import time
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import RequestContext, get_request_context
from app.config import get_settings
from app.database import get_db
from app.models import DataRow, Dataset
from app.schemas import OverviewMetrics
from app.services.analytics_service import build_analyst_insights

router = APIRouter(prefix="/overview", tags=["Overview"])
settings = get_settings()

_overview_cache: dict[int, dict] = {}


def _dataset_cache_key(dataset: Dataset) -> str:
    updated = dataset.updated_at or dataset.created_at
    return f"{dataset.id}:{dataset.row_count}:{updated.isoformat() if updated else 'none'}"


def _cache_metrics(dataset_id: int, cache_key: str, cached_at: float, payload: OverviewMetrics) -> None:
    _overview_cache[dataset_id] = {
        "cache_key": cache_key,
        "cached_at": cached_at,
        "payload": payload,
    }
    if len(_overview_cache) > 50:
        oldest_dataset_id = min(_overview_cache.items(), key=lambda item: item[1]["cached_at"])[0]
        _overview_cache.pop(oldest_dataset_id, None)


@router.get("/metrics", response_model=OverviewMetrics)
async def get_overview_metrics(
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    """Get metrics for the latest dataset in the authenticated tenant."""
    dataset_result = await db.execute(
        select(Dataset)
        .where(Dataset.tenant_id == context.tenant_id)
        .order_by(Dataset.created_at.desc())
        .limit(1)
    )
    dataset = dataset_result.scalar_one_or_none()

    if not dataset:
        return OverviewMetrics(
            total_rows=0,
            total_columns=0,
            numeric_columns=[],
            last_updated=None,
            basic_stats={},
            analyst_insights={
                "executive_summary": "No dataset is available yet. Upload a CSV to generate insights.",
                "recommendations": ["Upload a CSV file to begin analysis."],
                "data_quality": {
                    "rows_analyzed": 0,
                    "columns_analyzed": 0,
                    "duplicate_rows": 0,
                    "duplicate_pct": 0.0,
                    "completeness_pct": 0.0,
                    "high_missing_columns": [],
                    "inconsistent_categories": [],
                },
                "numeric_profiles": [],
                "categorical_profiles": [],
                "top_correlations": [],
                "segments": [],
                "trend": None,
                "kpis": {},
                "business_summary": {
                    "profit_available": False,
                    "revenue_column": None,
                    "cost_column": None,
                    "profit_column": None,
                    "total_revenue": None,
                    "total_cost": None,
                    "total_profit": None,
                    "profit_margin_pct": None,
                    "profit_rows": None,
                    "loss_rows": None,
                    "neutral_rows": None,
                    "message": "Upload data to calculate business performance.",
                },
                "profit_loss_breakdown": {
                    "segment_column": None,
                    "rows": [],
                    "top_profit_segments": [],
                    "top_loss_segments": [],
                    "message": "No data available for profit/loss breakdown.",
                },
                "simplified_trend": None,
                "chart_explanations": ["Upload data to enable simplified chart explanations."],
                "key_drivers": {
                    "positive_drivers": [],
                    "negative_drivers": [],
                },
                "alerts": [],
            },
        )

    cache_key = _dataset_cache_key(dataset)
    cached = _overview_cache.get(dataset.id)
    now = time.time()
    if cached and cached["cache_key"] == cache_key and (now - cached["cached_at"]) < settings.overview_cache_ttl_seconds:
        return cached["payload"]

    rows_result = await db.execute(
        select(DataRow).where(
            DataRow.tenant_id == context.tenant_id,
            DataRow.dataset_id == dataset.id,
        )
    )
    rows = rows_result.scalars().all()

    if not rows:
        payload = OverviewMetrics(
            dataset_id=dataset.id,
            total_rows=0,
            total_columns=0,
            numeric_columns=[],
            last_updated=dataset.updated_at,
            basic_stats={},
            chart_data=[],
            analyst_insights={
                "executive_summary": "Dataset has no rows. Upload non-empty CSV data to generate insights.",
                "recommendations": ["Upload a CSV with rows to enable analyst insights."],
                "data_quality": {
                    "rows_analyzed": 0,
                    "columns_analyzed": 0,
                    "duplicate_rows": 0,
                    "duplicate_pct": 0.0,
                    "completeness_pct": 0.0,
                    "high_missing_columns": [],
                    "inconsistent_categories": [],
                },
                "numeric_profiles": [],
                "categorical_profiles": [],
                "top_correlations": [],
                "segments": [],
                "trend": None,
                "kpis": {},
                "business_summary": {
                    "profit_available": False,
                    "revenue_column": None,
                    "cost_column": None,
                    "profit_column": None,
                    "total_revenue": None,
                    "total_cost": None,
                    "total_profit": None,
                    "profit_margin_pct": None,
                    "profit_rows": None,
                    "loss_rows": None,
                    "neutral_rows": None,
                    "message": "Upload data to calculate business performance.",
                },
                "profit_loss_breakdown": {
                    "segment_column": None,
                    "rows": [],
                    "top_profit_segments": [],
                    "top_loss_segments": [],
                    "message": "No data available for profit/loss breakdown.",
                },
                "simplified_trend": None,
                "chart_explanations": ["Upload data to enable simplified chart explanations."],
                "key_drivers": {
                    "positive_drivers": [],
                    "negative_drivers": [],
                },
                "alerts": [],
            },
        )
        _cache_metrics(dataset.id, cache_key, now, payload)
        return payload

    row_data = [row.row_data for row in rows]
    df = pd.DataFrame(row_data)

    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
    basic_stats: dict[str, dict[str, float]] = {}
    for col in numeric_cols:
        basic_stats[col] = {
            "min": float(df[col].min()),
            "max": float(df[col].max()),
            "avg": float(df[col].mean()),
        }

    chart_data: list[dict] = []
    if numeric_cols:
        label_col = None
        string_cols = df.select_dtypes(include=["object", "string"]).columns.tolist()
        if string_cols:
            for col in string_cols:
                if any(token in col.lower() for token in ["name", "date", "product", "month", "category"]):
                    label_col = col
                    break
            if not label_col:
                label_col = string_cols[0]

        subset = df.head(10).copy()
        if label_col:
            subset["name"] = subset[label_col].astype(str)
        else:
            subset["name"] = subset.index.astype(str)

        chart_data = subset[["name"] + numeric_cols].to_dict(orient="records")

    analyst_insights = build_analyst_insights(df)

    payload = OverviewMetrics(
        dataset_id=dataset.id,
        total_rows=len(df),
        total_columns=len(df.columns),
        numeric_columns=numeric_cols,
        last_updated=dataset.updated_at or datetime.now(),
        basic_stats=basic_stats,
        chart_data=chart_data,
        analyst_insights=analyst_insights,
    )

    _cache_metrics(dataset.id, cache_key, now, payload)
    return payload
