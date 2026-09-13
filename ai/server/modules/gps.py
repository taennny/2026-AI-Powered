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
# 이 거리 이내면 같은 장소로 판단. 넓히면 인접한 서로 다른 장소(예: 옆 가게)가
# 한 체류로 합쳐지고, 좁히면 실내 GPS 튐에 취약해진다. 장소 구분을 우선해 50m로 둔다.
# (드리프트 조각화는 촘촘한 수집(distanceInterval=0) + accuracy 필터로 완화)
STAY_RADIUS_M = 50  # 이 거리 이내면 같은 장소로 판단
MIN_STAY_MINUTES = 10  # 최소 체류(분). 미만은 잠깐 멈춘 것으로 보고 버린다
# 수집 간격이 불규칙(백그라운드 스로틀 등)해도 같은 자리면 이어붙이도록 여유를 둔다.
# 이 값 이하 끊김은 하나의 체류로 잇고, 초과 시엔 경계로 본다.
GAP_BRIDGE_MINUTES = 5
# 실내 GPS는 정확도가 나빠(오차 ~150m) 임계값을 넉넉히 둔다. 너무 낮으면
# 카페·식당 같은 실내 체류의 점이 통째로 걸러져 체류가 사라진다.
ACCURACY_MAX_M = 200  # 이보다 나쁜(값 큰) 점만 노이즈로 제외
# 필터가 절반 넘게 지우면 그날 GPS가 전반적으로 나쁜 것 → 왜곡 방지 위해 원본 유지
ACCURACY_MIN_KEEP_RATIO = 0.5
# 체류 중심점을 accuracy(오차 반경)로 가중 평균한다 — 정확한 점일수록 크게 반영해
# 실내 드리프트로 튄 점이 중심을 끌고 가는 것을 줄인다. accuracy를 모르면(0/None)
# 이 값으로 가정해 중립적 무게를 준다.
DEFAULT_ACCURACY_M = 30


def _acc_weight(acc) -> float:
    """accuracy(오차 반경 m)를 가중치로 변환. 작을수록(정확할수록) 큰 가중치.

    0/None/NaN(모름)은 DEFAULT_ACCURACY_M로 본다. 1m 미만은 1로 눌러 과도한
    가중을 막는다(가끔 accuracy가 비현실적으로 작게 오는 경우 방지).
    """
    try:
        a = float(acc)
    except (TypeError, ValueError):
        a = 0.0
    if a != a or a <= 0:  # NaN 또는 0/음수 → 모름
        a = DEFAULT_ACCURACY_M
    return 1.0 / max(a, 1.0)


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
    span_min = (df["time"].iloc[-1] - df["time"].iloc[0]).total_seconds() / 60

    # 1) 앵커 기반 원시 군집화 (gap ≤ 3분 + 같은 자리 → 이어붙임)
    segments = []
    current = None
    for _, row in df.iterrows():
        t, lat, lng = row["time"], float(row["lat"]), float(row["lng"])
        acc = row.get("accuracy")  # 없으면 None (가중에서 중립 처리)
        if current is None:
            current = _new_segment(t, lat, lng, acc)
            continue
        gap_min = (t - current["last_time"]).total_seconds() / 60
        dist = geodesic((lat, lng), current["anchor"]).meters
        if gap_min <= GAP_BRIDGE_MINUTES and dist <= STAY_RADIUS_M:
            _extend_segment(current, t, lat, lng, acc)
        else:
            segments.append(current)
            current = _new_segment(t, lat, lng, acc)
    if current is not None:
        segments.append(current)
    n_raw = len(segments)

    # 2) 이동/이상치(단일 점) 제거 → GPS 튐으로 갈라진 인접 체류가 다시 붙도록
    segments = [s for s in segments if len(s["lats"]) >= 2]
    n_multi = len(segments)

    # 3) 같은 자리 + 짧은 간격(≤3분)으로 나뉜 체류 병합 (튐·앱 종료 복원)
    segments = _merge_adjacent(segments)

    # 4) 최소 체류시간 필터 + 중심점 확정
    stays = []
    for seg in segments:
        duration_min = (seg["end_time"] - seg["start_time"]).total_seconds() / 60
        if duration_min < MIN_STAY_MINUTES:
            continue
        # accuracy 가중 중심점 — 정확한 점을 크게 반영해 튄 점의 영향을 줄인다.
        # 모두 모름이면 가중치가 같아져 단순 평균과 동일하다.
        weights = [_acc_weight(a) for a in seg["accs"]]
        wsum = sum(weights)
        seg["lat"] = sum(x * w for x, w in zip(seg["lats"], weights)) / wsum
        seg["lng"] = sum(x * w for x, w in zip(seg["lngs"], weights)) / wsum
        stays.append(seg)

    logger.info(
        "detect_stays | 입력=%d 필터후=%d 시간범위=%.1f분 원시구간=%d 유효구간=%d 체류=%d",
        n_input,
        n_kept,
        span_min,
        n_raw,
        n_multi,
        len(stays),
    )
    return stays


