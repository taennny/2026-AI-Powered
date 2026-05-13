from flask import Flask, request
from flask_restx import Api, Resource, fields
from flask_cors import CORS
from geopy.distance import geodesic
from dotenv import load_dotenv
import requests
import pandas as pd
import os
import logging

load_dotenv()

KAKAO_API_KEY = os.getenv("KAKAO_API_KEY")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 프론트 직접 호출 허용

api = Api(
    app,
    version="1.0",
    title="Roame AI 1 — GPS API",
    description="GPS 체류 감지 및 카카오 장소 매칭 API",
    doc="/swagger",
)

ns = api.namespace("api/ai", description="AI 분석")


# ──────────────────────────────────────────
# 체류 감지
# ──────────────────────────────────────────
STAY_RADIUS_M = 50       # 이 거리 이내면 체류로 판단
MIN_STAY_MINUTES = 3     # 최소 체류 시간 (분)

def detect_stays(gps_logs: list) -> list:
    """GPS 로그에서 체류 구간을 추출한다."""
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
                duration = (
                    current_stay["end_time"] - current_stay["start_time"]
                ).seconds // 60
                if duration >= MIN_STAY_MINUTES:
                    stays.append(current_stay)
                current_stay = None

    # 마지막 체류 처리
    if current_stay is not None:
        duration = (
            current_stay["end_time"] - current_stay["start_time"]
        ).seconds // 60
        if duration >= MIN_STAY_MINUTES:
            stays.append(current_stay)

    return stays


# ──────────────────────────────────────────
# 카카오 장소 매칭
# ──────────────────────────────────────────
KAKAO_CATEGORIES = ["FD6", "CE7", "AT4", "SW8"]  # 음식점, 카페, 관광, 지하철
KAKAO_SEARCH_RADIUS = 300  # 미터

def get_place_info(lat: float, lng: float) -> dict:
    """좌표 주변 카카오 장소 정보를 반환한다. 실패 시 기본값 반환."""
    if not KAKAO_API_KEY:
        logger.warning("KAKAO_API_KEY가 설정되지 않았습니다.")
        return {"place_name": "알 수 없음", "category": "", "place_id": "", "address": ""}

    headers = {"Authorization": f"KakaoAK {KAKAO_API_KEY}"}

    for code in KAKAO_CATEGORIES:
        try:
            params = {
                "x": lng,
                "y": lat,
                "radius": KAKAO_SEARCH_RADIUS,
                "sort": "distance",
                "category_group_code": code,
            }
            res = requests.get(
                "https://dapi.kakao.com/v2/local/search/category.json",
                headers=headers,
                params=params,
                timeout=5,  # 타임아웃 추가
            )
            res.raise_for_status()
            data = res.json()

            if data.get("documents"):
                place = data["documents"][0]
                return {
                    "place_name": place["place_name"],
                    "category": place["category_name"],
                    "place_id": place["id"],
                    "address": place["address_name"],
                }

        except requests.exceptions.Timeout:
            logger.warning("카카오 API 타임아웃 (category: %s)", code)
        except requests.exceptions.RequestException as e:
            logger.error("카카오 API 오류 (category: %s): %s", code, e)

    return {"place_name": "알 수 없음", "category": "", "place_id": "", "address": ""}


# ──────────────────────────────────────────
# API 엔드포인트
# ──────────────────────────────────────────
gps_log_model = api.model(
    "GPSLog",
    {
        "lat": fields.Float(required=True, description="위도"),
        "lng": fields.Float(required=True, description="경도"),
        "time": fields.String(required=True, description="시간 (ISO 8601 또는 HH:MM:SS)"),
    },
)

analyze_input = api.model(
    "AnalyzeInput",
    {
        "user_id": fields.String(required=True, description="유저 ID"),
        "date": fields.String(required=True, description="날짜 (YYYY-MM-DD)"),
        "gps_logs": fields.List(
            fields.Nested(gps_log_model), required=True, description="GPS 로그 목록"
        ),
    },
)

analyze_output = api.model(
    "AnalyzeOutput",
    {
        "user_id": fields.String,
        "date": fields.String,
        "places": fields.List(fields.Raw),
    },
)


@ns.route("/analyze")
class Analyze(Resource):
    @ns.expect(analyze_input)
    @ns.response(200, "성공", analyze_output)
    @ns.response(400, "잘못된 요청")
    @ns.response(500, "서버 오류")
    def post(self):
        """GPS 로그를 분석해 체류 장소 목록을 반환한다."""
        try:
            data = request.json or {}
            user_id = data.get("user_id", "")
            date = data.get("date", "")
            gps_logs = data.get("gps_logs", [])

            if not gps_logs:
                return {"error": "gps_logs가 비어있습니다."}, 400

            if len(gps_logs) < 2:
                return {"error": "GPS 로그가 최소 2개 이상 필요합니다."}, 400

            stays = detect_stays(gps_logs)

            places = []
            for stay in stays:
                place_info = get_place_info(stay["lat"], stay["lng"])
                duration_min = (
                    stay["end_time"] - stay["start_time"]
                ).seconds // 60

                places.append(
                    {
                        "place_name": place_info["place_name"],
                        "category": place_info["category"],
                        "place_id": place_info["place_id"],
                        "address": place_info["address"],
                        "arrived_at": stay["start_time"].isoformat(),
                        "left_at": stay["end_time"].isoformat(),
                        "duration_min": duration_min,
                        "lat": stay["lat"],
                        "lng": stay["lng"],
                    }
                )

            logger.info(
                "분석 완료 | user_id=%s date=%s 체류=%d곳",
                user_id,
                date,
                len(places),
            )

            return {"user_id": user_id, "date": date, "places": places}, 200

        except Exception as e:
            logger.error("분석 오류: %s", e)
            return {"error": str(e)}, 500


@app.route("/health")
def health():
    return {"status": "ok", "service": "roame-ai-1-gps"}, 200


if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)
