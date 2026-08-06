from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SubscriptionResponse(BaseModel):
    plan: str = Field(validation_alias="plan_type")
    billing_cycle: str
    started_at: Optional[datetime] = Field(default=None, validation_alias="created_at")
    premium_started_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: bool
    # 다음 결제일 갱신 예정 여부 — 해지 예약 시 false ("X일까지 이용 가능" 표시용)
    will_renew: bool = True

    model_config = {"from_attributes": True}


class SubscriptionUpdateRequest(BaseModel):
    plan_type: str
    # 프론트가 월/연 선택을 보내지 않으면 monthly로 처리 (하위호환)
    billing_cycle: str = "monthly"


class PaymentVerifyRequest(BaseModel):
    # 실결제 도입 전까지는 mock 검증기만 지원
    provider: str = "mock"
    receipt: str


class PaymentVerifyResponse(BaseModel):
    transaction_id: str
    plan: str
    billing_cycle: str
    already_processed: bool
    message: str