def _new_segment(t, lat: float, lng: float, acc=None) -> dict:
    return {
        "start_time": t,
        "end_time": t,
        "last_time": t,
        "lats": [lat],
        "lngs": [lng],
        "accs": [acc],  # 점별 accuracy — 중심점 가중 평균에 쓴다
        "anchor": (lat, lng),
    }


def _extend_segment(seg: dict, t, lat: float, lng: float, acc=None) -> None:
    seg["end_time"] = t
    seg["last_time"] = t
    seg["lats"].append(lat)
    seg["lngs"].append(lng)
    seg["accs"].append(acc)
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
            prev["accs"] += seg["accs"]
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
# 라이프로그 장소 카테고리를 단계(tier)로 나눈다(순서 아닌 tier).
#   랜드마크: 관광명소·문화시설 같은 "큰 명소" — 그 안에 있으면 옆 카페·마트보다
#             명소 자체를 잡는다(롯데월드 안에서 롯데마트로 뜨는 문제 방지).
#   Tier1(체험형): 실제로 "가서 시간을 보낸" 목적지 — 그다음.
#   Tier2(기능형): 편의점·은행처럼 옆에 있으면 중심을 뺏어가는 노이즈 — 폴백.
# 이렇게 나눠야 밀집 지역에서 "옆 편의점/은행"이 식당·카페를, 또 "몰 안 마트"가
# 명소를 이기지 않는다. (각 tier는 tier 안에서만 거리 최소 우선 → _nearest_place)
KAKAO_LANDMARK = [
    "AT4",  # 관광명소 (테마파크·명소)
    "CT1",  # 문화시설 (박물관·공연장 등)
]
KAKAO_STAY_TIER1 = [
    "FD6",  # 음식점
    "CE7",  # 카페
    "AD5",  # 숙박
    "MT1",  # 대형마트
]
KAKAO_STAY_TIER2 = [
    "SC4",  # 학교
    "CS2",  # 편의점
    "AC5",  # 학원
    "HP8",  # 병원
    "BK9",  # 은행
    "PO3",  # 공공기관
]
# 이동 지점(지하철역 등) — 체류형 후보가 전혀 없을 때만 폴백으로 사용
KAKAO_TRANSIT_CATEGORIES = ["SW8"]

# ── 후보 목록 (타임라인 장소 수정용) ────────
# 자동 매칭과 달리 "사용자가 직접 고르게" 근처 장소를 여러 개 준다. tier 편향 없이
# 전 카테고리를 모아 거리순 정렬 → 상위 N개. (사람이 고르니 노이즈성 카테고리도 포함)
CANDIDATE_RADIUS_M = 150  # 후보는 넉넉히(드리프트 감안)
CANDIDATE_COUNT = 5  # 프론트에 줄 후보 개수
CANDIDATE_PER_CATEGORY = 5  # 카테고리당 수집 개수(합쳐 거리순 정렬)
CANDIDATE_CATEGORIES = (
    KAKAO_LANDMARK + KAKAO_STAY_TIER1 + KAKAO_STAY_TIER2 + KAKAO_TRANSIT_CATEGORIES
)

# ── 키워드 검색 (직접 입력용) ──────────────
# 사용자가 친 문자열로 근처에서 이름 부분일치 장소를 찾는다("스타벅"→"스타벅스 …점").
# 이름으로 좁혀지니 반경은 넉넉히, 거리순으로 준다.
SEARCH_RADIUS_M = 1000  # 키워드 검색 반경 (이름 일치로 좁혀지므로 넉넉히)
SEARCH_COUNT = 10  # 키워드 검색 최대 결과

