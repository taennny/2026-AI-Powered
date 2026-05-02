from pydantic import BaseModel
from datetime import datetime


class GPSLogItem(BaseModel):
    lat: float
    lng: float
    accuracy: float | None = None
    speed: float | None = None
    timestamp: datetime


class GPSLogBatchRequest(BaseModel):
    logs: list[GPSLogItem]


class GPSLogBatchResponse(BaseModel):
    saved_count: int
