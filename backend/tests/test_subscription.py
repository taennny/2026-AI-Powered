"""구독 API 테스트 — 응답 필드 + 결제주기/프리미엄 시작일 로직."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import update

from app.models.subscription import Subscription
from tests.conftest import TEST_USER_ID, TestingSessionLocal


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


async def test_subscription_upgrade_premium_sets_expiry_and_started(client):
    """프리미엄 전환 시 expires_at + premium_started_at 세팅"""
    res = await client.put("/api/v1/subscriptions/me", json={"plan_type": "premium"})
    assert res.status_code == 200
    data = res.json()
    assert data["plan"] == "premium"
    assert data["expires_at"] is not None
    assert data["premium_started_at"] is not None


async def test_subscription_annual_longer_expiry(client):
    """연 결제는 월 결제보다 만료일이 길다 (30일 vs 365일)"""
    monthly = (
        await client.put(
            "/api/v1/subscriptions/me",
            json={"plan_type": "premium", "billing_cycle": "monthly"},
        )
    ).json()
    # free로 초기화 후 annual
    await client.put("/api/v1/subscriptions/me", json={"plan_type": "free"})
    annual = (
        await client.put(
            "/api/v1/subscriptions/me",
            json={"plan_type": "premium", "billing_cycle": "annual"},
        )
    ).json()
    assert annual["billing_cycle"] == "annual"
    assert datetime.fromisoformat(annual["expires_at"]) > datetime.fromisoformat(
        monthly["expires_at"]
    )


async def test_premium_started_at_kept_on_renewal_reset_on_cancel(client):
    """재결제 시 premium_started_at 유지, 해지 시 초기화"""
    first = (
        await client.put("/api/v1/subscriptions/me", json={"plan_type": "premium"})
    ).json()
    # 재결제 (premium→premium): 유지
    renew = (
        await client.put("/api/v1/subscriptions/me", json={"plan_type": "premium"})
    ).json()
    assert renew["premium_started_at"] == first["premium_started_at"]
    # 해지 (premium→free): 초기화
    cancel = (
        await client.put("/api/v1/subscriptions/me", json={"plan_type": "free"})
    ).json()
    assert cancel["premium_started_at"] is None


async def test_expired_premium_downgraded_on_read(client):
    """만료된 프리미엄은 조회 시점에 free로 강등 + 만료일·시작일 초기화"""
    await client.put("/api/v1/subscriptions/me", json={"plan_type": "premium"})
    await _set_expires_at(datetime.now(timezone.utc) - timedelta(days=1))

    res = await client.get("/api/v1/subscriptions/me")
    assert res.status_code == 200
    data = res.json()
    assert data["plan"] == "free"
    assert data["expires_at"] is None
    assert data["premium_started_at"] is None


async def test_non_expired_premium_stays_premium(client):
    """만료 전 프리미엄은 조회해도 그대로 유지"""
    await client.put("/api/v1/subscriptions/me", json={"plan_type": "premium"})

    res = await client.get("/api/v1/subscriptions/me")
    assert res.status_code == 200
    data = res.json()
    assert data["plan"] == "premium"
    assert data["expires_at"] is not None
    assert data["premium_started_at"] is not None


async def test_subscription_invalid_plan(client):
    """유효하지 않은 플랜 → 400"""
    res = await client.put("/api/v1/subscriptions/me", json={"plan_type": "gold"})
    assert res.status_code == 400


async def test_subscription_invalid_billing_cycle(client):
    """유효하지 않은 결제주기 → 400"""
    res = await client.put(
        "/api/v1/subscriptions/me",
        json={"plan_type": "premium", "billing_cycle": "weekly"},
    )
    assert res.status_code == 400
