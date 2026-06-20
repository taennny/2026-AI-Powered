"""timeline_data 직렬화 + style 매핑 단위 테스트."""

import uuid
from datetime import date, datetime, timezone

from app.models.daily_record import DailyRecord
from app.models.place import Place
from app.models.user import User
from app.services.timeline_serializer import build_timeline_data, map_style


def _user():
    return User(
        id=uuid.uuid4(),
        email="t@t.com",
        nickname="여행자",
        auth_provider="local",
    )


def _daily_record():
    return DailyRecord(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        target_date=date(2026, 5, 1),
    )


def test_map_style():
    assert map_style("info") == "info"
    assert map_style("emotion") == "emotional"
    assert map_style("casual") == "casual"
    assert map_style("formal") == "info"
    assert map_style("처음보는값") == "casual"  # 미매칭 → casual


def test_build_timeline_data_with_places():
    """장소가 있으면 blocks로 직렬화 + AI 필수 키 포함"""
    places = [
        Place(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            name="성수 카페",
            category="카페",
            address="서울 성동구 성수동",
            arrived_at=datetime(2026, 5, 1, 10, 30, tzinfo=timezone.utc),
            left_at=datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc),
        ),
    ]

    data = build_timeline_data(_daily_record(), _user(), places)

    assert data["date"] == "2026-05-01"
    assert data["user"]["nickname"] == "여행자"
    assert len(data["blocks"]) == 1

    block = data["blocks"][0]
    # AI serialize()가 필수로 읽는 키들
    for key in ("seq", "start", "end", "place", "category", "address"):
        assert key in block
    assert block["seq"] == 1
    assert block["start"] == "10:30"
    assert block["place"] == "성수 카페"


def test_build_timeline_data_empty_places():
    """장소가 없어도 구조는 유효 (blocks 빈 리스트)"""
    data = build_timeline_data(_daily_record(), _user(), [])
    assert data["blocks"] == []
    assert data["date"] == "2026-05-01"


def test_build_timeline_data_nullable_fields():
    """category/address/left_at 누락 시에도 필수 키 채워짐"""
    places = [
        Place(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            name="이름만 있는 장소",
            category=None,
            address=None,
            arrived_at=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
            left_at=None,
        ),
    ]

    block = build_timeline_data(_daily_record(), _user(), places)["blocks"][0]
    assert block["category"] == "기타"
    assert block["address"] == ""
    assert block["end"] == ""