PRIMARY_RADIUS_M = (
    50  # 체류 반경(50m)과 일치: 실제 머문 자리만 (밀집지역 옆건물 오매칭↓)
)
FALLBACK_RADIUS_M = 200  # 1차에서 못 찾으면 넓혀서 재시도
# 대형 명소(롯데월드 등)는 부지가 넓어 체류 중심이 마커에서 꽤 떨어질 수 있어
# PRIMARY(80)보다 넉넉히 준다. 너무 넓히면 옆 동네 작은 명소가 오매칭되므로 150m.
LANDMARK_RADIUS_M = 150
_UNKNOWN_PLACE = {"place_name": "알 수 없음", "category": ""}

# ── 캠퍼스 건물(학교부속시설) 매칭 ──────────
# 대학 강의동 등은 카카오에 POI로 있어도 category_group_code가 비어(예: "학교부속시설")
# 카테고리 검색으로는 안 잡힌다. 그래서 코드 있는 "옆 은행/ATM"이 이겨버린다.
# 근처에 학교(SC4)가 있으면 그 학교명으로 "키워드 검색+거리순"해 가장 가까운
# 캠퍼스 건물(강의동 등)을 찾아, 코드 없는 건물명까지 매칭한다.
CAMPUS_SCHOOL_RADIUS_M = 300  # 캠퍼스 마커(정문·본부)가 멀 수 있어 넉넉히
CAMPUS_BUILDING_MATCH_M = 60  # 키워드로 찾은 건물이 이보다 멀면 "여기 아님"으로 무시

# ── 국내/해외 하이브리드 라우팅 ────────────
# 카카오는 국내 전용이라 해외 좌표는 결과가 비어 "알 수 없음"이 된다.
# 좌표가 한국 대략 범위(bbox) 밖이면 구글 Places로 매칭한다.
# bbox는 본토+제주+울릉/독도를 넉넉히 포함(대마도 등 경계는 무시 가능한 예외).
_KOREA_BBOX = (33.0, 38.7, 124.5, 132.0)  # (lat_min, lat_max, lng_min, lng_max)

GOOGLE_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
GOOGLE_SEARCH_RADIUS_M = 100  # 체류 중심에서 이 반경 내 장소를 조회
# 구글 place type → 한글 카테고리(카카오와 톤 맞춤). 없으면 빈 문자열.
_GOOGLE_TYPE_KO = {
    "restaurant": "음식점",
    "cafe": "카페",
    "bar": "술집",
    "bakery": "베이커리",
    "food": "음식점",
    "tourist_attraction": "관광명소",
    "lodging": "숙박",
    "shopping_mall": "쇼핑몰",
    "store": "상점",
    "supermarket": "마트",
    "convenience_store": "편의점",
    "park": "공원",
    "museum": "박물관",
    "art_gallery": "미술관",
    "amusement_park": "놀이공원",
    "zoo": "동물원",
    "aquarium": "아쿠아리움",
    "school": "학교",
    "university": "대학교",
    "hospital": "병원",
    "bank": "은행",
    "subway_station": "지하철역",
    "train_station": "기차역",
    "airport": "공항",
}


def _in_korea(lat: float, lng: float) -> bool:
    """좌표가 국내(카카오 커버 범위) 대략 범위 안인지."""
    lat_min, lat_max, lng_min, lng_max = _KOREA_BBOX
    return lat_min <= lat <= lat_max and lng_min <= lng <= lng_max


def _google_nearby(lat: float, lng: float) -> list:
    """해외 좌표 주변 장소를 구글 Places(Nearby Search)로 조회. 실패/미설정 시 [].

    한 번의 호출로 주변 여러 장소를 받는다. language=ko 로 가능하면 한글 장소명.
    매칭(최근접 1곳)과 후보 목록이 공유하는 조회 부분.
    """
    if not settings.GOOGLE_MAPS_API_KEY:
        logger.warning("GOOGLE_MAPS_API_KEY 미설정 — 해외 좌표 매칭 생략")
        return []
    try:
        res = requests.get(
            GOOGLE_NEARBY_URL,
            params={
                "location": f"{lat},{lng}",
                "radius": GOOGLE_SEARCH_RADIUS_M,
                "language": "ko",
                "key": settings.GOOGLE_MAPS_API_KEY,
            },
            timeout=5,
        )
        res.raise_for_status()
        body = res.json()
        status_code = body.get("status")
        if status_code not in ("OK", "ZERO_RESULTS"):
            # REQUEST_DENIED(키/결제 문제) 등은 원인 파악 위해 남긴다.
            logger.error(
                "구글 Places 오류: status=%s msg=%s",
                status_code,
                body.get("error_message", ""),
            )
            return []
        return body.get("results", [])
    except requests.exceptions.Timeout:
        logger.warning("구글 Places 타임아웃")
        return []
    except requests.exceptions.RequestException as e:
        logger.error("구글 Places 요청 실패: %s", e)
        return []


