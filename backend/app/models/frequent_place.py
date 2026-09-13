# app/models/frequent_place.py
import uuid
from datetime import datetime, timezone

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FrequentPlace(Base):
    __tablename__ = "frequent_places"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    location: Mapped[object] = mapped_column(
        Geometry("POINT", srid=4326), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
