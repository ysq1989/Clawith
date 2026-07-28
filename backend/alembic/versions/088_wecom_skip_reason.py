"""Add skip_reason and update status for wecom_album_products.

Revision ID: 088_wecom_skip_reason
Create Date: 2026-07-28
"""

from alembic import op
import sqlalchemy as sa

revision = "088_wecom_skip_reason"
down_revision = ("087_wecom_ai_config",)
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("wecom_album_products", sa.Column("skip_reason", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("wecom_album_products", "skip_reason")
