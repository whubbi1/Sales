# backend/app/routers/leads.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, text, insert, delete as sa_delete
from typing import List
from uuid import UUID
from datetime import datetime

from app.database import get_db
from app.models.lead import Lead, LeadActivityLog, LeadNote, LeadFile, lead_partner, lead_partner_contact
from app.models.company import Company
from app.models.contact import Contact
from app.models.opportunity import Opportunity
from app.schemas.schemas import (
    LeadCreate, LeadUpdate, LeadResponse,
    LeadActivityLogResponse,
    LeadNoteCreate, LeadNoteResponse,
    LeadFileCreate, LeadFileResponse,
    LeadCloseWithOpportunity,
    PartnerSummary, OrgEntitySummary, EventSummary,
)
from app.services.ids import next_internal_id

router = APIRouter()


async def _attach_related(db: AsyncSession, leads: list):
    company_ids = {l.company_id for l in leads if l.company_id}
    companies = {}
    if company_ids:
        r = await db.execute(select(Company).where(Company.id.in_(company_ids)))
        companies = {c.id: c for c in r.scalars().all()}

    contact_ids = {l.contact_id for l in leads if l.contact_id} | {l.referral_contact_id for l in leads if l.referral_contact_id}
    contacts = {}
    if contact_ids:
        r = await db.execute(select(Contact).where(Contact.id.in_(contact_ids)))
        contacts = {c.id: c for c in r.scalars().all()}

    # marketing_events isn't an ORM model — same raw-SQL resolution trick as partners below.
    event_ids = {str(l.event_id) for l in leads if l.event_id}
    events = {}
    for eid in event_ids:
        r = await db.execute(text("SELECT id, title, event_date, status FROM marketing_events WHERE id = CAST(:id AS UUID)"), {"id": eid})
        row = r.fetchone()
        if row:
            events[eid] = EventSummary(id=row.id, title=row.title, event_date=row.event_date, status=row.status)

    lead_ids = [l.id for l in leads]
    partner_map = {}
    if lead_ids:
        r = await db.execute(select(lead_partner.c.lead_id, lead_partner.c.partner_id).where(lead_partner.c.lead_id.in_(lead_ids)))
        for row in r.all():
            partner_map.setdefault(row.lead_id, []).append(str(row.partner_id))

    all_partner_ids = {pid for ids in partner_map.values() for pid in ids}
    partners = {}
    for pid in all_partner_ids:
        r = await db.execute(text("SELECT id, internal_id, name, status FROM partners WHERE id = CAST(:id AS UUID)"), {"id": pid})
        row = r.fetchone()
        if row:
            partners[pid] = PartnerSummary(id=row.id, internal_id=row.internal_id, name=row.name, status=row.status)

    pc_map = {}
    if lead_ids:
        r = await db.execute(select(lead_partner_contact.c.lead_id, lead_partner_contact.c.contact_id).where(lead_partner_contact.c.lead_id.in_(lead_ids)))
        for row in r.all():
            pc_map.setdefault(row.lead_id, []).append(row.contact_id)
    all_pc_ids = {cid for ids in pc_map.values() for cid in ids}
    pc_contacts = {}
    if all_pc_ids:
        r = await db.execute(select(Contact).where(Contact.id.in_(all_pc_ids)))
        pc_contacts = {c.id: c for c in r.scalars().all()}

    # legal_org_entities isn't an ORM model — same raw-SQL resolution trick as partners above.
    org_entity_ids = {l.main_operational_team_id for l in leads if l.main_operational_team_id} \
                    | {l.sales_team_id for l in leads if l.sales_team_id}
    org_entities = {}
    for oid in org_entity_ids:
        r = await db.execute(text("SELECT id, code, title FROM legal_org_entities WHERE id = CAST(:id AS UUID)"), {"id": str(oid)})
        row = r.fetchone()
        if row:
            org_entities[oid] = OrgEntitySummary(id=row.id, code=row.code, title=row.title)

    for l in leads:
        l.company = companies.get(l.company_id) if l.company_id else None
        l.contact = contacts.get(l.contact_id) if l.contact_id else None
        l.referral_contact = contacts.get(l.referral_contact_id) if l.referral_contact_id else None
        l.partners = [partners[pid] for pid in partner_map.get(l.id, []) if pid in partners]
        l.partner_contacts = [pc_contacts[cid] for cid in pc_map.get(l.id, []) if cid in pc_contacts]
        l.main_operational_team = org_entities.get(l.main_operational_team_id) if l.main_operational_team_id else None
        l.sales_team = org_entities.get(l.sales_team_id) if l.sales_team_id else None
        l.event = events.get(str(l.event_id)) if l.event_id else None


