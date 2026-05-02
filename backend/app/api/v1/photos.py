import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.photos import PhotoResponse
from app.services.photos import upload_photo, get_photo, get_photo_url
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/photos", tags=["photos"])


@router.post("/upload", response_model=PhotoResponse, status_code=200)
async def upload_photo_api(
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    allowed_types = {"image/jpeg", "image/png", "image/jpg"}
    if photo.content_type not in allowed_types:
        raise HTTPException(status_code=422, detail="지원하지 않는 파일 형식입니다")

    file_bytes = await photo.read()

    saved = await upload_photo(
        file_bytes=file_bytes,
        content_type=photo.content_type,
        user_id=current_user.id,
        db=db,
    )

    photo_url = await get_photo_url(saved.storage_key)

    return PhotoResponse(
        photo_id=saved.id,
        photo_url=photo_url,
        taken_at=saved.taken_at,
        latitude=saved.latitude,
        longitude=saved.longitude,
        created_at=saved.created_at,
    )


@router.get("/{photo_id}", response_model=PhotoResponse)
async def get_photo_api(
    photo_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    photo = await get_photo(photo_id=photo_id, user_id=current_user.id, db=db)
    if not photo:
        raise HTTPException(status_code=404, detail="사진을 찾을 수 없습니다")

    photo_url = await get_photo_url(photo.storage_key)

    return PhotoResponse(
        photo_id=photo.id,
        photo_url=photo_url,
        taken_at=photo.taken_at,
        latitude=photo.latitude,
        longitude=photo.longitude,
        created_at=photo.created_at,
    )