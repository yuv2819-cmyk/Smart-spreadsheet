from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AIQuery, DataConnector, DataRow, Report, WorkspacePlan
from app.schemas import WorkspacePlanPayload

PLAN_DEFAULTS: dict[str, dict[str, int]] = {
    "free": {
        "max_rows": 10000,
        "max_reports_per_month": 20,
        "max_ai_queries_per_day": 50,
        "max_connectors": 1,
    },
    "pro": {
        "max_rows": 200000,
        "max_reports_per_month": 200,
        "max_ai_queries_per_day": 800,
        "max_connectors": 10,
    },
    "team": {
        "max_rows": 1000000,
        "max_reports_per_month": 1000,
        "max_ai_queries_per_day": 5000,
        "max_connectors": 50,
    },
}


def _period_bounds_today_utc() -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start, start + timedelta(days=1)


def _period_bounds_month_utc() -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


def _to_plan_payload(plan: WorkspacePlan) -> WorkspacePlanPayload:
    return WorkspacePlanPayload(
        plan_name=plan.plan_name,  # type: ignore[arg-type]
        max_rows=plan.max_rows,
        max_reports_per_month=plan.max_reports_per_month,
        max_ai_queries_per_day=plan.max_ai_queries_per_day,
        max_connectors=plan.max_connectors,
    )


def _apply_plan_defaults(plan_name: str) -> dict[str, int]:
    return PLAN_DEFAULTS.get(plan_name, PLAN_DEFAULTS["free"]).copy()


async def get_or_create_plan(db: AsyncSession, tenant_id: int, user_id: int) -> WorkspacePlan:
    result = await db.execute(
        select(WorkspacePlan).where(WorkspacePlan.tenant_id == tenant_id).limit(1)
    )
    plan = result.scalar_one_or_none()
    if plan:
        return plan

    defaults = _apply_plan_defaults("free")
    plan = WorkspacePlan(
        tenant_id=tenant_id,
        updated_by_user_id=user_id,
        plan_name="free",
        max_rows=defaults["max_rows"],
        max_reports_per_month=defaults["max_reports_per_month"],
        max_ai_queries_per_day=defaults["max_ai_queries_per_day"],
        max_connectors=defaults["max_connectors"],
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


async def update_plan(
    db: AsyncSession,
    *,
    tenant_id: int,
    user_id: int,
    payload: WorkspacePlanPayload,
) -> WorkspacePlan:
    plan = await get_or_create_plan(db, tenant_id, user_id)
    defaults = _apply_plan_defaults(payload.plan_name)
    plan.plan_name = payload.plan_name
    plan.max_rows = payload.max_rows or defaults["max_rows"]
    plan.max_reports_per_month = payload.max_reports_per_month or defaults["max_reports_per_month"]
    plan.max_ai_queries_per_day = payload.max_ai_queries_per_day or defaults["max_ai_queries_per_day"]
    plan.max_connectors = payload.max_connectors
    plan.updated_by_user_id = user_id
    await db.commit()
    await db.refresh(plan)
    return plan


async def get_usage_snapshot(
    db: AsyncSession,
    *,
    tenant_id: int,
    user_id: int,
) -> dict:
    plan = await get_or_create_plan(db, tenant_id, user_id)

    rows_result = await db.execute(
        select(func.count(DataRow.id)).where(DataRow.tenant_id == tenant_id)
    )
    rows_used = int(rows_result.scalar() or 0)

    month_start, month_end = _period_bounds_month_utc()
    reports_result = await db.execute(
        select(func.count(Report.id)).where(
            Report.tenant_id == tenant_id,
            Report.created_at >= month_start,
            Report.created_at < month_end,
        )
    )
    reports_this_month = int(reports_result.scalar() or 0)

    day_start, day_end = _period_bounds_today_utc()
    ai_result = await db.execute(
        select(func.count(AIQuery.id)).where(
            AIQuery.tenant_id == tenant_id,
            AIQuery.created_at >= day_start,
            AIQuery.created_at < day_end,
        )
    )
    ai_queries_today = int(ai_result.scalar() or 0)

    connectors_result = await db.execute(
        select(func.count(DataConnector.id)).where(
            DataConnector.tenant_id == tenant_id,
            DataConnector.enabled.is_(True),
        )
    )
    connectors_used = int(connectors_result.scalar() or 0)

    return {
        "rows_used": rows_used,
        "reports_this_month": reports_this_month,
        "ai_queries_today": ai_queries_today,
        "connectors_used": connectors_used,
        "plan": _to_plan_payload(plan),
    }


async def enforce_row_limit(
    db: AsyncSession,
    *,
    tenant_id: int,
    user_id: int,
    row_count: int,
) -> None:
    plan = await get_or_create_plan(db, tenant_id, user_id)
    if row_count > plan.max_rows:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Plan limit exceeded: max rows is {plan.max_rows} for plan '{plan.plan_name}'.",
        )


async def enforce_report_limit(
    db: AsyncSession,
    *,
    tenant_id: int,
    user_id: int,
) -> None:
    snapshot = await get_usage_snapshot(db, tenant_id=tenant_id, user_id=user_id)
    plan = snapshot["plan"]
    if snapshot["reports_this_month"] >= plan.max_reports_per_month:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Plan limit exceeded: max reports/month is {plan.max_reports_per_month}.",
        )


async def enforce_ai_query_limit(
    db: AsyncSession,
    *,
    tenant_id: int,
    user_id: int,
) -> None:
    snapshot = await get_usage_snapshot(db, tenant_id=tenant_id, user_id=user_id)
    plan = snapshot["plan"]
    if snapshot["ai_queries_today"] >= plan.max_ai_queries_per_day:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Plan limit exceeded: max AI queries/day is {plan.max_ai_queries_per_day}.",
        )


async def enforce_connector_limit(
    db: AsyncSession,
    *,
    tenant_id: int,
    user_id: int,
) -> None:
    snapshot = await get_usage_snapshot(db, tenant_id=tenant_id, user_id=user_id)
    plan = snapshot["plan"]
    if snapshot["connectors_used"] >= plan.max_connectors:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Plan limit exceeded: max active connectors is {plan.max_connectors}.",
        )
