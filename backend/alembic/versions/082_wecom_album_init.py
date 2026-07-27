"""Add WeChat Business Album (微商相册) module tables.

Revision ID: 082_wecom_album_init
Create Date: 2026-07-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "082_wecom_album_init"
down_revision = ("081_product_hub_init",)
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. wecom_album_accounts ──
    op.create_table(
        "wecom_album_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("token", sa.String(500), nullable=False),
        sa.Column("album_name", sa.String(200), nullable=True),
        sa.Column("album_icon", sa.String(500), nullable=True),
        sa.Column("album_id", sa.String(100), nullable=True),
        sa.Column("product_sync_stale_hours", sa.Integer(), server_default="1"),
        sa.Column("last_owner_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_product_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── 2. wecom_album_suppliers ──
    op.create_table(
        "wecom_album_suppliers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("wecom_album_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("external_id", sa.String(100), nullable=False),
        sa.Column("shop_id", sa.String(100), nullable=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("avatar", sa.String(500), nullable=True),
        sa.Column("album_id", sa.String(100), nullable=True),
        sa.Column("total_products", sa.Integer(), server_default="0"),
        sa.Column("new_products", sa.Integer(), server_default="0"),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_wecom_album_suppliers_tenant", "wecom_album_suppliers", ["tenant_id"])
    op.create_index(
        "ix_wecom_album_suppliers_tenant_external",
        "wecom_album_suppliers",
        ["tenant_id", "external_id"],
        unique=True,
    )

    # ── 3. wecom_album_products ──
    op.create_table(
        "wecom_album_products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "supplier_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("wecom_album_suppliers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("goods_id", sa.String(100), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=True),
        sa.Column("images", postgresql.JSON(), server_default="[]"),
        sa.Column("main_image", sa.String(500), nullable=True),
        sa.Column("video_url", sa.String(500), nullable=True),
        sa.Column("shop_name", sa.String(200), nullable=True),
        sa.Column("shop_id", sa.String(100), nullable=True),
        sa.Column("source_url", sa.String(500), nullable=True),
        sa.Column("tags", postgresql.JSON(), server_default="[]"),
        sa.Column("attributes", postgresql.JSON(), server_default="{}"),
        sa.Column("szwego_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_hash", sa.String(40), nullable=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_wecom_album_products_tenant", "wecom_album_products", ["tenant_id"])
    op.create_index("ix_wecom_album_products_supplier", "wecom_album_products", ["tenant_id", "supplier_id"])
    op.create_index(
        "ix_wecom_album_products_tenant_goods",
        "wecom_album_products",
        ["tenant_id", "goods_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("wecom_album_products")
    op.drop_table("wecom_album_suppliers")
    op.drop_table("wecom_album_accounts")
