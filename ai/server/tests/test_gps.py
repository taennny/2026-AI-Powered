"""AI-1 GPS 체류 감지 + 장소 매칭 테스트."""

from datetime import datetime, timedelta, timezone

import pytest

from config import settings
from modules import gps


def _log(t: datetime, lat: float, lng: float, accuracy: float | None = None) -> dict:
    log = {"time": t.isoformat(), "lat": lat, "lng": lng}
    if accuracy is not None:
        log["accuracy"] = accuracy
    return log


# ──────────────────────────────────────────
# 체류 감지: 중심점(centroid)
# ──────────────────────────────────────────
def test_detect_stays_uses_centroid():
    """매칭 좌표는 첫 점이 아니라 체류 구간 평균(centroid)이어야 한다."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    logs = [
        _log(base, 37.5000, 127.0000),
        _log(base + timedelta(minutes=5), 37.5002, 127.0002),  # 간격 5분(≤GAP_BRIDGE)
        _log(base + timedelta(minutes=10), 37.5001, 127.0001),  # 총 10분(≥MIN_STAY)
    ]
    stays = gps.detect_stays(logs)
    assert len(stays) == 1
    assert stays[0]["lat"] == pytest.approx((37.5000 + 37.5002 + 37.5001) / 3)
    assert stays[0]["lng"] == pytest.approx((127.0000 + 127.0002 + 127.0001) / 3)


def test_detect_stays_mixed_timestamp_precision():
    """마이크로초 있는/없는 ISO8601 시각이 섞여도 파싱 실패하지 않는다 (prod 500 재현)."""
    logs = [
        {"time": "2026-08-24T06:24:57.123456Z", "lat": 37.5, "lng": 127.0},
        {"time": "2026-08-24T06:29:57Z", "lat": 37.5, "lng": 127.0},  # 마이크로초 없음
        {"time": "2026-08-24T06:34:57Z", "lat": 37.5, "lng": 127.0},  # 간격 5분씩
        {"time": "2026-08-24T06:39:57Z", "lat": 37.5, "lng": 127.0},  # 총 ~15분(≥10)
    ]
    stays = gps.detect_stays(logs)  # 예전엔 여기서 ValueError → 500
    assert len(stays) == 1


def test_detect_stays_skips_short_stays():
    """MIN_STAY_MINUTES 미만은 체류로 보지 않는다."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    logs = [
        _log(base, 37.5, 127.0),
        _log(base + timedelta(minutes=1), 37.5, 127.0),  # 1분뿐
    ]
    assert gps.detect_stays(logs) == []


def _stay_run(base, start_min, end_min, lat=37.5, lng=127.0, step=1):
    """[start_min, end_min] 구간을 step분 간격으로 같은 좌표 로그 생성."""
    return [
        _log(base + timedelta(minutes=m), lat, lng)
        for m in range(start_min, end_min + 1, step)
    ]


def test_bridges_short_gap_same_location():
    """앱이 잠깐 죽어 GPS가 ≤5분 끊겨도, 같은 자리면 한 체류로 이어붙인다."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    logs = [
        _log(base, 37.5, 127.0),
        _log(base + timedelta(minutes=1), 37.5, 127.0),
        _log(base + timedelta(minutes=2), 37.5, 127.0),
        # 여기서 3분 끊김(앱 종료) — base+2 → base+5
        _log(base + timedelta(minutes=5), 37.5, 127.0),
        _log(base + timedelta(minutes=6), 37.5, 127.0),
        _log(base + timedelta(minutes=9), 37.5, 127.0),
        _log(base + timedelta(minutes=12), 37.5, 127.0),  # 총 12분(≥10)
    ]
    stays = gps.detect_stays(logs)
    assert len(stays) == 1
    dur = (stays[0]["end_time"] - stays[0]["start_time"]).total_seconds() / 60
    assert dur == pytest.approx(12)  # 끊긴 구간까지 포함해 하나로


def test_long_gap_splits():
    """GAP_BRIDGE_MINUTES 초과 끊김은 경계로 봐서 나눈다 (그동안 뭘 했는지 모르므로)."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    # 각 구간 12분(≥10) + 사이 12분 공백(>5분)
    logs = _stay_run(base, 0, 12) + _stay_run(base, 24, 36)
    stays = gps.detect_stays(logs)
    assert len(stays) == 2


