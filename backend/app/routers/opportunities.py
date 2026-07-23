# backend/app/routers/opportunities.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, text
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID, uuid4
from datetime import datetime

from app.database import get_db
from app.models.opportunity import Opportunity
from app.models.contact import Contact
from app.models.company import Company
from app.models.lead import Lead
from app.models.rfp import RFP, rfp_opportunity
from app.models.opportunity_extra import OpportunityStaffing, OpportunityStaffingMonth, OpportunityChecklistItem, OpportunityComment
from app.schemas.schemas import (
    OpportunityCreate, OpportunityUpdate, OpportunityResponse, OpportunitySummary,
    StaffingCreate, StaffingResponse, StaffingMonthsUpdate,
    ChecklistItemCreate, ChecklistItemUpdate, ChecklistItemResponse,
    CommentCreate, CommentResponse, PartnerSummary, OrgEntitySummary, LeadSummary, ContactSummary,
)
from app.services.ids import next_internal_id, compute_deal_name
from app.routers.projects import _maybe_create_project
from app.routers.finance_customers import _maybe_create_customer_contract

router = APIRouter()

# Retired in favor of a single 'Contract Won' status — still valid at the DB enum level
# (Postgres can't drop enum values) but no longer offered or accepted anywhere in the app.
RETIRED_DEAL_STATUSES = {'Contract Ongoing', 'Contract Finalised', 'PO Received'}


async def _attach_partners(db: AsyncSession, objs: list):
    # Partner isn't an ORM relationship (raw-SQL entity) — attach it as a plain instance
    # attribute so OpportunityResponse's from_attributes picks it up like a real relationship would.
    ids = {str(o.partner_id) for o in objs if getattr(o, "partner_id", None)}
    partners = {}
    for pid in ids:
        r = await db.execute(text("SELECT id, internal_id, name, status FROM partners WHERE id = CAST(:id AS UUID)"), {"id": pid})
        row = r.fetchone()
        if row:
            partners[pid] = PartnerSummary(id=row.id, internal_id=row.internal_id, name=row.name, status=row.status)
    for o in objs:
        o.partner = partners.get(str(o.partner_id)) if getattr(o, "partner_id", None) else None


async def _attach_contracting_party(db: AsyncSession, objs: list):
    # contracting_party_id isn't an ORM relationship (plain FK, see opportunity.py) — attach it
    # as a plain instance attribute, same trick as _attach_partners above. The contracting party
    # can be either a Company (contracting_party_id) or a Partner (contracting_party_partner_id).
    ids = {o.contracting_party_id for o in objs if getattr(o, "contracting_party_id", None)}
    companies = {}
    if ids:
        r = await db.execute(select(Company).where(Company.id.in_(ids)))
        companies = {c.id: c for c in r.scalars().all()}
    for o in objs:
        o.contracting_party_company = companies.get(o.contracting_party_id) if getattr(o, "contracting_party_id", None) else None

    partner_ids = {str(o.contracting_party_partner_id) for o in objs if getattr(o, "contracting_party_partner_id", None)}
    partners = {}
    for pid in partner_ids:
        r = await db.execute(text("SELECT id, internal_id, name, status FROM partners WHERE id = CAST(:id AS UUID)"), {"id": pid})
        row = r.fetchone()
        if row:
            partners[pid] = PartnerSummary(id=row.id, internal_id=row.internal_id, name=row.name, status=row.status)
    for o in objs:
        o.contracting_party_partner = partners.get(str(o.contracting_party_partner_id)) if getattr(o, "contracting_party_partner_id", None) else None


async def _attach_org_teams(db: AsyncSession, objs: list):
    # legal_org_entities isn't an ORM model — same raw-SQL resolution trick as partners above.
    ids = {str(o.main_operational_team_id) for o in objs if getattr(o, "main_operational_team_id", None)} \
        | {str(o.sales_team_id) for o in objs if getattr(o, "sales_team_id", None)}
    org_entities = {}
    for oid in ids:
        r = await db.execute(text("SELECT id, code, title FROM legal_org_entities WHERE id = CAST(:id AS UUID)"), {"id": oid})
        row = r.fetchone()
        if row:
            org_entities[oid] = OrgEntitySummary(id=row.id, code=row.code, title=row.title)
    for o in objs:
        o.main_operational_team = org_entities.get(str(o.main_operational_team_id)) if getattr(o, "main_operational_team_id", None) else None
        o.sales_team = org_entities.get(str(o.sales_team_id)) if getattr(o, "sales_team_id", None) else None


