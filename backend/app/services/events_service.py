from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import RequestContext
from app.models import AnalyticsEvent


async def track_event(
    db: AsyncSession,
    *,
    context: RequestContext,
    event_name: str,
    payload: dict | None = None,
    commit: bool = False,
) -> None:
    event = AnalyticsEvent(
        tenant_id=context.tenant_id,
        user_id=context.user_id,
        event_name=event_name[:120],
        payload=payload or {},
    )
    db.add(event)
    if commit:
        await db.commit()