def test_jitter_outlier_does_not_split():
    """한두 점 튐(반경 밖)이 있어도 같은 자리 체류는 쪼개지지 않는다."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    logs = [
        _log(base, 37.5, 127.0),
        _log(base + timedelta(minutes=2), 37.5, 127.0),
        _log(base + timedelta(minutes=4), 37.5, 127.0),
        _log(base + timedelta(minutes=6), 37.5006, 127.0),  # ~66m 튐(반경 밖, 단일)
        _log(base + timedelta(minutes=8), 37.5, 127.0),
        _log(base + timedelta(minutes=10), 37.5, 127.0),
        _log(base + timedelta(minutes=12), 37.5, 127.0),  # 총 12분(≥10)
    ]
    stays = gps.detect_stays(logs)
    assert len(stays) == 1


def test_drift_within_radius_kept_as_one_stay():
    """반경 내 GPS 드리프트(~30m)로 흔들려도 한 체류로 잡는다."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    logs = [
        _log(base, 37.5, 127.0),
        _log(base + timedelta(minutes=4), 37.5003, 127.0),  # ~33m
        _log(base + timedelta(minutes=8), 37.5, 127.0003),  # ~26m
        _log(base + timedelta(minutes=12), 37.5002, 127.0001),  # 근처, 총 12분(≥10)
    ]
    stays = gps.detect_stays(logs)
    assert len(stays) == 1


def test_moved_short_time_not_merged():
    """짧은 시간 뒤라도 다른 곳으로 이동했으면 합치지 않는다 (별도 체류)."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    # 카페(0~12분) → 1분 뒤 ~180m 떨어진 식당(13~25분), 각 12분(≥10)
    logs = _stay_run(base, 0, 12, lat=37.5, lng=127.0) + _stay_run(
        base, 13, 25, lat=37.5, lng=127.0020
    )
    stays = gps.detect_stays(logs)
    assert len(stays) == 2


# ──────────────────────────────────────────
# accuracy 노이즈 필터
# ──────────────────────────────────────────
def test_filter_by_accuracy_drops_bad_keeps_unknown():
    """accuracy가 임계 초과(나쁜) 점만 제외하고, 0/None(값 없음)은 유지한다."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    logs = [
        _log(base, 37.5, 127.0, accuracy=10),  # 양호 → 유지
        _log(base + timedelta(minutes=1), 37.5, 127.0, accuracy=0),  # 값없음 → 유지
        _log(base + timedelta(minutes=2), 37.5, 127.0),  # 미지정 → 유지
        _log(
            base + timedelta(minutes=3), 37.5, 127.0, accuracy=250
        ),  # 나쁨(>200) → 제외
    ]
    filtered = gps._filter_by_accuracy(logs)
    assert len(filtered) == 3  # 1개만 걸러짐(25%<50%)이라 필터 적용
    assert all(
        (not log.get("accuracy")) or log["accuracy"] <= gps.ACCURACY_MAX_M
        for log in filtered
    )


def test_indoor_accuracy_is_kept():
    """실내 수준 정확도(~150m)는 보존한다 — 실내 체류가 사라지면 안 됨."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    logs = [
        _log(base + timedelta(minutes=m), 37.5, 127.0, accuracy=150)
        for m in range(0, 13)  # 0~12분(≥10)
    ]
    assert len(gps._filter_by_accuracy(logs)) == 13  # 150 ≤ 200 → 전부 유지
    assert len(gps.detect_stays(logs)) == 1  # 실내 체류 살아있음


def test_keeps_original_when_filter_drops_too_many():
    """필터가 절반 넘게 지우면(그날 GPS 전반 불량) 원본 유지 — 왜곡 방지."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    logs = [
        _log(base, 37.5, 127.0, accuracy=250),  # 나쁨
        _log(base + timedelta(minutes=1), 37.5, 127.0, accuracy=250),  # 나쁨
        _log(base + timedelta(minutes=2), 37.5, 127.0, accuracy=250),  # 나쁨
        _log(base + timedelta(minutes=3), 37.5, 127.0, accuracy=10),  # 양호
        _log(base + timedelta(minutes=4), 37.5, 127.0, accuracy=10),  # 양호
    ]
    # 3/5(60%)가 걸러져 40%만 남음(<50%) → 필터 취소, 원본 5개 유지
    assert len(gps._filter_by_accuracy(logs)) == 5


