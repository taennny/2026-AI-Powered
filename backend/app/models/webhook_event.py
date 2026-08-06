import uuid
from sqlalchemy import String, Boolean, DateTime, ForeignKey, JSON, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional


from app.database import Base


class WebhookEvent(Base):
    """RevenueCat 웹훅 수신 기록. event_id 유니크가 멱등성 키."""

    __tablename__ = "webhook_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # RevenueCat event.id — 재시도 시 같은 값이 재사용됨 (멱등성 키)
    event_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # SANDBOX | PRODUCTION
    environment: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    # TEST·TRANSFER 등엔 없을 수 있음
    app_user_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # 매칭된 우리 유저 (미매칭이면 null)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    # 원본 이벤트 통째 보존 (재생용). JSONB 금지 — 테스트가 SQLite라 깨짐
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    # 구독 상태 갱신까지 수행했는지 (저장만 한 경우 false)
    # SQLite에서 server_default="false"는 문자열 'false'(truthy)로 저장되므로 text() 사용
    processed: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false"), nullable=False
    )
    # 처리 생략/실패 사유 (환경 불일치, 유저 매칭 실패 등)
    error: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