def _google_dist(lat: float, lng: float, r: dict) -> float:
    loc = r.get("geometry", {}).get("location", {})
    rlat, rlng = loc.get("lat"), loc.get("lng")
    if rlat is None or rlng is None:
        return float("inf")
    return geodesic((lat, lng), (rlat, rlng)).meters


def _google_category(r: dict) -> str:
    types = r.get("types", [])
    return next((_GOOGLE_TYPE_KO[t] for t in types if t in _GOOGLE_TYPE_KO), "")


def _google_place_info(lat: float, lng: float) -> dict | None:
    """해외 좌표를 구글 Places로 매칭해 최근접 1곳 반환. 실패/미설정 시 None."""
    results = _google_nearby(lat, lng)
    if not results:
        return None
    nearest = min(results, key=lambda r: _google_dist(lat, lng, r))
    name = nearest.get("name")
    if not name:
        return None
    return {"place_name": name, "category": _google_category(nearest)}


def _google_candidates(lat: float, lng: float, exclude=None) -> list:
    """해외 좌표 주변 장소 후보를 거리순 최대 CANDIDATE_COUNT개 반환.

    exclude(현재 매칭된 장소명)가 주어지면 그 이름은 후보에서 제외한다.
    """
    scored = []
    for r in _google_nearby(lat, lng):
        item = _google_item(lat, lng, r)
        if item is not None:
            scored.append((item["distance_m"], item))
    scored.sort(key=lambda x: (x[0] is None, x[0]))
    items = [c for _, c in scored]
    if exclude:
        items = [c for c in items if c["place_name"] != exclude]
    return items[:CANDIDATE_COUNT]


def _google_item(lat: float, lng: float, r: dict) -> dict | None:
    """구글 결과 1건을 표준 후보 형식으로. 이름 없으면 None."""
    name = r.get("name")
    if not name:
        return None
    loc = r.get("geometry", {}).get("location", {})
    dist = _google_dist(lat, lng, r)
    return {
        "place_name": name,
        "category": _google_category(r),
        "address": r.get("vicinity") or r.get("formatted_address") or "",
        "distance_m": int(dist) if dist != float("inf") else None,
        "lat": loc.get("lat"),
        "lng": loc.get("lng"),
        "place_id": r.get("place_id"),
    }


