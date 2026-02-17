import json
import time

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import RequestContext, get_request_context
from app.config import get_settings
from app.database import get_db
from app.models import AIQuery, DataRow, Dataset
from app.rate_limit import rate_limit
from app.schemas import AIQueryRequest, AIQueryResponse, AISummaryRequest, AISummaryResponse
from app.services.analytics_service import build_analyst_insights

router = APIRouter(prefix="/ai", tags=["AI Assistant"])
settings = get_settings()

_openai_api_key = settings.openai_api_key
_model_name = settings.openai_model

PLACEHOLDER_OPENAI_KEYS = {
    "",
    "your-openai-api-key-here",
    "your_openai_api_key_here",
}


def _is_placeholder_api_key(value: str | None) -> bool:
    if not value:
        return True
    return value.strip().lower() in PLACEHOLDER_OPENAI_KEYS


client = None if _is_placeholder_api_key(_openai_api_key) else OpenAI(api_key=_openai_api_key)


def _build_fallback_response(
    prompt: str,
    sample_data: list[dict],
    reason: str,
    analyst_insights: dict | None = None,
) -> tuple[str, dict]:
    insight_summary = (analyst_insights or {}).get("executive_summary", "Automated summary unavailable.")
    recommendations = (analyst_insights or {}).get("recommendations", [])
    rendered_recommendations = "\n".join(f"- {item}" for item in recommendations[:4])
    if not rendered_recommendations:
        rendered_recommendations = "- Upload more complete data for deeper analysis."

    generated_code = (
        f"Analyst response for: {prompt}\n\n"
        f"Executive summary:\n{insight_summary}\n\n"
        f"Recommended actions:\n{rendered_recommendations}"
    )
    result_data = {
        "generated": False,
        "message": "OpenAI is unavailable right now. Returning fallback analysis output.",
        "reason": reason,
        "sample_data": sample_data[:3],
        "analyst_insights": analyst_insights,
    }
    return generated_code, result_data


@router.post("/query", response_model=AIQueryResponse)
async def generate_ai_query(
    request: AIQueryRequest,
    _: None = Depends(rate_limit(key_prefix="ai-query", limit=30, window_seconds=60)),
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    """Generate and execute AI-powered data analysis."""
    start_time = time.time()

    result = await db.execute(
        select(Dataset).where(
            Dataset.id == request.dataset_id,
            Dataset.tenant_id == context.tenant_id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    sample_result = await db.execute(
        select(DataRow)
        .where(
            DataRow.tenant_id == context.tenant_id,
            DataRow.dataset_id == request.dataset_id,
        )
        .limit(10)
    )
    sample_data = [row.row_data for row in sample_result.scalars().all()]

    analysis_result = await db.execute(
        select(DataRow)
        .where(
            DataRow.tenant_id == context.tenant_id,
            DataRow.dataset_id == request.dataset_id,
        )
        .limit(2500)
    )
    analysis_rows = [row.row_data for row in analysis_result.scalars().all()]
    analysis_df = pd.DataFrame(analysis_rows)
    analyst_insights = build_analyst_insights(analysis_df)

    if client is None:
        generated_code, result_data = _build_fallback_response(
            request.prompt,
            sample_data,
            "missing_or_placeholder_api_key",
            analyst_insights=analyst_insights,
        )
    else:
        try:
            llm_context = {
                "row_count": dataset.row_count,
                "schema": dataset.schema_info,
                "analyst_summary": analyst_insights.get("executive_summary"),
                "data_quality": analyst_insights.get("data_quality"),
                "top_correlations": analyst_insights.get("top_correlations", [])[:3],
                "trend": analyst_insights.get("trend"),
                "kpis": analyst_insights.get("kpis"),
                "sample_rows": sample_data[:5],
            }
            response = client.chat.completions.create(
                model=_model_name,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a senior data analyst. Use only the provided dataset context, "
                            "do not invent numbers, and provide practical business recommendations."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Dataset analysis context:\n{json.dumps(llm_context, indent=2, default=str)}\n\n"
                            f"Question: {request.prompt}\n\n"
                            "Respond in Markdown with these sections:\n"
                            "1) Direct Answer\n"
                            "2) Evidence from Data\n"
                            "3) Risks or Caveats\n"
                            "4) Recommended Next Actions"
                        ),
                    },
                ],
                temperature=0.2,
                max_tokens=700,
            )
            generated_code = response.choices[0].message.content or "No response returned from model."
            result_data = {"generated": True, "analyst_insights": analyst_insights}
        except Exception as exc:
            generated_code, result_data = _build_fallback_response(
                request.prompt,
                sample_data,
                f"openai_error: {str(exc)}",
                analyst_insights=analyst_insights,
            )

    execution_time = int((time.time() - start_time) * 1000)

    ai_query = AIQuery(
        tenant_id=context.tenant_id,
        user_id=context.user_id,
        dataset_id=request.dataset_id,
        prompt=request.prompt,
        generated_code=generated_code,
        result_data=result_data,
        execution_time_ms=execution_time,
    )
    db.add(ai_query)
    await db.commit()
    await db.refresh(ai_query)

    return AIQueryResponse(
        id=ai_query.id,
        prompt=ai_query.prompt,
        generated_code=ai_query.generated_code,
        result_data=ai_query.result_data,
        execution_time_ms=ai_query.execution_time_ms,
    )


