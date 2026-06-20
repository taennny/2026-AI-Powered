"""sync schema drift: daily_records.map_image_url 추가 + photos storage_url→storage_key

init 마이그레이션 이후 모델에 반영됐지만 마이그레이션이 누락된 변경을 정합한다.
- daily_records: map_image_url 컬럼 추가 (모델엔 있으나 DB에 없어 조회 시 에러)
- photos: storage_url → storage_key 이름 변경 (rename으로 데이터 보존)

Revision ID: c3d9f0a1b2e4
Revises: 1839a65b4684
Create Date: 2026-06-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d9f0a1b2e4"
down_revision: Union[str, None] = "1839a65b4684"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "daily_records",
        sa.Column("map_image_url", sa.String(), nullable=True),
    )
    op.alter_column("photos", "storage_url", new_column_name="storage_key")


def downgrade() -> None:
    op.alter_column("photos", "storage_key", new_column_name="storage_url")
    op.drop_column("daily_records", "map_image_url")
