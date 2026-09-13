"""add places is_deleted

Revision ID: 779ce1dbfb62
Revises: c1f3a5b7d9e2
Create Date: 2026-09-13 09:34:00.868965

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "779ce1dbfb62"
down_revision: Union[str, None] = "c1f3a5b7d9e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "places",
        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("places", "is_deleted")
