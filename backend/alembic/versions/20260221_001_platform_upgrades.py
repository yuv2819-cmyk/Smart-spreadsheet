"""Add persistence, connectors, collaboration, billing, and analytics tables.

Revision ID: 20260221_001
Revises:
Create Date: 2026-02-21
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260221_001"
down_revision = None
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return name in set(inspector.get_table_names())


def upgrade() -> None:
    if not _has_table("reports"):
        op.create_table(
            "reports",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("dataset_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("report_type", sa.String(length=50), nullable=False, server_default="Executive"),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="Ready"),
            sa.Column("size_kb", sa.String(length=32), nullable=False, server_default="0.0 KB"),
            sa.Column("summary", sa.Text(), nullable=False),
            sa.Column("key_insights", sa.JSON(), nullable=False),
            sa.Column("recommendations", sa.JSON(), nullable=False),
            sa.Column("risks", sa.JSON(), nullable=False),
            sa.Column("drivers", sa.JSON(), nullable=False),
            sa.Column("kpis", sa.JSON(), nullable=False),
            sa.Column("content_markdown", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True)),
        )
        op.create_index("ix_reports_tenant_id", "reports", ["tenant_id"])
        op.create_index("ix_reports_dataset_id", "reports", ["dataset_id"])

    if not _has_table("cleaning_transformations"):
        op.create_table(
            "cleaning_transformations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("source_dataset_id", sa.Integer(), nullable=False),
            sa.Column("output_dataset_id", sa.Integer(), nullable=False),
            sa.Column("rule_ids", sa.JSON(), nullable=False),
            sa.Column("summary", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_cleaning_transformations_tenant_id", "cleaning_transformations", ["tenant_id"])

    if not _has_table("workspace_settings"):
        op.create_table(
            "workspace_settings",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), nullable=False, unique=True),
            sa.Column("workspace_name", sa.String(length=255), nullable=False, server_default="My Workspace"),
            sa.Column("subdomain", sa.String(length=100), nullable=False, server_default="my-workspace"),
            sa.Column("display_name", sa.String(length=255), nullable=False, server_default=""),
            sa.Column("email", sa.String(length=255), nullable=False, server_default=""),
            sa.Column("theme", sa.String(length=20), nullable=False, server_default="system"),
            sa.Column("notifications_email", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("notifications_product", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("updated_by_user_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True)),
        )
        op.create_index("ix_workspace_settings_tenant_id", "workspace_settings", ["tenant_id"])

    if not _has_table("workspace_goals"):
        op.create_table(
            "workspace_goals",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), nullable=False, unique=True),
            sa.Column("revenue_target", sa.Float(), nullable=False, server_default="0"),
            sa.Column("profit_target", sa.Float(), nullable=False, server_default="0"),
            sa.Column("margin_target", sa.Float(), nullable=False, server_default="0"),
            sa.Column("updated_by_user_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True)),
        )
        op.create_index("ix_workspace_goals_tenant_id", "workspace_goals", ["tenant_id"])

    if not _has_table("integration_configs"):
        op.create_table(
            "integration_configs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("integration_key", sa.String(length=100), nullable=False),
            sa.Column("connected", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            sa.Column("config", sa.Text(), nullable=False, server_default=""),
            sa.Column("last_tested_at", sa.DateTime(timezone=True)),
            sa.Column("last_test_ok", sa.Boolean()),
            sa.Column("note", sa.Text()),
            sa.Column("updated_by_user_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True)),
        )
        op.create_index("ix_integration_configs_tenant_id", "integration_configs", ["tenant_id"])
        op.create_index("ix_integration_configs_integration_key", "integration_configs", ["integration_key"])

    if not _has_table("workspace_plans"):
        op.create_table(
            "workspace_plans",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), nullable=False, unique=True),
            sa.Column("plan_name", sa.String(length=50), nullable=False, server_default="free"),
            sa.Column("max_rows", sa.Integer(), nullable=False, server_default="10000"),
            sa.Column("max_reports_per_month", sa.Integer(), nullable=False, server_default="20"),
            sa.Column("max_ai_queries_per_day", sa.Integer(), nullable=False, server_default="50"),
            sa.Column("max_connectors", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("updated_by_user_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True)),
        )
        op.create_index("ix_workspace_plans_tenant_id", "workspace_plans", ["tenant_id"])

    if not _has_table("data_connectors"):
        op.create_table(
            "data_connectors",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("connector_type", sa.String(length=50), nullable=False),
            sa.Column("config", sa.JSON(), nullable=False),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("sync_interval_minutes", sa.Integer(), nullable=False, server_default="60"),
            sa.Column("target_dataset_name", sa.String(length=255)),
            sa.Column("last_synced_at", sa.DateTime(timezone=True)),
            sa.Column("last_sync_status", sa.String(length=50)),
            sa.Column("last_sync_error", sa.Text()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True)),
        )
        op.create_index("ix_data_connectors_tenant_id", "data_connectors", ["tenant_id"])

    if not _has_table("connector_sync_runs"):
        op.create_table(
            "connector_sync_runs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("connector_id", sa.Integer(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(length=50), nullable=False),
            sa.Column("rows_synced", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("error_message", sa.Text()),
            sa.Column("dataset_id", sa.Integer()),
            sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("finished_at", sa.DateTime(timezone=True)),
        )
        op.create_index("ix_connector_sync_runs_connector_id", "connector_sync_runs", ["connector_id"])

    if not _has_table("report_shares"):
        op.create_table(
            "report_shares",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("report_id", sa.Integer(), nullable=False),
            sa.Column("created_by_user_id", sa.Integer(), nullable=False),
            sa.Column("token", sa.String(length=128), nullable=False, unique=True),
            sa.Column("expires_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_report_shares_tenant_id", "report_shares", ["tenant_id"])
        op.create_index("ix_report_shares_report_id", "report_shares", ["report_id"])
        op.create_index("ix_report_shares_token", "report_shares", ["token"], unique=True)

    if not _has_table("report_comments"):
        op.create_table(
            "report_comments",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("report_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_report_comments_tenant_id", "report_comments", ["tenant_id"])

    if not _has_table("report_approvals"):
        op.create_table(
            "report_approvals",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("report_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
            sa.Column("note", sa.Text()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True)),
        )
        op.create_index("ix_report_approvals_tenant_id", "report_approvals", ["tenant_id"])

    if not _has_table("analytics_events"):
        op.create_table(
            "analytics_events",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("event_name", sa.String(length=120), nullable=False),
            sa.Column("payload", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_analytics_events_tenant_id", "analytics_events", ["tenant_id"])
        op.create_index("ix_analytics_events_event_name", "analytics_events", ["event_name"])


def downgrade() -> None:
    for table in [
        "analytics_events",
        "report_approvals",
        "report_comments",
        "report_shares",
        "connector_sync_runs",
        "data_connectors",
        "workspace_plans",
        "integration_configs",
        "workspace_goals",
        "workspace_settings",
        "cleaning_transformations",
        "reports",
    ]:
        if _has_table(table):
            op.drop_table(table)
