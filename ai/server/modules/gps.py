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
STAY_RADIUS_M = 50  # 이 거리 이내면 같은 장소로 판단
MIN_STAY_MINUTES = 3  # 최소 체류 시간 (분)
# 정상 GPS 수집 간격은 30초. 그보다 큰 끊김이라도 이 값 이하이고 같은 자리면
# (앱이 잠깐 종료돼 GPS가 끊긴 경우 등) 하나의 체류로 이어붙인다. 초과 시엔 경계.
GAP_BRIDGE_MINUTES = 3
# 실내 GPS는 정확도가 나빠(오차 ~150m) 임계값을 넉넉히 둔다. 너무 낮으면
# 카페·식당 같은 실내 체류의 점이 통째로 걸러져 체류가 사라진다.
ACCURACY_MAX_M = 200  # 이보다 나쁜(값 큰) 점만 노이즈로 제외
# 필터가 절반 넘게 지우면 그날 GPS가 전반적으로 나쁜 것 → 왜곡 방지 위해 원본 유지
ACCURACY_MIN_KEEP_RATIO = 0.5


def _filter_by_accuracy(gps_logs: list) -> list:
    """정확도가 매우 나쁜(accuracy 값이 큰) GPS 점만 제외한다.

    accuracy 는 오차 반경(m)이라 값이 클수록 부정확. 프론트가 '값 없음'을 0으로
    보내므로(accuracy ?? 0) 0/None 은 '모름'으로 보고 유지한다.
    한 장소의 점을 통째로 날려 체류가 사라지는 것을 막기 위해:
      - 임계값을 넉넉히(200m) 두어 실내 GPS를 보존하고,
      - 필터가 점을 절반 넘게 지우면(그날 GPS 전반 불량) 원본을 그대로 쓴다.
    """
    filtered = [
        log
        for log in gps_logs
        if not log.get("accuracy") or log["accuracy"] <= ACCURACY_MAX_M
    ]
    if len(filtered) < 2 or len(filtered) < len(gps_logs) * ACCURACY_MIN_KEEP_RATIO:
        return gps_logs
    return filtered


def detect_stays(gps_logs: list) -> list:
    """GPS 로그에서 체류 구간을 추출한다.

    앵커(체류 중심점) 기준으로 군집화하며, 정상 간격을 넘는 GPS 끊김도
    GAP_BRIDGE_MINUTES 이하이고 같은 자리면 하나의 체류로 이어붙인다.

    반환: [ { "start_time", "end_time", "lat", "lng" } ]  (lat/lng = 중심점)
    """
    if len(gps_logs) < 2:
        return []

    n_input = len(gps_logs)
    gps_logs = _filter_by_accuracy(gps_logs)
    n_kept = len(gps_logs)

    df = pd.DataFrame(gps_logs)
    # ISO8601 유연 파싱: 마이크로초 유무·Z/오프셋 혼합 허용, 모두 UTC로 정규화
    # (기본 추론은 첫 값 포맷을 전체에 적용해 정밀도가 섞이면 실패함)
    df["time"] = pd.to_datetime(df["time"], format="ISO8601", utc=True)
    df = df.sort_values("time").reset_index(drop=True)

    # 1) 앵커 기반 원시 군집화 (gap ≤ 3분 + 같은 자리 → 이어붙임)
    segments = []
    current = None
    for _, row in df.iterrows():
        t, lat, lng = row["time"], float(row["lat"]), float(row["lng"])
        if current is None:
            current = _new_segment(t, lat, lng)
            continue
        gap_min = (t - current["last_time"]).total_seconds() / 60
        dist = geodesic((lat, lng), current["anchor"]).meters
        if gap_min <= GAP_BRIDGE_MINUTES and dist <= STAY_RADIUS_M:
            _extend_segment(current, t, lat, lng)
        else:
            segments.append(current)
            current = _new_segment(t, lat, lng)
    if current is not None:
        segments.append(current)

    # 2) 이동/이상치(단일 점) 제거 → GPS 튐으로 갈라진 인접 체류가 다시 붙도록
    segments = [s for s in segments if len(s["lats"]) >= 2]

    # 3) 같은 자리 + 짧은 간격(≤3분)으로 나뉜 체류 병합 (튐·앱 종료 복원)
    segments = _merge_adjacent(segments)

    # 4) 최소 체류시간 필터 + 중심점 확정
    stays = []
    for seg in segments:
        duration_min = (seg["end_time"] - seg["start_time"]).total_seconds() / 60
        if duration_min < MIN_STAY_MINUTES:
            continue
        seg["lat"] = sum(seg["lats"]) / len(seg["lats"])
        seg["lng"] = sum(seg["lngs"]) / len(seg["lngs"])
        stays.append(seg)

    logger.info(
        "detect_stays | 입력=%d 정확도필터후=%d 체류=%d",
        n_input,
        n_kept,
        len(stays),
    )
    return stays


