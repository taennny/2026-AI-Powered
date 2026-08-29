"""무료 사용자 주간 생성 한도 테스트 (주 3회, 프리미엄 무제한)"""

import uuid
from datetime import datetime, timedelta

from sqlalchemy import select, update

from app.config import settings
from app.models.blog import Blog
from app.models.enums import GenerationStatus
from app.utils.timezone import KST, week_bounds
from tests.conftest import TEST_USER_ID, TestingSessionLocal


async def _generate(client, daily_record_id):
    return await client.post(
        "/api/v1/blog/generate",
        json={"daily_record_id": str(daily_record_id), "style": "casual"},
    )


async def _fail_one_blog() -> None:
    """생성된 블로그 한 건을 FAILED로 변경 (생성 실패 상황 재현)"""
    async with TestingSessionLocal() as db:
        blog_id = (
            await db.execute(
                select(Blog.id).where(Blog.user_id == TEST_USER_ID).limit(1)
            )
        ).scalar_one()
        await db.execute(
            update(Blog)
            .where(Blog.id == blog_id)
            .values(generation_status=GenerationStatus.FAILED.value)
        )
        await db.commit()


# ============================================================
# 1. 무료 사용자 한도
# ============================================================


async def test_free_user_allowed_up_to_limit(client, daily_record_id):
    """무료 사용자는 한도(3회)까지 202"""
    for _ in range(settings.FREE_WEEKLY_BLOG_LIMIT):
        res = await _generate(client, daily_record_id)
        assert res.status_code == 202


async def test_free_user_over_limit_returns_429(client, daily_record_id):
    """한도 초과 요청은 429 + limit/used/reset_at 포함"""
    for _ in range(settings.FREE_WEEKLY_BLOG_LIMIT):
        assert (await _generate(client, daily_record_id)).status_code == 202

    res = await _generate(client, daily_record_id)
    assert res.status_code == 429

    detail = res.json()["detail"]
    assert detail["limit"] == settings.FREE_WEEKLY_BLOG_LIMIT
    assert detail["used"] == settings.FREE_WEEKLY_BLOG_LIMIT
    assert "message" in detail

    # reset_at은 KST(+09:00) ISO 문자열이며 이번 주 끝(= 다음 주 월요일 04:00)
    reset_at = datetime.fromisoformat(detail["reset_at"])
    assert reset_at.utcoffset() == timedelta(hours=9)
    assert reset_at == week_bounds()[1].astimezone(KST)


async def test_failed_generation_not_counted(client, daily_record_id):
    """FAILED 건은 카운트에서 빠진다 (3건 중 1건 실패 → 1회 더 가능)"""
    for _ in range(settings.FREE_WEEKLY_BLOG_LIMIT):
        assert (await _generate(client, daily_record_id)).status_code == 202

    await _fail_one_blog()

    res = await _generate(client, daily_record_id)
    assert res.status_code == 202


async def test_last_week_blogs_not_counted(client, daily_record_id):
    """지난주에 만든 블로그는 이번 주 카운트에 안 들어간다"""
    start, _ = week_bounds()
    async with TestingSessionLocal() as db:
        for _ in range(settings.FREE_WEEKLY_BLOG_LIMIT):
            db.add(
                Blog(
                    id=uuid.uuid4(),
                    user_id=TEST_USER_ID,
                    daily_record_id=daily_record_id,
                    title="지난주 글",
                    content="내용",
                    style="casual",
                    target_date=start.date(),
                    generation_status=GenerationStatus.COMPLETED.value,
                    created_at=start - timedelta(days=1),
                )
            )
        await db.commit()

    res = await _generate(client, daily_record_id)
    assert res.status_code == 202


# ============================================================
# 2. 프리미엄 무제한
# ============================================================


async def test_premium_user_unlimited(client, daily_record_id):
    """프리미엄은 한도를 넘겨도 계속 202"""
    await client.put("/api/v1/subscriptions/me", json={"plan_type": "premium"})

    for _ in range(settings.FREE_WEEKLY_BLOG_LIMIT + 2):
        res = await _generate(client, daily_record_id)
        assert res.status_code == 202


# ============================================================
# 3. 주 경계 계산 (월요일 04:00 KST)
# ============================================================


def test_week_bounds_before_boundary_belongs_to_previous_week():
    """월요일 03:00은 아직 전주 (하루 경계 04:00 이전)"""
    start, end = week_bounds(datetime(2026, 8, 3, 3, 0, tzinfo=KST))
    assert start.astimezone(KST) == datetime(2026, 7, 27, 4, 0, tzinfo=KST)
    assert end.astimezone(KST) == datetime(2026, 8, 3, 4, 0, tzinfo=KST)


def test_week_bounds_after_boundary_belongs_to_current_week():
    """월요일 05:00은 이번 주"""
    start, end = week_bounds(datetime(2026, 8, 3, 5, 0, tzinfo=KST))
    assert start.astimezone(KST) == datetime(2026, 8, 3, 4, 0, tzinfo=KST)
    assert end.astimezone(KST) == datetime(2026, 8, 10, 4, 0, tzinfo=KST)
