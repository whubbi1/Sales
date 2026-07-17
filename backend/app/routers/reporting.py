# backend/app/routers/reporting.py
import json
import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import ValidationError
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.reporting import SavedReport, SavedDashboard
from app.schemas.schemas import (
    ReportSpec, SavedReportCreate, SavedReportUpdate, SavedReportResponse,
    SavedDashboardCreate, SavedDashboardUpdate, SavedDashboardResponse,
    AIReportDraftRequest,
)
from app.services.reporting_registry import registry_for_frontend
from app.services.reporting_query import run_report_query, ReportSpecError

router = APIRouter()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")


def _visible_to(rows: list, user_email: str):
    return [r for r in rows if r.owner_email == user_email or user_email in (r.shared_with or []) or '*' in (r.shared_with or [])]


@router.get("/schema")
async def get_schema():
    return {"entities": registry_for_frontend()}


@router.post("/run")
async def run_report(spec: ReportSpec, db: AsyncSession = Depends(get_db)):
    try:
        rows = await run_report_query(db, spec.model_dump())
    except ReportSpecError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"rows": rows}


# ─── Saved Reports ──────────────────────────────────────────────────────────────
@router.get("/reports", response_model=List[SavedReportResponse])
async def list_reports(user_email: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SavedReport).order_by(SavedReport.updated_at.desc()))
    return _visible_to(r.scalars().all(), user_email)

@router.post("/reports", response_model=SavedReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(data: SavedReportCreate, db: AsyncSession = Depends(get_db)):
    row = SavedReport(name=data.name, owner_email=data.owner_email, spec=data.spec.model_dump(), chart_type=data.chart_type, shared_with=data.shared_with)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.get("/reports/{report_id}", response_model=SavedReportResponse)
async def get_report(report_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SavedReport).where(SavedReport.id == report_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    return row

@router.put("/reports/{report_id}", response_model=SavedReportResponse)
async def update_report(report_id: UUID, data: SavedReportUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SavedReport).where(SavedReport.id == report_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    update_data = data.model_dump(exclude_unset=True)
    if update_data.get('spec') is not None:
        update_data['spec'] = data.spec.model_dump()
    for k, v in update_data.items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(report_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SavedReport).where(SavedReport.id == report_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    await db.delete(row)
    await db.commit()

@router.post("/reports/{report_id}/run")
async def run_saved_report(report_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SavedReport).where(SavedReport.id == report_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    try:
        rows = await run_report_query(db, row.spec)
    except ReportSpecError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"rows": rows}


# ─── Saved Dashboards ───────────────────────────────────────────────────────────
@router.get("/dashboards", response_model=List[SavedDashboardResponse])
async def list_dashboards(user_email: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SavedDashboard).order_by(SavedDashboard.updated_at.desc()))
    return _visible_to(r.scalars().all(), user_email)

@router.post("/dashboards", response_model=SavedDashboardResponse, status_code=status.HTTP_201_CREATED)
async def create_dashboard(data: SavedDashboardCreate, db: AsyncSession = Depends(get_db)):
    row = SavedDashboard(name=data.name, owner_email=data.owner_email, report_ids=[str(i) for i in (data.report_ids or [])], shared_with=data.shared_with)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.get("/dashboards/{dashboard_id}", response_model=SavedDashboardResponse)
async def get_dashboard(dashboard_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SavedDashboard).where(SavedDashboard.id == dashboard_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return row

@router.put("/dashboards/{dashboard_id}", response_model=SavedDashboardResponse)
async def update_dashboard(dashboard_id: UUID, data: SavedDashboardUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SavedDashboard).where(SavedDashboard.id == dashboard_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    update_data = data.model_dump(exclude_unset=True)
    if update_data.get('report_ids') is not None:
        update_data['report_ids'] = [str(i) for i in update_data['report_ids']]
    for k, v in update_data.items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/dashboards/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard(dashboard_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SavedDashboard).where(SavedDashboard.id == dashboard_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    await db.delete(row)
    await db.commit()


# ─── Claude AI-assisted drafting ────────────────────────────────────────────────
# The model only ever sees the whitelisted schema below, and its output is re-validated
# against that exact same whitelist (via ReportSpec + run_report_query) before it's handed
# back to the frontend — nothing it produces is trusted or executed directly.
@router.post("/ai-draft")
async def ai_draft_report(data: AIReportDraftRequest, db: AsyncSession = Depends(get_db)):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    schema_desc = json.dumps(registry_for_frontend())
    system_prompt = (
        "You turn a plain-language reporting request into a JSON report specification for the "
        "WHUBBI CRM. You may ONLY use entity and column keys from the schema below — never invent "
        "one. Respond with ONLY a JSON object (no prose, no markdown fences) matching exactly this shape:\n"
        '{"entity": "<entity key>", "columns": ["<column key>", ...], '
        '"filters": [{"column": "<column key>", "operator": "= | != | > | < | >= | <= | contains | in | is_null | is_not_null", "value": <any>}], '
        '"group_by": ["<column key>", ...], "aggregates": [{"column": "<column key>", "function": "count | sum | avg | min | max"}], '
        '"sort": {"column": "<column key>", "dir": "asc | desc"}, "chart_type": "table | bar | line | pie"}\n'
        "Use empty arrays / omit filters, group_by, aggregates, sort if the request doesn't need them. "
        "Prefer chart_type \"table\" unless the request clearly wants a trend (line), comparison (bar), or breakdown (pie).\n\n"
        f"Available schema:\n{schema_desc}"
    )

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={
                "model": "claude-sonnet-4-6", "max_tokens": 1200,
                "system": system_prompt,
                "messages": [{"role": "user", "content": data.prompt}],
            },
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Claude API error {resp.status_code}: {resp.text[:300]}")

    text_content = "".join(b["text"] for b in resp.json().get("content", []) if b.get("type") == "text").strip()
    if text_content.startswith("```"):
        text_content = text_content.split("```")[1]
        if text_content.startswith("json"):
            text_content = text_content[4:]
        text_content = text_content.strip()

    try:
        spec = json.loads(text_content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Claude did not return valid JSON")

    try:
        validated = ReportSpec(**spec)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=f"Claude produced a malformed report spec: {e}")

    try:
        await run_report_query(db, validated.model_dump())
    except ReportSpecError as e:
        raise HTTPException(status_code=400, detail=f"Claude produced an invalid report spec: {e}")

    return {"spec": validated.model_dump()}
