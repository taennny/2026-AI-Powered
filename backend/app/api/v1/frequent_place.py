# app/api/v1/frequent_place.py
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.frequent_place import (
    FrequentPlaceCreateRequest,
    FrequentPlaceListResponse,
    FrequentPlaceResponse,
    FrequentPlaceSearchResponse,
    ReverseGeocodeResponse,
)
from app.services.frequent_place import (
    create_frequent_place,
    delete_frequent_place,
    get_frequent_places,
    to_response_dict,
)
from app.services.kakao import coord_to_address, search_kakao_places
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/places/frequent", tags=["frequent-places"])


@router.post(
    "", response_model=FrequentPlaceResponse, status_code=status.HTTP_201_CREATED
)
async def register_frequent_place(
    request: FrequentPlaceCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """자주가는곳 등록"""
    place = await create_frequent_place(db, current_user.id, request)
    return FrequentPlaceResponse(**to_response_dict(place))


@router.get("", response_model=FrequentPlaceListResponse)
async def list_frequent_places(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """자주가는곳 목록 조회"""
    places = await get_frequent_places(db, current_user.id)
    return FrequentPlaceListResponse(places=[to_response_dict(p) for p in places])


@router.delete("/{place_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_frequent_place_api(
    place_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """자주가는곳 삭제"""
    try:
        await delete_frequent_place(db, place_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/search", response_model=FrequentPlaceSearchResponse)
async def search_address(
    query: str,
    current_user: User = Depends(get_current_user),
):
    """주소/건물명 검색 (카카오 로컬 API)"""
    try:
        results = await search_kakao_places(query)
    except ValueError:
        raise HTTPException(status_code=502, detail="주소 검색에 실패했습니다")
    return FrequentPlaceSearchResponse(results=results)


@router.get("/reverse-geocode", response_model=ReverseGeocodeResponse)
async def reverse_geocode(
    latitude: float,
    longitude: float,
    current_user: User = Depends(get_current_user),
):
    """현재 위치(좌표) → 주소 변환"""
    try:
        result = await coord_to_address(latitude, longitude)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return ReverseGeocodeResponse(**result)
