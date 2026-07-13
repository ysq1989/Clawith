"""extend customer and supplier fields

Revision ID: 066_extend_cust_supl_fields
Revises: 065_add_category_default
"""
from typing import Sequence, Union
from alembic import op

revision: str = '066_extend_cust_supl_fields'
down_revision: Union[str, None] = '065_add_category_default'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- ERPSettings: 新增编码配置字段 ---
    op.execute("ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS customer_code_prefix VARCHAR(10) NOT NULL DEFAULT 'K'")
    op.execute("ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS customer_code_digits INTEGER NOT NULL DEFAULT 3")
    op.execute("ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS supplier_code_prefix VARCHAR(10) NOT NULL DEFAULT 'G'")
    op.execute("ALTER TABLE erp_settings ADD COLUMN IF NOT EXISTS supplier_code_digits INTEGER NOT NULL DEFAULT 3")

    # --- ERPCustomer: 新增字段 ---
    op.execute("ALTER TABLE erp_customers ADD COLUMN IF NOT EXISTS code VARCHAR(50)")
    op.execute("ALTER TABLE erp_customers ADD COLUMN IF NOT EXISTS short_name VARCHAR(100)")
    op.execute("ALTER TABLE erp_customers ADD COLUMN IF NOT EXISTS salesperson_id UUID")
    op.execute("ALTER TABLE erp_customers ADD COLUMN IF NOT EXISTS bank_name VARCHAR(200)")
    op.execute("ALTER TABLE erp_customers ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(200)")
    op.execute("ALTER TABLE erp_customers ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100)")
    op.execute("ALTER TABLE erp_customers ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(200)")
    op.execute("ALTER TABLE erp_customers ADD COLUMN IF NOT EXISTS credit_code VARCHAR(50)")
    op.execute("ALTER TABLE erp_customers ADD COLUMN IF NOT EXISTS legal_representative VARCHAR(100)")
    op.execute("ALTER TABLE erp_customers ADD COLUMN IF NOT EXISTS legal_rep_phone VARCHAR(50)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_customers_code ON erp_customers (code)")

    # --- ERPSupplier: 新增同样字段 ---
    op.execute("ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS code VARCHAR(50)")
    op.execute("ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS short_name VARCHAR(100)")
    op.execute("ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS salesperson_id UUID")
    op.execute("ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS bank_name VARCHAR(200)")
    op.execute("ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(200)")
    op.execute("ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100)")
    op.execute("ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(200)")
    op.execute("ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS credit_code VARCHAR(50)")
    op.execute("ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS legal_representative VARCHAR(100)")
    op.execute("ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS legal_rep_phone VARCHAR(50)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_suppliers_code ON erp_suppliers (code)")


def downgrade() -> None:
    # --- ERPSupplier ---
    op.execute("DROP INDEX IF EXISTS ix_erp_suppliers_code")
    op.execute("ALTER TABLE erp_suppliers DROP COLUMN IF EXISTS legal_rep_phone")
    op.execute("ALTER TABLE erp_suppliers DROP COLUMN IF EXISTS legal_representative")
    op.execute("ALTER TABLE erp_suppliers DROP COLUMN IF EXISTS credit_code")
    op.execute("ALTER TABLE erp_suppliers DROP COLUMN IF EXISTS bank_branch")
    op.execute("ALTER TABLE erp_suppliers DROP COLUMN IF EXISTS bank_account_number")
    op.execute("ALTER TABLE erp_suppliers DROP COLUMN IF EXISTS bank_account_name")
    op.execute("ALTER TABLE erp_suppliers DROP COLUMN IF EXISTS bank_name")
    op.execute("ALTER TABLE erp_suppliers DROP COLUMN IF EXISTS salesperson_id")
    op.execute("ALTER TABLE erp_suppliers DROP COLUMN IF EXISTS short_name")
    op.execute("ALTER TABLE erp_suppliers DROP COLUMN IF EXISTS code")

    # --- ERPCustomer ---
    op.execute("DROP INDEX IF EXISTS ix_erp_customers_code")
    op.execute("ALTER TABLE erp_customers DROP COLUMN IF EXISTS legal_rep_phone")
    op.execute("ALTER TABLE erp_customers DROP COLUMN IF EXISTS legal_representative")
    op.execute("ALTER TABLE erp_customers DROP COLUMN IF EXISTS credit_code")
    op.execute("ALTER TABLE erp_customers DROP COLUMN IF EXISTS bank_branch")
    op.execute("ALTER TABLE erp_customers DROP COLUMN IF EXISTS bank_account_number")
    op.execute("ALTER TABLE erp_customers DROP COLUMN IF EXISTS bank_account_name")
    op.execute("ALTER TABLE erp_customers DROP COLUMN IF EXISTS bank_name")
    op.execute("ALTER TABLE erp_customers DROP COLUMN IF EXISTS salesperson_id")
    op.execute("ALTER TABLE erp_customers DROP COLUMN IF EXISTS short_name")
    op.execute("ALTER TABLE erp_customers DROP COLUMN IF EXISTS code")

    # --- ERPSettings ---
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS supplier_code_digits")
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS supplier_code_prefix")
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS customer_code_digits")
    op.execute("ALTER TABLE erp_settings DROP COLUMN IF EXISTS customer_code_prefix")