def _new_segment(t, lat: float, lng: float) -> dict:
    return {
        "start_time": t,
        "end_time": t,
        "last_time": t,
        "lats": [lat],
        "lngs": [lng],
        "anchor": (lat, lng),
    }


def _extend_segment(seg: dict, t, lat: float, lng: float) -> None:
    seg["end_time"] = t
    seg["last_time"] = t
    seg["lats"].append(lat)
    seg["lngs"].append(lng)
    # 앵커를 running centroid로 갱신 — 점이 쌓일수록 한두 점 튐에 견고
    seg["anchor"] = (
        sum(seg["lats"]) / len(seg["lats"]),
        sum(seg["lngs"]) / len(seg["lngs"]),
    )


def _merge_adjacent(segments: list) -> list:
    """같은 자리 + 짧은 간격(≤GAP_BRIDGE_MINUTES)으로 나뉜 인접 체류를 병합한다."""
    if not segments:
        return segments
    merged = [segments[0]]
    for seg in segments[1:]:
        prev = merged[-1]
        gap_min = (seg["start_time"] - prev["end_time"]).total_seconds() / 60
        dist = geodesic(seg["anchor"], prev["anchor"]).meters
        if gap_min <= GAP_BRIDGE_MINUTES and dist <= STAY_RADIUS_M:
            prev["end_time"] = seg["end_time"]
            prev["lats"] += seg["lats"]
            prev["lngs"] += seg["lngs"]
            prev["anchor"] = (
                sum(prev["lats"]) / len(prev["lats"]),
                sum(prev["lngs"]) / len(prev["lngs"]),
            )
        else:
            merged.append(seg)
    return merged


# ──────────────────────────────────────────
# 카카오 장소 매칭
# ──────────────────────────────────────────
# 라이프로그 "체류형" 장소 카테고리. 순서에 의존하지 않고(아래 _nearest_place)
# 전부 조회해 최단거리를 고른다.
#   FD6 음식점 / CE7 카페 / AT4 관광명소 / CT1 문화시설 /
#   AD5 숙박 / MT1 대형마트 / CS2 편의점
KAKAO_STAY_CATEGORIES = ["FD6", "CE7", "AT4", "CT1", "AD5", "MT1", "CS2"]
# 이동 지점(지하철역 등) — 체류형 후보가 전혀 없을 때만 폴백으로 사용
KAKAO_TRANSIT_CATEGORIES = ["SW8"]

PRIMARY_RADIUS_M = 80  # 체류 반경(50m)에 가깝게: 실제 머문 자리 우선
FALLBACK_RADIUS_M = 200  # 1차에서 못 찾으면 넓혀서 재시도
_UNKNOWN_PLACE = {"place_name": "알 수 없음", "category": ""}


