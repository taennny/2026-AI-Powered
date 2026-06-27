"""구독 API 테스트 — 응답 필드 + 결제주기/프리미엄 시작일 로직."""

from datetime import datetime


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
