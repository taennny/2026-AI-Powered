"""add gps_logs.timezone, places.timezone

Revision ID: e7b3d1f5a9c2
Revises: c1f3a5b7d9e2
Create Date: 2026-09-07

`daily_records.timezone`은 하루에 하나뿐이라 비행기 탄 날을 표현할 수 없다.
GPS 로그가 수집 시점의 기기 tz를 들고 있으므로 거기서 장소의 tz를 정한다.

백필하지 않는다 — 기존 로그의 tz는 알 방법이 없다. NULL이면 읽는 쪽이
그날의 tz로 폴백하므로 지금과 똑같이 동작한다.

썸네일 마이그레이션(c1f3a5b7d9e2, PR #126) 뒤에 붙는다. 그쪽이 먼저 머지돼야
한다 — 순서가 뒤집히면 이 리비전을 찾지 못한다.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e7b3d1f5a9c2"
down_revision: Union[str, None] = "c1f3a5b7d9e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "gps_logs",
        sa.Column("timezone", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "places",
        sa.Column("timezone", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("places", "timezone")
    op.drop_column("gps_logs", "timezone")
