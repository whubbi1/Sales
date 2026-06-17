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
from app.schemas.schemas import OpportunityCreate, OpportunityUpdate, OpportunityResponse, OpportunitySummary

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
