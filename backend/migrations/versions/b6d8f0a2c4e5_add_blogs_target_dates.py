"""add blogs.target_dates

Revision ID: b6d8f0a2c4e5
Revises: d74e41267c35
Create Date: 2026-08-24

글에 실제로 포함된 날짜 목록. 하루짜리 글은 NULL이고, 모아쓰기(구간·임의 선택)는
기록이 있는 날짜만 ISO 문자열 배열로 담는다. 캘린더의 "이 날 글이 있나" 판정에 쓰인다.

백필하지 않는 이유: 모아쓰기 기능이 아직 배포 전이라 period_end가 채워진 운영 행이 없다.
(target_dates가 NULL이고 period_end만 있는 행은 대상이 없다)

JSONB가 아닌 JSON을 쓰는 이유: SQLite 테스트 DB와 스키마를 공유하기 때문.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b6d8f0a2c4e5"
down_revision: Union[str, None] = "d74e41267c35"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("blogs", sa.Column("target_dates", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("blogs", "target_dates")
