"""베타 전원 프리미엄 플래그.

DB의 plan_type은 free 그대로 두고 읽는 쪽에서만 프리미엄으로 취급한다.
끄면 즉시 원래 상태로 돌아와야 한다.
"""

import uuid
from datetime import date, datetime, timezone
from unittest.mock import patch

from app.models.blog import Blog
from app.models.enums import GenerationStatus
from app.services.blog import _check_quota, _get_style_examples
from app.services.subscription import get_user_subscription, is_premium
from tests.conftest import TEST_USER_ID, TestingSessionLocal


async def _make_published(db, content):
    blog = Blog(
        user_id=TEST_USER_ID,
        title="t",
        content=content,
        style="casual",
        target_date=date(2026, 8, 1),
        generation_status=GenerationStatus.COMPLETED,
        is_published=True,
        created_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
    )
    db.add(blog)
    await db.commit()


async def test_flag_off_keeps_free_user_free():
    """기본값(꺼짐)에서는 무료 사용자가 그대로 무료"""
    async with TestingSessionLocal() as db:
        subscription = await get_user_subscription(db, TEST_USER_ID)
        assert subscription.plan_type == "free"
        assert is_premium(subscription) is False


async def test_flag_on_treats_free_user_as_premium():
    """켜면 무료 사용자도 프리미엄으로 취급"""
    async with TestingSessionLocal() as db:
        subscription = await get_user_subscription(db, TEST_USER_ID)

        with patch("app.services.subscription.settings.BETA_ALL_PREMIUM", True):
            assert is_premium(subscription) is True


async def test_flag_on_does_not_change_db():
    """켜져 있어도 DB의 plan_type은 free 그대로 — 꺼면 바로 원복되어야 한다"""
    async with TestingSessionLocal() as db:
        with patch("app.services.subscription.settings.BETA_ALL_PREMIUM", True):
            subscription = await get_user_subscription(db, TEST_USER_ID)
            assert is_premium(subscription) is True
            assert subscription.plan_type == "free"  # 표시만 프리미엄

    # 새 세션에서 다시 읽어도 free
    async with TestingSessionLocal() as db:
        subscription = await get_user_subscription(db, TEST_USER_ID)
        assert subscription.plan_type == "free"
        assert is_premium(subscription) is False


async def test_flag_on_skips_weekly_quota():
    """켜면 주간 한도를 넘겨도 생성이 막히지 않는다"""
    async with TestingSessionLocal() as db:
        for _ in range(10):
            await _make_published(db, "본문")

        with patch("app.services.subscription.settings.BETA_ALL_PREMIUM", True):
            await _check_quota(db, TEST_USER_ID)  # QuotaExceededError가 나면 실패


async def test_flag_on_gives_style_examples():
    """켜면 무료 사용자도 문체 예시를 받는다"""
    async with TestingSessionLocal() as db:
        await _make_published(db, "내 문체가 담긴 글")

        with patch("app.services.subscription.settings.BETA_ALL_PREMIUM", True):
            examples = await _get_style_examples(db, TEST_USER_ID, uuid.uuid4())

        assert examples == ["내 문체가 담긴 글"]


async def test_response_shows_premium_so_app_unlocks_themes(client):
    """GET /subscriptions/me 응답이 프리미엄으로 나가야 앱에서 테마가 열린다.

    프론트는 plan==premium && is_active && 만료 아님 으로 판정한다.
    """
    with patch("app.api.v1.subscription.settings.BETA_ALL_PREMIUM", True):
        res = await client.get("/api/v1/subscriptions/me")

    assert res.status_code == 200
    body = res.json()
    assert body["plan"] == "premium"
    assert body["is_active"] is True
    assert body["expires_at"] is None  # 만료로 판정되면 안 된다


async def test_response_is_free_when_flag_off(client):
    """플래그를 끄면 응답이 원래대로 무료"""
    res = await client.get("/api/v1/subscriptions/me")

    assert res.status_code == 200
    assert res.json()["plan"] == "free"