async def _attach_lead_and_referral(db: AsyncSession, objs: list):
    # lead_id/referral_contact_id are plain columns (see opportunity.py) — attach both as plain
    # instance attributes, same trick as _attach_partners above.
    lead_ids = {o.lead_id for o in objs if getattr(o, "lead_id", None)}
    leads = {}
    if lead_ids:
        r = await db.execute(select(Lead.id, Lead.lead_number, Lead.title, Lead.origin).where(Lead.id.in_(lead_ids)))
        leads = {row.id: LeadSummary(id=row.id, lead_number=row.lead_number, title=row.title, origin=row.origin) for row in r.all()}

    contact_ids = {o.referral_contact_id for o in objs if getattr(o, "referral_contact_id", None)}
    contacts = {}
    if contact_ids:
        r = await db.execute(select(Contact).where(Contact.id.in_(contact_ids)))
        contacts = {c.id: ContactSummary.model_validate(c) for c in r.scalars().all()}

    for o in objs:
        o.lead = leads.get(o.lead_id) if getattr(o, "lead_id", None) else None
        o.referral_contact = contacts.get(o.referral_contact_id) if getattr(o, "referral_contact_id", None) else None


def _apply_daily_invoicing_amount(opp: Opportunity):
    # deal_amount is derived, not entered directly, whenever both inputs are present —
    # keeps it always equal to days x rate rather than letting the two drift apart.
    if opp.project_status == 'Daily Invoicing' and opp.invoice_days is not None and opp.daily_rate is not None:
        opp.deal_amount = opp.invoice_days * opp.daily_rate


def _months_between(start, end):
    if not start or not end:
        return []
    months = []
    cur = datetime(start.year, start.month, 1)
    last = datetime(end.year, end.month, 1)
    while cur <= last:
        months.append(cur)
        cur = datetime(cur.year + 1, 1, 1) if cur.month == 12 else datetime(cur.year, cur.month + 1, 1)
    return months


async def _sync_staffing_from_consultants(db: AsyncSession, opp: Opportunity):
    # Every assigned consultant gets a staffing row if they don't already have one —
    # removing someone from the assigned list here does NOT delete their existing
    # staffing entry, that stays a deliberate, separate action in the Staffing tab.
    consultants = [c for c in (opp.assigned_consultants or []) if c.get('email')]
    if not consultants:
        return

    r = await db.execute(select(OpportunityStaffing).where(OpportunityStaffing.opportunity_id == opp.id))
    existing_emails = {s.user_email for s in r.scalars().all()}
    for c in consultants:
        if c['email'] not in existing_emails:
            db.add(OpportunityStaffing(opportunity_id=opp.id, user_email=c['email'], user_name=c.get('name') or c['email']))
    await db.flush()

    # Daily Invoicing — the total invoiced days are split evenly across every assigned
    # consultant and every month of the contract period, so the staffing plan always
    # reflects what was actually quoted.
    if opp.project_status == 'Daily Invoicing' and opp.invoice_days:
        months = _months_between(opp.contract_start_date, opp.contract_end_date)
        if months:
            per_person_days = opp.invoice_days / len(consultants)
            per_month_days = round(per_person_days / len(months), 2)
            r2 = await db.execute(
                select(OpportunityStaffing).options(selectinload(OpportunityStaffing.months))
                .where(OpportunityStaffing.opportunity_id == opp.id)
            )
            by_email = {s.user_email: s for s in r2.scalars().all()}
            for c in consultants:
                row = by_email.get(c['email'])
                if row:
                    row.months = [OpportunityStaffingMonth(month=m, days=per_month_days) for m in months]
    await db.commit()


async def _lookup_names(db: AsyncSession, company_id, partner_id):
    # Resolves the display names deal_name is built from — used on both create and update
    # so the computed name always reflects whatever company/partner ends up on the row.
    company_name = None
    if company_id:
        r = await db.execute(select(Company.name).where(Company.id == company_id))
        company_name = r.scalar_one_or_none()
    partner_name = None
    if partner_id:
        r = await db.execute(text("SELECT name FROM partners WHERE id = CAST(:id AS UUID)"), {"id": str(partner_id)})
        row = r.fetchone()
        partner_name = row.name if row else None
    return company_name, partner_name


