import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    daily_record_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("daily_records.id"), nullable=True
    )
    # 사용자가 직접 붙인 사진만 값이 있다 — 비어 있으면 기존대로 taken_at으로 장소를 찾는다
    place_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("places.id"), nullable=True
    )
    # 지운 사진의 묘비 — row를 지우면 앱 재설치 후 같은 사진이 다시 올라와 되살아난다
    is_deleted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    thumbnail_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    taken_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
