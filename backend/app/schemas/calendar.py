import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.blog import TimelineBlock


class DailyRecordResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    target_date: date
    blocks: list[TimelineBlock]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
