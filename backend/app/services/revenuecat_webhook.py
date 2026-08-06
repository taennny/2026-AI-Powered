"""RevenueCat 웹훅 이벤트 처리.

인증·페이로드 파싱은 라우터가 담당하고, 여기서는
멱등 저장 → 환경 격리 → 유저 매칭 → 이벤트 분기 순으로 처리한다.
"""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.payment import Payment
from app.models.user import User
from app.models.webhook_event import WebhookEvent
from app.services.subscription import get_user_subscription, update_user_subscription

logger = logging.getLogger(__name__)

# product_id → (plan_type, billing_cycle). 미지 product_id는 결제 기록 생략
PRODUCT_PLAN_MAP = {
    "com.picknavi.roame.premium.monthly": ("premium", "monthly"),
    "com.picknavi.roame.premium.annual": ("premium", "annual"),
}

# 연장 계열: expiration이 DB보다 미래일 때만 적용 (늦게 도착한 옛 이벤트 무시)
EXTENSION_EVENTS = {
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "SUBSCRIPTION_EXTENDED",
}
# payments 기록 대상 (돈이 움직인 이벤트만)
PAYMENT_EVENTS = {"INITIAL_PURCHASE", "RENEWAL"}
# 구독 상태를 바꾸는 이벤트 전체 — 이 외(TEST·PRODUCT_CHANGE·미지 타입 등)는 저장+로그만
HANDLED_EVENTS = EXTENSION_EVENTS | {"CANCELLATION", "EXPIRATION", "BILLING_ISSUE"}


def _ms_to_datetime(ms) -> datetime | None:
    """ms epoch → aware datetime(UTC). 값이 없거나 형식이 틀리면 None."""
    if ms is None:
        return None
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc)
    except (ValueError, TypeError, OSError):
        return None


