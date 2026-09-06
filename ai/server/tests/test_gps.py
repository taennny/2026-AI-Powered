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
        _log(base + timedelta(minutes=2), 37.5002, 127.0002),
        _log(base + timedelta(minutes=4), 37.5001, 127.0001),
    ]
    stays = gps.detect_stays(logs)
    assert len(stays) == 1
    assert stays[0]["lat"] == pytest.approx((37.5000 + 37.5002 + 37.5001) / 3)
    assert stays[0]["lng"] == pytest.approx((127.0000 + 127.0002 + 127.0001) / 3)


def test_detect_stays_mixed_timestamp_precision():
    """마이크로초 있는/없는 ISO8601 시각이 섞여도 파싱 실패하지 않는다 (prod 500 재현)."""
    logs = [
        {"time": "2026-08-24T06:24:57.123456Z", "lat": 37.5, "lng": 127.0},
        {"time": "2026-08-24T06:26:57Z", "lat": 37.5, "lng": 127.0},  # 마이크로초 없음
        {"time": "2026-08-24T06:28:57Z", "lat": 37.5, "lng": 127.0},
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
    """앱이 잠깐 죽어 GPS가 ≤3분 끊겨도, 같은 자리면 한 체류로 이어붙인다."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    logs = [
        _log(base, 37.5, 127.0),
        _log(base + timedelta(minutes=1), 37.5, 127.0),
        _log(base + timedelta(minutes=2), 37.5, 127.0),
        # 여기서 3분 끊김(앱 종료) — base+2 → base+5
        _log(base + timedelta(minutes=5), 37.5, 127.0),
        _log(base + timedelta(minutes=6), 37.5, 127.0),
    ]
    stays = gps.detect_stays(logs)
    assert len(stays) == 1
    dur = (stays[0]["end_time"] - stays[0]["start_time"]).total_seconds() / 60
    assert dur == pytest.approx(6)  # 끊긴 구간까지 포함해 하나로


def test_long_gap_splits():
    """GAP_BRIDGE_MINUTES 초과 끊김은 경계로 봐서 나눈다 (그동안 뭘 했는지 모르므로)."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    logs = _stay_run(base, 0, 4) + _stay_run(base, 15, 19)  # 사이 11분 공백(>5분)
    stays = gps.detect_stays(logs)
    assert len(stays) == 2


def test_jitter_outlier_does_not_split():
    """한두 점 튐(반경 밖)이 있어도 같은 자리 체류는 쪼개지지 않는다."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    logs = [
        _log(base, 37.5, 127.0),
        _log(base + timedelta(minutes=1), 37.5, 127.0),
        _log(base + timedelta(minutes=2), 37.5, 127.0),
        _log(base + timedelta(minutes=3), 37.5006, 127.0),  # ~66m 튐(반경 밖, 단일)
        _log(base + timedelta(minutes=4), 37.5, 127.0),
        _log(base + timedelta(minutes=5), 37.5, 127.0),
        _log(base + timedelta(minutes=6), 37.5, 127.0),
    ]
    stays = gps.detect_stays(logs)
    assert len(stays) == 1


def test_drift_within_radius_kept_as_one_stay():
    """반경 내 GPS 드리프트(~30m)로 흔들려도 한 체류로 잡는다."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    logs = [
        _log(base, 37.5, 127.0),
        _log(base + timedelta(minutes=2), 37.5003, 127.0),  # ~33m
        _log(base + timedelta(minutes=4), 37.5, 127.0003),  # ~26m
        _log(base + timedelta(minutes=6), 37.5002, 127.0001),  # 근처
    ]
    stays = gps.detect_stays(logs)
    assert len(stays) == 1


def test_moved_within_3min_not_merged():
    """3분 안에라도 다른 곳으로 이동했으면 합치지 않는다 (별도 체류)."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    # 카페(0~4분) → 1분 뒤 ~180m 떨어진 식당(5~9분)
    logs = _stay_run(base, 0, 4, lat=37.5, lng=127.0) + _stay_run(
        base, 5, 9, lat=37.5, lng=127.0020
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
        _log(base + timedelta(minutes=3), 37.5, 127.0, accuracy=250),  # 나쁨(>200) → 제외
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
        _log(base + timedelta(minutes=m), 37.5, 127.0, accuracy=150) for m in range(0, 5)
    ]
    assert len(gps._filter_by_accuracy(logs)) == 5  # 150 ≤ 200 → 전부 유지
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
        _log(base + timedelta(minutes=1), 37.5, 127.0, accuracy=10),
        _log(base + timedelta(minutes=2), 37.5, 127.0, accuracy=10),
        _log(base + timedelta(minutes=3), 37.5, 127.0, accuracy=10),
        # ~33m 이내라 반경엔 들지만 accuracy 250(>200) → 제외되어 중심점 안 흔듦
        _log(base + timedelta(minutes=4), 37.5003, 127.0, accuracy=250),
    ]
    stays = gps.detect_stays(logs)
    assert len(stays) == 1
    assert stays[0]["lat"] == pytest.approx(37.5)  # 37.5003 섞였으면 어긋남


def test_all_bad_accuracy_falls_back_to_unfiltered():
    """모두 임계 초과면(2점 미만 남음) 다 날리지 않고 원본으로 감지."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    logs = [
        _log(base + timedelta(minutes=m), 37.5, 127.0, accuracy=250)
        for m in range(0, 5)
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
