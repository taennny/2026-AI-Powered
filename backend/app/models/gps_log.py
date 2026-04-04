import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, Float, ForeignKey, BigInteger, Index
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geometry
from app.models.user import Base


class GpsLog(Base):
    __tablename__ = "gps_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    location: Mapped[object] = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    __table_args__ = (
        Index("ix_gps_logs_user_recorded", "user_id", "recorded_at"),
    )