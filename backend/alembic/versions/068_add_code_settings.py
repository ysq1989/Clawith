"""add code settings fields to erp_settings

Revision ID: 068_add_code_settings
Revises: 067_add_company_name
"""
from typing import Sequence, Union
from alembic import op

revision: str = '068_add_code_settings'
down_revision: Union[str, None] = '067_add_company_name'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = [
    ("product_code_prefix", "VARCHAR(10) NOT NULL DEFAULT 'P'"),
    ("product_code_digits", "INTEGER NOT NULL DEFAULT 3"),
    ("material_code_prefix", "VARCHAR(10) NOT NULL DEFAULT 'M'"),
    ("material_code_digits", "INTEGER NOT NULL DEFAULT 3"),
    ("sales_order_prefix", "VARCHAR(10) NOT NULL DEFAULT 'SO'"),
    ("sales_order_digits", "INTEGER NOT NULL DEFAULT 4"),
    ("purchase_order_prefix", "VARCHAR(10) NOT NULL DEFAULT 'PO'"),
    ("purchase_order_digits", "INTEGER NOT NULL DEFAULT 4"),
    ("outbound_prefix", "VARCHAR(10) NOT NULL DEFAULT 'OUT'"),
    ("outbound_digits", "INTEGER NOT NULL DEFAULT 4"),
    ("inbound_prefix", "VARCHAR(10) NOT NULL DEFAULT 'IN'"),
    ("inbound_digits", "INTEGER NOT NULL DEFAULT 4"),
    ("transfer_prefix", "VARCHAR(10) NOT NULL DEFAULT 'TR'"),
    ("transfer_digits", "INTEGER NOT NULL DEFAULT 4"),
    ("financial_prefix", "VARCHAR(10) NOT NULL DEFAULT 'FIN'"),
    ("financial_digits", "INTEGER NOT NULL DEFAULT 4"),
]


def upgrade() -> None:
    for col, typedef in COLUMNS:
        op.execute(f"ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS {col} {typedef}")


def downgrade() -> None:
    for col, _ in reversed(COLUMNS):
        op.execute(f"ALTER TABLE erp_settings DROP COLUMN IF EXISTS {col}")
