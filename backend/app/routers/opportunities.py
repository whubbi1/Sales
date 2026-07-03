# backend/app/routers/opportunities.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.opportunity import Opportunity
from app.models.contact import Contact
from app.models.opportunity_extra import OpportunityStaffing, OpportunityChecklistItem, OpportunityComment
from app.schemas.schemas import (
    OpportunityCreate, OpportunityUpdate, OpportunityResponse, OpportunitySummary,
    StaffingCreate, StaffingResponse,
    ChecklistItemCreate, ChecklistItemUpdate, ChecklistItemResponse,
    CommentCreate, CommentResponse,
)

router = APIRouter()

@router.get("/", response_model=List[OpportunityResponse])
async def list_opportunities(
    skip: int = 0, limit: int = 100,
    search: str = None, company_id: str = None, deal_status: str = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Opportunity).options(
        selectinload(Opportunity.company),
        selectinload(Opportunity.contacts)
    )
    if search:
        query = query.where(or_(
            Opportunity.deal_name.ilike(f"%{search}%"),
            Opportunity.deal_id.ilike(f"%{search}%")
        ))
    if company_id:
        query = query.where(Opportunity.company_id == company_id)
    if deal_status:
        query = query.where(Opportunity.deal_status == deal_status)
    query = query.offset(skip).limit(limit).order_by(Opportunity.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=OpportunityResponse, status_code=status.HTTP_201_CREATED)
async def create_opportunity(opp: OpportunityCreate, db: AsyncSession = Depends(get_db)):
    contact_ids = opp.contact_ids or []
    data = opp.model_dump(exclude={'contact_ids'})
    db_opp = Opportunity(**data)

    if contact_ids:
        r = await db.execute(select(Contact).where(Contact.id.in_(contact_ids)))
        db_opp.contacts = r.scalars().all()

    db.add(db_opp)
    await db.commit()
    r = await db.execute(select(Opportunity).options(selectinload(Opportunity.company), selectinload(Opportunity.contacts)).where(Opportunity.id == db_opp.id))
    return r.scalar_one()

@router.get("/{opportunity_id}", response_model=OpportunityResponse)
async def get_opportunity(opportunity_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Opportunity).options(selectinload(Opportunity.company), selectinload(Opportunity.contacts)).where(Opportunity.id == opportunity_id))
    opp = r.scalar_one_or_none()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return opp

@router.put("/{opportunity_id}", response_model=OpportunityResponse)
async def update_opportunity(opportunity_id: UUID, data: OpportunityUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Opportunity).options(selectinload(Opportunity.contacts)).where(Opportunity.id == opportunity_id))
    opp = r.scalar_one_or_none()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    contact_ids = data.contact_ids or []
    update_data = data.model_dump(exclude={'contact_ids'}, exclude_unset=True)

    for k, v in update_data.items():
        setattr(opp, k, v)

    if contact_ids is not None:
        r = await db.execute(select(Contact).where(Contact.id.in_(contact_ids)))
        opp.contacts = r.scalars().all()

    await db.commit()
    r = await db.execute(select(Opportunity).options(selectinload(Opportunity.company), selectinload(Opportunity.contacts)).where(Opportunity.id == opportunity_id))
    return r.scalar_one()

