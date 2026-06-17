# backend/app/routers/contacts.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.contact import Contact
from app.models.opportunity import Opportunity
from app.schemas.schemas import ContactCreate, ContactUpdate, ContactResponse, ContactSummary, OpportunitySummary

router = APIRouter()

@router.get("/", response_model=List[ContactResponse])
async def list_contacts(
    skip: int = 0, limit: int = 100,
    search: str = None, company_id: str = None,
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
    query = query.offset(skip).limit(limit).order_by(Contact.last_name, Contact.first_name)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(contact: ContactCreate, db: AsyncSession = Depends(get_db)):
    db_contact = Contact(**contact.model_dump())
    db.add(db_contact)
    await db.commit()
    r = await db.execute(select(Contact).options(selectinload(Contact.company)).where(Contact.id == db_contact.id))
    return r.scalar_one()

@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(contact_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Contact).options(selectinload(Contact.company), selectinload(Contact.opportunities)).where(Contact.id == contact_id))
    contact = r.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
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
    return r.scalar_one()

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
