"""remove photos location column

Revision ID: e4e82ce55c19
Revises: 67aaac93cfa6
Create Date: 2026-06-20 03:54:53.049570

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e4e82ce55c19"
down_revision: Union[str, None] = "67aaac93cfa6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