def get_place_info(lat: float, lng: float) -> dict:
    """좌표에 가장 가까운 카카오 장소를 반환한다. 실패 시 기본값.

    카테고리 순서가 아니라 실제 거리로 선택한다:
      1) 체류형 카테고리 전역 최단거리 (좁은 반경 → 없으면 넓혀서)
      2) 그래도 없으면 이동 지점(지하철 등)까지 포함
      3) 그래도 없으면 좌표→주소 역지오코딩으로 대략적 위치(동네)
    """
    if not settings.KAKAO_API_KEY:
        logger.warning("KAKAO_API_KEY가 설정되지 않았습니다.")
        return dict(_UNKNOWN_PLACE)

    best = _nearest_place(lat, lng, KAKAO_STAY_CATEGORIES, PRIMARY_RADIUS_M)
    if best is None:
        best = _nearest_place(lat, lng, KAKAO_STAY_CATEGORIES, FALLBACK_RADIUS_M)
    if best is None:
        best = _nearest_place(lat, lng, KAKAO_TRANSIT_CATEGORIES, FALLBACK_RADIUS_M)
    if best is None:
        best = _reverse_geocode(lat, lng)  # POI 없으면 동네 이름이라도
    return best or dict(_UNKNOWN_PLACE)


def _nearest_place(
    lat: float, lng: float, categories: list, radius_m: int
) -> dict | None:
    """여러 카테고리를 모두 조회해 카카오 distance 기준 최단거리 1곳 반환.

    카테고리 목록 순서에 의존하지 않는다(거리 최소 우선). 후보 없으면 None.
    """
    headers = {"Authorization": f"KakaoAK {settings.KAKAO_API_KEY}"}
    best = None  # (distance_m, place_dict)

    for code in categories:
        try:
            res = requests.get(
                "https://dapi.kakao.com/v2/local/search/category.json",
                headers=headers,
                params={
                    "x": lng,
                    "y": lat,
                    "radius": radius_m,
                    "sort": "distance",
                    "category_group_code": code,
                },
                timeout=5,
            )
            res.raise_for_status()
            documents = res.json().get("documents", [])
            if not documents:
                continue
            nearest = documents[0]  # sort=distance → 그 카테고리 내 최근접
            distance_m = int(nearest.get("distance") or 0)
            if best is None or distance_m < best[0]:
                best = (
                    distance_m,
                    {
                        "place_name": nearest["place_name"],
                        "category": nearest["category_name"],
                    },
                )
        except requests.exceptions.Timeout:
            logger.warning("카카오 API 타임아웃 (category: %s)", code)
        except requests.exceptions.RequestException as e:
            logger.error("카카오 API 오류 (category: %s): %s", code, e)

    return best[1] if best else None


def _reverse_geocode(lat: float, lng: float) -> dict | None:
    """POI 매칭 실패 시 좌표를 대략적 위치(행정동)로 변환. 실패 시 None.

    카카오 coord2address 로 동 단위 지역명을 얻는다. 정확한 지번/도로명이
    아니라 '○○동 인근' 수준의 대략적 위치다.
    """
    headers = {"Authorization": f"KakaoAK {settings.KAKAO_API_KEY}"}
    try:
        res = requests.get(
            "https://dapi.kakao.com/v2/local/geo/coord2address.json",
            headers=headers,
            params={"x": lng, "y": lat},
            timeout=5,
        )
        res.raise_for_status()
        documents = res.json().get("documents", [])
        if not documents:
            return None
        addr = documents[0].get("address") or {}
        region = (
            addr.get("region_3depth_name")  # 동
            or addr.get("region_2depth_name")  # 구
            or addr.get("region_1depth_name")  # 시/도
        )
        if not region:
            return None
        return {"place_name": f"{region} 인근", "category": "위치"}
    except requests.exceptions.RequestException as e:
        logger.warning("역지오코딩 실패: %s", e)
        return None


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

            logger.info(
                "분석 완료 | user_id=%s 입력=%d 체류=%d곳",
                user_id,
                len(gps_logs),
                len(stays),
            )
            return {"stays": stays}, 200

        except Exception as e:
            logger.error("분석 오류: %s", e)
            return {"error": str(e)}, 500
