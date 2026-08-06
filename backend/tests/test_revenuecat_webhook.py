"""RevenueCat 웹훅 테스트 — 설계 v2의 시나리오 10종 + 비밀값 미설정 503."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.config import settings
from app.models.payment import Payment
from app.models.webhook_event import WebhookEvent
from tests.conftest import TEST_USER_ID, TestingSessionLocal

WEBHOOK_URL = "/api/v1/webhooks/revenuecat"
SECRET = "test-webhook-secret"
MONTHLY_PRODUCT = "com.picknavi.roame.premium.monthly"


@pytest.fixture(autouse=True)
def webhook_secret(monkeypatch):
    """테스트용 웹훅 비밀값 주입 (기본값은 빈 값 → 503)"""
    monkeypatch.setattr(settings, "REVENUECAT_WEBHOOK_SECRET", SECRET)
    monkeypatch.setattr(settings, "REVENUECAT_ENVIRONMENT", "PRODUCTION")


def _ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)


def _now() -> datetime:
    # ms 왕복 변환 시 오차가 없도록 마이크로초 제거
    return datetime.now(timezone.utc).replace(microsecond=0)


def make_payload(event_type: str = "INITIAL_PURCHASE", **overrides) -> dict:
    """실제 RevenueCat 필드명 기반 웹훅 페이로드 생성 헬퍼."""
    event = {
        "id": str(uuid.uuid4()),
        "type": event_type,
        "app_user_id": str(TEST_USER_ID),
        "environment": "PRODUCTION",
        "product_id": MONTHLY_PRODUCT,
        "transaction_id": str(uuid.uuid4()),
        "event_timestamp_ms": _ms(_now()),
    }
    event.update(overrides)
    return {"api_version": "1.0", "event": event}


async def _post(client, payload, secret=SECRET):
    headers = {"Authorization": secret} if secret is not None else {}
    return await client.post(WEBHOOK_URL, json=payload, headers=headers)


async def _me(client) -> dict:
    res = await client.get("/api/v1/subscriptions/me")
    assert res.status_code == 200
    return res.json()


def _parse_dt(value: str) -> datetime:
    dt = datetime.fromisoformat(value)
    # SQLite는 naive로 저장되므로 UTC로 간주
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


# 1·2. 인증


async def test_wrong_secret_rejected(client):
    """비밀값 불일치 → 401"""
    res = await _post(client, make_payload(), secret="wrong-secret")
    assert res.status_code == 401


async def test_missing_auth_header_rejected(client):
    """Authorization 헤더 부재 → 401"""
    res = await _post(client, make_payload(), secret=None)
    assert res.status_code == 401


async def test_unconfigured_secret_returns_503(client, monkeypatch):
    """비밀값 미설정 상태로 열리는 것 방지 → 503"""
    monkeypatch.setattr(settings, "REVENUECAT_WEBHOOK_SECRET", "")
    res = await _post(client, make_payload(), secret="anything")
    assert res.status_code == 503


# 3. 멱등성


async def test_duplicate_event_id_processed_once(client):
    """같은 event_id 2회 전송 → 1회만 처리 (수신 기록·결제 기록 각 1건)"""
    payload = make_payload(
        expiration_at_ms=_ms(_now() + timedelta(days=30)),
    )
    first = await _post(client, payload)
    second = await _post(client, payload)
    assert first.status_code == 200
    assert second.status_code == 200

    async with TestingSessionLocal() as db:
        events = (await db.execute(select(WebhookEvent))).scalars().all()
        payments = (
            (await db.execute(select(Payment).where(Payment.provider == "revenuecat")))
            .scalars()
            .all()
        )
    assert len(events) == 1
    assert len(payments) == 1


# 4. 순서 역전


async def test_out_of_order_old_event_ignored(client):
    """RENEWAL 처리 뒤 늦게 도착한 옛 이벤트 → 최종 상태 동일"""
    renewal_expires = _now() + timedelta(days=60)
    res = await _post(
        client,
        make_payload("RENEWAL", expiration_at_ms=_ms(renewal_expires)),
    )
    assert res.status_code == 200
    expires_after_renewal = (await _me(client))["expires_at"]

    # 더 이른 만료시각을 가진 옛 INITIAL_PURCHASE가 늦게 도착
    res = await _post(
        client,
        make_payload(
            "INITIAL_PURCHASE",
            expiration_at_ms=_ms(_now() + timedelta(days=30)),
        ),
    )
    assert res.status_code == 200

    me = await _me(client)
    assert me["plan"] == "premium"
    assert me["expires_at"] == expires_after_renewal


# 5. 해지 예약


async def test_cancellation_keeps_premium_until_expiry(client):
    """해지 예약(UNSUBSCRIBE) → premium 유지 + will_renew=false"""
    expires = _now() + timedelta(days=20)
    await _post(client, make_payload(expiration_at_ms=_ms(expires)))

    res = await _post(
        client,
        make_payload(
            "CANCELLATION",
            cancel_reason="UNSUBSCRIBE",
            expiration_at_ms=_ms(expires),
        ),
    )
    assert res.status_code == 200

    me = await _me(client)
    assert me["plan"] == "premium"
    assert me["will_renew"] is False
    assert _parse_dt(me["expires_at"]) == expires  # 만료일까지 이용 가능


async def test_uncancellation_restores_will_renew(client):
    """해지 취소 → will_renew=true 복원"""
    expires = _now() + timedelta(days=20)
    await _post(client, make_payload(expiration_at_ms=_ms(expires)))
    await _post(
        client,
        make_payload(
            "CANCELLATION", cancel_reason="UNSUBSCRIBE", expiration_at_ms=_ms(expires)
        ),
    )
    res = await _post(
        client,
        make_payload("UNCANCELLATION", expiration_at_ms=_ms(expires)),
    )
    assert res.status_code == 200

    me = await _me(client)
    assert me["plan"] == "premium"
    assert me["will_renew"] is True


# 6. 환불


async def test_refund_terminates_immediately(client):
    """환불(CANCELLATION+CUSTOMER_SUPPORT) → 만료 덮어씀 → 즉시 종료"""
    await _post(
        client,
        make_payload(expiration_at_ms=_ms(_now() + timedelta(days=30))),
    )
    assert (await _me(client))["plan"] == "premium"

    # 환불은 만료시각이 환불 시점(과거)으로 당겨져 온다
    res = await _post(
        client,
        make_payload(
            "CANCELLATION",
            cancel_reason="CUSTOMER_SUPPORT",
            expiration_at_ms=_ms(_now() - timedelta(minutes=1)),
        ),
    )
    assert res.status_code == 200
    assert (await _me(client))["plan"] == "free"


# 7. 만료


async def test_expiration_downgrades_to_free(client):
    """EXPIRATION → free 전환, 중복 실행(lazy expiry와 겹침)해도 동일"""
    await _post(
        client,
        make_payload(expiration_at_ms=_ms(_now() + timedelta(days=30))),
    )

    first = await _post(client, make_payload("EXPIRATION"))
    assert first.status_code == 200
    assert (await _me(client))["plan"] == "free"

    # 같은 결과를 만드는 이벤트가 또 와도(중복 안전) 동일
    second = await _post(client, make_payload("EXPIRATION"))
    assert second.status_code == 200
    me = await _me(client)
    assert me["plan"] == "free"
    assert me["expires_at"] is None


# 8. 결제 실패 유예


async def test_billing_issue_extends_to_grace_period(client):
    """BILLING_ISSUE → expires_at이 grace 종료 시점으로 연장"""
    await _post(
        client,
        make_payload(expiration_at_ms=_ms(_now() + timedelta(days=5))),
    )

    grace = _now() + timedelta(days=16)
    res = await _post(
        client,
        make_payload(
            "BILLING_ISSUE",
            grace_period_expiration_at_ms=_ms(grace),
        ),
    )
    assert res.status_code == 200

    me = await _me(client)
    assert me["plan"] == "premium"
    assert _parse_dt(me["expires_at"]) == grace


# 9. 샌드박스 격리


async def test_sandbox_event_stored_but_not_applied(client):
    """environment=SANDBOX(서버는 PRODUCTION) → 저장만, 구독 불변"""
    res = await _post(
        client,
        make_payload(
            environment="SANDBOX",
            expiration_at_ms=_ms(_now() + timedelta(days=30)),
        ),
    )
    assert res.status_code == 200

    me = await _me(client)
    assert me["plan"] == "free"  # 상태 갱신 없음

    async with TestingSessionLocal() as db:
        events = (await db.execute(select(WebhookEvent))).scalars().all()
    assert len(events) == 1  # 저장은 됨
    assert events[0].processed is False


# 10. 미지 타입·미지 유저


async def test_unknown_type_and_unknown_user_return_200(client):
    """미지 타입·미지 유저·uuid 파싱 실패 → 전부 200, 500 없음"""
    # 미지 타입
    res = await _post(client, make_payload("SOME_FUTURE_TYPE"))
    assert res.status_code == 200

    # 존재하지 않는 유저
    res = await _post(
        client,
        make_payload(
            app_user_id=str(uuid.uuid4()),
            expiration_at_ms=_ms(_now() + timedelta(days=30)),
        ),
    )
    assert res.status_code == 200

    # uuid로 파싱 안 되는 app_user_id
    res = await _post(
        client,
        make_payload(
            app_user_id="$RCAnonymousID:abc123",
            expiration_at_ms=_ms(_now() + timedelta(days=30)),
        ),
    )
    assert res.status_code == 200

    # 어떤 경우에도 구독은 바뀌지 않았다
    assert (await _me(client))["plan"] == "free"
