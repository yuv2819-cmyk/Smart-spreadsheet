from __future__ import annotations

import asyncio
import re
from datetime import datetime, timedelta, timezone
from io import StringIO
from typing import Any

import pandas as pd
from sqlalchemy import create_engine, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import ConnectorSyncRun, DataConnector, DataRow, Dataset
from app.services.cleaning_service import dataframe_to_json_records

GOOGLE_SHEET_ID_PATTERN = re.compile(r"/spreadsheets/d/([a-zA-Z0-9-_]+)")


def _google_csv_url(raw_url: str) -> str:
    url = (raw_url or "").strip()
    if "output=csv" in url:
        return url

    match = GOOGLE_SHEET_ID_PATTERN.search(url)
    if not match:
        raise ValueError("Invalid Google Sheets URL or ID.")
    sheet_id = match.group(1)
    gid_match = re.search(r"[?&]gid=([0-9]+)", url)
    gid = gid_match.group(1) if gid_match else "0"
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"


def _load_google_sheets_dataframe(config: dict[str, Any]) -> pd.DataFrame:
    url = str(config.get("url") or "")
    csv_url = _google_csv_url(url)
    return pd.read_csv(csv_url)


def _load_postgresql_dataframe(config: dict[str, Any]) -> pd.DataFrame:
    connection_url = str(config.get("connection_url") or "").strip()
    if not connection_url:
        raise ValueError("PostgreSQL connector requires 'connection_url'.")
    query = str(config.get("query") or "").strip() or "SELECT 1 as value"
    engine = create_engine(connection_url)
    try:
        return pd.read_sql(query, engine)
    finally:
        engine.dispose()


def load_connector_dataframe(connector_type: str, config: dict[str, Any]) -> pd.DataFrame:
    if connector_type == "google_sheets":
        return _load_google_sheets_dataframe(config)
    if connector_type == "postgresql":
        return _load_postgresql_dataframe(config)
    raise ValueError(f"Unsupported connector type: {connector_type}")


async def sync_connector(
    db: AsyncSession,
    *,
    connector: DataConnector,
) -> ConnectorSyncRun:
    run = ConnectorSyncRun(
        connector_id=connector.id,
        tenant_id=connector.tenant_id,
        user_id=connector.user_id,
        status="running",
    )
    db.add(run)
    await db.flush()

    try:
        df = load_connector_dataframe(connector.connector_type, connector.config or {})
        if df.empty:
            raise ValueError("Connector returned no rows.")

        schema_info = {str(col): str(df[col].dtype) for col in df.columns}
        dataset_name = (connector.target_dataset_name or "").strip() or connector.name
        dataset = Dataset(
            tenant_id=connector.tenant_id,
            user_id=connector.user_id,
            name=dataset_name,
            description=f"Synced from connector #{connector.id}",
            source_type=connector.connector_type,
            schema_info=schema_info,
            row_count=int(len(df)),
        )
        db.add(dataset)
        await db.flush()

        records = dataframe_to_json_records(df)
        rows_to_insert = [
            {
                "tenant_id": connector.tenant_id,
                "dataset_id": dataset.id,
                "row_data": row,
            }
            for row in records
        ]
        if rows_to_insert:
            await db.execute(insert(DataRow), rows_to_insert)

        now = datetime.now(timezone.utc)
        run.status = "success"
        run.rows_synced = int(len(df))
        run.dataset_id = dataset.id
        run.finished_at = now

        connector.last_synced_at = now
        connector.last_sync_status = "success"
        connector.last_sync_error = None
        await db.commit()
        await db.refresh(run)
        return run
    except Exception as exc:
        now = datetime.now(timezone.utc)
        run.status = "failed"
        run.error_message = str(exc)
        run.finished_at = now

        connector.last_synced_at = now
        connector.last_sync_status = "failed"
        connector.last_sync_error = str(exc)
        await db.commit()
        await db.refresh(run)
        return run


async def test_connector(connector_type: str, config: dict[str, Any]) -> tuple[bool, str, int]:
    try:
        df = await asyncio.to_thread(load_connector_dataframe, connector_type, config)
        if df.empty:
            return False, "Connector test succeeded but returned 0 rows.", 0
        return True, f"Connector test succeeded ({len(df)} rows).", int(len(df))
    except Exception as exc:
        return False, f"Connector test failed: {str(exc)}", 0


async def run_due_connector_syncs() -> None:
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(DataConnector).where(DataConnector.enabled.is_(True))
        )
        connectors = result.scalars().all()
        for connector in connectors:
            interval = max(5, int(connector.sync_interval_minutes or 60))
            due_at = connector.last_synced_at or (now - timedelta(minutes=interval + 1))
            if (now - due_at) < timedelta(minutes=interval):
                continue
            await sync_connector(db, connector=connector)
