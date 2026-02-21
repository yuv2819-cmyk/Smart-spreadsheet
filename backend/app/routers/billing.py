from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import RequestContext, get_request_context
from app.database import get_db
from app.schemas import UsageSnapshotResponse, WorkspacePlanPayload
from app.services.events_service import track_event
from app.services.plan_service import get_or_create_plan, get_usage_snapshot, update_plan

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.get("/plan", response_model=WorkspacePlanPayload)
async def get_plan(
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_or_create_plan(db, context.tenant_id, context.user_id)
    return WorkspacePlanPayload(
        plan_name=plan.plan_name,  # type: ignore[arg-type]
        max_rows=plan.max_rows,
        max_reports_per_month=plan.max_reports_per_month,
        max_ai_queries_per_day=plan.max_ai_queries_per_day,
        max_connectors=plan.max_connectors,
    )


@router.put("/plan", response_model=WorkspacePlanPayload)
async def put_plan(
    payload: WorkspacePlanPayload,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    plan = await update_plan(
        db,
        tenant_id=context.tenant_id,
        user_id=context.user_id,
        payload=payload,
    )
    await track_event(
        db,
        context=context,
        event_name="billing_plan_updated",
        payload={"plan_name": plan.plan_name},
    )
    await db.commit()
    return WorkspacePlanPayload(
        plan_name=plan.plan_name,  # type: ignore[arg-type]
        max_rows=plan.max_rows,
        max_reports_per_month=plan.max_reports_per_month,
        max_ai_queries_per_day=plan.max_ai_queries_per_day,
        max_connectors=plan.max_connectors,
    )


@router.get("/usage", response_model=UsageSnapshotResponse)
async def usage(
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    snapshot = await get_usage_snapshot(
        db,
        tenant_id=context.tenant_id,
        user_id=context.user_id,
    )
    return UsageSnapshotResponse(**snapshot)
