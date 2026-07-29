"""add price field to pool items

Revision ID: 093
Revises: 092_drop_pool_fk
Create Date: 2026-07-30
"""

from alembic import op
import sqlalchemy as sa

revision = "093_pool_item_price"
down_revision = "092_drop_pool_fk"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "product_hub_user_pool_items",
        sa.Column("price", sa.Numeric(10, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("product_hub_user_pool_items", "price")