def get_place_info(lat: float, lng: float) -> dict:
    """좌표에 가장 가까운 장소를 반환한다. 실패 시 기본값.

    국내/해외 하이브리드:
      - 국내(bbox 안): 카카오 로컬 (아래 흐름)
      - 해외(bbox 밖): 구글 Places (카카오는 국내 전용이라 결과 없음)

    국내 카카오 흐름 — 카테고리 순서가 아니라 tier + 실제 거리로 선택한다:
      1) 랜드마크(관광명소·문화시설) — 그 명소 위(≤150m)면 옆 카페·마트보다 우선
      2) 체험형(Tier1) 최단거리 (좁은 반경 → 없으면 넓혀서)
      3) 캠퍼스 건물(학교부속시설) — 학교 안이면 옆 은행보다 강의동을 우선
      4) 기능형(Tier2) 최단거리 (편의점·은행 등)
      5) 그래도 없으면 이동 지점(지하철 등)까지 포함
      6) 그래도 없으면 좌표→주소 역지오코딩으로 대략적 위치(동네)
    """
    if not _in_korea(lat, lng):
        return _google_place_info(lat, lng) or dict(_UNKNOWN_PLACE)

    if not settings.KAKAO_API_KEY:
        logger.warning("KAKAO_API_KEY가 설정되지 않았습니다.")
        return dict(_UNKNOWN_PLACE)

    # 1) 랜드마크 우선 — 큰 명소 안에선 옆 카페·마트가 아니라 명소 자체를
    best = _nearest_place(lat, lng, KAKAO_LANDMARK, LANDMARK_RADIUS_M)
    # 2) 체험형 (캠퍼스 안 식당·카페도 여기서 잡힌다)
    if best is None:
        best = _nearest_place(lat, lng, KAKAO_STAY_TIER1, PRIMARY_RADIUS_M)
    if best is None:
        best = _nearest_place(lat, lng, KAKAO_STAY_TIER1, FALLBACK_RADIUS_M)
    # 3) 캠퍼스 건물 — 기능형(은행 등)보다 먼저 시도 (강의동이 은행보다 의미있다)
    if best is None:
        best = _campus_building(lat, lng)
    # 4) 기능형 (편의점·은행 등)
    if best is None:
        best = _nearest_place(lat, lng, KAKAO_STAY_TIER2, PRIMARY_RADIUS_M)
    if best is None:
        best = _nearest_place(lat, lng, KAKAO_STAY_TIER2, FALLBACK_RADIUS_M)
    # 5) 이동 지점(지하철 등)
    if best is None:
        best = _nearest_place(lat, lng, KAKAO_TRANSIT_CATEGORIES, FALLBACK_RADIUS_M)
    # 6) POI 없으면 동네 이름이라도
    if best is None:
        best = _reverse_geocode(lat, lng)
    return best or dict(_UNKNOWN_PLACE)


def _kakao_doc_to_item(d: dict) -> dict | None:
    """카카오 장소 document 1건을 표준 후보/검색 형식으로. 좌표 없으면 None."""
    try:
        clat, clng = float(d["y"]), float(d["x"])
    except (KeyError, TypeError, ValueError):
        return None
    return {
        "place_name": d.get("place_name", ""),
        "category": d.get("category_name", ""),
        "address": d.get("road_address_name") or d.get("address_name") or "",
        "distance_m": int(d.get("distance") or 0),
        "lat": clat,
        "lng": clng,
        "place_id": d.get("id"),
    }


def get_place_candidates(lat: float, lng: float, exclude=None) -> list:
    """좌표 근처 장소 후보를 거리순 최대 CANDIDATE_COUNT개 반환 (타임라인 수정용).

    자동 매칭(get_place_info)은 tier로 1곳을 고르지만, 후보 목록은 사용자가 직접
    고르므로 tier 편향 없이 전 카테고리를 모아 거리순으로 준다. 국내는 카카오,
    해외는 구글. 각 후보: place_name/category/address/distance_m/lat/lng/place_id.

    exclude(현재 매칭된 장소명)가 주어지면 그 이름은 후보에서 빼서 준다 —
    "지금 카드에 떠있는 값"을 다시 보여주지 않기 위함(백엔드가 현재 place_name 전달).
    """
    if not _in_korea(lat, lng):
        return _google_candidates(lat, lng, exclude)

    if not settings.KAKAO_API_KEY:
        logger.warning("KAKAO_API_KEY 미설정 — 후보 없음")
        return []

    seen = set()
    scored = []  # (distance_m, candidate)
    for code in CANDIDATE_CATEGORIES:
        for d in _category_search_docs(
            lat, lng, code, CANDIDATE_RADIUS_M, CANDIDATE_PER_CATEGORY
        ):
            pid = d.get("id")
            if pid and pid in seen:
                continue
            item = _kakao_doc_to_item(d)
            if item is None:
                continue
            if pid:
                seen.add(pid)
            scored.append((item["distance_m"], item))
    scored.sort(key=lambda x: x[0])
    items = [c for _, c in scored]
    if exclude:
        items = [c for c in items if c["place_name"] != exclude]
    return items[:CANDIDATE_COUNT]


