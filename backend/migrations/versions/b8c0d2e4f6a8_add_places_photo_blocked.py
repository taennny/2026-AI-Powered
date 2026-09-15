"""add places.photo_blocked

Revision ID: b8c0d2e4f6a8
Revises: a7b9c1d3e5f7
Create Date: 2026-09-16

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b8c0d2e4f6a8"
down_revision: Union[str, None] = "a7b9c1d3e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "places",
        sa.Column(
            "photo_blocked", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )


def downgrade() -> None:
    op.drop_column("places", "photo_blocked")
