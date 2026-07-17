"""subscription: premium_started_at + billing_cycle 추가

Revision ID: d1e2f3a4b5c6
Revises: e4e82ce55c19
Create Date: 2026-06-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "e4e82ce55c19"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column("premium_started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column(
            "billing_cycle",
            sa.String(length=10),
            server_default="monthly",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("subscriptions", "billing_cycle")
    op.drop_column("subscriptions", "premium_started_at")
