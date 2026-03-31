import uuid
from sqlalchemy import String, Boolean, DateTime, Text, ForeignKey, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import datetime, date
from typing import Optional
from app.database import Base

class Blog(Base):
    __tablename__ = "blogs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    daily_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("daily_records.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    style: Mapped[str] = mapped_column(String(20), nullable=False)
    target_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    generation_status: Mapped[str] = mapped_column(String(20), server_default="pending", nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    visibility: Mapped[str] = mapped_column(String(20), server_default="private", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)