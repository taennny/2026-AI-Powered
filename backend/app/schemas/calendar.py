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
    # 이 장소를 어느 지역 시각으로 보여줄지. 서버가 폴백까지 채워 보낸다
    timezone: str | None = None
    # 그 시간대의 UTC 오프셋(분). 앱이 Intl 없이 현지 시각을 그린다.
    # 0은 "모름"이 아니라 UTC라는 값이라, 비었으면 None으로 둔다 —
    # 앱이 그때만 기기 시간대로 폴백한다
    utc_offset_minutes: int | None = None
    photos: List[str] = []


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
