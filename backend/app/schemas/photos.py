from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PhotoResponse(BaseModel):
    photo_id: UUID
    photo_url: str
    taken_at: datetime | None
    latitude: float | None
    longitude: float | None
    created_at: datetime

    model_config = {"from_attributes": True}
