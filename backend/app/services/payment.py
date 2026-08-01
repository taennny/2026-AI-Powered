import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import Payment
from app.services.payment_verifier import VERIFIERS
from app.services.subscription import update_user_subscription


async def _get_by_transaction_id(
    db: AsyncSession, transaction_id: str
) -> Payment | None:
    result = await db.execute(
        select(Payment).where(Payment.transaction_id == transaction_id)
    )
    return result.scalar_one_or_none()


async def process_receipt(
    db: AsyncSession,
    user_id: uuid.UUID,
    provider: str,
    receipt: str,
) -> tuple[Payment, bool]:
    """영수증 검증 → 결제 기록 → 구독 연장. 반환: (payment, 신규 처리 여부).

    멱등성: transaction_id 기준으로 같은 영수증이 재전송되면
    구독을 건드리지 않고 기존 기록을 반환한다 (중복 연장 방지).
    """
    if provider not in VERIFIERS:
        raise ValueError("지원하지 않는 결제 제공자")

    # 검증 실패(ReceiptVerificationError)는 그대로 전파 → 라우터에서 400
    verified = await VERIFIERS[provider].verify(receipt)

    existing = await _get_by_transaction_id(db, verified.transaction_id)
    if existing:
        if existing.user_id != user_id:
            # 다른 유저의 영수증 재사용 방지
            raise ValueError("다른 사용자의 결제입니다")
        return existing, False

    payment = Payment(
        user_id=user_id,
        provider=provider,
        transaction_id=verified.transaction_id,
        product_id=verified.product_id,
        plan_type=verified.plan_type,
        billing_cycle=verified.billing_cycle,
    )
    db.add(payment)
    try:
        await db.flush()
    except IntegrityError:
        # 동시 요청 레이스: unique 제약에 맡기고 중복으로 처리
        await db.rollback()
        existing = await _get_by_transaction_id(db, verified.transaction_id)
        if existing is None:
            raise
        if existing.user_id != user_id:
            raise ValueError("다른 사용자의 결제입니다")
        return existing, False

    await update_user_subscription(
        db, user_id, verified.plan_type, verified.billing_cycle
    )
    await db.commit()
    await db.refresh(payment)
    return payment, True
