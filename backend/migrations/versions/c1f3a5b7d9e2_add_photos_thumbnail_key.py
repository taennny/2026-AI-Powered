"""add photos.thumbnail_key

Revision ID: c1f3a5b7d9e2
Revises: b6d8f0a2c4e5
Create Date: 2026-09-07

카드 썸네일용 축소본의 storage key. 업로드 시점에 원본과 함께 만든다.

백필하지 않는다 — 이 컬럼이 생기기 전에 올라온 사진은 축소본 파일 자체가
없으므로, 키만 채우면 없는 파일을 가리키게 된다. NULL로 두고 조회 측이
원본으로 폴백한다.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c1f3a5b7d9e2"
down_revision: Union[str, None] = "b6d8f0a2c4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "photos",
        sa.Column("thumbnail_key", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("photos", "thumbnail_key")
