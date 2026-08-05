from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.subscription import (
    PaymentVerifyRequest,
    PaymentVerifyResponse,
    SubscriptionResponse,
    SubscriptionUpdateRequest,
)
from app.services.payment import process_receipt
from app.services.payment_verifier import ReceiptVerificationError
from app.services.subscription import get_user_subscription, update_user_subscription
from app.utils.dependencies import get_current_user

router = APIRouter(tags=["subscription"])


@router.get("/api/v1/subscriptions/me", response_model=SubscriptionResponse)
async def get_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """내 구독 정보 조회"""
    subscription = await get_user_subscription(db, current_user.id)
    return subscription


@router.put("/api/v1/subscriptions/me", response_model=SubscriptionResponse)
async def change_subscription(
    request: SubscriptionUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """구독 플랜 변경"""
    try:
        subscription = await update_user_subscription(
            db, current_user.id, request.plan_type, request.billing_cycle
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return subscription


@router.post("/api/v1/subscriptions/verify", response_model=PaymentVerifyResponse)
async def verify_payment(
    request: PaymentVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """영수증 검증 후 구독 반영 (같은 영수증 재전송은 멱등 처리)"""
    try:
        payment, created = await process_receipt(
            db, current_user.id, request.provider, request.receipt
        )
    except (ValueError, ReceiptVerificationError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    return PaymentVerifyResponse(
        transaction_id=payment.transaction_id,
        plan=payment.plan_type,
        billing_cycle=payment.billing_cycle,
        already_processed=not created,
        message="결제가 반영되었습니다" if created else "이미 처리된 결제입니다",
    )
