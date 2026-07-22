"""fix agnes model tool calling capability

Revision ID: 078
Revises: 202607171530, 202607161200
Create Date: 2026-07-19
"""

from alembic import op
import sqlalchemy as sa

revision = "078_fix_agnes_tool_capability"
down_revision = ("add_experience_revision_drafts", "202607161200")
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Mark agnes provider models as tool-calling capable.

    The v1.11 migration backfilled supports_tool_calling=true only for
    hardcoded legacy providers. 'agnes' was missing, causing
    model_tool_calling_unverified errors in Agent Runtime.
    """
    op.execute(
        sa.text(
            "UPDATE llm_models "
            "SET supports_tool_calling = true, "
            "tool_calling_capability_source = 'builtin_registry', "
            "tool_calling_checked_at = now(), "
            "tool_calling_error = NULL "
            "WHERE supports_tool_calling IS NULL "
            "AND lower(provider) = 'agnes'"
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE llm_models "
            "SET supports_tool_calling = NULL, "
            "tool_calling_capability_source = NULL, "
            "tool_calling_checked_at = NULL, "
            "tool_calling_error = NULL "
            "WHERE lower(provider) = 'agnes'"
        )
    )
