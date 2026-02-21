from __future__ import annotations

from datetime import datetime

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import RequestContext, get_request_context
from app.database import get_db
from app.models import DataRow, Dataset, Report, WorkspaceSettings
from app.schemas import IndiaInsightsResponse, IndiaReportRequest, ReportResponse
from app.services.events_service import track_event
from app.services.india_insights_service import build_india_insights, build_india_report_payload
from app.services.plan_service import enforce_report_limit

router = APIRouter(prefix="/india", tags=["India Insights"])


async def _get_dataset_for_tenant(
    db: AsyncSession,
    *,
    tenant_id: int,
    dataset_id: int | None = None,
) -> Dataset | None:
    if dataset_id is not None:
        dataset = await db.get(Dataset, dataset_id)
        if dataset and dataset.tenant_id == tenant_id:
            return dataset
        return None

    result = await db.execute(
        select(Dataset)
        .where(Dataset.tenant_id == tenant_id)
        .order_by(Dataset.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _get_workspace_settings(db: AsyncSession, *, tenant_id: int) -> WorkspaceSettings | None:
    result = await db.execute(
        select(WorkspaceSettings).where(WorkspaceSettings.tenant_id == tenant_id).limit(1)
    )
    return result.scalar_one_or_none()


async def _to_dataframe(db: AsyncSession, *, tenant_id: int, dataset_id: int) -> pd.DataFrame:
    rows_result = await db.execute(
        select(DataRow).where(
            DataRow.tenant_id == tenant_id,
            DataRow.dataset_id == dataset_id,
        )
    )
    rows = rows_result.scalars().all()
    row_data = [row.row_data for row in rows]
    return pd.DataFrame(row_data)


def _report_response(report: Report) -> ReportResponse:
    return ReportResponse(
        id=report.id,
        tenant_id=report.tenant_id,
        user_id=report.user_id,
        dataset_id=report.dataset_id,
        name=report.name,
        type=report.report_type,
        status=report.status,
        size_kb=report.size_kb,
        summary=report.summary,
        key_insights=list(report.key_insights or []),
        recommendations=list(report.recommendations or []),
        risks=list(report.risks or []),
        drivers=list(report.drivers or []),
        kpis=dict(report.kpis or {}),
        content_markdown=report.content_markdown,
        created_at=report.created_at or datetime.utcnow(),
    )


@router.get("/insights", response_model=IndiaInsightsResponse)
async def get_india_insights(
    dataset_id: int | None = Query(default=None),
    language: str | None = Query(default=None),
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    settings = await _get_workspace_settings(db, tenant_id=context.tenant_id)
    effective_language = (language or (settings.report_language if settings else "english") or "english").lower()
    fiscal_year_start_month = int(settings.fiscal_year_start_month) if settings else 4

    dataset = await _get_dataset_for_tenant(
        db,
        tenant_id=context.tenant_id,
        dataset_id=dataset_id,
    )
    if dataset is None:
        payload = build_india_insights(
            pd.DataFrame(),
            fiscal_year_start_month=fiscal_year_start_month,
            language=effective_language,
        )
        return IndiaInsightsResponse(dataset_id=None, **payload)

    df = await _to_dataframe(db, tenant_id=context.tenant_id, dataset_id=dataset.id)
    payload = build_india_insights(
        df,
        fiscal_year_start_month=fiscal_year_start_month,
        language=effective_language,
    )

    await track_event(
        db,
        context=context,
        event_name="india_insights_viewed",
        payload={"dataset_id": dataset.id, "language": effective_language},
    )
    await db.commit()
    return IndiaInsightsResponse(dataset_id=dataset.id, **payload)


@router.post("/report", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_india_trend_report(
    payload: IndiaReportRequest,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    settings = await _get_workspace_settings(db, tenant_id=context.tenant_id)
    effective_language = (payload.language or (settings.report_language if settings else "english")).lower()
    fiscal_year_start_month = int(settings.fiscal_year_start_month) if settings else 4

    dataset = await _get_dataset_for_tenant(
        db,
        tenant_id=context.tenant_id,
        dataset_id=payload.dataset_id,
    )
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    await enforce_report_limit(db, tenant_id=context.tenant_id, user_id=context.user_id)

    df = await _to_dataframe(db, tenant_id=context.tenant_id, dataset_id=dataset.id)
    insights = build_india_insights(
        df,
        fiscal_year_start_month=fiscal_year_start_month,
        language=effective_language,
    )
    report_payload = build_india_report_payload(
        dataset_name=dataset.name,
        insights=insights,
        language=effective_language,
    )
    content_markdown = str(report_payload["content_markdown"])
    size_kb = f"{(len(content_markdown.encode('utf-8')) / 1024):.1f} KB"

    report = Report(
        tenant_id=context.tenant_id,
        user_id=context.user_id,
        dataset_id=dataset.id,
        name=str(report_payload["name"])[:255],
        report_type=str(report_payload["type"])[:50],
        status=str(report_payload["status"])[:50],
        size_kb=size_kb,
        summary=str(report_payload["summary"]),
        key_insights=list(report_payload["key_insights"]),
        recommendations=list(report_payload["recommendations"]),
        risks=list(report_payload["risks"]),
        drivers=list(report_payload["drivers"]),
        kpis=dict(report_payload["kpis"]),
        content_markdown=content_markdown,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    await track_event(
        db,
        context=context,
        event_name="india_report_generated",
        payload={
            "dataset_id": dataset.id,
            "report_id": report.id,
            "language": effective_language,
        },
    )
    await db.commit()
    return _report_response(report)
