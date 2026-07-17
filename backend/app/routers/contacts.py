# backend/app/routers/contacts.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, text
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.contact import Contact, ContactNote
from app.models.company import Company, CompanyArticle
from app.models.opportunity import Opportunity
from app.schemas.schemas import (
    ContactCreate, ContactUpdate, ContactResponse, ContactSummary, OpportunitySummary, PartnerSummary,
    NoteCreate, NoteResponse, ArticleCreate, ArticleResponse,
)
from app.services.ids import next_internal_id

router = APIRouter()


async def _attach_partners(db: AsyncSession, objs: list):
    # Partner isn't an ORM relationship (raw-SQL entity) — attach it as a plain instance
    # attribute so ContactResponse's from_attributes picks it up like a real relationship would.
    ids = {str(o.partner_id) for o in objs if getattr(o, "partner_id", None)}
    partners = {}
    for pid in ids:
        r = await db.execute(text("SELECT id, internal_id, name, status FROM partners WHERE id = CAST(:id AS UUID)"), {"id": pid})
        row = r.fetchone()
        if row:
            partners[pid] = PartnerSummary(id=row.id, internal_id=row.internal_id, name=row.name, status=row.status)
    for o in objs:
        o.partner = partners.get(str(o.partner_id)) if getattr(o, "partner_id", None) else None

@router.get("/", response_model=List[ContactResponse])
async def list_contacts(
    skip: int = 0, limit: int = 100,
    search: str = None, company_id: str = None, partner_id: str = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Contact).options(selectinload(Contact.company))
    if search:
        query = query.where(or_(
            Contact.first_name.ilike(f"%{search}%"),
            Contact.last_name.ilike(f"%{search}%"),
            Contact.email.ilike(f"%{search}%")
        ))
    if company_id:
        query = query.where(Contact.company_id == company_id)
    if partner_id:
        query = query.where(Contact.partner_id == partner_id)
    query = query.offset(skip).limit(limit).order_by(Contact.last_name, Contact.first_name)
    result = await db.execute(query)
    contacts = result.scalars().all()
    await _attach_partners(db, contacts)
    return contacts

@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(contact: ContactCreate, db: AsyncSession = Depends(get_db)):
    data = contact.model_dump()
    data['internal_id'] = await next_internal_id(db, 'contact_internal_id_seq', 'CNT')
    # Default a new contact's owner to their company's owner, unless the caller already
    # picked someone — a contact created under an already-assigned company shouldn't
    # start out unassigned.
    if data.get('company_id') and not data.get('assigned_to_email'):
        r = await db.execute(select(Company).where(Company.id == data['company_id']))
        company = r.scalar_one_or_none()
        if company and company.assigned_to_email:
            data['assigned_to'] = company.assigned_to
            data['assigned_to_email'] = company.assigned_to_email
    db_contact = Contact(**data)
    db.add(db_contact)
    await db.commit()
    r = await db.execute(select(Contact).options(selectinload(Contact.company)).where(Contact.id == db_contact.id))
    row = r.scalar_one()
    await _attach_partners(db, [row])
    return row

@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(contact_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Contact).options(selectinload(Contact.company), selectinload(Contact.opportunities)).where(Contact.id == contact_id))
    contact = r.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    await _attach_partners(db, [contact])
    return contact

@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(contact_id: UUID, data: ContactUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = r.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(contact, k, v)
    await db.commit()
    r = await db.execute(select(Contact).options(selectinload(Contact.company)).where(Contact.id == contact_id))
    row = r.scalar_one()
    await _attach_partners(db, [row])
    return row

@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(contact_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = r.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    await db.delete(contact)
    await db.commit()

@router.get("/{contact_id}/opportunities", response_model=List[OpportunitySummary])
async def get_contact_opportunities(contact_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Contact).options(selectinload(Contact.opportunities)).where(Contact.id == contact_id))
    contact = r.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact.opportunities

# ─── Notes ────────────────────────────────────────────────────────────────────
@router.get("/{contact_id}/notes", response_model=List[NoteResponse])
async def list_contact_notes(contact_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ContactNote).where(ContactNote.contact_id == contact_id).order_by(ContactNote.created_at.desc()))
    return r.scalars().all()

@router.post("/{contact_id}/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_contact_note(contact_id: UUID, note: NoteCreate, db: AsyncSession = Depends(get_db)):
    db_note = ContactNote(contact_id=contact_id, **note.model_dump())
    db.add(db_note)
    await db.commit()
    await db.refresh(db_note)
    return db_note

@router.delete("/{contact_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact_note(contact_id: UUID, note_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ContactNote).where(ContactNote.id == note_id, ContactNote.contact_id == contact_id))
    note = r.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.delete(note)
    await db.commit()

# ─── Articles ─────────────────────────────────────────────────────────────────
# Shares company_articles/article_companies/article_contacts with the Companies module
# (see companies.py's Articles section) — an article created here has contact_id set and
# company_id null, but can still be additionally linked to companies via article_companies.
@router.get("/{contact_id}/articles", response_model=List[ArticleResponse])
async def list_contact_articles(contact_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT * FROM (
            SELECT a.* FROM company_articles a WHERE a.contact_id = :cid
            UNION
            SELECT a.* FROM company_articles a
            JOIN article_contacts ac ON ac.article_id = a.id
            WHERE ac.contact_id = :cid
        ) sub ORDER BY created_at DESC
    """), {"cid": str(contact_id)})
    return [dict(row._mapping) for row in r.fetchall()]

@router.post("/{contact_id}/articles", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_contact_article(contact_id: UUID, article: ArticleCreate, db: AsyncSession = Depends(get_db)):
    db_article = CompanyArticle(contact_id=contact_id, **article.model_dump())
    db.add(db_article)
    await db.commit()
    await db.refresh(db_article)
    return db_article

@router.delete("/{contact_id}/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact_article(contact_id: UUID, article_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(CompanyArticle).where(CompanyArticle.id == article_id, CompanyArticle.contact_id == contact_id))
    article = r.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    await db.delete(article)
    await db.commit()
