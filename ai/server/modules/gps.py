"""AI-1 — GPS 체류/이동 감지 + 카카오 장소 매칭.

엔드포인트: POST /api/ai/analyze

백엔드 연동 계약 (backend/app/services/ai.py · schemas/ai.py 기준)
  요청:  { "user_id": str, "gps_logs": [ { "time": ISO8601, "lat": float, "lng": float } ] }
  응답:  { "stays": [ { "place_name", "category", "start", "end",
                       "duration_min", "lat", "lng" } ] }

※ 현재 체류 감지는 거리 임계값 기반(baseline)이다.
  3단계에서 Isolation Forest + RandomForest 모델로 detect_stays 내부만 교체한다.
"""

import logging

import pandas as pd
import requests
from flask import request
from flask_restx import Namespace, Resource, fields
from geopy.distance import geodesic

from config import settings

logger = logging.getLogger(__name__)

ns = Namespace(
    "gps",
    path="/api/ai",
    description="GPS 체류 감지 및 카카오 장소 매칭 (AI-1)",
)

# ──────────────────────────────────────────
# 체류 감지 (baseline: 거리 임계값)
# ──────────────────────────────────────────
STAY_RADIUS_M = 50  # 이 거리 이내면 체류로 판단
MIN_STAY_MINUTES = 3  # 최소 체류 시간 (분)


def detect_stays(gps_logs: list) -> list:
    """GPS 로그에서 체류 구간을 추출한다.

    반환: [ { "start_time": Timestamp, "end_time": Timestamp,
              "lat": float, "lng": float } ]
    """
    if len(gps_logs) < 2:
        return []

    df = pd.DataFrame(gps_logs)
    df["time"] = pd.to_datetime(df["time"])
    df = df.sort_values("time").reset_index(drop=True)

    distances = []
    for i in range(len(df) - 1):
        p1 = (df.loc[i, "lat"], df.loc[i, "lng"])
        p2 = (df.loc[i + 1, "lat"], df.loc[i + 1, "lng"])
        distances.append(geodesic(p1, p2).meters)
    distances.append(0)

    df["distance_m"] = distances
    df["is_staying"] = df["distance_m"] < STAY_RADIUS_M

    stays = []
    current_stay = None

    for _, row in df.iterrows():
        if row["is_staying"]:
            if current_stay is None:
                current_stay = {
                    "start_time": row["time"],
                    "lat": row["lat"],
                    "lng": row["lng"],
                }
            current_stay["end_time"] = row["time"]
        else:
            if current_stay is not None:
                _append_if_valid(stays, current_stay)
                current_stay = None

    if current_stay is not None:
        _append_if_valid(stays, current_stay)

    return stays


def _append_if_valid(stays: list, stay: dict) -> None:
    duration_min = (stay["end_time"] - stay["start_time"]).total_seconds() // 60
    if duration_min >= MIN_STAY_MINUTES:
        stays.append(stay)


# ──────────────────────────────────────────
# 카카오 장소 매칭
# ──────────────────────────────────────────
KAKAO_CATEGORIES = ["FD6", "CE7", "AT4", "SW8"]  # 음식점, 카페, 관광, 지하철
KAKAO_SEARCH_RADIUS = 300  # 미터
_UNKNOWN_PLACE = {"place_name": "알 수 없음", "category": ""}


def get_place_info(lat: float, lng: float) -> dict:
    """좌표 주변 카카오 장소 정보를 반환한다. 실패 시 기본값 반환."""
    if not settings.KAKAO_API_KEY:
        logger.warning("KAKAO_API_KEY가 설정되지 않았습니다.")
        return dict(_UNKNOWN_PLACE)

    headers = {"Authorization": f"KakaoAK {settings.KAKAO_API_KEY}"}

    for code in KAKAO_CATEGORIES:
        try:
            res = requests.get(
                "https://dapi.kakao.com/v2/local/search/category.json",
                headers=headers,
                params={
                    "x": lng,
                    "y": lat,
                    "radius": KAKAO_SEARCH_RADIUS,
                    "sort": "distance",
                    "category_group_code": code,
                },
                timeout=5,
            )
            res.raise_for_status()
            documents = res.json().get("documents", [])
            if documents:
                place = documents[0]
                return {
                    "place_name": place["place_name"],
                    "category": place["category_name"],
                }
        except requests.exceptions.Timeout:
            logger.warning("카카오 API 타임아웃 (category: %s)", code)
        except requests.exceptions.RequestException as e:
            logger.error("카카오 API 오류 (category: %s): %s", code, e)

    return dict(_UNKNOWN_PLACE)


# ──────────────────────────────────────────
# API 모델 (Swagger 문서화)
# ──────────────────────────────────────────
gps_log_model = ns.model(
    "GPSLog",
    {
        "time": fields.String(required=True, description="시간 (ISO 8601)"),
        "lat": fields.Float(required=True, description="위도"),
        "lng": fields.Float(required=True, description="경도"),
    },
)

analyze_input = ns.model(
    "AnalyzeInput",
    {
        "user_id": fields.String(required=True, description="유저 ID"),
        "gps_logs": fields.List(
            fields.Nested(gps_log_model), required=True, description="GPS 로그 목록"
        ),
    },
)

stay_model = ns.model(
    "Stay",
    {
        "place_name": fields.String,
        "category": fields.String,
        "start": fields.String(description="체류 시작 (ISO 8601)"),
        "end": fields.String(description="체류 종료 (ISO 8601)"),
        "duration_min": fields.Integer,
        "lat": fields.Float,
        "lng": fields.Float,
    },
)

analyze_output = ns.model(
    "AnalyzeOutput",
    {"stays": fields.List(fields.Nested(stay_model))},
)


@ns.route("/analyze")
class Analyze(Resource):
    @ns.expect(analyze_input)
    @ns.response(200, "성공", analyze_output)
    @ns.response(400, "잘못된 요청")
    @ns.response(500, "서버 오류")
    def post(self):
        """GPS 로그를 분석해 체류 장소(stays) 목록을 반환한다."""
        try:
            data = request.json or {}
            user_id = data.get("user_id", "")
            gps_logs = data.get("gps_logs", [])

            if len(gps_logs) < 2:
                return {"error": "gps_logs는 최소 2개 이상 필요합니다."}, 400

            stays = []
            for stay in detect_stays(gps_logs):
                info = get_place_info(stay["lat"], stay["lng"])
                duration_min = int(
                    (stay["end_time"] - stay["start_time"]).total_seconds() // 60
                )
                stays.append(
                    {
                        "place_name": info["place_name"],
                        "category": info["category"],
                        "start": stay["start_time"].isoformat(),
                        "end": stay["end_time"].isoformat(),
                        "duration_min": duration_min,
                        "lat": float(stay["lat"]),
                        "lng": float(stay["lng"]),
                    }
                )

            logger.info("분석 완료 | user_id=%s 체류=%d곳", user_id, len(stays))
            return {"stays": stays}, 200

        except Exception as e:
            logger.error("분석 오류: %s", e)
            return {"error": str(e)}, 500
