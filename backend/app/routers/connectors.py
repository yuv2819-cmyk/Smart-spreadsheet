from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import RequestContext, get_request_context
from app.database import get_db
from app.models import DataConnector
from app.schemas import (
    ConnectorSyncResponse,
    DataConnectorCreate,
    DataConnectorResponse,
    DataConnectorUpdate,
)
from app.services.connectors_service import run_due_connector_syncs, sync_connector, test_connector
from app.services.events_service import track_event
from app.services.plan_service import enforce_connector_limit

router = APIRouter(prefix="/connectors", tags=["Connectors"])


@router.get("/", response_model=list[DataConnectorResponse])
async def list_connectors(
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DataConnector)
        .where(DataConnector.tenant_id == context.tenant_id)
        .order_by(DataConnector.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=DataConnectorResponse, status_code=status.HTTP_201_CREATED)
async def create_connector(
    payload: DataConnectorCreate,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    await enforce_connector_limit(db, tenant_id=context.tenant_id, user_id=context.user_id)

    connector = DataConnector(
        tenant_id=context.tenant_id,
        user_id=context.user_id,
        name=payload.name,
        connector_type=payload.connector_type,
        config=payload.config,
        enabled=payload.enabled,
        sync_interval_minutes=payload.sync_interval_minutes,
        target_dataset_name=payload.target_dataset_name,
    )
    db.add(connector)
    await db.commit()
    await db.refresh(connector)

    await track_event(
        db,
        context=context,
        event_name="connector_created",
        payload={"connector_id": connector.id, "connector_type": connector.connector_type},
    )
    await db.commit()
    return connector


@router.patch("/{connector_id}", response_model=DataConnectorResponse)
async def update_connector(
    connector_id: int,
    payload: DataConnectorUpdate,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    connector = await db.get(DataConnector, connector_id)
    if connector is None or connector.tenant_id != context.tenant_id:
        raise HTTPException(status_code=404, detail="Connector not found")

    if payload.name is not None:
        connector.name = payload.name
    if payload.config is not None:
        connector.config = payload.config
    if payload.enabled is not None:
        connector.enabled = payload.enabled
    if payload.sync_interval_minutes is not None:
        connector.sync_interval_minutes = payload.sync_interval_minutes
    if payload.target_dataset_name is not None:
        connector.target_dataset_name = payload.target_dataset_name

    await db.commit()
    await db.refresh(connector)
    return connector


@router.delete("/{connector_id}")
async def delete_connector(
    connector_id: int,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    connector = await db.get(DataConnector, connector_id)
    if connector is None or connector.tenant_id != context.tenant_id:
        raise HTTPException(status_code=404, detail="Connector not found")
    await db.delete(connector)
    await db.commit()
    return {"message": "Connector deleted successfully"}


@router.post("/{connector_id}/test", response_model=ConnectorSyncResponse)
async def connector_test(
    connector_id: int,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    connector = await db.get(DataConnector, connector_id)
    if connector is None or connector.tenant_id != context.tenant_id:
        raise HTTPException(status_code=404, detail="Connector not found")

    ok, detail, rows = await test_connector(connector.connector_type, connector.config or {})
    return ConnectorSyncResponse(
        connector_id=connector.id,
        status="success" if ok else "failed",
        rows_synced=rows,
        dataset_id=None,
        detail=detail,
    )


@router.post("/{connector_id}/sync", response_model=ConnectorSyncResponse)
async def connector_sync(
    connector_id: int,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    connector = await db.get(DataConnector, connector_id)
    if connector is None or connector.tenant_id != context.tenant_id:
        raise HTTPException(status_code=404, detail="Connector not found")

    run = await sync_connector(db, connector=connector)
    await track_event(
        db,
        context=context,
        event_name="connector_sync_triggered",
        payload={
            "connector_id": connector.id,
            "status": run.status,
            "rows_synced": run.rows_synced,
            "dataset_id": run.dataset_id,
        },
    )
    await db.commit()
    return ConnectorSyncResponse(
        connector_id=connector.id,
        status=run.status,
        rows_synced=run.rows_synced,
        dataset_id=run.dataset_id,
        detail=run.error_message or "Sync completed",
    )


@router.post("/sync-due")
async def sync_due_connectors(
    secret: str = Query(default=""),
):
    # Minimal trigger endpoint for cron-style calls.
    # Kept intentionally simple for MVP workflows.
    _ = secret
    await run_due_connector_syncs()
    return {"message": "Due connector sync check completed"}
