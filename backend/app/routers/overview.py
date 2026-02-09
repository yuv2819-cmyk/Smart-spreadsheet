from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models import Dataset, DataRow
from app.schemas import OverviewMetrics
import pandas as pd
from datetime import datetime

router = APIRouter(prefix="/overview", tags=["Overview"])

@router.get("/metrics", response_model=OverviewMetrics)
async def get_overview_metrics(
    db: AsyncSession = Depends(get_db)
):
    """Get metrics for the primary dataset (MVP: dataset_id=1)"""
    # 1. Fetch latest dataset info
    dataset_result = await db.execute(
        select(Dataset)
        .where(Dataset.tenant_id == 1)
        .order_by(Dataset.created_at.desc())
        .limit(1)
    )
    dataset = dataset_result.scalar_one_or_none()
    
    if not dataset:
        # Return empty state if no dataset found
        return OverviewMetrics(
            total_rows=0,
            total_columns=0,
            numeric_columns=[],
            last_updated=None,
            basic_stats={}
        )

    # 2. Fetch all data rows
    rows_result = await db.execute(
        select(DataRow).where(DataRow.dataset_id == dataset.id)
    )
    rows = rows_result.scalars().all()
    
    if not rows:
         return OverviewMetrics(
            total_rows=0,
            total_columns=0,
            numeric_columns=[],
            last_updated=dataset.updated_at,
            basic_stats={}
        )

    # 3. Process with Pandas
    row_data = [r.row_data for r in rows]
    df = pd.DataFrame(row_data)
    
    # Identify numeric columns
    numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
    
    # Calculate stats
    basic_stats = {}
    for col in numeric_cols:
        basic_stats[col] = {
            "min": float(df[col].min()),
            "max": float(df[col].max()),
            "avg": float(df[col].mean())
        }
        
    # Prepare chart data (subset for visualization)
    # We'll take the first 10 rows and only numeric columns for the bar chart
    chart_data = []
    if numeric_cols:
        # Find a suitable string column for labels (e.g. Name, Date, Product)
        label_col = None
        string_cols = df.select_dtypes(include=['object', 'string']).columns.tolist()
        if string_cols:
            # Prefer columns with "name", "date", "product" in title
            for col in string_cols:
                if any(x in col.lower() for x in ['name', 'date', 'product', 'month', 'category']):
                    label_col = col
                    break
            # Fallback to first string col
            if not label_col:
                label_col = string_cols[0]

        subset = df.head(10).copy()
        
        # Add identifier
        if label_col:
            subset['name'] = subset[label_col].astype(str)
        else:
            subset['name'] = subset.index.astype(str)
            
        chart_data = subset[['name'] + numeric_cols].to_dict(orient='records')
        
    return OverviewMetrics(
        dataset_id=dataset.id,
        total_rows=len(df),
        total_columns=len(df.columns),
        numeric_columns=numeric_cols,
        last_updated=dataset.updated_at or datetime.now(),
        basic_stats=basic_stats,
        chart_data=chart_data
    )
