import io
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.photo import Photo
from app.schemas.photo import PhotoResponse
from app.services import exif_parser

router = APIRouter(prefix="/photos", tags=["photos"])

UPLOAD_DIR = Path("uploads/photos")
ALLOWED_MIME = {"image/jpeg", "image/png", "image/heic", "image/webp"}


@router.post("/upload", response_model=PhotoResponse, status_code=201)
async def upload_photo(
    user_id: uuid.UUID = Form(...),
    daily_record_id: uuid.UUID | None = Form(None),
    block_seq: int | None = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> PhotoResponse:
    mime = file.content_type or "application/octet-stream"
    if mime not in ALLOWED_MIME:
        raise HTTPException(status_code=415, detail=f"Unsupported media type: {mime}")

    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 20MB)")

    photo_id = uuid.uuid4()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "photo.jpg").suffix or ".jpg"
    stored_path = str(UPLOAD_DIR / f"{photo_id}{suffix}")

    with open(stored_path, "wb") as f:
        f.write(contents)

    exif_data: dict = {"taken_at": None, "latitude": None, "longitude": None}
    try:
        img = Image.open(io.BytesIO(contents))
        exif_data = exif_parser.parse(img)
    except Exception:
        pass

    photo = Photo(
        id=photo_id,
        user_id=user_id,
        daily_record_id=daily_record_id,
        block_seq=block_seq,
        original_filename=file.filename or "photo.jpg",
        stored_path=stored_path,
        mime_type=mime,
        file_size=len(contents),
        **exif_data,
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)
    return PhotoResponse.model_validate(photo)


@router.get("/{photo_id}", response_model=PhotoResponse)
async def get_photo(
    photo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> PhotoResponse:
    photo = await db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return PhotoResponse.model_validate(photo)
