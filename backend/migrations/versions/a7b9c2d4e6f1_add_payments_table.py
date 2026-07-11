"""payments 테이블 추가 (영수증 검증 기록, transaction_id 멱등성 키)

Revision ID: a7b9c2d4e6f1
Revises: d1e2f3a4b5c6
Create Date: 2026-07-12

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7b9c2d4e6f1"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("transaction_id", sa.String(length=255), nullable=False),
        sa.Column("product_id", sa.String(length=100), nullable=False),
        sa.Column("plan_type", sa.String(length=20), nullable=False),
        sa.Column("billing_cycle", sa.String(length=10), nullable=False),
        sa.Column(
            "status", sa.String(length=20), server_default="verified", nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.UniqueConstraint("transaction_id", name="uq_payments_transaction_id"),
    )


def downgrade() -> None:
    op.drop_table("payments")
