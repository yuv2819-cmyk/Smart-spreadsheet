from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON, Boolean, Float
from sqlalchemy.sql import func
from app.database import Base

class Tenant(Base):
    """Multi-tenant table for organization isolation"""
    __tablename__ = "tenants"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    subdomain = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class User(Base):
    """User table with tenant_id for multi-tenancy"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255))
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    role = Column(String(50), default="user")  # user, admin, viewer
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Dataset(Base):
    """Stores metadata about uploaded datasets"""
    __tablename__ = "datasets"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    source_type = Column(String(50))  # csv, postgresql, snowflake
    schema_info = Column(JSON)  # Column names and types
    row_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class DataRow(Base):
    """Stores actual data rows for datasets (simplified for MVP)"""
    __tablename__ = "data_rows"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, index=True)
    row_data = Column(JSON, nullable=False)  # Actual row data as JSON
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AIQuery(Base):
    """Stores AI-generated queries and results"""
    __tablename__ = "ai_queries"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    prompt = Column(Text, nullable=False)
    generated_code = Column(Text)  # Python/SQL code
    result_data = Column(JSON)  # Query results
    execution_time_ms = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Report(Base):
    """Stores generated reports per tenant"""
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    report_type = Column(String(50), nullable=False, default="Executive")
    status = Column(String(50), nullable=False, default="Ready")
    size_kb = Column(String(32), nullable=False, default="0.0 KB")
    summary = Column(Text, nullable=False)
    key_insights = Column(JSON, nullable=False, default=list)
    recommendations = Column(JSON, nullable=False, default=list)
    risks = Column(JSON, nullable=False, default=list)
    drivers = Column(JSON, nullable=False, default=list)
    kpis = Column(JSON, nullable=False, default=dict)
    content_markdown = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CleaningTransformation(Base):
    """Stores data cleaning runs and lineage between source/output datasets."""
    __tablename__ = "cleaning_transformations"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    source_dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, index=True)
    output_dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, index=True)
    rule_ids = Column(JSON, nullable=False, default=list)
    summary = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WorkspaceSettings(Base):
    """Persisted workspace/user-facing settings (replaces local-only settings)."""
    __tablename__ = "workspace_settings"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, unique=True, index=True)
    workspace_name = Column(String(255), nullable=False, default="My Workspace")
    subdomain = Column(String(100), nullable=False, default="my-workspace")
    display_name = Column(String(255), nullable=False, default="")
    email = Column(String(255), nullable=False, default="")
    theme = Column(String(20), nullable=False, default="system")
    notifications_email = Column(Boolean, nullable=False, default=True)
    notifications_product = Column(Boolean, nullable=False, default=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class WorkspaceGoal(Base):
    """Persisted goal targets for revenue/profit/margin tracking."""
    __tablename__ = "workspace_goals"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, unique=True, index=True)
    revenue_target = Column(Float, nullable=False, default=0.0)
    profit_target = Column(Float, nullable=False, default=0.0)
    margin_target = Column(Float, nullable=False, default=0.0)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class IntegrationConfig(Base):
    """Persisted integration config and status by workspace."""
    __tablename__ = "integration_configs"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    integration_key = Column(String(100), nullable=False, index=True)
    connected = Column(Boolean, nullable=False, default=False)
    config = Column(Text, nullable=False, default="")
    last_tested_at = Column(DateTime(timezone=True))
    last_test_ok = Column(Boolean)
    note = Column(Text)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class WorkspacePlan(Base):
    """Workspace billing plan and soft usage limits."""
    __tablename__ = "workspace_plans"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, unique=True, index=True)
    plan_name = Column(String(50), nullable=False, default="free")
    max_rows = Column(Integer, nullable=False, default=10000)
    max_reports_per_month = Column(Integer, nullable=False, default=20)
    max_ai_queries_per_day = Column(Integer, nullable=False, default=50)
    max_connectors = Column(Integer, nullable=False, default=1)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class DataConnector(Base):
    """Connector definitions for external data sync."""
    __tablename__ = "data_connectors"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    connector_type = Column(String(50), nullable=False)  # google_sheets, postgresql
    config = Column(JSON, nullable=False, default=dict)
    enabled = Column(Boolean, nullable=False, default=True)
    sync_interval_minutes = Column(Integer, nullable=False, default=60)
    target_dataset_name = Column(String(255))
    last_synced_at = Column(DateTime(timezone=True))
    last_sync_status = Column(String(50))
    last_sync_error = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ConnectorSyncRun(Base):
    """Execution logs for connector sync jobs."""
    __tablename__ = "connector_sync_runs"

    id = Column(Integer, primary_key=True, index=True)
    connector_id = Column(Integer, ForeignKey("data_connectors.id"), nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(50), nullable=False)
    rows_synced = Column(Integer, nullable=False, default=0)
    error_message = Column(Text)
    dataset_id = Column(Integer, ForeignKey("datasets.id"))
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True))


class ReportShare(Base):
    """Share links for report collaboration."""
    __tablename__ = "report_shares"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String(128), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ReportComment(Base):
    """Comments on reports for team collaboration."""
    __tablename__ = "report_comments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ReportApproval(Base):
    """Simple approval workflow state for reports."""
    __tablename__ = "report_approvals"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(50), nullable=False, default="pending")  # pending, approved, rejected
    note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AnalyticsEvent(Base):
    """Product analytics events for usage tracking."""
    __tablename__ = "analytics_events"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    event_name = Column(String(120), nullable=False, index=True)
    payload = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
