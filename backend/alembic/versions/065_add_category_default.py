"""add is_default to erp_categories

Revision ID: 065_add_category_default
Revises: 064_add_categories
"""
from typing import Sequence, Union
from alembic import op

revision: str = '065_add_category_default'
down_revision: Union[str, None] = '064_add_categories'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE erp_categories ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE")


def downgrade() -> None:
    op.execute("ALTER TABLE erp_categories DROP COLUMN IF EXISTS is_default")