def search_places(lat: float, lng: float, query: str) -> list:
    """사용자가 친 문자열로 근처 장소를 이름 부분일치 검색해 거리순 반환.

    직접 입력용 — "스타벅"이면 "스타벅스 …점"들이 뜬다(카카오 키워드 검색 부분일치).
    국내는 카카오, 해외는 구글 텍스트 검색. 후보와 같은 형식.
    """
    query = (query or "").strip()
    if not query:
        return []
    if not _in_korea(lat, lng):
        return _google_text_search(lat, lng, query)
    if not settings.KAKAO_API_KEY:
        logger.warning("KAKAO_API_KEY 미설정 — 검색 없음")
        return []
    items = []
    for d in _keyword_nearest(lat, lng, query, SEARCH_RADIUS_M)[:SEARCH_COUNT]:
        item = _kakao_doc_to_item(d)
        if item is not None:
            items.append(item)
    return items


def _google_text_search(lat: float, lng: float, query: str) -> list:
    """해외 키워드 검색(구글 Text Search). 실패/미설정 시 []."""
    if not settings.GOOGLE_MAPS_API_KEY:
        logger.warning("GOOGLE_MAPS_API_KEY 미설정 — 해외 검색 생략")
        return []
    try:
        res = requests.get(
            "https://maps.googleapis.com/maps/api/place/textsearch/json",
            params={
                "query": query,
                "location": f"{lat},{lng}",
                "radius": SEARCH_RADIUS_M,
                "language": "ko",
                "key": settings.GOOGLE_MAPS_API_KEY,
            },
            timeout=5,
        )
        res.raise_for_status()
        body = res.json()
        if body.get("status") not in ("OK", "ZERO_RESULTS"):
            logger.error(
                "구글 Text Search 오류: status=%s msg=%s",
                body.get("status"),
                body.get("error_message", ""),
            )
            return []
        scored = []
        for r in body.get("results", []):
            item = _google_item(lat, lng, r)
            if item is not None:
                scored.append((item["distance_m"], item))
        scored.sort(key=lambda x: (x[0] is None, x[0]))
        return [c for _, c in scored[:SEARCH_COUNT]]
    except requests.exceptions.RequestException as e:
        logger.warning("구글 Text Search 실패: %s", e)
        return []


def _category_search_docs(
    lat: float, lng: float, code: str, radius_m: int, size: int
) -> list:
    """한 카테고리의 근처 장소 documents를 거리순으로 최대 size개 반환. 실패 시 [].

    _nearest_place는 최근접 1개만 쓰지만, 후보 목록은 카테고리당 여러 개가 필요하다.
    """
    headers = {"Authorization": f"KakaoAK {settings.KAKAO_API_KEY}"}
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
                "size": size,
            },
            timeout=5,
        )
        res.raise_for_status()
        return res.json().get("documents", [])
    except requests.exceptions.RequestException as e:
        logger.warning("카카오 카테고리 검색 실패 (%s): %s", code, e)
        return []


def _campus_building(lat: float, lng: float) -> dict | None:
    """학교 안이면 카테고리 코드 없는 캠퍼스 건물(강의동 등)까지 매칭. 없으면 None.

    카카오 카테고리 검색은 category_group_code 있는 POI만 준다. 대학 강의동은
    코드가 비어("학교부속시설") 카테고리로는 안 잡히고, 코드 있는 옆 은행/ATM이
    이겨버린다. 그래서:
      1) 근처에 학교(SC4)가 있는지 확인 → 있으면 그 학교명을 얻는다
      2) 학교명으로 키워드 검색(좌표 거리순) → 가장 가까운 캠퍼스 건물
      3) 그 건물이 충분히 가까우면(≤CAMPUS_BUILDING_MATCH_M) 건물명으로 매칭
    가까운 건물이 없으면(그 학교에 붙어있지 않으면) None을 돌려 다음 단계로 넘긴다.
    """
    school = _nearest_place(lat, lng, ["SC4"], CAMPUS_SCHOOL_RADIUS_M)
    if school is None:
        return None
    # 학교명으로 키워드 검색 — "경기대학교"가 "경기대학교 …종합강의동"을 토큰 매칭한다
    docs = _keyword_nearest(lat, lng, school["place_name"], CAMPUS_SCHOOL_RADIUS_M)
    if not docs:
        return None
    nearest = docs[0]  # sort=distance → 우리 중심에서 가장 가까운 캠퍼스 POI
    distance_m = int(nearest.get("distance") or 0)
    if distance_m > CAMPUS_BUILDING_MATCH_M:
        return None  # 그 학교 건물이 곁에 없음 → 여기가 캠퍼스 안이 아니다
    return {
        "place_name": nearest["place_name"],
        "category": nearest.get("category_name", ""),
    }


