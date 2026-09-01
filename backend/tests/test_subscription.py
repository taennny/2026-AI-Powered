"""구독 조회 응답 + 결제주기·프리미엄 시작일 로직.

구독 변경 API(PUT /subscriptions/me)는 제거됐다 — 결제 없이 프리미엄이 될 수
있었기 때문. 실제 반영은 RevenueCat 웹훅이 update_user_subscription을 호출해
이뤄지므로, 여기서는 그 서비스를 직접 호출해 검증한다.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import update

from app.models.subscription import Subscription
from app.services.subscription import update_user_subscription
from tests.conftest import TEST_USER_ID, TestingSessionLocal


async def _change(plan_type: str, billing_cycle: str = "monthly") -> dict:
    """구독 변경 후 주요 필드를 dict로 반환 (세션 밖에서 쓰기 위해 값만 뽑는다)"""
    async with TestingSessionLocal() as db:
        subscription = await update_user_subscription(
            db, TEST_USER_ID, plan_type, billing_cycle
        )
        return {
            "plan": subscription.plan_type,
            "billing_cycle": subscription.billing_cycle,
            "expires_at": subscription.expires_at,
            "premium_started_at": subscription.premium_started_at,
        }


async def _set_expires_at(expires_at: datetime) -> None:
    """테스트 유저 구독의 만료일을 직접 수정 (만료 상태 재현용)"""
    async with TestingSessionLocal() as db:
        await db.execute(
            update(Subscription)
            .where(Subscription.user_id == TEST_USER_ID)
            .values(expires_at=expires_at)
        )
        await db.commit()


async def test_subscription_default_free(client):
    """최초 조회 시 free 플랜 자동 생성 + 프론트 필드명 확인"""
    res = await client.get("/api/v1/subscriptions/me")
    assert res.status_code == 200
    data = res.json()
    assert data["plan"] == "free"
    assert data["is_active"] is True
    assert data["billing_cycle"] == "monthly"
    assert "started_at" in data
    assert data["premium_started_at"] is None
    assert data["expires_at"] is None


async def test_upgrade_premium_sets_expiry_and_started():
    """프리미엄 전환 시 expires_at + premium_started_at 세팅"""
    data = await _change("premium")
    assert data["plan"] == "premium"
    assert data["expires_at"] is not None
    assert data["premium_started_at"] is not None


async def test_annual_longer_expiry():
    """연 결제는 월 결제보다 만료일이 길다 (30일 vs 365일)"""
    monthly = await _change("premium", "monthly")
    await _change("free")  # 초기화 후 annual
    annual = await _change("premium", "annual")

    assert annual["billing_cycle"] == "annual"
    assert annual["expires_at"] > monthly["expires_at"]


async def test_premium_started_at_kept_on_renewal_reset_on_cancel():
    """재결제 시 premium_started_at 유지, 해지 시 초기화"""
    first = await _change("premium")
    renew = await _change("premium")
    assert renew["premium_started_at"] == first["premium_started_at"]

    cancel = await _change("free")
    assert cancel["premium_started_at"] is None


async def test_expired_premium_downgraded_on_read(client):
    """만료된 프리미엄은 조회 시점에 free로 강등 + 만료일·시작일 초기화"""
    await _change("premium")
    await _set_expires_at(datetime.now(timezone.utc) - timedelta(days=1))

    res = await client.get("/api/v1/subscriptions/me")
    assert res.status_code == 200
    data = res.json()
    assert data["plan"] == "free"
    assert data["expires_at"] is None
    assert data["premium_started_at"] is None


async def test_non_expired_premium_stays_premium(client):
    """만료 전 프리미엄은 조회해도 그대로 유지"""
    await _change("premium")

    res = await client.get("/api/v1/subscriptions/me")
    assert res.status_code == 200
    data = res.json()
    assert data["plan"] == "premium"
    assert data["expires_at"] is not None
    assert data["premium_started_at"] is not None


async def test_invalid_plan_rejected():
    """유효하지 않은 플랜은 거부"""
    with pytest.raises(ValueError):
        await _change("gold")


async def test_invalid_billing_cycle_rejected():
    """유효하지 않은 결제주기는 거부"""
    with pytest.raises(ValueError):
        await _change("premium", "weekly")
