"""add production module tables and settings fields

Revision ID: 070_add_production
Revises: 069_add_entity_codes
"""
from typing import Sequence, Union
from alembic import op

revision: str = '070_add_production'
down_revision: Union[str, None] = '069_add_entity_codes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 生产工单表
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_production_orders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            order_no VARCHAR(50),
            product_id UUID NOT NULL REFERENCES erp_products(id),
            quantity INTEGER NOT NULL,
            warehouse_id UUID REFERENCES erp_warehouses(id),
            status VARCHAR(20) NOT NULL DEFAULT 'draft',
            notes TEXT,
            created_by UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_production_orders_tenant_id ON erp_production_orders(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_production_orders_order_no ON erp_production_orders(order_no)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_production_orders_product_id ON erp_production_orders(product_id)")

    # BOM（物料清单）表
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_boms (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES erp_products(id),
            material_id UUID NOT NULL REFERENCES erp_materials(id),
            quantity NUMERIC(14,4) NOT NULL DEFAULT 1,
            unit VARCHAR(20),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_boms_tenant_id ON erp_boms(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_boms_product_id ON erp_boms(product_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_boms_material_id ON erp_boms(material_id)")

    # 生产状态自定义表
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_production_statuses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            name VARCHAR(50) NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_production_statuses_tenant_id ON erp_production_statuses(tenant_id)")

    # stock_records 增加 production_order_id 字段
    op.execute("ALTER TABLE erp_stock_records ADD COLUMN IF NOT EXISTS production_order_id UUID REFERENCES erp_production_orders(id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_stock_records_production_order_id ON erp_stock_records(production_order_id)")

    # ERPSettings 增加生产相关字段
    op.execute("ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS production_order_prefix VARCHAR(10) NOT NULL DEFAULT 'PRD'")
    op.execute("ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS production_order_digits INTEGER NOT NULL DEFAULT 4")
    op.execute("ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS module_customers BOOLEAN NOT NULL DEFAULT TRUE")
    op.execute("ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS module_suppliers BOOLEAN NOT NULL DEFAULT TRUE")
    op.execute("ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS module_products BOOLEAN NOT NULL DEFAULT TRUE")
    op.execute("ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS module_materials BOOLEAN NOT NULL DEFAULT TRUE")
    op.execute("ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS module_inventory BOOLEAN NOT NULL DEFAULT TRUE")
    op.execute("ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS module_production BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS module_finance BOOLEAN NOT NULL DEFAULT TRUE")


def downgrade() -> None:
    # 移除 settings 生产字段
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS module_finance")
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS module_production")
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS module_inventory")
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS module_materials")
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS module_products")
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS module_suppliers")
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS module_customers")
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS production_order_digits")
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS production_order_prefix")

    # 移除 stock_records.production_order_id
    op.execute("ALTER TABLE erp_stock_records DROP COLUMN IF EXISTS production_order_id")

    # 删除表（反向依赖顺序）
    op.execute("DROP TABLE IF EXISTS erp_production_statuses")
    op.execute("DROP TABLE IF EXISTS erp_boms")
    op.execute("DROP TABLE IF EXISTS erp_production_orders")