def _keyword_nearest(lat: float, lng: float, query: str, radius_m: int) -> list:
    """카카오 키워드 검색을 좌표 거리순으로 조회해 documents 리스트 반환. 실패 시 [].

    category_group_code 없는 POI(학교부속시설 등)도 잡히는 유일한 경로다.
    x,y를 주면 각 결과에 중심으로부터의 distance(m)가 채워진다.
    """
    headers = {"Authorization": f"KakaoAK {settings.KAKAO_API_KEY}"}
    try:
        res = requests.get(
            "https://dapi.kakao.com/v2/local/search/keyword.json",
            headers=headers,
            params={
                "query": query,
                "x": lng,
                "y": lat,
                "radius": radius_m,
                "sort": "distance",
            },
            timeout=5,
        )
        res.raise_for_status()
        return res.json().get("documents", [])
    except requests.exceptions.Timeout:
        logger.warning("카카오 키워드 검색 타임아웃 (query: %s)", query)
        return []
    except requests.exceptions.RequestException as e:
        logger.error("카카오 키워드 검색 오류 (query: %s): %s", query, e)
        return []


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

candidate_model = ns.model(
    "Candidate",
    {
        "place_name": fields.String,
        "category": fields.String,
        "address": fields.String,
        "distance_m": fields.Integer(description="체류 중심에서의 거리(m)"),
        "lat": fields.Float,
        "lng": fields.Float,
        "place_id": fields.String(description="카카오/구글 장소 ID (저장 참고용)"),
    },
)

candidates_output = ns.model(
    "CandidatesOutput",
    {"candidates": fields.List(fields.Nested(candidate_model))},
)

search_output = ns.model(
    "SearchOutput",
    {"results": fields.List(fields.Nested(candidate_model))},
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
            # 내부 예외 메시지는 로그에만, 응답은 일반 메시지 (내부정보 노출 방지)
            return {"error": "분석 중 오류가 발생했습니다."}, 500


@ns.route("/candidates")
class Candidates(Resource):
    @ns.doc(
        params={
            "lat": "위도",
            "lng": "경도",
            "exclude": "현재 매칭된 장소명(후보에서 제외). 선택",
        }
    )
    @ns.response(200, "성공", candidates_output)
    @ns.response(400, "잘못된 요청")
    @ns.response(500, "서버 오류")
    def get(self):
        """좌표 근처 장소 후보(거리순, 최대 5개). 타임라인 장소 수정 UI용.

        exclude 로 현재 카드의 장소명을 주면 그 장소는 후보에서 빠진다.
        """
        try:
            lat = float(request.args.get("lat", ""))
            lng = float(request.args.get("lng", ""))
        except (TypeError, ValueError):
            return {"error": "lat, lng 쿼리 파라미터(숫자)가 필요합니다."}, 400
        exclude = request.args.get("exclude") or None
        try:
            candidates = get_place_candidates(lat, lng, exclude)
            return {"candidates": candidates}, 200
        except Exception as e:
            logger.error("후보 조회 오류: %s", e)
            return {"error": "후보 조회 중 오류가 발생했습니다."}, 500


@ns.route("/search")
class Search(Resource):
    @ns.doc(params={"lat": "위도", "lng": "경도", "query": "검색어(부분일치)"})
    @ns.response(200, "성공", search_output)
    @ns.response(400, "잘못된 요청")
    @ns.response(500, "서버 오류")
    def get(self):
        """좌표 근처에서 이름 부분일치 장소 검색(거리순). 직접 입력용.

        예: query=스타벅 → "스타벅스 …점" 목록. 응답은 후보와 같은 형식.
        """
        try:
            lat = float(request.args.get("lat", ""))
            lng = float(request.args.get("lng", ""))
        except (TypeError, ValueError):
            return {"error": "lat, lng 쿼리 파라미터(숫자)가 필요합니다."}, 400
        query = request.args.get("query", "")
        if not query.strip():
            return {"error": "query 쿼리 파라미터가 필요합니다."}, 400
        try:
            results = search_places(lat, lng, query)
            return {"results": results}, 200
        except Exception as e:
            logger.error("검색 오류: %s", e)
            return {"error": "검색 중 오류가 발생했습니다."}, 500
