"""add blogs.period_end

Revision ID: f1a3c5e7b9d2
Revises: d8f2a4c6b1e3
Create Date: 2026-08-07

여러 날을 한 편으로 묶는 모아쓰기의 종료일. 하루짜리 글은 NULL이고,
모아쓰기는 target_date가 시작일, period_end가 종료일이다.
기존 행은 전부 하루짜리라 백필하지 않는다.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f1a3c5e7b9d2"
down_revision: Union[str, None] = "d8f2a4c6b1e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("blogs", sa.Column("period_end", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("blogs", "period_end")