def test_bad_accuracy_point_excluded_from_stay():
    """반경 안이라도 accuracy 나쁜 점은 체류 중심점 계산에서 빠진다."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    logs = [
        _log(base, 37.5, 127.0, accuracy=10),
        _log(base + timedelta(minutes=4), 37.5, 127.0, accuracy=10),
        # ~33m 이내라 반경엔 들지만 accuracy 250(>200) → 제외되어 중심점 안 흔듦
        _log(base + timedelta(minutes=6), 37.5003, 127.0, accuracy=250),
        _log(base + timedelta(minutes=8), 37.5, 127.0, accuracy=10),
        _log(base + timedelta(minutes=12), 37.5, 127.0, accuracy=10),  # 총 12분(≥10)
    ]
    stays = gps.detect_stays(logs)
    assert len(stays) == 1
    assert stays[0]["lat"] == pytest.approx(37.5)  # 37.5003 섞였으면 어긋남


def test_all_bad_accuracy_falls_back_to_unfiltered():
    """모두 임계 초과면(2점 미만 남음) 다 날리지 않고 원본으로 감지."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    logs = [
        _log(base + timedelta(minutes=m), 37.5, 127.0, accuracy=250)
        for m in range(0, 13)  # 0~12분(≥10)
    ]
    stays = gps.detect_stays(logs)
    assert len(stays) == 1


# ──────────────────────────────────────────
# 장소 매칭: 카테고리 순서 무관, 전역 최단거리
# ──────────────────────────────────────────
class _FakeResp:
    def __init__(self, docs):
        self._docs = docs

    def raise_for_status(self):
        pass

    def json(self):
        return {"documents": self._docs}


def _doc(name: str, category: str, distance: int) -> dict:
    return {
        "place_name": name,
        "category_name": category,
        "distance": str(distance),
    }


def test_picks_global_nearest_not_category_order(monkeypatch):
    """음식점(FD6)이 목록 앞이라도, 더 가까운 카페가 선택돼야 한다."""
    monkeypatch.setattr(settings, "KAKAO_API_KEY", "dummy")

    def fake_get(url, headers=None, params=None, timeout=None):
        code = params["category_group_code"]
        if code == "FD6":  # 음식점 250m (멀지만 목록 맨 앞)
            return _FakeResp([_doc("먼 식당", "음식점", 250)])
        if code == "CE7":  # 카페 10m (실제 있던 곳)
            return _FakeResp([_doc("가까운 카페", "음식점 > 카페", 10)])
        return _FakeResp([])

    monkeypatch.setattr(gps.requests, "get", fake_get)

    info = gps.get_place_info(37.5, 127.0)
    assert info["place_name"] == "가까운 카페"  # 순서 아닌 거리로 선택


def test_transit_only_as_fallback(monkeypatch):
    """체류형 후보가 전혀 없을 때만 지하철 등 이동지점으로 폴백."""
    monkeypatch.setattr(settings, "KAKAO_API_KEY", "dummy")

    def fake_get(url, headers=None, params=None, timeout=None):
        if params["category_group_code"] == "SW8":
            return _FakeResp([_doc("성수역", "교통,수송 > 지하철", 30)])
        return _FakeResp([])  # 체류형 카테고리는 전부 없음

    monkeypatch.setattr(gps.requests, "get", fake_get)

    info = gps.get_place_info(37.5, 127.0)
    assert info["place_name"] == "성수역"


def test_transit_not_chosen_when_stay_place_exists(monkeypatch):
    """가까운 지하철이 있어도, 체류형 장소가 있으면 그쪽을 우선한다."""
    monkeypatch.setattr(settings, "KAKAO_API_KEY", "dummy")

    def fake_get(url, headers=None, params=None, timeout=None):
        code = params["category_group_code"]
        if code == "CE7":
            return _FakeResp([_doc("카페", "음식점 > 카페", 40)])
        if code == "SW8":
            return _FakeResp([_doc("지하철역", "교통,수송 > 지하철", 5)])
        return _FakeResp([])

    monkeypatch.setattr(gps.requests, "get", fake_get)

    # 지하철(5m)이 카페(40m)보다 가깝지만, 체류형이 있으므로 transit은 조회조차 안 함
    info = gps.get_place_info(37.5, 127.0)
    assert info["place_name"] == "카페"


