from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, delete
from app.database import get_db
from app.models import Dataset, DataRow, AIQuery
from app.schemas import DatasetCreate, Dataset as DatasetSchema, DataUploadResponse
import pandas as pd
import json
from io import StringIO

router = APIRouter(prefix="/datasets", tags=["Datasets"])

@router.post("/", response_model=DatasetSchema)
async def create_dataset(
    dataset: DatasetCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new dataset"""
    new_dataset = Dataset(
        tenant_id=1,
        user_id=1,
        name=dataset.name,
        description=dataset.description,
        source_type=dataset.source_type,
        schema_info=dataset.schema_info
    )
    db.add(new_dataset)
    await db.commit()
    await db.refresh(new_dataset)
    return new_dataset

@router.get("/latest", response_model=DatasetSchema)
async def get_latest_dataset(
    db: AsyncSession = Depends(get_db)
):
    """Get the most recent dataset"""
    result = await db.execute(
        select(Dataset)
        .where(Dataset.tenant_id == 1)
        .order_by(Dataset.created_at.desc())
        .limit(1)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="No datasets found")
    return dataset

@router.get("/", response_model=list[DatasetSchema])
async def list_datasets(
    db: AsyncSession = Depends(get_db)
):
    """List all datasets for the tenant"""
    result = await db.execute(
        select(Dataset).where(Dataset.tenant_id == 1)
    )
    datasets = result.scalars().all()
    return datasets

@router.post("/upload", response_model=DataUploadResponse)
async def upload_new_dataset(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload a CSV file and replace the current dataset (MVP: Single Dataset Mode)"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    # 1. Clear existing datasets (MVP Single Tenant/Dataset limit)
    # Delete dependent AI queries first
    await db.execute(delete(AIQuery).where(AIQuery.tenant_id == 1))
    # Delete data rows
    await db.execute(delete(DataRow).where(DataRow.tenant_id == 1))
    # Delete datasets
    await db.execute(delete(Dataset).where(Dataset.tenant_id == 1))
    
    # 2. Read and Parse CSV
    try:
        contents = await file.read()
        if not contents:
             raise HTTPException(status_code=400, detail="File is empty")
        
        # Try decoding with utf-8 first, fallback to latin-1 (common for Excel)
        try:
            decoded = contents.decode('utf-8')
        except UnicodeDecodeError:
            decoded = contents.decode('latin-1')
             
        df = pd.read_csv(StringIO(decoded))
        if df.empty:
             raise HTTPException(status_code=400, detail="CSV contains no data")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")
    
    # 3. Create Dataset Record
    schema_info = {col: str(df[col].dtype) for col in df.columns}
    
    new_dataset = Dataset(
        tenant_id=1,
        user_id=1,
        name=file.filename,
        description="Uploaded via CSV",
        source_type="csv",
        schema_info=schema_info,
        row_count=len(df)
    )
    db.add(new_dataset)
    await db.flush() # Get ID
    
    # 4. Insert Rows
    # Convert NaNs to None for JSON compatibility
    df = df.where(pd.notnull(df), None)
    
    rows_to_insert = []
    for _, row in df.iterrows():
        rows_to_insert.append({
            "tenant_id": 1,
            "dataset_id": new_dataset.id,
            "row_data": row.to_dict()
        })
    
    if rows_to_insert:
        await db.execute(insert(DataRow), rows_to_insert)
    
    await db.commit()
    await db.refresh(new_dataset)
    
    return DataUploadResponse(
        dataset_id=new_dataset.id,
        rows_imported=len(df),
        message=f"Successfully uploaded '{file.filename}' with {len(df)} rows."
    )

@router.get("/{dataset_id}/data")
async def get_dataset_data(
    dataset_id: int,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get data rows for a dataset"""
    # Try fetching rows for the specific ID
    result = await db.execute(
        select(DataRow)
        .where(DataRow.dataset_id == dataset_id)
        .limit(limit)
    )
    rows = result.scalars().all()
    
    # Fallback: If no rows found (maybe ID is old), get rows from the LATEST dataset
    if not rows:
         dataset_result = await db.execute(
            select(Dataset)
            .where(Dataset.tenant_id == 1)
            .order_by(Dataset.created_at.desc())
            .limit(1)
         )
         dataset = dataset_result.scalar_one_or_none()
         if dataset:
             result = await db.execute(
                select(DataRow)
                .where(DataRow.dataset_id == dataset.id)
                .limit(limit)
            )
             rows = result.scalars().all()
             
    return {"data": [row.row_data for row in rows]}

@router.delete("/clear")
async def clear_dataset(
    db: AsyncSession = Depends(get_db)
):
    """Clear all data for the tenant (MVP: Single Dataset Mode)"""
    # Delete dependent AI queries first
    await db.execute(delete(AIQuery).where(AIQuery.tenant_id == 1))
    # Delete data rows
    await db.execute(delete(DataRow).where(DataRow.tenant_id == 1))
    # Delete datasets
    await db.execute(delete(Dataset).where(Dataset.tenant_id == 1))
    
    await db.commit()
    
    return {"message": "Dataset cleared successfully"}