async def _maybe_create_rfp(db: AsyncSession, opp: Opportunity):
    # Fires once per opportunity — the moment its status is (or becomes) "RFP Ongoing" and it
    # isn't already linked to an RFP. Returns the new RFP's id so the caller can tell the
    # frontend to redirect there; returns None the rest of the time (status unchanged, already
    # linked, etc.) so nothing else about create/update behavior changes.
    if opp.deal_status != 'RFP Ongoing':
        return None
    r = await db.execute(select(rfp_opportunity.c.rfp_id).where(rfp_opportunity.c.opportunity_id == opp.id))
    if r.first():
        return None
    company_name, partner_name = await _lookup_names(db, opp.company_id, opp.partner_id)
    rfp = RFP(
        name=f"RFP - {company_name or partner_name or 'Unknown'} - {opp.project_name or opp.deal_name}",
        company_id=opp.company_id,
        partner_id=opp.partner_id,
        owner_email=opp.assigned_to_email,
        owner=opp.assigned_to,
    )
    rfp.opportunities.append(opp)
    db.add(rfp)
    await db.commit()
    return rfp.id


@router.get("/", response_model=List[OpportunityResponse])
async def list_opportunities(
    skip: int = 0, limit: int = 100,
    search: str = None, company_id: str = None, partner_id: str = None, deal_status: str = None,
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
    if partner_id:
        query = query.where(Opportunity.partner_id == partner_id)
    if deal_status:
        query = query.where(Opportunity.deal_status == deal_status)
    query = query.offset(skip).limit(limit).order_by(Opportunity.created_at.desc())
    result = await db.execute(query)
    opps = result.scalars().all()
    await _attach_partners(db, opps)
    await _attach_contracting_party(db, opps)
    await _attach_org_teams(db, opps)
    await _attach_lead_and_referral(db, opps)
    return opps

@router.post("/", response_model=OpportunityResponse, status_code=status.HTTP_201_CREATED)
async def create_opportunity(opp: OpportunityCreate, db: AsyncSession = Depends(get_db)):
    if opp.deal_status in RETIRED_DEAL_STATUSES:
        raise HTTPException(status_code=400, detail=f"'{opp.deal_status}' is retired — use 'Contract Won' instead")
    contact_ids = opp.contact_ids or []
    data = opp.model_dump(exclude={'contact_ids'})

    company_name, partner_name = await _lookup_names(db, data.get('company_id'), data.get('partner_id'))
    data['deal_id'] = await next_internal_id(db, 'opportunity_deal_id_seq', 'OPP')
    data['deal_name'] = compute_deal_name(data.get('closing_date'), company_name, partner_name, data.get('project_name'))

    db_opp = Opportunity(**data)
    _apply_daily_invoicing_amount(db_opp)

    if contact_ids:
        r = await db.execute(select(Contact).where(Contact.id.in_(contact_ids)))
        db_opp.contacts = r.scalars().all()

    db.add(db_opp)
    await db.commit()
    new_rfp_id = await _maybe_create_rfp(db, db_opp)
    new_project = await _maybe_create_project(db, db_opp)
    if new_project:
        await _maybe_create_customer_contract(db, db_opp, new_project)
    await _sync_staffing_from_consultants(db, db_opp)
    r = await db.execute(select(Opportunity).options(selectinload(Opportunity.company), selectinload(Opportunity.contacts)).where(Opportunity.id == db_opp.id))
    row = r.scalar_one()
    await _attach_partners(db, [row])
    await _attach_contracting_party(db, [row])
    await _attach_org_teams(db, [row])
    await _attach_lead_and_referral(db, [row])
    row.rfp_id = new_rfp_id
    return row

@router.get("/{opportunity_id}", response_model=OpportunityResponse)
async def get_opportunity(opportunity_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Opportunity).options(selectinload(Opportunity.company), selectinload(Opportunity.contacts)).where(Opportunity.id == opportunity_id))
    opp = r.scalar_one_or_none()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    await _attach_partners(db, [opp])
    await _attach_contracting_party(db, [opp])
    await _attach_org_teams(db, [opp])
    await _attach_lead_and_referral(db, [opp])
    return opp

