"""구독 API 테스트 — 응답 필드(plan/started_at) + 프리미엄 만료일 자동 설정."""


async def test_subscription_default_free(client):
    """최초 조회 시 free 플랜 자동 생성 + 프론트 필드명 확인"""
    res = await client.get("/api/v1/subscriptions/me")
    assert res.status_code == 200
    data = res.json()
    assert data["plan"] == "free"
    assert data["is_active"] is True
    assert "started_at" in data
    assert data["expires_at"] is None


async def test_subscription_upgrade_premium_sets_expiry(client):
    """프리미엄 전환 시 expires_at 자동 세팅"""
    res = await client.put("/api/v1/subscriptions/me", json={"plan_type": "premium"})
    assert res.status_code == 200
    data = res.json()
    assert data["plan"] == "premium"
    assert data["expires_at"] is not None


async def test_subscription_downgrade_clears_expiry(client):
    """free 전환 시 expires_at 해제"""
    await client.put("/api/v1/subscriptions/me", json={"plan_type": "premium"})

    res = await client.put("/api/v1/subscriptions/me", json={"plan_type": "free"})
    assert res.status_code == 200
    data = res.json()
    assert data["plan"] == "free"
    assert data["expires_at"] is None


async def test_subscription_invalid_plan(client):
    """유효하지 않은 플랜 → 400"""
    res = await client.put("/api/v1/subscriptions/me", json={"plan_type": "gold"})
    assert res.status_code == 400
