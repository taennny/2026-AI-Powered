import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DailyRecord(Base):
    __tablename__ = "daily_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    place_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    photo_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_distance: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    map_image_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("user_id", "target_date", name="uq_daily_records_user_date"),
    )
