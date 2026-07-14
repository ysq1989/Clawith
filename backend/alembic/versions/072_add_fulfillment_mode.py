"""Add fulfillment_mode to erp_products and default_fulfillment_mode to erp_settings

Revision ID: 072_add_fulfillment_mode
Revises: 071_add_payments
Create Date: 2026-07-14
"""

from alembic import op
import sqlalchemy as sa

revision: str = '072_add_fulfillment_mode'
down_revision: str = '071_add_payments'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 产品级履约模式：NULL=继承全局, "mts"=按计划生产, "mto"=按订单生产
    op.execute("""
        ALTER TABLE erp_products
        ADD COLUMN IF NOT EXISTS fulfillment_mode VARCHAR(10);
    """)

    # 全局默认履约模式（替换 auto_stock_deduct 的语义）
    op.execute("""
        ALTER TABLE erp_settings
        ADD COLUMN IF NOT EXISTS default_fulfillment_mode VARCHAR(10) NOT NULL DEFAULT 'mts';
    """)

    # 将旧 auto_stock_deduct=False 的租户迁移为默认 mto（按订单生产 = 不自动扣库存）
    op.execute("""
        UPDATE erp_settings
        SET default_fulfillment_mode = 'mto'
        WHERE auto_stock_deduct = false;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE erp_products DROP COLUMN IF EXISTS fulfillment_mode;")
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS default_fulfillment_mode;")
