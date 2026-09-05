import uuid
from sqlalchemy import JSON, String, Boolean, DateTime, Text, ForeignKey, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import datetime, date
from typing import Optional
from app.database import Base


class Blog(Base):
    __tablename__ = "blogs"
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    daily_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("daily_records.id"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    style: Mapped[str] = mapped_column(String(20), nullable=False)
    # 여러 날을 한 편으로 묶은 글(모아쓰기)이면 target_date가 시작일이 된다.
    target_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    # 모아쓰기 종료일. 하루짜리 글은 NULL.
    period_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # 글에 실제로 포함된 날짜 목록(ISO 문자열 배열). 하루짜리 글은 NULL(daily_record_id로 판정).
    # 구간으로 요청이 들어와도 "기록이 있는 날짜"만 담기므로,
    # 캘린더의 "이 날 글이 있나"(has_journal) 판정은 이 배열을 기준으로 해야
    # 고르지 않은 날에 글이 있다고 잘못 표시되지 않는다.
    # JSONB가 아닌 JSON을 쓰는 이유: SQLite 테스트 DB 호환.
    target_dates: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    generation_status: Mapped[str] = mapped_column(
        String(20), server_default="pending", nullable=False
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean, server_default="false", nullable=False
    )
    visibility: Mapped[str] = mapped_column(
        String(20), server_default="private", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    # 소프트 삭제 시각. NULL이면 살아있는 글.
    # 하드 삭제하지 않는 이유는 주간 생성 횟수를 유지하기 위해서다(services/blog.py 참고).
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
