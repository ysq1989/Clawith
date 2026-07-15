"""Add uploaded_by to erp_attachments

Revision ID: 075_attachment_uploaded_by
Revises: 074_cn_order_statuses
Create Date: 2026-07-15
"""

from alembic import op

revision: str = '075_attachment_uploaded_by'
down_revision: str = '074_cn_order_statuses'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE erp_attachments
        ADD COLUMN IF NOT EXISTS uploaded_by UUID;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE erp_attachments DROP COLUMN IF EXISTS uploaded_by;")
