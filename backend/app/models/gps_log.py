import uuid
from datetime import datetime
from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GpsLog(Base):
    __tablename__ = "gps_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    location: Mapped[object] = mapped_column(
        Geometry("POINT", srid=4326), nullable=False
    )
    accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    speed: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    # 수집 당시 기기 tz. 여행 중에는 하루 안에서도 달라진다
    timezone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    __table_args__ = (Index("ix_gps_logs_user_recorded", "user_id", "recorded_at"),)
