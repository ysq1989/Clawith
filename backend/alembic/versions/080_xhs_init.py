"""Add Xiaohongshu (小红书) operations module tables.

Revision ID: 080
Create Date: 2026-07-22
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "080_xhs_init"
down_revision = ("078_fix_agnes_tool_capability", "077_remove_contact_fields")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # xhs_accounts
    op.create_table(
        "xhs_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("alias", sa.String(200)),
        sa.Column("xhs_user_id", sa.String(100)),
        sa.Column("cookie_encrypted", sa.Text),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("last_login_at", sa.DateTime),
        sa.Column("last_health_check_at", sa.DateTime),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # xhs_personas
    op.create_table(
        "xhs_personas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("tone", sa.String(100)),
        sa.Column("topics", postgresql.JSONB),
        sa.Column("avoid_words", postgresql.JSONB),
        sa.Column("is_default", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # xhs_content
    op.create_table(
        "xhs_content",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("xhs_accounts.id")),
        sa.Column("persona_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("xhs_personas.id")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.Text),
        sa.Column("note_type", sa.String(20), server_default="image"),
        sa.Column("images", postgresql.JSONB),
        sa.Column("video_url", sa.String(500)),
        sa.Column("tags", postgresql.JSONB),
        sa.Column("status", sa.String(20), server_default="draft"),
        sa.Column("scheduled_at", sa.DateTime),
        sa.Column("published_at", sa.DateTime),
        sa.Column("xhs_note_id", sa.String(100)),
        sa.Column("publish_log", sa.Text),
        sa.Column("ai_generated", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # xhs_publish_logs
    op.create_table(
        "xhs_publish_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("content_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("xhs_content.id")),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("xhs_accounts.id")),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("error_message", sa.Text),
        sa.Column("published_at", sa.DateTime),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # xhs_note_analytics
    op.create_table(
        "xhs_note_analytics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("note_id", sa.String(100), nullable=False, index=True),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("xhs_accounts.id")),
        sa.Column("title", sa.String(200)),
        sa.Column("author_id", sa.String(100)),
        sa.Column("author_name", sa.String(200)),
        sa.Column("views", sa.Integer, server_default="0"),
        sa.Column("likes", sa.Integer, server_default="0"),
        sa.Column("comments", sa.Integer, server_default="0"),
        sa.Column("bookmarks", sa.Integer, server_default="0"),
        sa.Column("shares", sa.Integer, server_default="0"),
        sa.Column("followers_gained", sa.Integer, server_default="0"),
        sa.Column("collected_at", sa.DateTime, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # xhs_schedules
    op.create_table(
        "xhs_schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("content_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("xhs_content.id"), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("xhs_accounts.id"), nullable=False),
        sa.Column("scheduled_at", sa.DateTime, nullable=False),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("retry_count", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # xhs_knowledge
    op.create_table(
        "xhs_knowledge",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("metadata", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("xhs_knowledge")
    op.drop_table("xhs_schedules")
    op.drop_table("xhs_note_analytics")
    op.drop_table("xhs_publish_logs")
    op.drop_table("xhs_content")
    op.drop_table("xhs_personas")
    op.drop_table("xhs_accounts")
