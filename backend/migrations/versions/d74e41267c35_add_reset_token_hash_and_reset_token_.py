"""add reset_token_hash and reset_token_expires_at to users

Revision ID: d74e41267c35
Revises: a2c4e6f8b0d1
Create Date: 2026-08-21 07:39:27.462973

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d74e41267c35"
down_revision: Union[str, None] = "a2c4e6f8b0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "users", sa.Column("reset_token_hash", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column("reset_token_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "reset_token_expires_at")
    op.drop_column("users", "reset_token_hash")
