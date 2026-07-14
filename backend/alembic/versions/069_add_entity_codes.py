"""add code fields to products, materials, stock records, financial records

Revision ID: 069_add_entity_codes
Revises: 068_add_code_settings
"""
from typing import Sequence, Union
from alembic import op

revision: str = '069_add_entity_codes'
down_revision: Union[str, None] = '068_add_code_settings'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE erp_products ADD COLUMN IF NOT EXISTS code VARCHAR(50)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_products_code ON erp_products(code)")
    op.execute("ALTER TABLE erp_materials ADD COLUMN IF NOT EXISTS code VARCHAR(50)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_materials_code ON erp_materials(code)")
    op.execute("ALTER TABLE erp_stock_records ADD COLUMN IF NOT EXISTS record_no VARCHAR(50)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_stock_records_record_no ON erp_stock_records(record_no)")
    op.execute("ALTER TABLE erp_financial_records ADD COLUMN IF NOT EXISTS record_no VARCHAR(50)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_financial_records_record_no ON erp_financial_records(record_no)")


def downgrade() -> None:
    op.execute("ALTER TABLE erp_financial_records DROP COLUMN IF EXISTS record_no")
    op.execute("ALTER TABLE erp_stock_records DROP COLUMN IF EXISTS record_no")
    op.execute("ALTER TABLE erp_materials DROP COLUMN IF EXISTS code")
    op.execute("ALTER TABLE erp_products DROP COLUMN IF EXISTS code")