@router.put("/{opportunity_id}", response_model=OpportunityResponse)
async def update_opportunity(opportunity_id: UUID, data: OpportunityUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Opportunity).options(selectinload(Opportunity.contacts)).where(Opportunity.id == opportunity_id))
    opp = r.scalar_one_or_none()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    # Contract Won is terminal — the whole opportunity is frozen from here on. Anything left
    # to do (staffing, invoicing, delivery) happens on its linked Project instead.
    if opp.deal_status == 'Contract Won':
        raise HTTPException(status_code=400, detail="This opportunity is Contract Won and can no longer be edited. Continue this work on its linked Project.")

    if data.deal_status in RETIRED_DEAL_STATUSES:
        raise HTTPException(status_code=400, detail=f"'{data.deal_status}' is retired — use 'Contract Won' instead")

    update_data = data.model_dump(exclude={'contact_ids'}, exclude_unset=True)
    update_data.pop('deal_id', None)     # immutable after creation
    update_data.pop('deal_name', None)   # always recomputed below, never taken from the client

    for k, v in update_data.items():
        setattr(opp, k, v)
    _apply_daily_invoicing_amount(opp)

    # Recompute unconditionally so deal_name always reflects the row's current company/partner
    # /project/closing_date, whichever of those fields this particular update touched.
    company_name, partner_name = await _lookup_names(db, opp.company_id, opp.partner_id)
    opp.deal_name = compute_deal_name(opp.closing_date, company_name, partner_name, opp.project_name)

    if 'contact_ids' in data.model_fields_set:
        r = await db.execute(select(Contact).where(Contact.id.in_(data.contact_ids or [])))
        opp.contacts = r.scalars().all()

    await db.commit()
    new_rfp_id = await _maybe_create_rfp(db, opp)
    new_project = await _maybe_create_project(db, opp)
    if new_project:
        await _maybe_create_customer_contract(db, opp, new_project)
    await _sync_staffing_from_consultants(db, opp)
    r = await db.execute(select(Opportunity).options(selectinload(Opportunity.company), selectinload(Opportunity.contacts)).where(Opportunity.id == opportunity_id))
    row = r.scalar_one()
    await _attach_partners(db, [row])
    await _attach_contracting_party(db, [row])
    await _attach_org_teams(db, [row])
    await _attach_lead_and_referral(db, [row])
    row.rfp_id = new_rfp_id
    return row

# ─── Linked Contacts (incremental, alongside the full-replace via PUT above) ────
@router.post("/{opportunity_id}/contacts/{contact_id}")
async def link_opportunity_contact(opportunity_id: UUID, contact_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Opportunity).options(selectinload(Opportunity.contacts)).where(Opportunity.id == opportunity_id))
    opp = r.scalar_one_or_none()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    rc = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = rc.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    if contact not in opp.contacts:
        opp.contacts.append(contact)
        await db.commit()
    return {"status": "ok"}


@router.delete("/{opportunity_id}/contacts/{contact_id}")
async def unlink_opportunity_contact(opportunity_id: UUID, contact_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Opportunity).options(selectinload(Opportunity.contacts)).where(Opportunity.id == opportunity_id))
    opp = r.scalar_one_or_none()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    opp.contacts = [c for c in opp.contacts if c.id != contact_id]
    await db.commit()
    return {"status": "ok"}


