from datetime import datetime, timedelta, timezone
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import RequestContext, get_request_context
from app.database import get_db
from app.models import Dataset, Report, ReportApproval, ReportComment, ReportShare
from app.schemas import (
    ReportApprovalResponse,
    ReportApprovalUpsert,
    ReportCommentCreate,
    ReportCommentResponse,
    ReportCreate,
    ReportResponse,
    ReportShareCreate,
    ReportShareResponse,
)
from app.services.events_service import track_event
from app.services.plan_service import enforce_report_limit

router = APIRouter(prefix="/reports", tags=["Reports"])


def _to_report_response(report: Report) -> ReportResponse:
    return ReportResponse(
        id=report.id,
        tenant_id=report.tenant_id,
        user_id=report.user_id,
        name=report.name,
        type=report.report_type,
        dataset_id=report.dataset_id,
        summary=report.summary,
        key_insights=report.key_insights or [],
        recommendations=report.recommendations or [],
        risks=report.risks or [],
        drivers=report.drivers or [],
        kpis=report.kpis or {},
        content_markdown=report.content_markdown,
        status=report.status,
        size_kb=report.size_kb,
        created_at=report.created_at,
    )


@router.get("/", response_model=list[ReportResponse])
async def list_reports(
    limit: int = Query(default=100, ge=1, le=500),
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Report)
        .where(Report.tenant_id == context.tenant_id)
        .order_by(Report.created_at.desc())
        .limit(limit)
    )
    reports = result.scalars().all()
    return [_to_report_response(report) for report in reports]


@router.post("/", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    payload: ReportCreate,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    await enforce_report_limit(db, tenant_id=context.tenant_id, user_id=context.user_id)

    dataset_result = await db.execute(
        select(Dataset.id).where(
            Dataset.id == payload.dataset_id,
            Dataset.tenant_id == context.tenant_id,
        )
    )
    if dataset_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    report = Report(
        tenant_id=context.tenant_id,
        user_id=context.user_id,
        dataset_id=payload.dataset_id,
        name=payload.name,
        report_type=payload.type,
        status=payload.status,
        size_kb=payload.size_kb,
        summary=payload.summary,
        key_insights=payload.key_insights,
        recommendations=payload.recommendations,
        risks=payload.risks,
        drivers=payload.drivers,
        kpis=payload.kpis,
        content_markdown=payload.content_markdown,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    await track_event(
        db,
        context=context,
        event_name="report_created",
        payload={"report_id": report.id, "dataset_id": report.dataset_id},
    )
    await db.commit()
    return _to_report_response(report)


@router.delete("/{report_id}")
async def delete_report(
    report_id: int,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if report is None or report.tenant_id != context.tenant_id:
        raise HTTPException(status_code=404, detail="Report not found")

    await db.delete(report)
    await db.commit()
    return {"message": "Report deleted successfully"}


@router.post("/{report_id}/share", response_model=ReportShareResponse)
async def create_report_share(
    report_id: int,
    payload: ReportShareCreate,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if report is None or report.tenant_id != context.tenant_id:
        raise HTTPException(status_code=404, detail="Report not found")

    expires_at = None
    if payload.expires_in_hours is not None:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=payload.expires_in_hours)

    share = ReportShare(
        tenant_id=context.tenant_id,
        report_id=report.id,
        created_by_user_id=context.user_id,
        token=secrets.token_urlsafe(24),
        expires_at=expires_at,
    )
    db.add(share)
    await db.commit()
    await db.refresh(share)

    return ReportShareResponse(
        id=share.id,
        report_id=share.report_id,
        token=share.token,
        share_url=f"/reports?share={share.token}",
        expires_at=share.expires_at,
        created_at=share.created_at,
    )


@router.get("/public/{token}", response_model=ReportResponse)
async def get_public_report(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    share_result = await db.execute(
        select(ReportShare).where(ReportShare.token == token).limit(1)
    )
    share = share_result.scalar_one_or_none()
    if share is None:
        raise HTTPException(status_code=404, detail="Share link not found")
    expires_at = share.expires_at
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Share link has expired")

    report = await db.get(Report, share.report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return _to_report_response(report)


@router.get("/{report_id}/comments", response_model=list[ReportCommentResponse])
async def list_report_comments(
    report_id: int,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if report is None or report.tenant_id != context.tenant_id:
        raise HTTPException(status_code=404, detail="Report not found")

    result = await db.execute(
        select(ReportComment)
        .where(
            ReportComment.tenant_id == context.tenant_id,
            ReportComment.report_id == report_id,
        )
        .order_by(ReportComment.created_at.asc())
    )
    comments = result.scalars().all()
    return [
        ReportCommentResponse(
            id=item.id,
            report_id=item.report_id,
            user_id=item.user_id,
            body=item.body,
            created_at=item.created_at,
        )
        for item in comments
    ]


@router.post("/{report_id}/comments", response_model=ReportCommentResponse, status_code=status.HTTP_201_CREATED)
async def create_report_comment(
    report_id: int,
    payload: ReportCommentCreate,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if report is None or report.tenant_id != context.tenant_id:
        raise HTTPException(status_code=404, detail="Report not found")

    comment = ReportComment(
        tenant_id=context.tenant_id,
        report_id=report_id,
        user_id=context.user_id,
        body=payload.body.strip(),
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return ReportCommentResponse(
        id=comment.id,
        report_id=comment.report_id,
        user_id=comment.user_id,
        body=comment.body,
        created_at=comment.created_at,
    )


@router.get("/{report_id}/approvals", response_model=list[ReportApprovalResponse])
async def list_report_approvals(
    report_id: int,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if report is None or report.tenant_id != context.tenant_id:
        raise HTTPException(status_code=404, detail="Report not found")

    result = await db.execute(
        select(ReportApproval).where(
            ReportApproval.tenant_id == context.tenant_id,
            ReportApproval.report_id == report_id,
        )
    )
    approvals = result.scalars().all()
    return [
        ReportApprovalResponse(
            id=item.id,
            report_id=item.report_id,
            user_id=item.user_id,
            status=item.status,
            note=item.note,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in approvals
    ]


@router.put("/{report_id}/approval", response_model=ReportApprovalResponse)
async def upsert_report_approval(
    report_id: int,
    payload: ReportApprovalUpsert,
    context: RequestContext = Depends(get_request_context),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if report is None or report.tenant_id != context.tenant_id:
        raise HTTPException(status_code=404, detail="Report not found")

    result = await db.execute(
        select(ReportApproval).where(
            ReportApproval.tenant_id == context.tenant_id,
            ReportApproval.report_id == report_id,
            ReportApproval.user_id == context.user_id,
        )
    )
    approval = result.scalar_one_or_none()
    if approval is None:
        approval = ReportApproval(
            tenant_id=context.tenant_id,
            report_id=report_id,
            user_id=context.user_id,
        )
        db.add(approval)

    approval.status = payload.status
    approval.note = payload.note
    await db.commit()
    await db.refresh(approval)
    return ReportApprovalResponse(
        id=approval.id,
        report_id=approval.report_id,
        user_id=approval.user_id,
        status=approval.status,
        note=approval.note,
        created_at=approval.created_at,
        updated_at=approval.updated_at,
    )
