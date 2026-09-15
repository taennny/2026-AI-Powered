import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.place_photo import PlacePhotoResponse
from app.services.place_photo import delete_place_photo, replace_place_photo
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/places", tags=["place-photos"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg", "image/heic", "image/heif"}


@router.put("/{place_id}/photo", response_model=PlacePhotoResponse)
async def replace_place_photo_api(
    place_id: uuid.UUID,
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """카드 사진 교체 — 기존 사진은 파일까지 지우고 묘비만 남긴다"""
    if photo.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=422, detail="지원하지 않는 파일 형식입니다")

    try:
        saved, photo_url, thumbnail_url = await replace_place_photo(
            db=db,
            place_id=place_id,
            user_id=current_user.id,
            file_bytes=await photo.read(),
            content_type=photo.content_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return PlacePhotoResponse(
        photo_id=saved.id, photo_url=photo_url, thumbnail_url=thumbnail_url
    )


@router.delete("/{place_id}/photo", status_code=204)
async def delete_place_photo_api(
    place_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """카드 사진 삭제 — 다시 올려도 되살아나지 않는다"""
    try:
        await delete_place_photo(db, place_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
