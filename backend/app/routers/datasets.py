from io import StringIO

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.auth import RequestContext, get_request_context
from app.database import get_db
from app.models import AIQuery, DataRow, Dataset
from app.rate_limit import rate_limit
from app.schemas import DataUploadResponse, Dataset as DatasetSchema, DatasetCreate

router = APIRouter(prefix="/datasets", tags=["Datasets"])
settings = get_settings()


async def _clear_tenant_data(db: AsyncSession, tenant_id: int) -> None:
    await db.execute(delete(AIQuery).where(AIQuery.tenant_id == tenant_id))
    await db.execute(delete(DataRow).where(DataRow.tenant_id == tenant_id))
    await db.execute(delete(Dataset).where(Dataset.tenant_id == tenant_id))


@router.post("/", response_model=DatasetSchema)
async def create_dataset(
    dataset: DatasetCreate,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    """Create a new dataset"""
    new_dataset = Dataset(
        tenant_id=context.tenant_id,
        user_id=context.user_id,
        name=dataset.name,
        description=dataset.description,
        source_type=dataset.source_type,
        schema_info=dataset.schema_info,
    )
    db.add(new_dataset)
    await db.commit()
    await db.refresh(new_dataset)
    return new_dataset


@router.get("/latest", response_model=DatasetSchema)
async def get_latest_dataset(
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    """Get the most recent dataset"""
    result = await db.execute(
        select(Dataset)
        .where(Dataset.tenant_id == context.tenant_id)
        .order_by(Dataset.created_at.desc())
        .limit(1)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="No datasets found")
    return dataset


@router.get("/", response_model=list[DatasetSchema])
async def list_datasets(
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    """List all datasets for the tenant"""
    result = await db.execute(select(Dataset).where(Dataset.tenant_id == context.tenant_id))
    return result.scalars().all()


@router.post("/upload", response_model=DataUploadResponse)
async def upload_new_dataset(
    file: UploadFile = File(...),
    _: None = Depends(rate_limit(key_prefix="datasets-upload", limit=20, window_seconds=60)),
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    """Upload a CSV file and replace the current tenant dataset (single dataset mode)."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    # Fast reject when content-length is present.
    raw_size = file.headers.get("content-length") if file.headers else None
    if raw_size:
        try:
            if int(raw_size) > settings.max_upload_size_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"CSV exceeds max upload size ({settings.max_upload_size_bytes} bytes)",
                )
        except ValueError:
            pass

    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="File is empty")
        if len(contents) > settings.max_upload_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"CSV exceeds max upload size ({settings.max_upload_size_bytes} bytes)",
            )

        try:
            decoded = contents.decode("utf-8")
        except UnicodeDecodeError:
            decoded = contents.decode("latin-1")

        df = pd.read_csv(StringIO(decoded))
        if df.empty:
            raise HTTPException(status_code=400, detail="CSV contains no data")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(exc)}")

    await _clear_tenant_data(db, context.tenant_id)

    schema_info = {col: str(df[col].dtype) for col in df.columns}
    new_dataset = Dataset(
        tenant_id=context.tenant_id,
        user_id=context.user_id,
        name=file.filename,
        description="Uploaded via CSV",
        source_type="csv",
        schema_info=schema_info,
        row_count=len(df),
    )
    db.add(new_dataset)
    await db.flush()

    df = df.where(pd.notnull(df), None)
    rows_to_insert = [
        {
            "tenant_id": context.tenant_id,
            "dataset_id": new_dataset.id,
            "row_data": row.to_dict(),
        }
        for _, row in df.iterrows()
    ]

    if rows_to_insert:
        await db.execute(insert(DataRow), rows_to_insert)

    await db.commit()
    await db.refresh(new_dataset)

    return DataUploadResponse(
        dataset_id=new_dataset.id,
        rows_imported=len(df),
        message=f"Successfully uploaded '{file.filename}' with {len(df)} rows.",
    )


@router.get("/{dataset_id}/data")
async def get_dataset_data(
    dataset_id: int,
    limit: int = Query(default=100, ge=1, le=1000),
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    """Get data rows for a dataset."""
    requested_dataset = await db.execute(
        select(Dataset.id).where(
            Dataset.id == dataset_id,
            Dataset.tenant_id == context.tenant_id,
        )
    )
    effective_dataset_id = requested_dataset.scalar_one_or_none()

    if effective_dataset_id is None:
        latest_result = await db.execute(
            select(Dataset.id)
            .where(Dataset.tenant_id == context.tenant_id)
            .order_by(Dataset.created_at.desc())
            .limit(1)
        )
        effective_dataset_id = latest_result.scalar_one_or_none()
        if effective_dataset_id is None:
            return {"data": []}

    result = await db.execute(
        select(DataRow)
        .where(
            DataRow.tenant_id == context.tenant_id,
            DataRow.dataset_id == effective_dataset_id,
        )
        .limit(limit)
    )
    rows = result.scalars().all()
    return {"data": [row.row_data for row in rows]}


@router.delete("/clear")
async def clear_dataset(
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    """Clear all datasets for the authenticated tenant."""
    await _clear_tenant_data(db, context.tenant_id)
    await db.commit()
    return {"message": "Dataset cleared successfully"}
