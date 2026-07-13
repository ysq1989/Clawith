"""add erp_categories table and category_id columns

Revision ID: 064_add_categories
Revises: add_contact_email_default
"""
from typing import Sequence, Union
from alembic import op

revision: str = '064_add_categories'
down_revision: Union[str, None] = 'add_contact_email_default'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_categories (
            id UUID NOT NULL PRIMARY KEY,
            tenant_id UUID NOT NULL,
            type VARCHAR(20) NOT NULL,
            name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("ALTER TABLE erp_categories ADD CONSTRAINT fk_erp_categories_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_categories_tenant_id ON erp_categories(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_categories_type ON erp_categories(tenant_id, type)")
    op.execute("ALTER TABLE erp_customers ADD COLUMN IF NOT EXISTS category_id UUID")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_customers_category_id ON erp_customers(category_id)")
    op.execute("ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS category_id UUID")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_suppliers_category_id ON erp_suppliers(category_id)")


def downgrade() -> None:
    op.execute("ALTER TABLE erp_suppliers DROP COLUMN IF EXISTS category_id")
    op.execute("ALTER TABLE erp_customers DROP COLUMN IF EXISTS category_id")
    op.execute("DROP TABLE IF EXISTS erp_categories")
