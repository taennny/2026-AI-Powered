import uuid

from pydantic import BaseModel


class PlaceUpdateRequest(BaseModel):
    name: str
    category: str | None = None


class PlaceResponse(BaseModel):
    place_id: uuid.UUID
    name: str
    category: str | None
    is_corrected: bool


class PlaceCandidate(BaseModel):
    place_name: str
    category: str | None = None
    address: str | None = None
    distance_m: float
    lat: float
    lng: float
    place_id: str | None = None


class PlaceCandidatesResponse(BaseModel):
    candidates: list[PlaceCandidate]


class PlaceSearchResponse(BaseModel):
    results: list[PlaceCandidate]
