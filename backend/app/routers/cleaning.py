from __future__ import annotations

from datetime import datetime

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import RequestContext, get_request_context
from app.database import get_db
from app.models import CleaningTransformation, DataRow, Dataset
from app.schemas import (
    CleaningApplyRequest,
    CleaningApplyResponse,
    CleaningDiffRequest,
    CleaningDiffResponse,
    CleaningPreviewRequest,
    CleaningPreviewResponse,
    CleaningProfileResponse,
    CleaningTransformationResponse,
)
from app.services.cleaning_service import (
    apply_cleaning_rules,
    build_row_level_diff,
    build_cleaning_profile,
    dataframe_to_json_records,
)
from app.services.events_service import track_event

router = APIRouter(prefix="/cleaning", tags=["Data Cleaning"])


async def _load_dataset_df(
    *,
    dataset_id: int,
    context: RequestContext,
    db: AsyncSession,
) -> tuple[Dataset, pd.DataFrame]:
    dataset_result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.tenant_id == context.tenant_id,
        )
    )
    dataset = dataset_result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    rows_result = await db.execute(
        select(DataRow)
        .where(
            DataRow.tenant_id == context.tenant_id,
            DataRow.dataset_id == dataset_id,
        )
        .order_by(DataRow.id.asc())
    )
    rows = [row.row_data for row in rows_result.scalars().all()]
    if not rows:
        if dataset.schema_info:
            return dataset, pd.DataFrame(columns=list(dataset.schema_info.keys()))
        return dataset, pd.DataFrame()

    return dataset, pd.DataFrame(rows)


async def _create_dataset_from_dataframe(
    *,
    dataset_name: str,
    dataset_description: str,
    source_type: str,
    df: pd.DataFrame,
    context: RequestContext,
    db: AsyncSession,
) -> Dataset:
    schema_info = {str(col): str(df[col].dtype) for col in df.columns}
    new_dataset = Dataset(
        tenant_id=context.tenant_id,
        user_id=context.user_id,
        name=dataset_name,
        description=dataset_description,
        source_type=source_type,
        schema_info=schema_info,
        row_count=int(len(df)),
    )
    db.add(new_dataset)
    await db.flush()

    records = dataframe_to_json_records(df)
    if records:
        rows_to_insert = [
            {
                "tenant_id": context.tenant_id,
                "dataset_id": new_dataset.id,
                "row_data": row,
            }
            for row in records
        ]
        await db.execute(insert(DataRow), rows_to_insert)

    return new_dataset


