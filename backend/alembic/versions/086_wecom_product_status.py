"""Add status field to wecom_album_products.

Revision ID: 086_wecom_product_status
Create Date: 2026-07-27
"""

from alembic import op
import sqlalchemy as sa

revision = "086_wecom_product_status"
down_revision = ("085_wecom_ai_model",)
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "wecom_album_products",
        sa.Column("status", sa.String(20), server_default="pending_clean", nullable=False),
    )
    op.create_index("ix_wecom_album_products_status", "wecom_album_products", ["tenant_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_wecom_album_products_status", "wecom_album_products")
    op.drop_column("wecom_album_products", "status")
