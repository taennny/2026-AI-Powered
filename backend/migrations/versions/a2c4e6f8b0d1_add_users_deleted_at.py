"""add users.deleted_at

Revision ID: a2c4e6f8b0d1
Revises: f1a3c5e7b9d2
Create Date: 2026-08-20

회원탈퇴(소프트 삭제)용 컬럼. 값을 채우고 조회에서 제외하는 처리는 auth 쪽 담당.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a2c4e6f8b0d1"
down_revision: Union[str, None] = "f1a3c5e7b9d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "deleted_at")
