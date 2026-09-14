"""add place_type to frequent_places

Revision ID: f05cc032cd45
Revises: cea4261f28a2
Create Date: 2026-09-14 08:39:16.707261

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "f05cc032cd45"
down_revision: Union[str, None] = "cea4261f28a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "frequent_places",
        sa.Column(
            "place_type",
            sa.String(length=20),
            server_default="frequent",
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("frequent_places", "place_type")