@router.get("/profile/{dataset_id}", response_model=CleaningProfileResponse)
async def get_cleaning_profile(
    dataset_id: int,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    _, df = await _load_dataset_df(dataset_id=dataset_id, context=context, db=db)
    profile = build_cleaning_profile(df, dataset_id)
    return CleaningProfileResponse(**profile)


@router.post("/preview", response_model=CleaningPreviewResponse)
async def preview_cleaning(
    payload: CleaningPreviewRequest,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    _, df = await _load_dataset_df(dataset_id=payload.dataset_id, context=context, db=db)
    profile = build_cleaning_profile(df, payload.dataset_id)
    preview = apply_cleaning_rules(df, payload.rule_ids, profile["suggestions"])

    return CleaningPreviewResponse(
        dataset_id=payload.dataset_id,
        selected_rule_ids=preview["selected_rule_ids"],
        rows_before=preview["rows_before"],
        rows_after=preview["rows_after"],
        total_cells_changed=preview["total_cells_changed"],
        total_rows_removed=preview["total_rows_removed"],
        rule_impacts=preview["rule_impacts"],
        sample_diffs=preview["sample_diffs"],
    )


@router.post("/diff", response_model=CleaningDiffResponse)
async def cleaning_diff(
    payload: CleaningDiffRequest,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    _, df = await _load_dataset_df(dataset_id=payload.dataset_id, context=context, db=db)
    profile = build_cleaning_profile(df, payload.dataset_id)
    execution = apply_cleaning_rules(df, payload.rule_ids, profile["suggestions"], sample_limit=payload.limit)
    changes = build_row_level_diff(df, execution["dataframe"], limit=payload.limit)
    return CleaningDiffResponse(
        dataset_id=payload.dataset_id,
        selected_rule_ids=execution["selected_rule_ids"],
        changed_rows=len(changes),
        changes=changes,
    )


@router.post("/apply", response_model=CleaningApplyResponse, status_code=status.HTTP_201_CREATED)
async def apply_cleaning(
    payload: CleaningApplyRequest,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    source_dataset, df = await _load_dataset_df(dataset_id=payload.dataset_id, context=context, db=db)
    profile = build_cleaning_profile(df, payload.dataset_id)
    execution = apply_cleaning_rules(df, payload.rule_ids, profile["suggestions"])
    selected_rule_ids = execution["selected_rule_ids"]
    if not selected_rule_ids:
        raise HTTPException(status_code=400, detail="No valid cleaning rules were selected.")

    cleaned_df = execution["dataframe"]
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    output_name = (payload.output_name or "").strip() or f"{source_dataset.name} (Cleaned {timestamp})"
    output_dataset = await _create_dataset_from_dataframe(
        dataset_name=output_name,
        dataset_description=f"Cleaned from dataset #{source_dataset.id}",
        source_type=source_dataset.source_type,
        df=cleaned_df,
        context=context,
        db=db,
    )

    transformation = CleaningTransformation(
        tenant_id=context.tenant_id,
        user_id=context.user_id,
        source_dataset_id=source_dataset.id,
        output_dataset_id=output_dataset.id,
        rule_ids=selected_rule_ids,
        summary={
            "rows_before": execution["rows_before"],
            "rows_after": execution["rows_after"],
            "total_cells_changed": execution["total_cells_changed"],
            "total_rows_removed": execution["total_rows_removed"],
        },
    )
    db.add(transformation)
    await db.commit()
    await db.refresh(transformation)
    await track_event(
        db,
        context=context,
        event_name="cleaning_applied",
        payload={
            "transformation_id": transformation.id,
            "source_dataset_id": source_dataset.id,
            "output_dataset_id": output_dataset.id,
            "rule_ids": selected_rule_ids,
        },
    )
    await db.commit()

    return CleaningApplyResponse(
        transformation_id=transformation.id,
        source_dataset_id=source_dataset.id,
        output_dataset_id=output_dataset.id,
        rows_before=execution["rows_before"],
        rows_after=execution["rows_after"],
        message=f"Created cleaned dataset '{output_dataset.name}' ({execution['rows_after']} rows).",
    )


@router.get("/history", response_model=list[CleaningTransformationResponse])
async def list_cleaning_history(
    dataset_id: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(CleaningTransformation)
        .where(CleaningTransformation.tenant_id == context.tenant_id)
        .order_by(CleaningTransformation.created_at.desc())
        .limit(limit)
    )
    if dataset_id is not None:
        query = query.where(
            (CleaningTransformation.source_dataset_id == dataset_id)
            | (CleaningTransformation.output_dataset_id == dataset_id)
        )

    result = await db.execute(query)
    items = result.scalars().all()
    return [
        CleaningTransformationResponse(
            id=item.id,
            source_dataset_id=item.source_dataset_id,
            output_dataset_id=item.output_dataset_id,
            rule_ids=item.rule_ids or [],
            summary=item.summary or {},
            created_at=item.created_at,
        )
        for item in items
    ]


@router.post("/rollback/{transformation_id}", response_model=CleaningApplyResponse)
async def rollback_cleaning(
    transformation_id: int,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    transformation = await db.get(CleaningTransformation, transformation_id)
    if transformation is None or transformation.tenant_id != context.tenant_id:
        raise HTTPException(status_code=404, detail="Cleaning transformation not found")

    source_dataset, source_df = await _load_dataset_df(
        dataset_id=transformation.source_dataset_id,
        context=context,
        db=db,
    )

    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    rollback_dataset = await _create_dataset_from_dataframe(
        dataset_name=f"{source_dataset.name} (Rollback {timestamp})",
        dataset_description=f"Rollback from cleaning transformation #{transformation.id}",
        source_type=source_dataset.source_type,
        df=source_df,
        context=context,
        db=db,
    )

    rollback_transformation = CleaningTransformation(
        tenant_id=context.tenant_id,
        user_id=context.user_id,
        source_dataset_id=transformation.output_dataset_id,
        output_dataset_id=rollback_dataset.id,
        rule_ids=["rollback_to_source_snapshot"],
        summary={
            "rollback_from_transformation_id": transformation.id,
            "rows_before": int(len(source_df)),
            "rows_after": int(len(source_df)),
        },
    )
    db.add(rollback_transformation)
    await db.commit()
    await db.refresh(rollback_transformation)
    await track_event(
        db,
        context=context,
        event_name="cleaning_rollback",
        payload={
            "transformation_id": rollback_transformation.id,
            "rollback_from": transformation.id,
        },
    )
    await db.commit()

    return CleaningApplyResponse(
        transformation_id=rollback_transformation.id,
        source_dataset_id=transformation.output_dataset_id,
        output_dataset_id=rollback_dataset.id,
        rows_before=int(len(source_df)),
        rows_after=int(len(source_df)),
        message=f"Rollback dataset '{rollback_dataset.name}' created and set as latest dataset.",
    )
