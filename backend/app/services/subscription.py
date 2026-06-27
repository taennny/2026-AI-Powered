import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subscription import Subscription

# 결제주기별 구독 기간(일)
BILLING_DURATION_DAYS = {"monthly": 30, "annual": 365}


async def get_user_subscription(db: AsyncSession, user_id: uuid.UUID) -> Subscription:
    """유저의 구독 정보 조회. 없으면 free 플랜 자동 생성."""
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        subscription = Subscription(user_id=user_id, plan_type="free", is_active=True)
        db.add(subscription)
        await db.commit()
        await db.refresh(subscription)

    return subscription


async def update_user_subscription(
    db: AsyncSession,
    user_id: uuid.UUID,
    plan_type: str,
    billing_cycle: str = "monthly",
) -> Subscription:
    """구독 플랜 변경"""
    valid_plans = {"free", "premium"}
    if plan_type not in valid_plans:
        raise ValueError(f"유효하지 않은 플랜입니다: {plan_type}")
    if billing_cycle not in BILLING_DURATION_DAYS:
        raise ValueError(f"유효하지 않은 결제주기입니다: {billing_cycle}")

    subscription = await get_user_subscription(db, user_id)
    was_premium = subscription.plan_type == "premium"  # 덮어쓰기 전 기록

    subscription.plan_type = plan_type
    subscription.billing_cycle = billing_cycle
    if plan_type == "premium":
        subscription.is_active = True
        subscription.expires_at = datetime.now(timezone.utc) + timedelta(
            days=BILLING_DURATION_DAYS[billing_cycle]
        )
        # 첫 전환에만 기록, 재결제(premium→premium)면 유지
        if not was_premium:
            subscription.premium_started_at = datetime.now(timezone.utc)
    else:  # 해지(free 전환): 만료일·프리미엄 시작일 초기화
        subscription.expires_at = None
        subscription.premium_started_at = None
    await db.commit()
    await db.refresh(subscription)
    return subscription
