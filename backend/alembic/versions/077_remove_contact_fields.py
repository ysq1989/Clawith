"""Remove redundant contact_name/phone/email from erp_customers and erp_suppliers

Revision ID: 077_remove_contact_fields
Revises: 076_status_is_default
Create Date: 2026-07-17
"""

from alembic import op

revision: str = '077_remove_contact_fields'
down_revision: str = '076_status_is_default'
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ('erp_customers', 'erp_suppliers'):
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS contact_name;")
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS phone;")
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS email;")


def downgrade() -> None:
    for table in ('erp_customers', 'erp_suppliers'):
        op.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS contact_name VARCHAR(100);")
        op.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS phone VARCHAR(50);")
        op.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS email VARCHAR(200);")
