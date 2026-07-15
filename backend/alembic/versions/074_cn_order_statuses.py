"""Rename all order statuses from English to Chinese

Revision ID: 074_cn_order_statuses
Revises: 073_custom_order_statuses
Create Date: 2026-07-15
"""

from alembic import op

revision: str = '074_cn_order_statuses'
down_revision: str = '073_custom_order_statuses'
branch_labels = None
depends_on = None

# (table, old, new) pairs
SALES = [
    ('draft', '草稿'), ('confirmed', '已确认'), ('processing', '处理中'),
    ('shipped', '已发货'), ('completed', '已完成'), ('cancelled', '已取消'),
]
PURCHASE = [
    ('draft', '草稿'), ('confirmed', '已确认'), ('receiving', '收货中'),
    ('completed', '已完成'), ('cancelled', '已取消'),
]
PRODUCTION = [
    ('draft', '草稿'), ('confirmed', '已确认'), ('in_progress', '进行中'),
    ('completed', '已完成'), ('cancelled', '已取消'),
]
STATUSES = [
    ('draft', '草稿'), ('confirmed', '已确认'), ('processing', '处理中'),
    ('shipped', '已发货'), ('receiving', '收货中'), ('in_progress', '进行中'),
    ('completed', '已完成'), ('cancelled', '已取消'),
    ('received', '已完成'),  # old frontend value
]


def _update(table, pairs):
    for old, new in pairs:
        op.execute(f"UPDATE {table} SET status = '{new}' WHERE status = '{old}'")


def _update_names(pairs):
    for old, new in pairs:
        op.execute(f"UPDATE erp_production_statuses SET name = '{new}' WHERE name = '{old}'")


def upgrade() -> None:
    _update('erp_sales_orders', SALES)
    _update('erp_purchase_orders', PURCHASE)
    _update('erp_production_orders', PRODUCTION)
    _update_names(STATUSES)


def downgrade() -> None:
    reverse = [(new, old) for old, new in SALES]
    _update('erp_sales_orders', reverse)
    reverse = [(new, old) for old, new in PURCHASE]
    _update('erp_purchase_orders', reverse)
    reverse = [(new, old) for old, new in PRODUCTION]
    _update('erp_production_orders', reverse)
    reverse = [(new, old) for old, new in STATUSES]
    _update_names(reverse)
