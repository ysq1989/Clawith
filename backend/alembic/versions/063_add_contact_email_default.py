"""add contact email and is_default

Revision ID: add_contact_email_default
Revises: add_contacts_attachments
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'add_contact_email_default'
down_revision: Union[str, None] = '062_add_contacts_attachments'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE erp_contacts ADD COLUMN IF NOT EXISTS email VARCHAR(200)")
    op.execute("ALTER TABLE erp_contacts ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE")


def downgrade() -> None:
    op.execute("ALTER TABLE erp_contacts DROP COLUMN IF EXISTS is_default")
    op.execute("ALTER TABLE erp_contacts DROP COLUMN IF EXISTS email")
