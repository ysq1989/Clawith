"""add contacts and attachments tables

Revision ID: 062_add_contacts_attachments
Revises: 061_split_products_materials
Create Date: 2026-07-14 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '062_add_contacts_attachments'
down_revision: Union[str, None] = '061_split_products_materials'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- 联系人表 ---
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_contacts (
            id UUID NOT NULL PRIMARY KEY,
            tenant_id UUID NOT NULL,
            parent_type VARCHAR(20) NOT NULL,
            parent_id UUID NOT NULL,
            name VARCHAR(100) NOT NULL,
            position VARCHAR(100),
            phone VARCHAR(50),
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("ALTER TABLE erp_contacts ADD CONSTRAINT fk_erp_contacts_tenant_id_tenants FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_contacts_tenant_id ON erp_contacts(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_contacts_parent_id ON erp_contacts(parent_id)")

    # --- 附件表 ---
    op.execute("""
        CREATE TABLE IF NOT EXISTS erp_attachments (
            id UUID NOT NULL PRIMARY KEY,
            tenant_id UUID NOT NULL,
            parent_type VARCHAR(20) NOT NULL,
            parent_id UUID NOT NULL,
            file_name VARCHAR(500) NOT NULL,
            file_path VARCHAR(1000) NOT NULL,
            file_size INTEGER NOT NULL DEFAULT 0,
            mime_type VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("ALTER TABLE erp_attachments ADD CONSTRAINT fk_erp_attachments_tenant_id_tenants FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_attachments_tenant_id ON erp_attachments(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_erp_attachments_parent_id ON erp_attachments(parent_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS erp_attachments")
    op.execute("DROP TABLE IF EXISTS erp_contacts")
