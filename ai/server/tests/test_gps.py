"""AI-1 GPS 체류 감지 + 장소 매칭 테스트."""

from datetime import datetime, timedelta, timezone

import pytest

from config import settings
from modules import gps


def _log(t: datetime, lat: float, lng: float) -> dict:
    return {"time": t.isoformat(), "lat": lat, "lng": lng}


# ──────────────────────────────────────────
# 체류 감지: 중심점(centroid)
# ──────────────────────────────────────────
def test_detect_stays_uses_centroid():
    """매칭 좌표는 첫 점이 아니라 체류 구간 평균(centroid)이어야 한다."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    logs = [
        _log(base, 37.5000, 127.0000),
        _log(base + timedelta(minutes=5), 37.5002, 127.0002),
        _log(base + timedelta(minutes=10), 37.5001, 127.0001),
    ]
    stays = gps.detect_stays(logs)
    assert len(stays) == 1
    assert stays[0]["lat"] == pytest.approx((37.5000 + 37.5002 + 37.5001) / 3)
    assert stays[0]["lng"] == pytest.approx((127.0000 + 127.0002 + 127.0001) / 3)


def test_detect_stays_skips_short_stays():
    """MIN_STAY_MINUTES 미만은 체류로 보지 않는다."""
    base = datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc)
    logs = [
        _log(base, 37.5, 127.0),
        _log(base + timedelta(minutes=1), 37.5, 127.0),  # 1분뿐
    ]
    assert gps.detect_stays(logs) == []


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


def test_unknown_when_nothing_found(monkeypatch):
    monkeypatch.setattr(settings, "KAKAO_API_KEY", "dummy")
    monkeypatch.setattr(gps.requests, "get", lambda *a, **k: _FakeResp([]))
    assert gps.get_place_info(37.5, 127.0)["place_name"] == "알 수 없음"


def test_no_api_key_returns_unknown(monkeypatch):
    monkeypatch.setattr(settings, "KAKAO_API_KEY", "")
    assert gps.get_place_info(37.5, 127.0)["place_name"] == "알 수 없음"
