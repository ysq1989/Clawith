"""Add is_default to erp_production_statuses + set initial defaults

Revision ID: 076_status_is_default
Revises: 075_attachment_uploaded_by
Create Date: 2026-07-15
"""

from alembic import op

revision: str = '076_status_is_default'
down_revision: str = '075_attachment_uploaded_by'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE erp_production_statuses
        ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
    """)

    # 为每个租户的每个类型设置第一个状态为默认
    op.execute("""
        UPDATE erp_production_statuses
        SET is_default = true
        WHERE id IN (
            SELECT DISTINCT ON (tenant_id, status_type) id
            FROM erp_production_statuses
            WHERE is_active = true
            ORDER BY tenant_id, status_type, sort_order
        );
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE erp_production_statuses DROP COLUMN IF EXISTS is_default;")