async def _set_partners(db: AsyncSession, lead_id, partner_ids):
    await db.execute(sa_delete(lead_partner).where(lead_partner.c.lead_id == lead_id))
    for pid in partner_ids or []:
        await db.execute(insert(lead_partner).values(lead_id=lead_id, partner_id=pid))


async def _set_partner_contacts(db: AsyncSession, lead_id, contact_ids):
    await db.execute(sa_delete(lead_partner_contact).where(lead_partner_contact.c.lead_id == lead_id))
    for cid in contact_ids or []:
        await db.execute(insert(lead_partner_contact).values(lead_id=lead_id, contact_id=cid))


async def _log_change(db: AsyncSession, lead_id, field_name: str, old_value, new_value, email, name):
    if old_value == new_value:
        return
    db.add(LeadActivityLog(
        lead_id=lead_id, field_name=field_name,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        changed_by_email=email, changed_by_name=name,
    ))




@router.get("/", response_model=List[LeadResponse])
async def list_leads(
    skip: int = 0, limit: int = 500, search: str = None, lead_status: str = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Lead)
    if search:
        query = query.where(or_(Lead.title.ilike(f"%{search}%"), Lead.lead_number.ilike(f"%{search}%")))
    if lead_status:
        query = query.where(Lead.status == lead_status)
    query = query.offset(skip).limit(limit).order_by(Lead.created_at.desc())
    r = await db.execute(query)
    leads = r.scalars().all()
    await _attach_related(db, leads)
    return leads


