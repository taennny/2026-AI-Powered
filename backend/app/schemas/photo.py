import uuid
from datetime import datetime

from pydantic import BaseModel


class PhotoResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    daily_record_id: uuid.UUID | None
    block_seq: int | None
    original_filename: str
    stored_path: str
    mime_type: str
    file_size: int
    taken_at: datetime | None
    latitude: float | None
    longitude: float | None
    created_at: datetime

    model_config = {"from_attributes": True}
