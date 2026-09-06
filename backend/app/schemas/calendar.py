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
    photos: List[str] = []
    thumbnails: List[str] = []


class TimelineResponse(BaseModel):
    date: str
    # 글쓰기에 필요한 그날의 daily_record id.
    # 프론트가 analyze 응답에서만 받으면 analyze가 돌린 날짜(오늘)의 것이라
    # 캘린더에서 고른 날짜와 어긋난다 — 어제 카드를 보며 글쓰기를 누르면
    # 오늘 기록으로 글이 생성된다. 화면에 그려지는 타임라인과 같은 응답에서
    # 내려주면 어긋날 수 없다.
    daily_record_id: str
    polyline: List[PolylinePoint]
    places: List[PlaceEntry]
