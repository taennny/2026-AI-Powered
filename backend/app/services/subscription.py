import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subscription import Subscription

PREMIUM_DURATION_DAYS = 30


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
    db: AsyncSession, user_id: uuid.UUID, plan_type: str
) -> Subscription:
    """구독 플랜 변경"""
    valid_plans = {"free", "premium"}
    if plan_type not in valid_plans:
        raise ValueError(f"유효하지 않은 플랜입니다: {plan_type}")

    subscription = await get_user_subscription(db, user_id)
    subscription.plan_type = plan_type
    if plan_type == "premium":
        subscription.is_active = True
        subscription.expires_at = datetime.now(timezone.utc) + timedelta(
            days=PREMIUM_DURATION_DAYS
        )
    else:  # free 전환 시 만료일 해제
        subscription.expires_at = None
    await db.commit()
    await db.refresh(subscription)
    return subscription
