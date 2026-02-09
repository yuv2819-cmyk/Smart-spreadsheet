from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import AIQuery, Dataset, DataRow
from app.schemas import AIQueryRequest, AIQueryResponse, AISummaryRequest, AISummaryResponse
import pandas as pd
import openai
import os
import time
import json

router = APIRouter(prefix="/ai", tags=["AI Assistant"])

openai.api_key = os.getenv("OPENAI_API_KEY")

@router.post("/query", response_model=AIQueryResponse)
async def generate_ai_query(
    request: AIQueryRequest,
    db: AsyncSession = Depends(get_db)
):
    """Generate and execute AI-powered data analysis"""
    start_time = time.time()
    
    # Get dataset info
    result = await db.execute(
        select(Dataset).where(Dataset.id == request.dataset_id, Dataset.tenant_id == 1)
    )
    dataset = result.scalar_one_or_none()
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Get sample data
    data_result = await db.execute(
        select(DataRow)
        .where(DataRow.dataset_id == request.dataset_id)
        .limit(5)
    )
    sample_rows = data_result.scalars().all()
    sample_data = [row.row_data for row in sample_rows]
    
    # Generate code using OpenAI (simplified for MVP)
    try:
        # For MVP, return a mock response if no API key
        if not openai.api_key or openai.api_key == "your_openai_api_key_here":
            generated_code = f"""
# AI-Generated Analysis for: {request.prompt}
import pandas as pd

# Sample code based on your prompt
df = pd.DataFrame({json.dumps(sample_data)})
result = df.describe().to_dict()
"""
            result_data = {
                "message": "This is a mock response. Add your OpenAI API key to get real AI-generated code.",
                "sample_data": sample_data[:3]
            }
        else:
            # Real OpenAI call
            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a data analysis assistant. Generate Python pandas code to answer the user's question."},
                    {"role": "user", "content": f"Dataset schema: {dataset.schema_info}\nSample data: {sample_data[:3]}\n\nQuestion: {request.prompt}"}
                ]
            )
            generated_code = response.choices[0].message.content
            result_data = {"generated": True}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")
    
    execution_time = int((time.time() - start_time) * 1000)
    
    # Save query
    ai_query = AIQuery(
        tenant_id=1,
        user_id=1,
        dataset_id=request.dataset_id,
        prompt=request.prompt,
        generated_code=generated_code,
        result_data=result_data,
        execution_time_ms=execution_time
    )
    db.add(ai_query)
    await db.commit()
    await db.refresh(ai_query)
    
    return AIQueryResponse(
        id=ai_query.id,
        prompt=ai_query.prompt,
        generated_code=ai_query.generated_code,
        result_data=ai_query.result_data,
        execution_time_ms=ai_query.execution_time_ms
    )

@router.get("/queries")
async def list_queries(
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """List recent AI queries"""
    result = await db.execute(
        select(AIQuery)
        .where(AIQuery.tenant_id == 1)
        .order_by(AIQuery.created_at.desc())
        .limit(limit)
    )
    queries = result.scalars().all()
    return {"queries": queries}

@router.post("/summarize", response_model=AISummaryResponse)
async def summarize_dataset(
    request: AISummaryRequest,
    db: AsyncSession = Depends(get_db)
):
    """Generate a summary of the dataset"""
    # 1. Fetch dataset
    result = await db.execute(
        select(Dataset).where(Dataset.id == request.dataset_id, Dataset.tenant_id == 1)
    )
    dataset = result.scalar_one_or_none()
    
    if not dataset:
         raise HTTPException(status_code=404, detail="Dataset not found")

    # 2. Fetch sample data (up to 20 rows for summary context)
    data_result = await db.execute(
        select(DataRow)
        .where(DataRow.dataset_id == request.dataset_id)
        .limit(20)
    )
    rows = data_result.scalars().all()
    
    if not rows:
        return AISummaryResponse(
            summary="This dataset is empty. Upload data to get a summary.",
            key_insights=[]
        )

    # 3. Prepare data for summary configuration
    row_data = [r.row_data for r in rows]
    df = pd.DataFrame(row_data)
    
    # Calculate basic numeric stats for the service
    numeric_stats = {}
    try:
        numeric_cols = df.select_dtypes(include=['number']).columns
        for col in numeric_cols:
            numeric_stats[col] = {
                "min": float(df[col].min()),
                "max": float(df[col].max()),
                "avg": float(df[col].mean())
            }
    except Exception:
        # Graceful fallback if stat calc fails on sample data
        pass

    # 4. Call AI Service
    from app.services.ai_service import ai_service
    
    ai_response = ai_service.summarize_dataset(
        row_count=dataset.row_count,
        columns=list(dataset.schema_info.keys()) if dataset.schema_info else df.columns.tolist(),
        sample_data=row_data, # Service will limit this
        numeric_stats=numeric_stats
    )

    return AISummaryResponse(
        summary=ai_response["summary"],
        key_insights=ai_response["key_insights"]
    )
