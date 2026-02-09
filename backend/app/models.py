from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON, Boolean
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