@router.delete("/{opportunity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_opportunity(opportunity_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Opportunity).where(Opportunity.id == opportunity_id))
    opp = r.scalar_one_or_none()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    rfp_check = await db.execute(text("SELECT 1 FROM rfp_opportunities WHERE opportunity_id = :id"), {"id": str(opportunity_id)})
    if rfp_check.first():
        raise HTTPException(status_code=400, detail="Cannot delete: this Opportunity is linked to an RFP. Unlink it from the RFP first.")
    project_check = await db.execute(text("SELECT 1 FROM projects WHERE opportunity_id = :id"), {"id": str(opportunity_id)})
    if project_check.first():
        raise HTTPException(status_code=400, detail="Cannot delete: a Project already exists for this Opportunity.")
    await db.delete(opp)
    await db.commit()

# ─── Staffing (employees assigned to this opportunity) ─────────────────────────
@router.get("/{opportunity_id}/staffing/", response_model=List[StaffingResponse])
async def list_staffing(opportunity_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(OpportunityStaffing).options(selectinload(OpportunityStaffing.months))
        .where(OpportunityStaffing.opportunity_id == opportunity_id).order_by(OpportunityStaffing.created_at)
    )
    return r.scalars().all()

@router.post("/{opportunity_id}/staffing/", response_model=StaffingResponse, status_code=status.HTTP_201_CREATED)
async def add_staffing(opportunity_id: UUID, data: StaffingCreate, db: AsyncSession = Depends(get_db)):
    row = OpportunityStaffing(opportunity_id=opportunity_id, **data.model_dump())
    db.add(row)
    await db.commit()
    # Re-query with an eager load rather than db.refresh() + assigning the relationship —
    # refresh() re-expires already-loaded relationships, and AsyncSession can't lazy-load
    # them afterwards outside the request's active DB context (FastAPI's response
    # serialization runs after the handler returns, triggering a MissingGreenlet error).
    r = await db.execute(select(OpportunityStaffing).options(selectinload(OpportunityStaffing.months)).where(OpportunityStaffing.id == row.id))
    return r.scalar_one()

@router.delete("/{opportunity_id}/staffing/{staffing_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def remove_staffing(opportunity_id: UUID, staffing_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(OpportunityStaffing).where(OpportunityStaffing.id == staffing_id, OpportunityStaffing.opportunity_id == opportunity_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Staffing entry not found")
    await db.delete(row)
    await db.commit()

# Replaces this staffing assignment's whole month->days allocation (simplest correct
# semantics for an editable grid — the frontend always sends its full current state).
@router.put("/{opportunity_id}/staffing/{staffing_id}/months", response_model=StaffingResponse)
async def set_staffing_months(opportunity_id: UUID, staffing_id: UUID, data: StaffingMonthsUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(OpportunityStaffing).options(selectinload(OpportunityStaffing.months))
                          .where(OpportunityStaffing.id == staffing_id, OpportunityStaffing.opportunity_id == opportunity_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Staffing entry not found")
    row.months = [OpportunityStaffingMonth(month=m.month, days=m.days) for m in data.months]
    await db.commit()
    r = await db.execute(select(OpportunityStaffing).options(selectinload(OpportunityStaffing.months)).where(OpportunityStaffing.id == staffing_id))
    return r.scalar_one()

@router.get("/staffing/all", response_model=None)
async def list_all_staffing(db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(OpportunityStaffing, Opportunity.deal_name, Opportunity.deal_status)
        .join(Opportunity, Opportunity.id == OpportunityStaffing.opportunity_id)
        .options(selectinload(OpportunityStaffing.months))
        .order_by(OpportunityStaffing.user_name)
    )
    return [
        {
            "id": str(row.OpportunityStaffing.id),
            "opportunity_id": str(row.OpportunityStaffing.opportunity_id),
            "opportunity_name": row.deal_name,
            "deal_status": row.deal_status,
            "user_email": row.OpportunityStaffing.user_email,
            "user_name": row.OpportunityStaffing.user_name,
            "role": row.OpportunityStaffing.role,
            "created_at": row.OpportunityStaffing.created_at,
            "months": [{"month": m.month, "days": m.days} for m in row.OpportunityStaffing.months],
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

# ─── Links (manually-curated SharePoint folders/files, each with a description) ─
@router.get("/{opportunity_id}/links")
async def list_opportunity_links(opportunity_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT * FROM opportunity_links WHERE opportunity_id = CAST(:oid AS UUID) ORDER BY created_at DESC
    """), {"oid": opportunity_id})
    links = []
    for row in r.fetchall():
        d = dict(row._mapping)
        d["id"] = str(d["id"])
        d["opportunity_id"] = str(d["opportunity_id"])
        links.append(d)
    return {"links": links}

@router.post("/{opportunity_id}/links")
async def create_opportunity_link(opportunity_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("url"):
        raise HTTPException(status_code=400, detail="url is required")
    lid = str(uuid4())
    await db.execute(text("""
        INSERT INTO opportunity_links (id, opportunity_id, url, description, created_at, updated_at)
        VALUES (CAST(:id AS UUID), CAST(:oid AS UUID), :url, :description, NOW(), NOW())
    """), {"id": lid, "oid": opportunity_id, "url": data["url"], "description": data.get("description", "")})
    await db.commit()
    return {"status": "ok", "id": lid}

@router.put("/{opportunity_id}/links/{link_id}")
async def update_opportunity_link(opportunity_id: str, link_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE opportunity_links SET
            url = COALESCE(NULLIF(:url,''), url),
            description = COALESCE(:description, description),
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID) AND opportunity_id = CAST(:oid AS UUID)
    """), {"id": link_id, "oid": opportunity_id, "url": data.get("url", ""), "description": data.get("description")})
    await db.commit()
    return {"status": "ok"}

@router.delete("/{opportunity_id}/links/{link_id}")
async def delete_opportunity_link(opportunity_id: str, link_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        DELETE FROM opportunity_links WHERE id = CAST(:id AS UUID) AND opportunity_id = CAST(:oid AS UUID)
    """), {"id": link_id, "oid": opportunity_id})
    await db.commit()
    return {"status": "ok"}