def test_reverse_geocode_fallback_when_no_poi(monkeypatch):
    """POI가 하나도 없으면 좌표→동네로 폴백한다 ('알 수 없음' 대신)."""
    monkeypatch.setattr(settings, "KAKAO_API_KEY", "dummy")

    def fake_get(url, headers=None, params=None, timeout=None):
        if "coord2address" in url:
            return _FakeResp(
                [
                    {
                        "address": {
                            "region_1depth_name": "서울",
                            "region_2depth_name": "성동구",
                            "region_3depth_name": "성수동2가",
                        }
                    }
                ]
            )
        return _FakeResp([])  # 모든 POI 카테고리 없음

    monkeypatch.setattr(gps.requests, "get", fake_get)

    info = gps.get_place_info(37.5, 127.0)
    assert info["place_name"] == "성수동2가 인근"
    assert info["category"] == "위치"


def test_unknown_when_everything_fails(monkeypatch):
    """POI도 역지오코딩도 다 비면 그제야 '알 수 없음'."""
    monkeypatch.setattr(settings, "KAKAO_API_KEY", "dummy")
    monkeypatch.setattr(gps.requests, "get", lambda *a, **k: _FakeResp([]))
    assert gps.get_place_info(37.5, 127.0)["place_name"] == "알 수 없음"


def test_no_api_key_returns_unknown(monkeypatch):
    monkeypatch.setattr(settings, "KAKAO_API_KEY", "")
    assert gps.get_place_info(37.5, 127.0)["place_name"] == "알 수 없음"


# ── 랜드마크 우선 (대형 명소 > 안쪽 카페·마트) ──
def test_landmark_beats_nearer_general(monkeypatch):
    """대형 명소(롯데월드) 안이면, 더 가까운 롯데마트가 있어도 명소를 고른다."""
    monkeypatch.setattr(settings, "KAKAO_API_KEY", "dummy")

    def fake_get(url, headers=None, params=None, timeout=None):
        if "keyword.json" in url:
            raise AssertionError("랜드마크가 잡히면 캠퍼스 폴백 안 함")
        code = params["category_group_code"]
        if code == "AT4":  # 롯데월드 어드벤처 70m (랜드마크, ≤80m)
            return _FakeResp(
                [_doc("롯데월드 어드벤처", "여행 > 관광,명소 > 테마파크", 70)]
            )
        if code == "MT1":  # 롯데마트 20m (더 가깝지만 일반 체험형)
            return _FakeResp([_doc("롯데마트 월드타워점", "가정,생활 > 대형마트", 20)])
        return _FakeResp([])

    monkeypatch.setattr(gps.requests, "get", fake_get)
    info = gps.get_place_info(37.5, 127.0)
    assert info["place_name"] == "롯데월드 어드벤처"  # 마트 아님


def test_landmark_ignored_beyond_radius(monkeypatch):
    """랜드마크가 반경(150m) 밖이면 우선하지 않고, 가까운 일반 체험형을 고른다."""
    monkeypatch.setattr(settings, "KAKAO_API_KEY", "dummy")

    def fake_get(url, headers=None, params=None, timeout=None):
        # 실제 카카오처럼 radius를 존중하는 목(radius 밖이면 결과 없음)
        radius = params.get("radius", 0)
        code = params["category_group_code"]
        if code == "AT4" and radius >= 200:  # 관광지 200m — 반경 150이면 안 나옴
            return _FakeResp([_doc("먼 관광지", "여행 > 관광,명소", 200)])
        if code == "CE7" and radius >= 40:  # 카페 40m
            return _FakeResp([_doc("스타벅스", "음식점 > 카페", 40)])
        return _FakeResp([])

    monkeypatch.setattr(gps.requests, "get", fake_get)
    info = gps.get_place_info(37.5, 127.0)
    assert info["place_name"] == "스타벅스"  # 200m 관광지는 랜드마크 반경 밖


