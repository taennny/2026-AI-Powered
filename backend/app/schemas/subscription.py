from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SubscriptionResponse(BaseModel):
    plan: str = Field(validation_alias="plan_type")
    started_at: Optional[datetime] = Field(default=None, validation_alias="created_at")
    expires_at: Optional[datetime] = None
    is_active: bool

    model_config = {"from_attributes": True}


class SubscriptionUpdateRequest(BaseModel):
    plan_type: str
