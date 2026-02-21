from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import RequestContext, get_request_context
from app.database import get_db
from app.models import AnalyticsEvent
from app.schemas import AnalyticsEventIngest, AnalyticsEventResponse
from app.services.events_service import track_event

router = APIRouter(prefix="/events", tags=["Events"])


@router.post("/ingest")
async def ingest_event(
    payload: AnalyticsEventIngest,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    await track_event(
        db,
        context=context,
        event_name=payload.event_name,
        payload=payload.payload,
    )
    await db.commit()
    return {"message": "Event tracked"}


@router.get("/recent", response_model=list[AnalyticsEventResponse])
async def recent_events(
    limit: int = Query(default=100, ge=1, le=500),
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AnalyticsEvent)
        .where(AnalyticsEvent.tenant_id == context.tenant_id)
        .order_by(AnalyticsEvent.created_at.desc())
        .limit(limit)
    )
    events = result.scalars().all()
    return [
        AnalyticsEventResponse(
            id=event.id,
            event_name=event.event_name,
            payload=event.payload or {},
            created_at=event.created_at,
        )
        for event in events
    ]
