"""Add status_type to erp_production_statuses for sales/purchase/production

Revision ID: 073_custom_order_statuses
Revises: 072_add_fulfillment_mode
Create Date: 2026-07-15
"""

from alembic import op
import sqlalchemy as sa

revision: str = '073_custom_order_statuses'
down_revision: str = '072_add_fulfillment_mode'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE erp_production_statuses
        ADD COLUMN IF NOT EXISTS status_type VARCHAR(20) NOT NULL DEFAULT 'production';
    """)

    # 为已有租户插入默认销售状态
    op.execute("""
        INSERT INTO erp_production_statuses (id, tenant_id, name, sort_order, is_active, status_type, created_at)
        SELECT gen_random_uuid(), t.id, s.name, s.ord, true, 'sales', now()
        FROM tenants t
        CROSS JOIN (VALUES ('confirmed', 0), ('processing', 1), ('shipped', 2), ('completed', 3)) AS s(name, ord)
        WHERE NOT EXISTS (
            SELECT 1 FROM erp_production_statuses
            WHERE tenant_id = t.id AND status_type = 'sales'
        );
    """)

    # 为已有租户插入默认采购状态
    op.execute("""
        INSERT INTO erp_production_statuses (id, tenant_id, name, sort_order, is_active, status_type, created_at)
        SELECT gen_random_uuid(), t.id, s.name, s.ord, true, 'purchase', now()
        FROM tenants t
        CROSS JOIN (VALUES ('confirmed', 0), ('receiving', 1), ('completed', 2)) AS s(name, ord)
        WHERE NOT EXISTS (
            SELECT 1 FROM erp_production_statuses
            WHERE tenant_id = t.id AND status_type = 'purchase'
        );
    """)


def downgrade() -> None:
    op.execute("DELETE FROM erp_production_statuses WHERE status_type IN ('sales', 'purchase');")
    op.execute("ALTER TABLE erp_production_statuses DROP COLUMN IF EXISTS status_type;")
