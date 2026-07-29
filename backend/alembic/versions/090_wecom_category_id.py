"""add category_id to wecom_album_products

Revision ID: 090
Revises: 089
Create Date: 2026-07-29
"""

from alembic import op
import sqlalchemy as sa

revision = "090_wecom_category_id"
down_revision = "089_wecom_sync_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "wecom_album_products",
        sa.Column("category_id", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("wecom_album_products", "category_id")
