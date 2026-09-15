"""add photos.place_id and photos.is_deleted

Revision ID: a7b9c1d3e5f7
Revises: f05cc032cd45
Create Date: 2026-09-15

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7b9c1d3e5f7"
down_revision: Union[str, None] = "f05cc032cd45"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("photos", sa.Column("place_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_photos_place_id", "photos", "places", ["place_id"], ["id"]
    )
    op.create_index("ix_photos_place_id", "photos", ["place_id"])
    op.add_column(
        "photos",
        sa.Column(
            "is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )


def downgrade() -> None:
    op.drop_column("photos", "is_deleted")
    op.drop_index("ix_photos_place_id", table_name="photos")
    op.drop_constraint("fk_photos_place_id", "photos", type_="foreignkey")
    op.drop_column("photos", "place_id")