@router.delete("/{opportunity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_opportunity(opportunity_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Opportunity).where(Opportunity.id == opportunity_id))
    opp = r.scalar_one_or_none()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    await db.delete(opp)
    await db.commit()

# ─── Staffing (employees assigned to this opportunity) ─────────────────────────
@router.get("/{opportunity_id}/staffing/", response_model=List[StaffingResponse])
async def list_staffing(opportunity_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(OpportunityStaffing).where(OpportunityStaffing.opportunity_id == opportunity_id).order_by(OpportunityStaffing.created_at))
    return r.scalars().all()

@router.post("/{opportunity_id}/staffing/", response_model=StaffingResponse, status_code=status.HTTP_201_CREATED)
async def add_staffing(opportunity_id: UUID, data: StaffingCreate, db: AsyncSession = Depends(get_db)):
    row = OpportunityStaffing(opportunity_id=opportunity_id, **data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/{opportunity_id}/staffing/{staffing_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def remove_staffing(opportunity_id: UUID, staffing_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(OpportunityStaffing).where(OpportunityStaffing.id == staffing_id, OpportunityStaffing.opportunity_id == opportunity_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Staffing entry not found")
    await db.delete(row)
    await db.commit()

@router.get("/staffing/all", response_model=None)
async def list_all_staffing(db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(OpportunityStaffing, Opportunity.deal_name)
        .join(Opportunity, Opportunity.id == OpportunityStaffing.opportunity_id)
        .order_by(OpportunityStaffing.user_name)
    )
    return [
        {
            "id": str(row.OpportunityStaffing.id),
            "opportunity_id": str(row.OpportunityStaffing.opportunity_id),
            "opportunity_name": row.deal_name,
            "user_email": row.OpportunityStaffing.user_email,
            "user_name": row.OpportunityStaffing.user_name,
            "role": row.OpportunityStaffing.role,
            "created_at": row.OpportunityStaffing.created_at,
        }
        for row in r.all()
    ]

# ─── Checklist ──────────────────────────────────────────────────────────────────
@router.get("/{opportunity_id}/checklist/", response_model=List[ChecklistItemResponse])
async def list_checklist(opportunity_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(OpportunityChecklistItem).where(OpportunityChecklistItem.opportunity_id == opportunity_id).order_by(OpportunityChecklistItem.position, OpportunityChecklistItem.created_at))
    return r.scalars().all()

@router.post("/{opportunity_id}/checklist/", response_model=ChecklistItemResponse, status_code=status.HTTP_201_CREATED)
async def add_checklist_item(opportunity_id: UUID, data: ChecklistItemCreate, db: AsyncSession = Depends(get_db)):
    row = OpportunityChecklistItem(opportunity_id=opportunity_id, **data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.put("/{opportunity_id}/checklist/{item_id}/", response_model=ChecklistItemResponse)
async def update_checklist_item(opportunity_id: UUID, item_id: UUID, data: ChecklistItemUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(OpportunityChecklistItem).where(OpportunityChecklistItem.id == item_id, OpportunityChecklistItem.opportunity_id == opportunity_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/{opportunity_id}/checklist/{item_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_checklist_item(opportunity_id: UUID, item_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(OpportunityChecklistItem).where(OpportunityChecklistItem.id == item_id, OpportunityChecklistItem.opportunity_id == opportunity_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    await db.delete(row)
    await db.commit()

# ─── Comments ───────────────────────────────────────────────────────────────────
@router.get("/{opportunity_id}/comments/", response_model=List[CommentResponse])
async def list_comments(opportunity_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(OpportunityComment).where(OpportunityComment.opportunity_id == opportunity_id).order_by(OpportunityComment.created_at.desc()))
    return r.scalars().all()

@router.post("/{opportunity_id}/comments/", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def add_comment(opportunity_id: UUID, data: CommentCreate, db: AsyncSession = Depends(get_db)):
    row = OpportunityComment(opportunity_id=opportunity_id, **data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/{opportunity_id}/comments/{comment_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(opportunity_id: UUID, comment_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(OpportunityComment).where(OpportunityComment.id == comment_id, OpportunityComment.opportunity_id == opportunity_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Comment not found")
    await db.delete(row)
    await db.commit()

# ─── SharePoint files (live listing via Microsoft Graph Shares API) ───────────
@router.get("/{opportunity_id}/sharepoint-files")
async def list_sharepoint_files(opportunity_id: UUID, db: AsyncSession = Depends(get_db)):
    import base64
    import httpx
    from app.routers.settings import get_ms_token

    r = await db.execute(select(Opportunity).where(Opportunity.id == opportunity_id))
    opp = r.scalar_one_or_none()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    if not opp.sharepoint_site_url:
        return {"linked": False, "files": []}

    try:
        token = await get_ms_token()
        if not token:
            return {"linked": True, "error": "Microsoft Graph is not configured", "files": []}

        b64 = base64.urlsafe_b64encode(opp.sharepoint_site_url.encode()).decode().rstrip("=")
        share_id = "u!" + b64

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://graph.microsoft.com/v1.0/shares/{share_id}/driveItem",
                headers={"Authorization": f"Bearer {token}"},
                params={"$expand": "children($select=id,name,webUrl,size,lastModifiedDateTime,folder,file)"},
            )
        if resp.status_code != 200:
            return {"linked": True, "error": f"Microsoft Graph returned {resp.status_code}: {resp.text[:300]}", "files": []}

        item = resp.json()
        children = item.get("children")
        files = children if children is not None else [item]
        result = [{
            "id": f.get("id"),
            "name": f.get("name"),
            "web_url": f.get("webUrl"),
            "size": f.get("size"),
            "last_modified": f.get("lastModifiedDateTime"),
            "is_folder": "folder" in f,
        } for f in files]
        return {"linked": True, "files": result}
    except Exception as e:
        return {"linked": True, "error": str(e), "files": []}
