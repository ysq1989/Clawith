"""Add Product Hub (选品中心) module tables + tenant.enabled_modules field.

Revision ID: 081_product_hub_init
Create Date: 2026-07-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "081_product_hub_init"
down_revision = ("080_xhs_init",)
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Add enabled_modules to tenants ──
    op.add_column(
        "tenants",
        sa.Column("enabled_modules", postgresql.JSON(), nullable=True),
    )

    # ── 2. product_hub_supply_chains ──
    op.create_table(
        "product_hub_supply_chains",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("logo_url", sa.String(500)),
        sa.Column("source_platform", sa.String(50), nullable=False, server_default="weixin_album"),
        sa.Column("crawl_config", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
        sa.Column("last_crawl_at", sa.DateTime(timezone=True)),
        sa.Column("products_count", sa.Integer, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )

    # ── 3. product_hub_categories ──
    op.create_table(
        "product_hub_categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True)),
        sa.Column("icon", sa.String(50)),
        sa.Column("sort_order", sa.Integer, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── 4. product_hub_products ──
    op.create_table(
        "product_hub_products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Internal fields
        sa.Column("source_url", sa.String(500)),
        sa.Column("source_shop_name", sa.String(200)),
        sa.Column("source_shop_id", sa.String(100)),
        sa.Column("crawl_task_id", postgresql.UUID(as_uuid=True)),
        sa.Column(
            "supply_chain_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("product_hub_supply_chains.id", ondelete="SET NULL"),
        ),
        # User-visible fields
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("price", sa.Numeric(10, 2)),
        sa.Column("original_price", sa.Numeric(10, 2)),
        sa.Column("images", postgresql.JSON(), server_default="[]"),
        sa.Column("main_image", sa.String(500)),
        # Classification
        sa.Column("supply_chain_name", sa.String(200)),
        sa.Column(
            "category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("product_hub_categories.id", ondelete="SET NULL"),
        ),
        sa.Column("tags", postgresql.JSON(), server_default="[]"),
        sa.Column("clean_summary", sa.Text),
        sa.Column("attributes", postgresql.JSON(), server_default="{}"),
        sa.Column("quality_score", sa.Float),
        # Status
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_index(
        "ix_product_hub_products_tenant_category",
        "product_hub_products",
        ["tenant_id", "category_id"],
    )
    op.create_index(
        "ix_product_hub_products_tenant_status",
        "product_hub_products",
        ["tenant_id", "status"],
    )

    # ── 5. product_hub_crawl_tasks ──
    op.create_table(
        "product_hub_crawl_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "supply_chain_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("product_hub_supply_chains.id", ondelete="SET NULL"),
        ),
        sa.Column("source_url", sa.String(500), nullable=False),
        sa.Column("crawl_config", postgresql.JSON(), server_default="{}"),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("products_count", sa.Integer, server_default=sa.text("0")),
        sa.Column("clean_count", sa.Integer, server_default=sa.text("0")),
        sa.Column("error_message", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
    )

    # ── 6. product_hub_user_pools ──
    op.create_table(
        "product_hub_user_pools",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )

    # ── 7. product_hub_user_pool_items ──
    op.create_table(
        "product_hub_user_pool_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "pool_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("product_hub_user_pools.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("product_hub_products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("note", sa.Text),
        sa.Column("selected_by_agent", sa.Boolean, server_default=sa.text("false")),
        sa.Column("sort_order", sa.Integer, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("product_hub_user_pool_items")
    op.drop_table("product_hub_user_pools")
    op.drop_table("product_hub_crawl_tasks")
    op.drop_index("ix_product_hub_products_tenant_status", table_name="product_hub_products")
    op.drop_index("ix_product_hub_products_tenant_category", table_name="product_hub_products")
    op.drop_table("product_hub_products")
    op.drop_table("product_hub_categories")
    op.drop_table("product_hub_supply_chains")
    op.drop_column("tenants", "enabled_modules")
