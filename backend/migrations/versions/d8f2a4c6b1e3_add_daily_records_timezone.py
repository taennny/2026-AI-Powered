"""add daily_records.timezone

Revision ID: d8f2a4c6b1e3
Revises: c7e1a3b5d9f0
Create Date: 2026-08-06

그날 사용자가 있던 지역의 IANA 타임존. 값을 채우는 것은 analyze 흐름 담당이며,
기존 행은 국내 서비스로 운영된 기간이라 Asia/Seoul로 백필한다.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d8f2a4c6b1e3"
down_revision: Union[str, None] = "c7e1a3b5d9f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "daily_records",
        sa.Column("timezone", sa.String(length=64), nullable=True),
    )
    # 기존 기록은 전부 국내에서 만들어졌으므로 백필해 둔다.
    # (나중에 넣으면 과거 기록이 어느 지역이었는지 알 수 없다)
    op.execute(
        "UPDATE daily_records SET timezone = 'Asia/Seoul' WHERE timezone IS NULL"
    )


def downgrade() -> None:
    op.drop_column("daily_records", "timezone")
