from __future__ import annotations

import json
from datetime import datetime, timezone
from urllib import request as urllib_request

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import RequestContext, get_request_context
from app.database import get_db
from app.models import IntegrationConfig, WorkspaceGoal, WorkspaceSettings
from app.schemas import IntegrationConfigPayload, WorkspaceGoalPayload, WorkspaceSettingsPayload
from app.services.events_service import track_event

router = APIRouter(prefix="/workspace", tags=["Workspace"])

SUPPORTED_INTEGRATIONS: dict[str, str] = {
    "google-sheets": "sheet",
    "slack": "url",
    "webhook": "url",
    "tally": "token",
    "zoho-books": "token",
    "busy": "token",
    "razorpay": "token_or_url",
    "phonepe": "token_or_url",
    "bharatpe": "token_or_url",
    "amazon-seller": "token",
    "flipkart-seller": "token",
    "gst-portal": "token",
}


async def _get_or_create_settings(
    db: AsyncSession,
    *,
    context: RequestContext,
) -> WorkspaceSettings:
    result = await db.execute(
        select(WorkspaceSettings).where(WorkspaceSettings.tenant_id == context.tenant_id).limit(1)
    )
    settings = result.scalar_one_or_none()
    if settings:
        return settings

    settings = WorkspaceSettings(
        tenant_id=context.tenant_id,
        workspace_name="My Workspace",
        subdomain="my-workspace",
        display_name="",
        email="",
        theme="system",
        notifications_email=True,
        notifications_product=True,
        india_mode_enabled=False,
        preferred_currency="USD",
        number_format="international",
        fiscal_year_start_month=1,
        report_language="english",
        updated_by_user_id=context.user_id,
    )
    db.add(settings)
    await db.commit()
    await db.refresh(settings)
    return settings


async def _get_or_create_goals(
    db: AsyncSession,
    *,
    context: RequestContext,
) -> WorkspaceGoal:
    result = await db.execute(
        select(WorkspaceGoal).where(WorkspaceGoal.tenant_id == context.tenant_id).limit(1)
    )
    goals = result.scalar_one_or_none()
    if goals:
        return goals

    goals = WorkspaceGoal(
        tenant_id=context.tenant_id,
        revenue_target=0.0,
        profit_target=0.0,
        margin_target=0.0,
        updated_by_user_id=context.user_id,
    )
    db.add(goals)
    await db.commit()
    await db.refresh(goals)
    return goals