@router.get("/queries")
async def list_queries(
    limit: int = Query(default=10, ge=1, le=100),
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    """List recent AI queries."""
    result = await db.execute(
        select(AIQuery)
        .where(AIQuery.tenant_id == context.tenant_id)
        .order_by(AIQuery.created_at.desc())
        .limit(limit)
    )
    queries = result.scalars().all()
    return {
        "queries": [
            {
                "id": query.id,
                "dataset_id": query.dataset_id,
                "prompt": query.prompt,
                "generated_code": query.generated_code,
                "result_data": query.result_data,
                "execution_time_ms": query.execution_time_ms,
                "created_at": query.created_at,
            }
            for query in queries
        ]
    }


@router.post("/summarize", response_model=AISummaryResponse)
async def summarize_dataset(
    request: AISummaryRequest,
    _: None = Depends(rate_limit(key_prefix="ai-summarize", limit=20, window_seconds=60)),
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    """Generate a summary of the dataset."""
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == request.dataset_id,
            Dataset.tenant_id == context.tenant_id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    data_result = await db.execute(
        select(DataRow)
        .where(
            DataRow.tenant_id == context.tenant_id,
            DataRow.dataset_id == request.dataset_id,
        )
        .limit(2500)
    )
    rows = data_result.scalars().all()
    if not rows:
        return AISummaryResponse(
            summary="This dataset is empty. Upload data to get a summary.",
            key_insights=[],
        )

    row_data = [r.row_data for r in rows]
    df = pd.DataFrame(row_data)

    analyst_insights = build_analyst_insights(df)
    numeric_stats: dict[str, dict[str, float]] = {
        profile["column"]: {
            "min": float(profile.get("min", 0.0)),
            "max": float(profile.get("max", 0.0)),
            "avg": float(profile.get("mean", 0.0)),
        }
        for profile in analyst_insights.get("numeric_profiles", [])
    }

    from app.services.ai_service import ai_service

    ai_response = ai_service.summarize_dataset(
        row_count=dataset.row_count,
        columns=list(dataset.schema_info.keys()) if dataset.schema_info else df.columns.tolist(),
        sample_data=row_data,
        numeric_stats=numeric_stats,
    )

    key_insights = ai_response.get("key_insights", [])
    for recommendation in analyst_insights.get("recommendations", [])[:3]:
        if recommendation not in key_insights:
            key_insights.append(recommendation)

    summary = ai_response.get("summary") or analyst_insights.get("executive_summary", "Summary unavailable.")

    return AISummaryResponse(summary=summary, key_insights=key_insights[:6])


@router.get("/recommended-questions/{dataset_id}")
async def recommended_questions(
    dataset_id: int,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    """Return analyst-grade starter questions tailored to the dataset."""
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.tenant_id == context.tenant_id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    rows_result = await db.execute(
        select(DataRow)
        .where(
            DataRow.tenant_id == context.tenant_id,
            DataRow.dataset_id == dataset_id,
        )
        .limit(2500)
    )
    rows = [row.row_data for row in rows_result.scalars().all()]
    if not rows:
        return {"dataset_id": dataset_id, "questions": []}

    insights = build_analyst_insights(pd.DataFrame(rows))
    questions = [
        "Which metric should leadership monitor weekly and why?",
        "Where are the biggest risks in data quality and how do they affect decisions?",
        "What are the top 3 drivers of the primary business metric?",
    ]

    trend = insights.get("trend")
    if trend and trend.get("metric_column"):
        questions.append(
            f"What is driving month-over-month movement in '{trend['metric_column']}'?"
        )

    correlations = insights.get("top_correlations", [])
    if correlations:
        strongest = correlations[0]
        questions.append(
            f"Why are '{strongest['column_x']}' and '{strongest['column_y']}' strongly linked?"
        )

    segments = insights.get("segments", [])
    if segments:
        first_segment = segments[0]
        questions.append(
            f"How can we improve performance in low-performing '{first_segment['segment_column']}' segments?"
        )

    business_summary = insights.get("business_summary", {})
    if business_summary.get("profit_available"):
        questions.append("Which segments are driving losses, and what actions can recover margin fastest?")

    return {"dataset_id": dataset_id, "questions": questions[:8]}
