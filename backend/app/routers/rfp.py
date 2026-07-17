# backend/app/routers/rfp.py
import uuid as uuid_module
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, delete
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from app.database import get_db
from app.services.ids import next_internal_id
from app.models.rfp import RFP, RFPActionItem, RFPDocumentChecklist, RFPStaffingTask, RFPStaffingAllocation, RFPStaffingRate, RFPStaffingRole, rfp_opportunity
from app.models.opportunity import Opportunity
from app.models.contact import Contact
from app.schemas.schemas import (
    RFPCreate, RFPUpdate, RFPResponse, RFPSummary,
    RFPActionItemCreate, RFPActionItemUpdate, RFPActionItemResponse,
    RFPDocumentChecklistCreate, RFPDocumentChecklistUpdate, RFPDocumentChecklistResponse,
    RFPStaffingTaskCreate, RFPStaffingTaskUpdate, RFPStaffingTaskResponse, RFPStaffingAllocationsSet,
    RFPStaffingRoleCreate, RFPStaffingRoleUpdate, RFPStaffingRoleResponse,
    RFPStaffingRateCreate, RFPStaffingRateResponse,
    PartnerSummary,
)
from app.routers.task_manager import create_task as tm_create_task

router = APIRouter()


async def _attach_partners(db: AsyncSession, objs: list):
    # Partner isn't an ORM relationship (raw-SQL entity) — same trick used for
    # Contact/Opportunity.partner throughout this codebase.
    ids = {str(o.partner_id) for o in objs if getattr(o, "partner_id", None)}
    partners = {}
    for pid in ids:
        r = await db.execute(text("SELECT id, internal_id, name, status FROM partners WHERE id = CAST(:id AS UUID)"), {"id": pid})
        row = r.fetchone()
        if row:
            partners[pid] = PartnerSummary(id=row.id, internal_id=row.internal_id, name=row.name, status=row.status)
    for o in objs:
        o.partner = partners.get(str(o.partner_id)) if getattr(o, "partner_id", None) else None


def _load_query():
    return select(RFP).options(selectinload(RFP.company), selectinload(RFP.opportunities))


@router.get("/", response_model=List[RFPResponse])
async def list_rfps(company_id: str = None, status_filter: str = None, db: AsyncSession = Depends(get_db)):
    query = _load_query()
    if company_id:
        query = query.where(RFP.company_id == company_id)
    if status_filter:
        query = query.where(RFP.status == status_filter)
    query = query.order_by(RFP.created_at.desc())
    result = await db.execute(query)
    rfps = result.scalars().all()
    await _attach_partners(db, rfps)
    return rfps


@router.post("/", response_model=RFPResponse, status_code=status.HTTP_201_CREATED)
async def create_rfp(data: RFPCreate, db: AsyncSession = Depends(get_db)):
    opportunity_ids = data.opportunity_ids or []
    payload = data.model_dump(exclude={'opportunity_ids'})
    payload['approvers'] = [a.model_dump() if hasattr(a, 'model_dump') else a for a in (payload.get('approvers') or [])]
    payload['reference'] = await next_internal_id(db, 'rfp_reference_seq', 'RFP')
    rfp = RFP(**payload)
    if opportunity_ids:
        r = await db.execute(select(Opportunity).where(Opportunity.id.in_(opportunity_ids)))
        rfp.opportunities = r.scalars().all()
    db.add(rfp)
    await db.commit()
    r = await db.execute(_load_query().where(RFP.id == rfp.id))
    row = r.scalar_one()
    await _attach_partners(db, [row])
    return row


