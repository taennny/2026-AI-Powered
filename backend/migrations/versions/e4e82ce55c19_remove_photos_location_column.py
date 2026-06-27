"""remove photos location column

Revision ID: e4e82ce55c19
Revises: c3d9f0a1b2e4
Create Date: 2026-06-20 03:54:53.049570

"""

from typing import Sequence, Union

import geoalchemy2
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4e82ce55c19"
down_revision: Union[str, None] = "c3d9f0a1b2e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column("photos", "location")


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        "photos",
        sa.Column(
            "location",
            geoalchemy2.types.Geometry(
                geometry_type="POINT",
                srid=4326,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=True,
        ),
    )
