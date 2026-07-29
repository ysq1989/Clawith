"""drop pool items product foreign key

Revision ID: 092
Revises: 091_wecom_categories
Create Date: 2026-07-30
"""

from alembic import op

revision = "092_drop_pool_fk"
down_revision = "091_wecom_categories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "product_hub_user_pool_items_product_id_fkey",
        "product_hub_user_pool_items",
        type_="foreignkey",
    )


def downgrade() -> None:
    op.create_foreign_key(
        "product_hub_user_pool_items_product_id_fkey",
        "product_hub_user_pool_items",
        "product_hub_products",
        ["product_id"],
        ["id"],
    )
