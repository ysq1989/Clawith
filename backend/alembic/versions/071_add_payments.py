"""add payments table and settings category fields

Revision ID: 071_add_payments
Revises: 070_add_production
"""
from typing import Sequence, Union
from alembic import op

revision: str = '071_add_payments'
down_revision: Union[str, None] = '070_add_production'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 收付款表
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_payments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            payment_no VARCHAR(50),
            payment_type VARCHAR(20) NOT NULL,
            related_order_id UUID,
            customer_id UUID,
            supplier_id UUID,
            amount NUMERIC(14,2) NOT NULL,
            payment_method VARCHAR(30),
            payment_date DATE NOT NULL,
            notes TEXT,
            created_by UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_payments_tenant_id ON erp_payments(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_payments_payment_no ON erp_payments(payment_no)")

    # ERPSettings 增加收付款模块开关和分类字段
    op.execute("ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS module_payments BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS warehouse_categories TEXT")
    op.execute("ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS outbound_categories TEXT")
    op.execute("ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS inbound_categories TEXT")


def downgrade() -> None:
    # 移除 settings 分类字段
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS inbound_categories")
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS outbound_categories")
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS warehouse_categories")
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS module_payments")

    # 删除收付款表
    op.execute("DROP TABLE IF EXISTS erp_payments")