@router.get("/settings", response_model=WorkspaceSettingsPayload)
async def get_settings(
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    settings = await _get_or_create_settings(db, context=context)
    return WorkspaceSettingsPayload(
        workspace_name=settings.workspace_name,
        subdomain=settings.subdomain,
        display_name=settings.display_name,
        email=settings.email,
        theme=settings.theme,  # type: ignore[arg-type]
        notifications_email=settings.notifications_email,
        notifications_product=settings.notifications_product,
        india_mode_enabled=settings.india_mode_enabled,
        preferred_currency=settings.preferred_currency,  # type: ignore[arg-type]
        number_format=settings.number_format,  # type: ignore[arg-type]
        fiscal_year_start_month=settings.fiscal_year_start_month,
        report_language=settings.report_language,  # type: ignore[arg-type]
    )


@router.put("/settings", response_model=WorkspaceSettingsPayload)
async def put_settings(
    payload: WorkspaceSettingsPayload,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    settings = await _get_or_create_settings(db, context=context)
    settings.workspace_name = payload.workspace_name.strip() or "My Workspace"
    settings.subdomain = payload.subdomain.strip().lower() or "my-workspace"
    settings.display_name = payload.display_name.strip()
    settings.email = payload.email.strip().lower()
    settings.theme = payload.theme
    settings.notifications_email = payload.notifications_email
    settings.notifications_product = payload.notifications_product
    settings.india_mode_enabled = payload.india_mode_enabled
    settings.preferred_currency = payload.preferred_currency
    settings.number_format = payload.number_format
    settings.fiscal_year_start_month = int(payload.fiscal_year_start_month)
    settings.report_language = payload.report_language
    settings.updated_by_user_id = context.user_id
    await db.commit()
    await track_event(
        db,
        context=context,
        event_name="workspace_settings_updated",
        payload={
            "theme": payload.theme,
            "india_mode_enabled": payload.india_mode_enabled,
            "preferred_currency": payload.preferred_currency,
            "number_format": payload.number_format,
            "fiscal_year_start_month": payload.fiscal_year_start_month,
            "report_language": payload.report_language,
        },
    )
    await db.commit()
    return payload


@router.get("/goals", response_model=WorkspaceGoalPayload)
async def get_goals(
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    goals = await _get_or_create_goals(db, context=context)
    return WorkspaceGoalPayload(
        revenue_target=float(goals.revenue_target),
        profit_target=float(goals.profit_target),
        margin_target=float(goals.margin_target),
    )


@router.put("/goals", response_model=WorkspaceGoalPayload)
async def put_goals(
    payload: WorkspaceGoalPayload,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    goals = await _get_or_create_goals(db, context=context)
    goals.revenue_target = float(payload.revenue_target)
    goals.profit_target = float(payload.profit_target)
    goals.margin_target = float(payload.margin_target)
    goals.updated_by_user_id = context.user_id
    await db.commit()
    await track_event(
        db,
        context=context,
        event_name="workspace_goals_updated",
        payload={
            "revenue_target": goals.revenue_target,
            "profit_target": goals.profit_target,
            "margin_target": goals.margin_target,
        },
    )
    await db.commit()
    return payload


@router.get("/integrations", response_model=list[IntegrationConfigPayload])
async def list_integrations(
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(IntegrationConfig).where(IntegrationConfig.tenant_id == context.tenant_id)
    )
    existing = {item.integration_key: item for item in result.scalars().all()}

    response: list[IntegrationConfigPayload] = []
    for key in SUPPORTED_INTEGRATIONS.keys():
        item = existing.get(key)
        if item is None:
            response.append(
                IntegrationConfigPayload(
                    integration_key=key,
                    connected=False,
                    config="",
                    last_tested_at=None,
                    last_test_ok=None,
                    note=None,
                )
            )
        else:
            response.append(
                IntegrationConfigPayload(
                    integration_key=item.integration_key,
                    connected=item.connected,
                    config=item.config or "",
                    last_tested_at=item.last_tested_at,
                    last_test_ok=item.last_test_ok,
                    note=item.note,
                )
            )
    return response


@router.put("/integrations/{integration_key}", response_model=IntegrationConfigPayload)
async def upsert_integration(
    integration_key: str,
    payload: IntegrationConfigPayload,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    if integration_key not in SUPPORTED_INTEGRATIONS:
        raise HTTPException(status_code=400, detail="Unsupported integration")

    result = await db.execute(
        select(IntegrationConfig).where(
            IntegrationConfig.tenant_id == context.tenant_id,
            IntegrationConfig.integration_key == integration_key,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        item = IntegrationConfig(
            tenant_id=context.tenant_id,
            integration_key=integration_key,
            updated_by_user_id=context.user_id,
        )
        db.add(item)

    item.connected = payload.connected
    item.config = payload.config
    item.last_tested_at = payload.last_tested_at
    item.last_test_ok = payload.last_test_ok
    item.note = payload.note
    item.updated_by_user_id = context.user_id
    await db.commit()

    await track_event(
        db,
        context=context,
        event_name="integration_upserted",
        payload={"integration_key": integration_key, "connected": payload.connected},
    )
    await db.commit()
    return IntegrationConfigPayload(
        integration_key=integration_key,
        connected=item.connected,
        config=item.config or "",
        last_tested_at=item.last_tested_at,
        last_test_ok=item.last_test_ok,
        note=item.note,
    )


@router.post("/integrations/{integration_key}/disconnect", response_model=IntegrationConfigPayload)
async def disconnect_integration(
    integration_key: str,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    if integration_key not in SUPPORTED_INTEGRATIONS:
        raise HTTPException(status_code=400, detail="Unsupported integration")

    result = await db.execute(
        select(IntegrationConfig).where(
            IntegrationConfig.tenant_id == context.tenant_id,
            IntegrationConfig.integration_key == integration_key,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        return IntegrationConfigPayload(integration_key=integration_key)

    item.connected = False
    item.config = ""
    item.last_tested_at = None
    item.last_test_ok = None
    item.note = "Disconnected"
    item.updated_by_user_id = context.user_id
    await db.commit()
    return IntegrationConfigPayload(
        integration_key=integration_key,
        connected=False,
        config="",
        last_tested_at=None,
        last_test_ok=None,
        note="Disconnected",
    )


@router.post("/integrations/{integration_key}/test")
async def test_integration(
    integration_key: str,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    if integration_key not in SUPPORTED_INTEGRATIONS:
        raise HTTPException(status_code=400, detail="Unsupported integration")

    result = await db.execute(
        select(IntegrationConfig).where(
            IntegrationConfig.tenant_id == context.tenant_id,
            IntegrationConfig.integration_key == integration_key,
        )
    )
    item = result.scalar_one_or_none()
    if item is None or not item.connected or not item.config:
        raise HTTPException(status_code=400, detail="Integration is not connected.")

    ok = False
    note = "Test failed."
    now = datetime.now(timezone.utc)

    try:
        mode = SUPPORTED_INTEGRATIONS[integration_key]
        config_value = (item.config or "").strip()

        if mode == "sheet":
            ok = ("docs.google.com/spreadsheets" in config_value) or (len(config_value) >= 12)
            note = "Sheet reference format looks valid." if ok else "Sheet reference looks invalid."
        elif mode == "token":
            ok = len(config_value) >= 6
            note = "Credential format looks valid." if ok else "Credential format looks too short."
        elif mode == "token_or_url":
            is_url = config_value.startswith("http://") or config_value.startswith("https://")
            if is_url:
                payload = json.dumps(
                    {
                        "event": "integration_test",
                        "source": "smartsheet",
                        "integration": integration_key,
                        "timestamp": now.isoformat(),
                    }
                ).encode("utf-8")
                req = urllib_request.Request(
                    config_value,
                    data=payload,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib_request.urlopen(req, timeout=8) as response:
                    ok = 200 <= int(response.status) < 300
                    note = "Endpoint test payload delivered." if ok else f"Endpoint responded with {response.status}."
            else:
                ok = len(config_value) >= 8
                note = "Credential format looks valid." if ok else "Credential format looks too short."
        else:
            if not (config_value.startswith("http://") or config_value.startswith("https://")):
                raise ValueError("URL must start with http:// or https://")
            payload = json.dumps(
                {
                    "event": "integration_test",
                    "source": "smartsheet",
                    "integration": integration_key,
                    "timestamp": now.isoformat(),
                }
            ).encode("utf-8")
            req = urllib_request.Request(
                config_value,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib_request.urlopen(req, timeout=8) as response:
                ok = 200 <= int(response.status) < 300
                note = "Test payload delivered." if ok else f"Endpoint responded with {response.status}."
    except Exception as exc:
        ok = False
        note = f"Test failed: {str(exc)}"

    item.last_tested_at = now
    item.last_test_ok = ok
    item.note = note
    item.updated_by_user_id = context.user_id
    await db.commit()
    return {"ok": ok, "detail": note}
