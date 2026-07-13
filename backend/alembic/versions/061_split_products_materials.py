"""split products and materials

Revision ID: 061_split_products_materials
Revises: add_erp_tables
Create Date: 2026-07-13 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '061_split_products_materials'
down_revision: Union[str, None] = 'add_erp_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- 1. 创建 erp_materials 表（参照 erp_products，用 cost_price 替代 unit_price）---
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_materials (
            id UUID NOT NULL PRIMARY KEY,
            tenant_id UUID NOT NULL,
            name VARCHAR(200) NOT NULL,
            sku VARCHAR(100),
            category VARCHAR(100),
            unit VARCHAR(20),
            cost_price NUMERIC(14, 2),
            stock_qty INTEGER NOT NULL DEFAULT 0,
            min_stock INTEGER DEFAULT 0,
            description TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("ALTER TABLE erp_materials ADD CONSTRAINT fk_erp_materials_tenant_id_tenants FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_materials_tenant_id ON erp_materials(tenant_id)")

    # --- 2. 修改 erp_products：移除 cost_price 列 ---
    op.execute("ALTER TABLE erp_products DROP COLUMN IF EXISTS cost_price")

    # --- 3. 修改 erp_purchase_order_items：product_id 改为 material_id ---
    # 先删除旧外键约束
    op.execute("ALTER TABLE erp_purchase_order_items DROP CONSTRAINT IF EXISTS fk_erp_purchase_order_items_product_id_erp_products")
    op.execute("DROP INDEX IF EXISTS ix_erp_purchase_order_items_product_id")
    # 重命名列
    op.execute("ALTER TABLE erp_purchase_order_items RENAME COLUMN product_id TO material_id")
    # 创建新索引和外键
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_purchase_order_items_material_id ON erp_purchase_order_items(material_id)")
    op.execute("ALTER TABLE erp_purchase_order_items ADD CONSTRAINT fk_erp_purchase_order_items_material_id_erp_materials FOREIGN KEY (material_id) REFERENCES erp_materials(id)")

    # --- 4. 修改 erp_stock_records：增加 material_id 和 record_source 列 ---
    op.execute("ALTER TABLE erp_stock_records ADD COLUMN material_id UUID")
    op.execute("ALTER TABLE erp_stock_records ADD COLUMN record_source VARCHAR(20)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_stock_records_material_id ON erp_stock_records(material_id)")

    # 将已有的产品库存记录标记为 'product'
    op.execute("UPDATE erp_stock_records SET record_source = 'product' WHERE record_source IS NULL")


def downgrade() -> None:
    # --- 回滚 4：移除 material_id 和 record_source ---
    op.execute("ALTER TABLE erp_stock_records DROP COLUMN IF EXISTS record_source")
    op.execute("DROP INDEX IF EXISTS ix_erp_stock_records_material_id")
    op.execute("ALTER TABLE erp_stock_records DROP COLUMN IF EXISTS material_id")

    # --- 回滚 3：material_id 改回 product_id ---
    op.execute("ALTER TABLE erp_purchase_order_items DROP CONSTRAINT IF EXISTS fk_erp_purchase_order_items_material_id_erp_materials")
    op.execute("DROP INDEX IF EXISTS ix_erp_purchase_order_items_material_id")
    op.execute("ALTER TABLE erp_purchase_order_items RENAME COLUMN material_id TO product_id")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_purchase_order_items_product_id ON erp_purchase_order_items(product_id)")
    op.execute("ALTER TABLE erp_purchase_order_items ADD CONSTRAINT fk_erp_purchase_order_items_product_id_erp_products FOREIGN KEY (product_id) REFERENCES erp_products(id)")

    # --- 回滚 2：恢复 erp_products.cost_price ---
    op.execute("ALTER TABLE erp_products ADD COLUMN cost_price NUMERIC(14, 2)")

    # --- 回滚 1：删除 erp_materials ---
    op.execute("DROP TABLE IF EXISTS erp_materials")
