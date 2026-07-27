"""Add discount field to wecom_album_suppliers.

Revision ID: 083_wecom_album_supplier_discount
Create Date: 2026-07-27
"""

from alembic import op
import sqlalchemy as sa

revision = "083_wecom_album_supplier_discount"
down_revision = ("082_wecom_album_init",)
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "wecom_album_suppliers",
        sa.Column("discount", sa.Float(), server_default="1.0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("wecom_album_suppliers", "discount")
