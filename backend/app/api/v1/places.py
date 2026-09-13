import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.place import (
    PlaceCandidatesResponse,
    PlaceResponse,
    PlaceSearchResponse,
    PlaceUpdateRequest,
)
from app.services.place import (
    delete_place,
    get_candidates,
    search_places,
    update_place,
)
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/places", tags=["places"])


@router.get("/{place_id}/candidates", response_model=PlaceCandidatesResponse)
async def get_place_candidates(
    place_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """장소 후보 조회 (AI 서버 중계)"""
    try:
        result = await get_candidates(db, place_id, current_user.id)
        return PlaceCandidatesResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/search", response_model=PlaceSearchResponse)
async def search_place(
    lat: float,
    lng: float,
    query: str,
    current_user: User = Depends(get_current_user),
):
    """키워드로 장소 검색 (AI 서버 중계)"""
    result = await search_places(lat, lng, query)
    return PlaceSearchResponse(**result)


@router.put("/{place_id}", response_model=PlaceResponse)
async def update_place_api(
    place_id: uuid.UUID,
    request: PlaceUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """장소 이름/카테고리 수정"""
    try:
        place = await update_place(
            db, place_id, current_user.id, request.name, request.category
        )
        return PlaceResponse(
            place_id=place.id,
            name=place.name,
            category=place.category,
            is_corrected=place.is_corrected,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{place_id}", status_code=204)
async def delete_place_api(
    place_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """장소 삭제 (소프트 삭제)"""
    try:
        await delete_place(db, place_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
