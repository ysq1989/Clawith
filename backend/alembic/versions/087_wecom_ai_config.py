"""Add AI cleaning config fields to wecom_album_accounts.

Revision ID: 087_wecom_ai_config
Create Date: 2026-07-27
"""

from alembic import op
import sqlalchemy as sa

revision = "087_wecom_ai_config"
down_revision = ("086_wecom_product_status",)
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("wecom_album_accounts", sa.Column("ai_batch_limit", sa.Integer(), server_default="20", nullable=False))
    op.add_column("wecom_album_accounts", sa.Column("ai_timeout_seconds", sa.Integer(), server_default="60", nullable=False))
    op.add_column("wecom_album_accounts", sa.Column("ai_max_tokens", sa.Integer(), server_default="2048", nullable=False))
    op.add_column("wecom_album_accounts", sa.Column("ai_prompt_system", sa.Text(), nullable=True))
    op.add_column("wecom_album_accounts", sa.Column("ai_prompt_user_template", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("wecom_album_accounts", "ai_prompt_user_template")
    op.drop_column("wecom_album_accounts", "ai_prompt_system")
    op.drop_column("wecom_album_accounts", "ai_max_tokens")
    op.drop_column("wecom_album_accounts", "ai_timeout_seconds")
    op.drop_column("wecom_album_accounts", "ai_batch_limit")
