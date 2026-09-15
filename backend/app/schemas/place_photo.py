from uuid import UUID

from pydantic import BaseModel


class PlacePhotoResponse(BaseModel):
    photo_id: UUID
    photo_url: str
    thumbnail_url: str

    model_config = {"from_attributes": True}
