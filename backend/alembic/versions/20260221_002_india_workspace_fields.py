"""Add India-mode localization fields to workspace_settings.

Revision ID: 20260221_002
Revises: 20260221_001
Create Date: 2026-02-21
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260221_002"
down_revision = "20260221_001"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return name in set(inspector.get_table_names())


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns(table_name)}
    return column_name in columns


def upgrade() -> None:
    if not _has_table("workspace_settings"):
        return

    if not _has_column("workspace_settings", "india_mode_enabled"):
        op.add_column(
            "workspace_settings",
            sa.Column("india_mode_enabled", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        )
    if not _has_column("workspace_settings", "preferred_currency"):
        op.add_column(
            "workspace_settings",
            sa.Column("preferred_currency", sa.String(length=8), nullable=False, server_default="USD"),
        )
    if not _has_column("workspace_settings", "number_format"):
        op.add_column(
            "workspace_settings",
            sa.Column("number_format", sa.String(length=20), nullable=False, server_default="international"),
        )
    if not _has_column("workspace_settings", "fiscal_year_start_month"):
        op.add_column(
            "workspace_settings",
            sa.Column("fiscal_year_start_month", sa.Integer(), nullable=False, server_default="1"),
        )
    if not _has_column("workspace_settings", "report_language"):
        op.add_column(
            "workspace_settings",
            sa.Column("report_language", sa.String(length=20), nullable=False, server_default="english"),
        )


def downgrade() -> None:
    # Downgrade is intentionally conservative for SQLite compatibility.
    pass
