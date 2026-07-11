"""결제 영수증 검증 API 테스트 — 검증·멱등성·영수증 재사용 방지."""

import uuid

import pytest

from app.models.user import User
from app.services.payment import process_receipt
from tests.conftest import TestingSessionLocal


async def test_verify_receipt_upgrades_subscription(client):
    """정상 영수증 → 결제 반영 + 구독이 premium/annual로 전환"""
    res = await client.post(
        "/api/v1/subscriptions/verify",
        json={"provider": "mock", "receipt": "mock:tx1:annual"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["transaction_id"] == "tx1"
    assert data["plan"] == "premium"
    assert data["billing_cycle"] == "annual"
    assert data["already_processed"] is False

    me = (await client.get("/api/v1/subscriptions/me")).json()
    assert me["plan"] == "premium"
    assert me["billing_cycle"] == "annual"


async def test_verify_receipt_idempotent(client):
    """같은 영수증 재전송 → already_processed True + 구독 만료일 불변"""
    first = await client.post(
        "/api/v1/subscriptions/verify",
        json={"provider": "mock", "receipt": "mock:tx2:monthly"},
    )
    assert first.status_code == 200
    expires_before = (await client.get("/api/v1/subscriptions/me")).json()["expires_at"]

    second = await client.post(
        "/api/v1/subscriptions/verify",
        json={"provider": "mock", "receipt": "mock:tx2:monthly"},
    )
    assert second.status_code == 200
    assert second.json()["already_processed"] is True

    expires_after = (await client.get("/api/v1/subscriptions/me")).json()["expires_at"]
    assert expires_after == expires_before


async def test_verify_invalid_receipt(client):
    """형식이 틀린 영수증 → 400"""
    res = await client.post(
        "/api/v1/subscriptions/verify",
        json={"provider": "mock", "receipt": "garbage"},
    )
    assert res.status_code == 400


async def test_verify_unknown_provider(client):
    """미지원 결제 제공자 → 400"""
    res = await client.post(
        "/api/v1/subscriptions/verify",
        json={"provider": "paypal", "receipt": "mock:tx3:monthly"},
    )
    assert res.status_code == 400


async def test_verify_receipt_of_another_user_rejected(client):
    """다른 유저가 이미 쓴 transaction_id 재사용 → ValueError (영수증 재사용 방지)"""
    # 첫 유저(테스트 유저)가 정상 결제
    res = await client.post(
        "/api/v1/subscriptions/verify",
        json={"provider": "mock", "receipt": "mock:tx4:monthly"},
    )
    assert res.status_code == 200

    # 두 번째 유저가 같은 영수증으로 시도
    other_user_id = uuid.uuid4()
    async with TestingSessionLocal() as db:
        db.add(
            User(
                id=other_user_id,
                email="other@test.com",
                nickname="다른유저",
                auth_provider="local",
            )
        )
        await db.commit()

        with pytest.raises(ValueError, match="다른 사용자의 결제"):
            await process_receipt(db, other_user_id, "mock", "mock:tx4:monthly")
