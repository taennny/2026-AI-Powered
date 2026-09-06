import uuid
from datetime import datetime, timezone
from sqlalchemy import Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    daily_record_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("daily_records.id"), nullable=True
    )
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    # 카드 썸네일용 축소본. 이 컬럼이 생기기 전에 올라온 사진은 NULL이라
    # 조회 측이 원본으로 폴백한다 (규칙으로 키를 추측하면 없는 파일을 가리킨다)
    thumbnail_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    taken_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
