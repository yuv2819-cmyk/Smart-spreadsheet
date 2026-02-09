from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any, List
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
    prompt: str

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
    chart_data: List[Dict[str, Any]] = [] # For Recharts

# AI Summary Schema
class AISummaryRequest(BaseModel):
    dataset_id: int

class AISummaryResponse(BaseModel):
    summary: str
    key_insights: List[str]

