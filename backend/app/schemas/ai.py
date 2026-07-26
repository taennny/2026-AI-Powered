from datetime import datetime

from pydantic import BaseModel
from uuid import UUID
from typing import Optional


class AIGpsLogItem(BaseModel):
    time: datetime
    lat: float
    lng: float


class AIAnalyzeRequest(BaseModel):
    user_id: str
    gps_logs: list[AIGpsLogItem]


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
