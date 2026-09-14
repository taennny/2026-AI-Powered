from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AIGpsLogItem(BaseModel):
    time: datetime
    lat: float
    lng: float
    accuracy: float | None = None


class AISavedPlaceItem(BaseModel):
    name: str
    lat: float
    lng: float


class AIAnalyzeRequest(BaseModel):
    user_id: str
    gps_logs: list[AIGpsLogItem]
    saved_places: list[AISavedPlaceItem] = []


class AIStayItem(BaseModel):
    place_name: str
    category: str
    start: datetime
    end: datetime
    duration_min: int
    lat: float
    lng: float


class AIAnalyzeResponse(BaseModel):
    stays: list[AIStayItem]


class AnalyzeResponse(BaseModel):
    daily_record_id: Optional[UUID] = None
    message: str
    place_count: int
