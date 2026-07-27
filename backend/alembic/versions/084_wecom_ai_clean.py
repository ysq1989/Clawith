"""Add AI cleaning fields to wecom_album_products.

Revision ID: 084_wecom_ai_clean
Create Date: 2026-07-27
"""

from alembic import op
import sqlalchemy as sa

revision = "084_wecom_ai_clean"
down_revision = ("083_wecom_discount",)
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("wecom_album_products", sa.Column("clean_title", sa.String(500), nullable=True))
    op.add_column("wecom_album_products", sa.Column("clean_price", sa.Numeric(10, 2), nullable=True))
    op.add_column("wecom_album_products", sa.Column("ai_cleaned_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("wecom_album_products", "ai_cleaned_at")
    op.drop_column("wecom_album_products", "clean_price")
    op.drop_column("wecom_album_products", "clean_title")
