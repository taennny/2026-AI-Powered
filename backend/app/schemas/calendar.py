# app/schemas/calendar.py

from datetime import datetime
from typing import List

from pydantic import BaseModel


class DayEntry(BaseModel):
    date: str
    has_journal: bool
    has_timeline: bool


class CalendarResponse(BaseModel):
    year: int
    month: int
    days: List[DayEntry]


class PolylinePoint(BaseModel):
    lat: float
    lng: float


class PlaceEntry(BaseModel):
    place_id: str
    name: str
    category: str | None
    arrived_at: datetime
    left_at: datetime | None
    lat: float
    lng: float


class TimelineResponse(BaseModel):
    date: str
    total_distance: float
    polyline: List[PolylinePoint]
    places: List[PlaceEntry]