def _as_utc(dt: datetime) -> datetime:
    """naive datetime(SQLite)은 UTC로 간주해 비교 가능하게 만든다."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


async def _get_by_event_id(db: AsyncSession, event_id: str) -> WebhookEvent | None:
    result = await db.execute(
        select(WebhookEvent).where(WebhookEvent.event_id == event_id)
    )
    return result.scalar_one_or_none()


async def _resolve_user_id(db: AsyncSession, app_user_id) -> uuid.UUID | None:
    """app_user_id를 우리 user_id로 매칭. 파싱 실패·미존재 유저면 None."""
    try:
        user_id = uuid.UUID(str(app_user_id))
    except (ValueError, TypeError):
        return None
    result = await db.execute(select(User.id).where(User.id == user_id))
    return result.scalar_one_or_none()


async def process_webhook_event(
    db: AsyncSession, event: dict
) -> tuple[WebhookEvent, bool]:
    """웹훅 이벤트 1건 처리. 반환: (수신 기록, 신규 처리 여부).

    멱등성: event.id가 이미 저장돼 있으면 상태를 건드리지 않고
    기존 기록을 반환한다 (재시도 중복 처리 방지).
    """
    event_id = str(event.get("id") or uuid.uuid4())  # id 누락 시에도 기록은 남긴다
    existing = await _get_by_event_id(db, event_id)
    if existing:
        return existing, False

    environment = event.get("environment")
    record = WebhookEvent(
        event_id=event_id,
        event_type=str(event.get("type") or "UNKNOWN"),
        environment=str(environment) if environment is not None else None,
        app_user_id=event.get("app_user_id"),
        payload=event,
    )
    db.add(record)
    try:
        await db.flush()
    except IntegrityError:
        # 동시 재전송 레이스: unique 제약에 맡기고 중복으로 처리
        await db.rollback()
        existing = await _get_by_event_id(db, event_id)
        if existing is None:
            raise
        return existing, False
    await db.commit()  # 멱등 키 확정 — 이후 처리가 실패해도 수신 기록은 남는다

    # 환경 격리: 서버 환경과 불일치(SANDBOX 수신 등)면 저장만, 상태 갱신 생략
    if record.environment != settings.REVENUECAT_ENVIRONMENT:
        logger.info(
            "RevenueCat 환경 불일치로 저장만 수행: environment=%s event_id=%s",
            record.environment,
            event_id,
        )
        record.error = f"environment 불일치: {record.environment}"
        await db.commit()
        return record, True

    if record.event_type not in HANDLED_EVENTS:
        # TEST·PRODUCT_CHANGE·SUBSCRIPTION_PAUSED·TRANSFER·미지 타입: 저장+로그만
        logger.info(
            "RevenueCat 이벤트 저장만 수행: type=%s event_id=%s",
            record.event_type,
            event_id,
        )
        record.processed = True
        await db.commit()
        return record, True

    user_id = await _resolve_user_id(db, record.app_user_id)
    if user_id is None:
        logger.warning(
            "RevenueCat 이벤트의 유저 매칭 실패: app_user_id=%r event_id=%s",
            record.app_user_id,
            event_id,
        )
        record.error = "유저 매칭 실패"
        await db.commit()
        return record, True

    record.user_id = user_id
    await db.commit()

    await _apply_event(db, user_id, event, record.event_type)
    record.processed = True
    await db.commit()
    return record, True


async def _apply_event(
    db: AsyncSession, user_id: uuid.UUID, event: dict, event_type: str
) -> None:
    """이벤트 타입별 구독 상태 반영 (설계 v2 표 기준)."""
    if event_type in PAYMENT_EVENTS:
        # 결제 기록은 순서 규칙과 무관하게 남긴다 (transaction_id 멱등)
        await _record_payment(db, user_id, event)

    subscription = await get_user_subscription(db, user_id)

    if event_type in EXTENSION_EVENTS:
        if event_type == "UNCANCELLATION":
            # 해지 취소: 만료 연장 여부와 무관하게 갱신 예정 복원
            subscription.will_renew = True
            await db.commit()

        expires = _ms_to_datetime(event.get("expiration_at_ms"))
        current = subscription.expires_at
        # DB가 None이면(lazy expiry 초기화 포함) 비교 없이 적용
        if expires is None or (current is not None and expires <= _as_utc(current)):
            logger.info(
                "옛 이벤트라 만료 갱신 생략: type=%s expiration=%s", event_type, expires
            )
            return

        mapped = PRODUCT_PLAN_MAP.get(event.get("product_id"))
        billing_cycle = mapped[1] if mapped else subscription.billing_cycle
        await update_user_subscription(
            db, user_id, "premium", billing_cycle, expires_at=expires, will_renew=True
        )

    elif event_type == "CANCELLATION":
        if event.get("cancel_reason") == "CUSTOMER_SUPPORT":
            # 환불: 만료시각이 환불 시점으로 당겨져 오므로 그대로 덮어씀 → 사실상 즉시 종료
            expires = _ms_to_datetime(event.get("expiration_at_ms"))
            if expires is None:
                logger.warning("환불 이벤트에 expiration_at_ms 없음 — 상태 유지")
                return
            subscription.expires_at = expires
            subscription.will_renew = False
            await db.commit()
        else:
            # 해지 예약: 만료일까지 이용 가능, 다음 갱신만 중단
            subscription.will_renew = False
            await db.commit()

    elif event_type == "EXPIRATION":
        # free 전환 — lazy expiry와 결과가 같아 중복 실행해도 안전
        await update_user_subscription(db, user_id, "free")

    elif event_type == "BILLING_ISSUE":
        grace = _ms_to_datetime(event.get("grace_period_expiration_at_ms"))
        if grace is None:
            logger.info("BILLING_ISSUE에 grace 기간 없음 — 상태 유지")
            return
        # 유예 종료 시점까지 연장 (안 하면 lazy expiry가 원래 만료일에 끊는다)
        subscription.expires_at = grace
        await db.commit()


async def _record_payment(db: AsyncSession, user_id: uuid.UUID, event: dict) -> None:
    """INITIAL_PURCHASE·RENEWAL 결제 기록. transaction_id 기준 멱등."""
    transaction_id = event.get("transaction_id")
    product_id = event.get("product_id")
    mapped = PRODUCT_PLAN_MAP.get(product_id)
    if not transaction_id or mapped is None:
        logger.warning(
            "결제 기록 생략: transaction_id=%r product_id=%r",
            transaction_id,
            product_id,
        )
        return

    result = await db.execute(
        select(Payment).where(Payment.transaction_id == str(transaction_id))
    )
    if result.scalar_one_or_none():
        return

    plan_type, billing_cycle = mapped
    db.add(
        Payment(
            user_id=user_id,
            provider="revenuecat",
            transaction_id=str(transaction_id),
            product_id=str(product_id),
            plan_type=plan_type,
            billing_cycle=billing_cycle,
        )
    )
    try:
        await db.flush()
    except IntegrityError:
        # 동시 처리 레이스: 이미 기록된 것으로 간주
        await db.rollback()
