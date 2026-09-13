# app/schemas/frequent_place.py
import uuid
from datetime import datetime

from pydantic import BaseModel


# 자주가는곳 등록 요청
class FrequentPlaceCreateRequest(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float


# 자주가는곳 등록/조회 응답
class FrequentPlaceResponse(BaseModel):
    place_id: uuid.UUID
    name: str
    address: str
    latitude: float
    longitude: float
    created_at: datetime


# 자주가는곳 목록 조회 응답
class FrequentPlaceListResponse(BaseModel):
    places: list[FrequentPlaceResponse]


# 주소 검색 결과 항목
class PlaceSearchResult(BaseModel):
    place_name: str
    address: str
    latitude: float
    longitude: float


# 주소 검색 응답
class FrequentPlaceSearchResponse(BaseModel):
    results: list[PlaceSearchResult]

# 현재 위치 → 주소 변환 응답
class ReverseGeocodeResponse(BaseModel):
    address: str