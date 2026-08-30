"""캘린더의 '이 날 글이 있나' 판정 — 삭제·모아쓰기 케이스."""

import uuid
from datetime import date, datetime, timezone

from app.models.blog import Blog
from app.models.daily_record import DailyRecord
from app.models.enums import GenerationStatus
from app.services.calendar import get_monthly_calendar
from tests.conftest import TEST_USER_ID, TestingSessionLocal


async def _record(db, target_date):
    rec = DailyRecord(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        target_date=target_date,
        place_count=1,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return rec


async def _blog(db, **kwargs):
    blog = Blog(
        user_id=TEST_USER_ID,
        title="t",
        content="c",
        style="casual",
        generation_status=GenerationStatus.COMPLETED,
        **kwargs,
    )
    db.add(blog)
    await db.commit()
    return blog


async def _flag(db, target_date):
    data = await get_monthly_calendar(
        TEST_USER_ID, target_date.year, target_date.month, db
    )
    key = target_date.strftime("%Y-%m-%d")
    return next(d["has_journal"] for d in data["days"] if d["date"] == key)


async def test_deleted_blog_not_counted():
    """삭제한 글은 캘린더에 표시되지 않는다 (소프트 삭제라 행은 남아 있음)"""
    async with TestingSessionLocal() as db:
        rec = await _record(db, date(2026, 9, 1))
        await _blog(
            db,
            daily_record_id=rec.id,
            target_date=date(2026, 9, 1),
            deleted_at=datetime.now(timezone.utc),
        )
        assert await _flag(db, date(2026, 9, 1)) is False


async def test_multi_day_blog_shows_on_selected_dates():
    """모아쓰기 글은 target_dates에 든 날에만 표시된다"""
    async with TestingSessionLocal() as db:
        await _record(db, date(2026, 9, 3))  # 고른 날
        await _record(db, date(2026, 9, 4))  # 범위 안이지만 안 고른 날
        await _blog(
            db,
            daily_record_id=None,
            target_date=date(2026, 9, 3),
            period_end=date(2026, 9, 5),
            target_dates=["2026-09-03", "2026-09-05"],
        )
        assert await _flag(db, date(2026, 9, 3)) is True
        assert await _flag(db, date(2026, 9, 4)) is False


async def test_single_day_blog_still_works():
    """하루짜리 글은 기존대로 daily_record_id로 판정된다"""
    async with TestingSessionLocal() as db:
        rec = await _record(db, date(2026, 9, 10))
        await _blog(db, daily_record_id=rec.id, target_date=date(2026, 9, 10))
        assert await _flag(db, date(2026, 9, 10)) is True
