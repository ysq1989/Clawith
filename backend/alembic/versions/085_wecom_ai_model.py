"""Add ai_model_id to wecom_album_accounts.

Revision ID: 085_wecom_ai_model
Create Date: 2026-07-27
"""

from alembic import op
import sqlalchemy as sa

revision = "085_wecom_ai_model"
down_revision = ("084_wecom_ai_clean",)
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "wecom_album_accounts",
        sa.Column("ai_model_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_wecom_album_accounts_ai_model",
        "wecom_album_accounts",
        "llm_models",
        ["ai_model_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_wecom_album_accounts_ai_model", "wecom_album_accounts", type_="foreignkey")
    op.drop_column("wecom_album_accounts", "ai_model_id")
