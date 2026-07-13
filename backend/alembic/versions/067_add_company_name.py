"""add company_name to customer and supplier

Revision ID: 067_add_company_name
Revises: 066_extend_cust_supl_fields
"""
from typing import Sequence, Union
from alembic import op

revision: str = '067_add_company_name'
down_revision: Union[str, None] = '066_extend_cust_supl_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE erp_customers ADD COLUMN IF NOT EXISTS company_name VARCHAR(200)")
    op.execute("ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS company_name VARCHAR(200)")


def downgrade() -> None:
    op.execute("ALTER TABLE erp_suppliers DROP COLUMN IF EXISTS company_name")
    op.execute("ALTER TABLE erp_customers DROP COLUMN IF EXISTS company_name")