@router.post("/", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(data: LeadCreate, db: AsyncSession = Depends(get_db)):
    lead_number = await next_internal_id(db, 'lead_number_seq', 'LEAD')
    payload = data.model_dump(exclude={'partner_ids', 'partner_contact_ids'})
    payload['lead_number'] = lead_number
    lead = Lead(**payload)
    db.add(lead)
    await db.flush()
    await _set_partners(db, lead.id, data.partner_ids)
    await _set_partner_contacts(db, lead.id, data.partner_contact_ids)
    await db.commit()
    r = await db.execute(select(Lead).where(Lead.id == lead.id))
    row = r.scalar_one()
    await _attach_related(db, [row])
    return row


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = r.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    await _attach_related(db, [lead])
    return lead


@router.put("/{lead_id}", response_model=LeadResponse)
async def update_lead(lead_id: UUID, data: LeadUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = r.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    update_data = data.model_dump(exclude={'changed_by_email', 'changed_by_name', 'partner_ids', 'partner_contact_ids'}, exclude_unset=True)

    # A closed lead is terminal — it can never be moved to another status. Duplicate it
    # instead if the work needs to continue under a new lead.
    if lead.status == 'Closed' and 'status' in update_data and update_data['status'] != 'Closed':
        raise HTTPException(status_code=400, detail="This lead is closed and cannot be reopened. Duplicate it to continue this work under a new lead.")

    for k, v in update_data.items():
        old_value = getattr(lead, k)
        if old_value != v:
            await _log_change(db, lead.id, k, old_value, v, data.changed_by_email, data.changed_by_name)
            setattr(lead, k, v)
            if k == 'status' and v == 'Closed':
                lead.closed_at = datetime.utcnow()

    if 'partner_ids' in data.model_fields_set:
        await _set_partners(db, lead.id, data.partner_ids)
    if 'partner_contact_ids' in data.model_fields_set:
        await _set_partner_contacts(db, lead.id, data.partner_contact_ids)

    await db.commit()
    r2 = await db.execute(select(Lead).where(Lead.id == lead_id))
    row = r2.scalar_one()
    await _attach_related(db, [row])
    return row


@router.post("/{lead_id}/close-with-opportunity", response_model=LeadResponse)
async def close_lead_with_opportunity(lead_id: UUID, data: LeadCloseWithOpportunity, db: AsyncSession = Depends(get_db)):
    # Called once the user has actually reviewed and saved the Opportunity created from
    # this lead — links the two records and closes the lead atomically. The "Create an
    # Opportunity" status itself is just a stage; this is the real trigger.
    r = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = r.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.status == 'Closed':
        raise HTTPException(status_code=400, detail="This lead is already closed.")

    ro = await db.execute(select(Opportunity.id).where(Opportunity.id == data.opportunity_id))
    if not ro.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Opportunity not found")

    await _log_change(db, lead.id, 'status', lead.status, 'Closed', data.changed_by_email, data.changed_by_name)
    await _log_change(db, lead.id, 'opportunity_id', lead.opportunity_id, str(data.opportunity_id), data.changed_by_email, data.changed_by_name)
    lead.status = 'Closed'
    lead.closed_at = datetime.utcnow()
    lead.opportunity_id = data.opportunity_id
    await db.commit()

    r2 = await db.execute(select(Lead).where(Lead.id == lead_id))
    row = r2.scalar_one()
    await _attach_related(db, [row])
    return row


# ─── Linked Partners / Contacts (incremental, alongside the full-replace via PUT above) ──
@router.post("/{lead_id}/partners/{partner_id}")
async def link_lead_partner(lead_id: UUID, partner_id: UUID, db: AsyncSession = Depends(get_db)):
    exists = await db.execute(select(lead_partner).where(lead_partner.c.lead_id == lead_id, lead_partner.c.partner_id == partner_id))
    if not exists.first():
        await db.execute(insert(lead_partner).values(lead_id=lead_id, partner_id=partner_id))
        await db.commit()
    return {"status": "ok"}


@router.delete("/{lead_id}/partners/{partner_id}")
async def unlink_lead_partner(lead_id: UUID, partner_id: UUID, db: AsyncSession = Depends(get_db)):
    await db.execute(sa_delete(lead_partner).where(lead_partner.c.lead_id == lead_id, lead_partner.c.partner_id == partner_id))
    await db.commit()
    return {"status": "ok"}


@router.post("/{lead_id}/contacts/{contact_id}")
async def link_lead_contact(lead_id: UUID, contact_id: UUID, db: AsyncSession = Depends(get_db)):
    exists = await db.execute(select(lead_partner_contact).where(lead_partner_contact.c.lead_id == lead_id, lead_partner_contact.c.contact_id == contact_id))
    if not exists.first():
        await db.execute(insert(lead_partner_contact).values(lead_id=lead_id, contact_id=contact_id))
        await db.commit()
    return {"status": "ok"}


@router.delete("/{lead_id}/contacts/{contact_id}")
async def unlink_lead_contact(lead_id: UUID, contact_id: UUID, db: AsyncSession = Depends(get_db)):
    await db.execute(sa_delete(lead_partner_contact).where(lead_partner_contact.c.lead_id == lead_id, lead_partner_contact.c.contact_id == contact_id))
    await db.commit()
    return {"status": "ok"}


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(lead_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = r.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    await db.delete(lead)
    await db.commit()


# ─── Activity log ───────────────────────────────────────────────────────────────
@router.get("/{lead_id}/activity-log", response_model=List[LeadActivityLogResponse])
async def list_lead_activity_log(lead_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(LeadActivityLog).where(LeadActivityLog.lead_id == lead_id).order_by(LeadActivityLog.changed_at.desc()))
    return r.scalars().all()


# ─── Notes ──────────────────────────────────────────────────────────────────────
@router.get("/{lead_id}/notes/", response_model=List[LeadNoteResponse])
async def list_lead_notes(lead_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(LeadNote).where(LeadNote.lead_id == lead_id).order_by(LeadNote.created_at.desc()))
    return r.scalars().all()

@router.post("/{lead_id}/notes/", response_model=LeadNoteResponse, status_code=status.HTTP_201_CREATED)
async def add_lead_note(lead_id: UUID, data: LeadNoteCreate, db: AsyncSession = Depends(get_db)):
    row = LeadNote(lead_id=lead_id, **data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/{lead_id}/notes/{note_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead_note(lead_id: UUID, note_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(LeadNote).where(LeadNote.id == note_id, LeadNote.lead_id == lead_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.delete(row)
    await db.commit()


# ─── Files ──────────────────────────────────────────────────────────────────────
@router.get("/{lead_id}/files/", response_model=List[LeadFileResponse])
async def list_lead_files(lead_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(LeadFile).where(LeadFile.lead_id == lead_id).order_by(LeadFile.created_at.desc()))
    return r.scalars().all()

@router.post("/{lead_id}/files/", response_model=LeadFileResponse, status_code=status.HTTP_201_CREATED)
async def add_lead_file(lead_id: UUID, data: LeadFileCreate, db: AsyncSession = Depends(get_db)):
    row = LeadFile(lead_id=lead_id, **data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/{lead_id}/files/{file_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead_file(lead_id: UUID, file_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(LeadFile).where(LeadFile.id == file_id, LeadFile.lead_id == lead_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="File not found")
    await db.delete(row)
    await db.commit()
