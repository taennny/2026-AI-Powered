import uuid
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import datetime

from app.database import Base


class Payment(Base):
    """결제 검증 기록. 카드정보·PII는 저장하지 않는다 (스토어 영수증 검증 결과만 보관)."""

    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    # 결제 제공자: "mock" | "google" | "apple"
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    # 스토어 트랜잭션 ID — 멱등성 키 (같은 영수증 중복 처리 방지)
    transaction_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    product_id: Mapped[str] = mapped_column(String(100), nullable=False)
    plan_type: Mapped[str] = mapped_column(String(20), nullable=False)
    billing_cycle: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), server_default="verified", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
