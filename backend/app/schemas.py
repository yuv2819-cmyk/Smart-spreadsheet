from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any, List, Literal
from datetime import datetime

# Tenant Schemas
class TenantBase(BaseModel):
    name: str
    subdomain: str

class TenantCreate(TenantBase):
    pass

class Tenant(TenantBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str
    tenant_id: int

class User(UserBase):
    id: int
    tenant_id: int
    is_active: bool
    role: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# Auth Schemas
class AuthUser(BaseModel):
    id: int
    tenant_id: int
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool
    role: str

    class Config:
        from_attributes = True


class AuthSignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: Optional[str] = Field(default=None, max_length=255)
    workspace_name: Optional[str] = Field(default=None, max_length=255)


class AuthSignInRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthUser

# Dataset Schemas
class DatasetBase(BaseModel):
    name: str
    description: Optional[str] = None
    source_type: str

class DatasetCreate(DatasetBase):
    schema_info: Optional[Dict[str, Any]] = None

class Dataset(DatasetBase):
    id: int
    tenant_id: int
    user_id: int
    row_count: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# AI Query Schemas
class AIQueryRequest(BaseModel):
    dataset_id: int
    prompt: str = Field(min_length=1, max_length=2000)

class AIQueryResponse(BaseModel):
    id: int
    prompt: str
    generated_code: Optional[str] = None
    result_data: Optional[Dict[str, Any]] = None
    execution_time_ms: Optional[int] = None
    
    class Config:
        from_attributes = True

# Data Upload Schema
class DataUploadResponse(BaseModel):
    dataset_id: int
    rows_imported: int
    message: str

# Overview Metrics Schema
class ChartData(BaseModel):
    name: str
    
    class Config:
        extra = "allow"

class OverviewMetrics(BaseModel):
    dataset_id: Optional[int] = None
    total_rows: int
    total_columns: int
    numeric_columns: List[str]
    last_updated: Optional[datetime] = None
    basic_stats: Dict[str, Dict[str, float]]  # {col_name: {min, max, avg}}
    chart_data: List[Dict[str, Any]] = Field(default_factory=list)  # For Recharts
    analyst_insights: Optional[Dict[str, Any]] = None

# AI Summary Schema
class AISummaryRequest(BaseModel):
    dataset_id: int

class AISummaryResponse(BaseModel):
    summary: str
    key_insights: List[str]


# Report Schemas
class ReportBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: str = Field(default="Executive", min_length=1, max_length=50)
    dataset_id: int
    summary: str = Field(min_length=1)
    key_insights: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    drivers: List[str] = Field(default_factory=list)
    kpis: Dict[str, str] = Field(default_factory=dict)
    content_markdown: str = Field(min_length=1)
    status: str = Field(default="Ready", min_length=1, max_length=50)
    size_kb: str = Field(default="0.0 KB", min_length=1, max_length=32)


class ReportCreate(ReportBase):
    pass


class ReportResponse(ReportBase):
    id: int
    tenant_id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Data Cleaning Schemas
class CleaningRuleSuggestion(BaseModel):
    id: str
    label: str
    description: str
    rule_type: str
    column: Optional[str] = None
    confidence: float
    severity: str
    affected_rows: int
    params: Dict[str, Any] = Field(default_factory=dict)


class CleaningProfileResponse(BaseModel):
    dataset_id: int
    row_count: int
    column_count: int
    duplicate_rows: int
    total_missing_cells: int
    missing_pct: float
    suggestions: List[CleaningRuleSuggestion] = Field(default_factory=list)


class CleaningPreviewRequest(BaseModel):
    dataset_id: int
    rule_ids: List[str] = Field(default_factory=list)


class CleaningRuleImpact(BaseModel):
    rule_id: str
    changed_cells: int = 0
    rows_removed: int = 0
    note: Optional[str] = None


class CleaningPreviewResponse(BaseModel):
    dataset_id: int
    selected_rule_ids: List[str]
    rows_before: int
    rows_after: int
    total_cells_changed: int
    total_rows_removed: int
    rule_impacts: List[CleaningRuleImpact] = Field(default_factory=list)
    sample_diffs: List[Dict[str, Any]] = Field(default_factory=list)


class CleaningApplyRequest(BaseModel):
    dataset_id: int
    rule_ids: List[str] = Field(default_factory=list)
    output_name: Optional[str] = Field(default=None, max_length=255)


class CleaningDiffRequest(BaseModel):
    dataset_id: int
    rule_ids: List[str] = Field(default_factory=list)
    limit: int = Field(default=20, ge=1, le=200)


class CleaningDiffResponse(BaseModel):
    dataset_id: int
    selected_rule_ids: List[str]
    changed_rows: int
    changes: List[Dict[str, Any]] = Field(default_factory=list)


class CleaningApplyResponse(BaseModel):
    transformation_id: int
    source_dataset_id: int
    output_dataset_id: int
    rows_before: int
    rows_after: int
    message: str


class CleaningTransformationResponse(BaseModel):
    id: int
    source_dataset_id: int
    output_dataset_id: int
    rule_ids: List[str]
    summary: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


# Workspace Persistence Schemas
class WorkspaceSettingsPayload(BaseModel):
    workspace_name: str = Field(default="My Workspace", max_length=255)
    subdomain: str = Field(default="my-workspace", max_length=100)
    display_name: str = Field(default="", max_length=255)
    email: str = Field(default="", max_length=255)
    theme: Literal["system", "light", "dark"] = "system"
    notifications_email: bool = True
    notifications_product: bool = True
    india_mode_enabled: bool = False
    preferred_currency: Literal["USD", "INR"] = "USD"
    number_format: Literal["international", "indian"] = "international"
    fiscal_year_start_month: int = Field(default=1, ge=1, le=12)
    report_language: Literal["english", "hindi", "hinglish"] = "english"


class WorkspaceGoalPayload(BaseModel):
    revenue_target: float = 0.0
    profit_target: float = 0.0
    margin_target: float = 0.0


class IntegrationConfigPayload(BaseModel):
    integration_key: str = Field(min_length=1, max_length=100)
    connected: bool = False
    config: str = ""
    last_tested_at: Optional[datetime] = None
    last_test_ok: Optional[bool] = None
    note: Optional[str] = None


class WorkspacePlanPayload(BaseModel):
    plan_name: Literal["free", "pro", "team"] = "free"
    max_rows: int = Field(ge=1)
    max_reports_per_month: int = Field(ge=1)
    max_ai_queries_per_day: int = Field(ge=1)
    max_connectors: int = Field(ge=0)


class UsageSnapshotResponse(BaseModel):
    rows_used: int
    reports_this_month: int
    ai_queries_today: int
    connectors_used: int
    plan: WorkspacePlanPayload


# Connectors Schemas
class DataConnectorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    connector_type: Literal["google_sheets", "postgresql"]
    config: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True
    sync_interval_minutes: int = Field(default=60, ge=5, le=10080)
    target_dataset_name: Optional[str] = Field(default=None, max_length=255)


class DataConnectorUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    config: Optional[Dict[str, Any]] = None
    enabled: Optional[bool] = None
    sync_interval_minutes: Optional[int] = Field(default=None, ge=5, le=10080)
    target_dataset_name: Optional[str] = Field(default=None, max_length=255)


class DataConnectorResponse(BaseModel):
    id: int
    name: str
    connector_type: str
    config: Dict[str, Any]
    enabled: bool
    sync_interval_minutes: int
    target_dataset_name: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    last_sync_status: Optional[str] = None
    last_sync_error: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ConnectorSyncResponse(BaseModel):
    connector_id: int
    status: str
    rows_synced: int
    dataset_id: Optional[int] = None
    detail: str


# Report Collaboration Schemas
class ReportShareCreate(BaseModel):
    expires_in_hours: Optional[int] = Field(default=168, ge=1, le=24 * 365)


class ReportShareResponse(BaseModel):
    id: int
    report_id: int
    token: str
    share_url: str
    expires_at: Optional[datetime] = None
    created_at: datetime


class ReportCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class ReportCommentResponse(BaseModel):
    id: int
    report_id: int
    user_id: int
    body: str
    created_at: datetime


class ReportApprovalUpsert(BaseModel):
    status: Literal["pending", "approved", "rejected"]
    note: Optional[str] = Field(default=None, max_length=2000)


class ReportApprovalResponse(BaseModel):
    id: int
    report_id: int
    user_id: int
    status: str
    note: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


# Events Schemas
class AnalyticsEventIngest(BaseModel):
    event_name: str = Field(min_length=1, max_length=120)
    payload: Dict[str, Any] = Field(default_factory=dict)


class AnalyticsEventResponse(BaseModel):
    id: int
    event_name: str
    payload: Dict[str, Any]
    created_at: datetime


# India Insights Schemas
class IndiaInsightsResponse(BaseModel):
    dataset_id: Optional[int] = None
    locale: str
    currency: str
    number_format: str
    fiscal_year_start_month: int
    signals: Dict[str, Any] = Field(default_factory=dict)
    macro_overlay: List[Dict[str, Any]] = Field(default_factory=list)
    fiscal_year_summary: List[Dict[str, Any]] = Field(default_factory=list)
    festival_impact: List[Dict[str, Any]] = Field(default_factory=list)
    state_performance: List[Dict[str, Any]] = Field(default_factory=list)
    tier_performance: List[Dict[str, Any]] = Field(default_factory=list)
    gst_summary: Dict[str, Any] = Field(default_factory=dict)
    sector_benchmarks: Dict[str, Any] = Field(default_factory=dict)
    compliance_alerts: List[Dict[str, Any]] = Field(default_factory=list)
    localization: Dict[str, Any] = Field(default_factory=dict)
    recommended_actions: List[str] = Field(default_factory=list)


class IndiaReportRequest(BaseModel):
    dataset_id: Optional[int] = None
    language: Literal["english", "hindi", "hinglish"] = "english"

