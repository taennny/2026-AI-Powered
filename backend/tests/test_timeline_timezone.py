"""AI에 보내는 타임라인의 시각이 현지 시각으로 나가는지.

UTC를 그대로 찍으면 AI가 "오후 2시에 도착했다"처럼 9시간 어긋난 글을 쓴다.
"""

import uuid
from datetime import date, datetime, timezone

from app.models.daily_record import DailyRecord
from app.models.place import Place
from app.models.user import User
from app.services.timeline_serializer import build_timeline_data


def _place(arrived_utc, left_utc):
    return Place(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        name="광교호수공원",
        category="공원",
        address="경기 수원시",
        arrived_at=arrived_utc,
        left_at=left_utc,
    )


def _record(tz_name):
    return DailyRecord(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        target_date=date(2026, 8, 6),
        timezone=tz_name,
    )


def _user():
    return User(id=uuid.uuid4(), email="t@t.com", nickname="테스터")


def test_kst_record_shows_local_time():
    """KST 23시 기록이 23:00으로 나가야 한다 (UTC 14:00 그대로면 버그)"""
    arrived = datetime(2026, 8, 6, 14, 0, tzinfo=timezone.utc)  # KST 23:00
    left = datetime(2026, 8, 6, 15, 30, tzinfo=timezone.utc)  # KST 24:30
    data = build_timeline_data(_record("Asia/Seoul"), _user(), [_place(arrived, left)])

    assert data["blocks"][0]["start"] == "23:00"
    assert data["blocks"][0]["end"] == "00:30"


def test_overseas_record_uses_its_own_timezone():
    """해외 기록은 그 지역 시각으로 (파리 = UTC+2, 서머타임)"""
    arrived = datetime(2026, 8, 6, 17, 0, tzinfo=timezone.utc)  # 파리 19:00
    data = build_timeline_data(
        _record("Europe/Paris"), _user(), [_place(arrived, None)]
    )

    assert data["blocks"][0]["start"] == "19:00"
    assert data["blocks"][0]["end"] == ""


def test_missing_timezone_falls_back_to_kst():
    """timezone이 아직 안 채워진 기록은 Asia/Seoul로 간주"""
    arrived = datetime(2026, 8, 6, 1, 0, tzinfo=timezone.utc)  # KST 10:00
    data = build_timeline_data(_record(None), _user(), [_place(arrived, None)])

    assert data["blocks"][0]["start"] == "10:00"


def test_unknown_timezone_falls_back_to_kst():
    """알 수 없는 타임존 문자열이 와도 기본값으로 동작 (500 방지)"""
    arrived = datetime(2026, 8, 6, 1, 0, tzinfo=timezone.utc)
    data = build_timeline_data(_record("Not/AZone"), _user(), [_place(arrived, None)])

    assert data["blocks"][0]["start"] == "10:00"


def test_naive_datetime_treated_as_utc():
    """DB에서 naive로 올라와도 UTC로 간주해 변환 (SQLite 대응)"""
    arrived = datetime(2026, 8, 6, 14, 0)  # tzinfo 없음
    data = build_timeline_data(_record("Asia/Seoul"), _user(), [_place(arrived, None)])

    assert data["blocks"][0]["start"] == "23:00"