# ── 카테고리 tiering (체험형 > 기능형) ──────
def test_experiential_beats_nearer_functional(monkeypatch):
    """더 가까운 편의점(기능형)이 있어도, 체험형(카페)이 있으면 카페를 고른다."""
    monkeypatch.setattr(settings, "KAKAO_API_KEY", "dummy")

    def fake_get(url, headers=None, params=None, timeout=None):
        if "keyword.json" in url:
            raise AssertionError("체험형이 잡히면 캠퍼스 폴백 안 함")
        code = params["category_group_code"]
        if code == "CE7":  # 카페 60m (Tier1)
            return _FakeResp([_doc("스타벅스", "음식점 > 카페", 60)])
        if code == "CS2":  # 편의점 10m (Tier2, 더 가깝지만 기능형)
            return _FakeResp([_doc("GS25", "가정,생활 > 편의점", 10)])
        return _FakeResp([])

    monkeypatch.setattr(gps.requests, "get", fake_get)
    info = gps.get_place_info(37.5, 127.0)
    assert info["place_name"] == "스타벅스"  # Tier2는 조회조차 안 함


# ── 캠퍼스 건물(학교부속시설) 폴백 ─────────
def test_campus_building_beats_nearby_bank(monkeypatch):
    """학교 안에선 코드 없는 강의동을, 옆의 코드 있는 은행보다 우선 매칭한다."""
    monkeypatch.setattr(settings, "KAKAO_API_KEY", "dummy")

    def fake_get(url, headers=None, params=None, timeout=None):
        if "keyword.json" in url:  # 학교명 키워드 검색 → 가까운 캠퍼스 건물
            assert params["query"] == "경기대학교"
            return _FakeResp(
                [
                    _doc(
                        "경기대학교 수원캠퍼스 종합강의동",
                        "교육,학문 > 학교부속시설",
                        5,
                    ),
                    _doc("경기대학교 교육대학원", "교육,학문 > 학교 > 대학원", 8),
                ]
            )
        code = params["category_group_code"]
        if code == "SC4":  # 캠퍼스 마커는 멀리(150m)
            return _FakeResp([_doc("경기대학교", "교육,학문 > 학교 > 대학교", 150)])
        if code == "BK9":  # 은행 ATM은 바로 옆(28m)
            return _FakeResp([_doc("신한은행 365코너", "금융,보험 > 은행 > ATM", 28)])
        return _FakeResp([])

    monkeypatch.setattr(gps.requests, "get", fake_get)
    info = gps.get_place_info(37.5, 127.0)
    assert info["place_name"] == "경기대학교 수원캠퍼스 종합강의동"  # 은행 아님


def test_campus_fallback_ignored_when_building_far(monkeypatch):
    """학교는 근처지만 키워드로 찾은 건물이 멀면(>60m) 캠퍼스 매칭을 버리고 기능형으로."""
    monkeypatch.setattr(settings, "KAKAO_API_KEY", "dummy")

    def fake_get(url, headers=None, params=None, timeout=None):
        if "keyword.json" in url:
            return _FakeResp(
                [_doc("먼 강의동", "교육,학문 > 학교부속시설", 120)]
            )  # >60m
        code = params["category_group_code"]
        if code == "SC4":
            return _FakeResp([_doc("어느대학교", "교육,학문 > 학교 > 대학교", 250)])
        if code == "BK9":
            return _FakeResp([_doc("신한은행", "금융,보험 > 은행", 28)])
        return _FakeResp([])

    monkeypatch.setattr(gps.requests, "get", fake_get)
    info = gps.get_place_info(37.5, 127.0)
    assert info["place_name"] == "신한은행"  # 캠퍼스 건물이 곁에 없음 → 기능형


def test_campus_fallback_not_triggered_off_campus(monkeypatch):
    """근처에 학교(SC4)가 없으면 키워드 검색을 아예 하지 않는다."""
    monkeypatch.setattr(settings, "KAKAO_API_KEY", "dummy")

    def fake_get(url, headers=None, params=None, timeout=None):
        if "keyword.json" in url:
            raise AssertionError("학교가 없으면 키워드 검색 금지")
        code = params["category_group_code"]
        if code == "BK9":
            return _FakeResp([_doc("신한은행", "금융,보험 > 은행", 20)])
        return _FakeResp([])  # SC4 포함 나머지 없음

    monkeypatch.setattr(gps.requests, "get", fake_get)
    info = gps.get_place_info(37.5, 127.0)
    assert info["place_name"] == "신한은행"


