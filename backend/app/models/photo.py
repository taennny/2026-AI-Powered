import uuid
from sqlalchemy import Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from datetime import datetime
from typing import Optional
from app.database import Base

class Photo(Base):
    __tablename__ = "photos"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    daily_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("daily_records.id"), nullable=True)
    storage_url: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[Optional[Geometry]] = mapped_column(Geometry(geometry_type='POINT', srid=4326), nullable=True)
    taken_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)