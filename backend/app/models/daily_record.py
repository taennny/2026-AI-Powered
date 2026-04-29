import uuid
from sqlalchemy import ForeignKey, Integer, Float, Date, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import datetime, date
from typing import Optional
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
    place_count: Mapped[int] = mapped_column(
        Integer, server_default="0", nullable=False
    )
    photo_count: Mapped[int] = mapped_column(
        Integer, server_default="0", nullable=False
    )
    total_distance: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("user_id", "target_date", name="_user_target_date_uc"),
    )