# ── 국내/해외 하이브리드 (구글 Places) ─────
class _FakeGoogleResp:
    def __init__(self, results, status="OK"):
        self._results = results
        self._status = status

    def raise_for_status(self):
        pass

    def json(self):
        return {"status": self._status, "results": self._results}


def _gplace(name, types, lat, lng):
    return {
        "name": name,
        "types": types,
        "geometry": {"location": {"lat": lat, "lng": lng}},
    }


def test_in_korea_bbox():
    assert gps._in_korea(37.5, 127.0) is True  # 서울
    assert gps._in_korea(33.4, 126.5) is True  # 제주
    assert gps._in_korea(48.8584, 2.2945) is False  # 파리
    assert gps._in_korea(40.7128, -74.0060) is False  # 뉴욕
    assert gps._in_korea(35.6895, 139.6917) is False  # 도쿄


def test_overseas_routes_to_google(monkeypatch):
    """해외 좌표는 카카오가 아니라 구글 Places로 매칭한다."""
    monkeypatch.setattr(settings, "GOOGLE_MAPS_API_KEY", "gkey")

    def fake_get(url, params=None, timeout=None, **kw):
        assert "googleapis.com" in url  # 카카오 아님
        return _FakeGoogleResp(
            [
                _gplace(
                    "에펠탑",
                    ["tourist_attraction", "point_of_interest"],
                    48.8584,
                    2.2945,
                )
            ]
        )

    monkeypatch.setattr(gps.requests, "get", fake_get)

    info = gps.get_place_info(48.8584, 2.2945)  # 파리
    assert info["place_name"] == "에펠탑"
    assert info["category"] == "관광명소"


def test_google_picks_nearest_by_distance(monkeypatch):
    """구글 결과 중 체류 중심에서 가장 가까운 장소를 고른다."""
    monkeypatch.setattr(settings, "GOOGLE_MAPS_API_KEY", "gkey")
    center = (35.6895, 139.6917)  # 도쿄

    def fake_get(url, params=None, timeout=None, **kw):
        return _FakeGoogleResp(
            [
                _gplace("먼 상점", ["store"], 35.6905, 139.6930),  # ~150m
                _gplace("가까운 카페", ["cafe"], 35.6895, 139.6917),  # 0m
            ]
        )

    monkeypatch.setattr(gps.requests, "get", fake_get)

    info = gps.get_place_info(*center)
    assert info["place_name"] == "가까운 카페"
    assert info["category"] == "카페"


def test_overseas_no_google_key_returns_unknown(monkeypatch):
    """구글 키 미설정이면 해외는 매칭 없이 '알 수 없음' (기존 동작 유지)."""
    monkeypatch.setattr(settings, "GOOGLE_MAPS_API_KEY", "")
    # 구글 호출 자체가 없어야 함 — 호출되면 에러로 감지
    monkeypatch.setattr(
        gps.requests,
        "get",
        lambda *a, **k: (_ for _ in ()).throw(AssertionError("호출 금지")),
    )
    assert gps.get_place_info(48.8584, 2.2945)["place_name"] == "알 수 없음"


def test_google_request_denied_returns_unknown(monkeypatch):
    """구글 status가 OK/ZERO_RESULTS가 아니면(키·결제 문제 등) '알 수 없음'."""
    monkeypatch.setattr(settings, "GOOGLE_MAPS_API_KEY", "gkey")
    monkeypatch.setattr(
        gps.requests,
        "get",
        lambda *a, **k: _FakeGoogleResp([], status="REQUEST_DENIED"),
    )
    assert gps.get_place_info(48.8584, 2.2945)["place_name"] == "알 수 없음"


def test_domestic_never_calls_google(monkeypatch):
    """국내 좌표는 구글 URL을 절대 호출하지 않는다 (카카오만)."""
    monkeypatch.setattr(settings, "KAKAO_API_KEY", "dummy")

    def fake_get(url, headers=None, params=None, timeout=None, **kw):
        assert "googleapis.com" not in url  # 국내는 구글 금지
        return _FakeResp([_doc("서울 카페", "음식점 > 카페", 20)])

    monkeypatch.setattr(gps.requests, "get", fake_get)

    info = gps.get_place_info(37.5, 127.0)
    assert info["place_name"] == "서울 카페"
