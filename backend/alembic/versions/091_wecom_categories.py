"""add wecom_album_categories table

Revision ID: 091
Revises: 090_wecom_category_id
Create Date: 2026-07-29
"""

from alembic import op
import sqlalchemy as sa

revision = "091_wecom_categories"
down_revision = "090_wecom_category_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "wecom_album_categories",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("pid", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cate_name", sa.String(100), nullable=False),
        sa.Column("sort", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_show", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_wecom_album_categories_tenant_pid", "wecom_album_categories", ["tenant_id", "pid"])


def downgrade() -> None:
    op.drop_index("ix_wecom_album_categories_tenant_pid", table_name="wecom_album_categories")
    op.drop_table("wecom_album_categories")