@router.get("/{rfp_id}", response_model=RFPResponse)
async def get_rfp(rfp_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(_load_query().where(RFP.id == rfp_id))
    rfp = r.scalar_one_or_none()
    if not rfp:
        raise HTTPException(status_code=404, detail="RFP not found")
    await _attach_partners(db, [rfp])
    return rfp


@router.put("/{rfp_id}", response_model=RFPResponse)
async def update_rfp(rfp_id: UUID, data: RFPUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(RFP).where(RFP.id == rfp_id))
    rfp = r.scalar_one_or_none()
    if not rfp:
        raise HTTPException(status_code=404, detail="RFP not found")
    update_data = data.model_dump(exclude_unset=True)
    if 'approvers' in update_data and update_data['approvers'] is not None:
        update_data['approvers'] = [a if isinstance(a, dict) else a.model_dump() for a in update_data['approvers']]
    for k, v in update_data.items():
        setattr(rfp, k, v)
    await db.commit()
    r = await db.execute(_load_query().where(RFP.id == rfp_id))
    row = r.scalar_one()
    await _attach_partners(db, [row])
    return row


@router.delete("/{rfp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rfp(rfp_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(RFP).where(RFP.id == rfp_id))
    rfp = r.scalar_one_or_none()
    if not rfp:
        raise HTTPException(status_code=404, detail="RFP not found")
    await db.delete(rfp)
    await db.commit()


# ─── Linked opportunities ───────────────────────────────────────────────────────
@router.post("/{rfp_id}/opportunities/{opportunity_id}")
async def link_opportunity(rfp_id: UUID, opportunity_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(RFP).options(selectinload(RFP.opportunities)).where(RFP.id == rfp_id))
    rfp = r.scalar_one_or_none()
    if not rfp:
        raise HTTPException(status_code=404, detail="RFP not found")
    if not any(o.id == opportunity_id for o in rfp.opportunities):
        ro = await db.execute(select(Opportunity).where(Opportunity.id == opportunity_id))
        opp = ro.scalar_one_or_none()
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        rfp.opportunities.append(opp)
        await db.commit()
    return {"status": "ok"}


@router.delete("/{rfp_id}/opportunities/{opportunity_id}")
async def unlink_opportunity(rfp_id: UUID, opportunity_id: UUID, db: AsyncSession = Depends(get_db)):
    await db.execute(
        delete(rfp_opportunity).where(
            rfp_opportunity.c.rfp_id == rfp_id, rfp_opportunity.c.opportunity_id == opportunity_id
        )
    )
    await db.commit()
    return {"status": "ok"}


# ─── Action plan — each item can be internally or externally owned ─────────────
async def _resolve_external_owner(db: AsyncSession, item: RFPActionItem):
    # Trust the contact record over whatever name/email the client sent, since owner_contact_id
    # is meant to be a real pick from this RFP's contacts, not a free-text field.
    if item.owner_type == 'external' and item.owner_contact_id:
        r = await db.execute(select(Contact).where(Contact.id == item.owner_contact_id))
        contact = r.scalar_one_or_none()
        if contact:
            item.owner_email = contact.email
            item.owner_name = f"{contact.first_name} {contact.last_name}"


async def _sync_internal_task(db: AsyncSession, item: RFPActionItem):
    if item.owner_type == 'internal' and item.owner_email:
        due = item.due_date.isoformat() if item.due_date else ''
        if item.task_id:
            await db.execute(text("""
                UPDATE tasks SET title = :title, owner_email = :email, owner_name = :name,
                    assignee_email = :email, assignee_name = :name,
                    due_date = CAST(NULLIF(:due,'') AS TIMESTAMP), updated_at = NOW()
                WHERE id = CAST(:tid AS UUID)
            """), {"title": item.description, "email": item.owner_email, "name": item.owner_name or "",
                   "due": due, "tid": str(item.task_id)})
        else:
            result = await tm_create_task({
                "title": item.description, "owner_email": item.owner_email, "owner_name": item.owner_name or "",
                "entity_type": "rfp_action_item", "entity_id": str(item.id),
                "source": "rfp", "due_date": due,
            }, db)
            item.task_id = uuid_module.UUID(result["id"])


@router.get("/{rfp_id}/action-items", response_model=List[RFPActionItemResponse])
async def list_action_items(rfp_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(RFPActionItem).where(RFPActionItem.rfp_id == rfp_id).order_by(RFPActionItem.position, RFPActionItem.created_at))
    return r.scalars().all()


@router.post("/{rfp_id}/action-items", response_model=RFPActionItemResponse, status_code=status.HTTP_201_CREATED)
async def create_action_item(rfp_id: UUID, data: RFPActionItemCreate, db: AsyncSession = Depends(get_db)):
    item = RFPActionItem(rfp_id=rfp_id, **data.model_dump())
    db.add(item)
    await db.flush()
    await _resolve_external_owner(db, item)
    await _sync_internal_task(db, item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/{rfp_id}/action-items/{item_id}", response_model=RFPActionItemResponse)
async def update_action_item(rfp_id: UUID, item_id: UUID, data: RFPActionItemUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(RFPActionItem).where(RFPActionItem.id == item_id, RFPActionItem.rfp_id == rfp_id))
    item = r.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Action item not found")
    was_internal = item.owner_type == 'internal'
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    await _resolve_external_owner(db, item)
    if item.owner_type == 'internal':
        await _sync_internal_task(db, item)
    elif was_internal:
        # Owner moved off "internal" — the already-created task_manager entry stays as a
        # legitimate historical record, we just stop tracking it against this item.
        item.task_id = None
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{rfp_id}/action-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action_item(rfp_id: UUID, item_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(RFPActionItem).where(RFPActionItem.id == item_id, RFPActionItem.rfp_id == rfp_id))
    item = r.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Action item not found")
    await db.delete(item)
    await db.commit()


# ─── Document checklist ("documents to be created") ────────────────────────────
@router.get("/{rfp_id}/document-checklist", response_model=List[RFPDocumentChecklistResponse])
async def list_document_checklist(rfp_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(RFPDocumentChecklist).where(RFPDocumentChecklist.rfp_id == rfp_id).order_by(RFPDocumentChecklist.position, RFPDocumentChecklist.created_at))
    return r.scalars().all()


@router.post("/{rfp_id}/document-checklist", response_model=RFPDocumentChecklistResponse, status_code=status.HTTP_201_CREATED)
async def create_document_checklist_item(rfp_id: UUID, data: RFPDocumentChecklistCreate, db: AsyncSession = Depends(get_db)):
    item = RFPDocumentChecklist(rfp_id=rfp_id, **data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/{rfp_id}/document-checklist/{item_id}", response_model=RFPDocumentChecklistResponse)
async def update_document_checklist_item(rfp_id: UUID, item_id: UUID, data: RFPDocumentChecklistUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(RFPDocumentChecklist).where(RFPDocumentChecklist.id == item_id, RFPDocumentChecklist.rfp_id == rfp_id))
    item = r.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Document checklist item not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{rfp_id}/document-checklist/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document_checklist_item(rfp_id: UUID, item_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(RFPDocumentChecklist).where(RFPDocumentChecklist.id == item_id, RFPDocumentChecklist.rfp_id == rfp_id))
    item = r.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Document checklist item not found")
    await db.delete(item)
    await db.commit()


# ─── AI document analysis ──────────────────────────────────────────────────────
@router.post("/{rfp_id}/analyze")
async def analyze_rfp(rfp_id: UUID, db: AsyncSession = Depends(get_db)):
    import base64, io, json, os, httpx
    from docx import Document
    from app.routers.settings import get_ms_token

    r = await db.execute(select(RFP).where(RFP.id == rfp_id))
    rfp = r.scalar_one_or_none()
    if not rfp:
        raise HTTPException(status_code=404, detail="RFP not found")
    if not rfp.documents_folder_url:
        raise HTTPException(status_code=400, detail="No documents folder linked yet")

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    rfp.analysis_status = 'analyzing'
    rfp.analysis_error = None
    await db.commit()

    try:
        token = await get_ms_token()
        if not token:
            raise ValueError("Microsoft Graph is not configured")

        folder_share_id = "u!" + base64.urlsafe_b64encode(rfp.documents_folder_url.encode()).decode().rstrip("=")
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"https://graph.microsoft.com/v1.0/shares/{folder_share_id}/driveItem",
                headers={"Authorization": f"Bearer {token}"},
                params={"$expand": "children($select=id,name,webUrl,size,lastModifiedDateTime,folder,file)"},
            )
            if resp.status_code != 200:
                raise ValueError(f"Microsoft Graph returned {resp.status_code}: {resp.text[:300]}")
            item = resp.json()
            children = item.get("children")
            children = children if children is not None else ([] if "folder" in item else [item])

            # Bounded to the first 8 PDF/Word files — keeps analysis time/cost predictable;
            # anything else in the folder is listed elsewhere but not included in the analysis.
            candidates = [c for c in children if "folder" not in c and c.get("name", "").lower().endswith(('.pdf', '.docx'))][:8]
            if not candidates:
                raise ValueError("No PDF or Word documents found in the linked folder")

            content_blocks = []
            for f in candidates:
                file_share_id = "u!" + base64.urlsafe_b64encode(f["webUrl"].encode()).decode().rstrip("=")
                fresp = await client.get(
                    f"https://graph.microsoft.com/v1.0/shares/{file_share_id}/driveItem/content",
                    headers={"Authorization": f"Bearer {token}"},
                )
                if fresp.status_code != 200:
                    continue
                name = f["name"]
                if name.lower().endswith('.pdf'):
                    b64 = base64.standard_b64encode(fresp.content).decode("utf-8")
                    content_blocks.append({"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}})
                else:
                    doc = Document(io.BytesIO(fresp.content))
                    text_content = "\n".join(p.text for p in doc.paragraphs)
                    content_blocks.append({"type": "text", "text": f"--- Document: {name} ---\n{text_content}"})

            if not content_blocks:
                raise ValueError("Could not download any documents from the linked folder")

        prompt = """You are analyzing RFP (Request for Proposal) documents. Based on the attached document(s), return ONLY a valid JSON object with this exact structure:
{
  "summary": "A short 3-5 sentence analysis of the RFP: what's being requested, scope, and any notable requirements or risks.",
  "key_dates": [{"label": "Submission Deadline", "date": "YYYY-MM-DD"}],
  "action_plan": [{"description": "Action to take", "suggested_due_date": "YYYY-MM-DD or null"}],
  "documents_checklist": [{"name": "Document to prepare", "template_hint": "Optional note on what template/format to use, or null"}]
}
Extract all deadlines/dates you can find (submission, Q&A, site visits, decision date, etc.) for key_dates.
For action_plan, list concrete steps needed to respond to this RFP.
For documents_checklist, list every document/attachment the RFP requires as part of the response.
Return ONLY the JSON, no markdown, no explanation."""
        content_blocks.append({"type": "text", "text": prompt})

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "anthropic-beta": "pdfs-2024-09-25",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-6", "max_tokens": 4000,
                    "messages": [{"role": "user", "content": content_blocks}],
                },
            )
            if resp.status_code != 200:
                raise ValueError(f"Claude API error {resp.status_code}: {resp.text[:300]}")
            text_content = resp.json()["content"][0]["text"].strip()
            text_content = text_content.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(text_content)

        rfp.ai_summary = parsed.get("summary", "")
        rfp.key_dates = [d for d in parsed.get("key_dates", []) if d.get("label") and d.get("date")]

        for i, action in enumerate(parsed.get("action_plan", [])):
            due = None
            if action.get("suggested_due_date"):
                try:
                    due = datetime.fromisoformat(action["suggested_due_date"])
                except ValueError:
                    due = None
            db.add(RFPActionItem(rfp_id=rfp.id, description=action.get("description", ""), due_date=due, position=i))

        for i, docitem in enumerate(parsed.get("documents_checklist", [])):
            name = (docitem.get("name") or "Document").strip()
            if docitem.get("template_hint"):
                name = f"{name} ({docitem['template_hint']})"
            db.add(RFPDocumentChecklist(rfp_id=rfp.id, name=name, position=i))

        rfp.analysis_status = 'done'
        await db.commit()
        return {"status": "ok"}

    except Exception as e:
        rfp.analysis_status = 'failed'
        rfp.analysis_error = str(e)[:500]
        await db.commit()
        raise HTTPException(status_code=502, detail=str(e))


# ─── Staffing Roles (one assigned resource each; a resource can hold several roles) ────
@router.get("/{rfp_id}/staffing-roles", response_model=List[RFPStaffingRoleResponse])
async def list_staffing_roles(rfp_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(RFPStaffingRole).where(RFPStaffingRole.rfp_id == rfp_id).order_by(RFPStaffingRole.created_at))
    return r.scalars().all()


@router.post("/{rfp_id}/staffing-roles", response_model=RFPStaffingRoleResponse, status_code=status.HTTP_201_CREATED)
async def create_staffing_role(rfp_id: UUID, data: RFPStaffingRoleCreate, db: AsyncSession = Depends(get_db)):
    role = RFPStaffingRole(rfp_id=rfp_id, **data.model_dump())
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return role


@router.put("/{rfp_id}/staffing-roles/{role_id}", response_model=RFPStaffingRoleResponse)
async def update_staffing_role(rfp_id: UUID, role_id: UUID, data: RFPStaffingRoleUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(RFPStaffingRole).where(RFPStaffingRole.id == role_id, RFPStaffingRole.rfp_id == rfp_id))
    role = r.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(role, k, v)
    await db.commit()
    await db.refresh(role)
    return role


@router.delete("/{rfp_id}/staffing-roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_staffing_role(rfp_id: UUID, role_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(RFPStaffingRole).where(RFPStaffingRole.id == role_id, RFPStaffingRole.rfp_id == rfp_id))
    role = r.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    await db.delete(role)
    await db.commit()


# ─── Staffing/Costing Sheet ─────────────────────────────────────────────────────
@router.get("/{rfp_id}/staffing-tasks", response_model=List[RFPStaffingTaskResponse])
async def list_staffing_tasks(rfp_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(RFPStaffingTask).options(selectinload(RFPStaffingTask.allocations), selectinload(RFPStaffingTask.role))
        .where(RFPStaffingTask.rfp_id == rfp_id).order_by(RFPStaffingTask.position, RFPStaffingTask.created_at)
    )
    return r.scalars().all()


@router.post("/{rfp_id}/staffing-tasks", response_model=RFPStaffingTaskResponse, status_code=status.HTTP_201_CREATED)
async def create_staffing_task(rfp_id: UUID, data: RFPStaffingTaskCreate, db: AsyncSession = Depends(get_db)):
    task = RFPStaffingTask(rfp_id=rfp_id, **data.model_dump())
    db.add(task)
    await db.commit()
    # Re-query with an eager load rather than db.refresh() — refresh() re-expires
    # relationships, and AsyncSession can't lazy-load them during response serialization
    # (which runs after the handler returns, outside the active DB context).
    r = await db.execute(select(RFPStaffingTask).options(selectinload(RFPStaffingTask.allocations), selectinload(RFPStaffingTask.role)).where(RFPStaffingTask.id == task.id))
    return r.scalar_one()


@router.put("/{rfp_id}/staffing-tasks/{task_id}", response_model=RFPStaffingTaskResponse)
async def update_staffing_task(rfp_id: UUID, task_id: UUID, data: RFPStaffingTaskUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(RFPStaffingTask).options(selectinload(RFPStaffingTask.allocations), selectinload(RFPStaffingTask.role))
                          .where(RFPStaffingTask.id == task_id, RFPStaffingTask.rfp_id == rfp_id))
    task = r.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Staffing task not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(task, k, v)
    await db.commit()
    # db.refresh() would re-expire the allocations relationship loaded above, and
    # AsyncSession can't lazy-load it during response serialization — re-query instead.
    r = await db.execute(select(RFPStaffingTask).options(selectinload(RFPStaffingTask.allocations), selectinload(RFPStaffingTask.role)).where(RFPStaffingTask.id == task_id))
    return r.scalar_one()


@router.delete("/{rfp_id}/staffing-tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_staffing_task(rfp_id: UUID, task_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(RFPStaffingTask).where(RFPStaffingTask.id == task_id, RFPStaffingTask.rfp_id == rfp_id))
    task = r.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Staffing task not found")
    await db.delete(task)
    await db.commit()


# Replaces this task's whole allocation set — the frontend always sends its full current
# state for the granularity (week/month) currently being edited; the other granularity's
# rows, if any, are left untouched.
@router.put("/{rfp_id}/staffing-tasks/{task_id}/allocations", response_model=RFPStaffingTaskResponse)
async def set_staffing_allocations(rfp_id: UUID, task_id: UUID, data: RFPStaffingAllocationsSet, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(RFPStaffingTask).options(selectinload(RFPStaffingTask.allocations), selectinload(RFPStaffingTask.role))
                          .where(RFPStaffingTask.id == task_id, RFPStaffingTask.rfp_id == rfp_id))
    task = r.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Staffing task not found")
    granularity = data.allocations[0].period_type if data.allocations else None
    kept = [a for a in task.allocations if granularity and a.period_type != granularity]
    task.allocations = kept + [RFPStaffingAllocation(period_start=a.period_start, period_type=a.period_type, days=a.days) for a in data.allocations]
    await db.commit()
    r = await db.execute(select(RFPStaffingTask).options(selectinload(RFPStaffingTask.allocations), selectinload(RFPStaffingTask.role)).where(RFPStaffingTask.id == task_id))
    return r.scalar_one()


@router.get("/{rfp_id}/staffing-rates", response_model=List[RFPStaffingRateResponse])
async def list_staffing_rates(rfp_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(RFPStaffingRate).where(RFPStaffingRate.rfp_id == rfp_id))
    return r.scalars().all()


@router.put("/{rfp_id}/staffing-rates", response_model=RFPStaffingRateResponse)
async def set_staffing_rate(rfp_id: UUID, data: RFPStaffingRateCreate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(RFPStaffingRate).where(RFPStaffingRate.rfp_id == rfp_id, RFPStaffingRate.resource_email == data.resource_email))
    rate = r.scalar_one_or_none()
    if rate:
        rate.day_rate = data.day_rate
        rate.resource_name = data.resource_name
    else:
        rate = RFPStaffingRate(rfp_id=rfp_id, **data.model_dump())
        db.add(rate)
    await db.commit()
    await db.refresh(rate)
    return rate
