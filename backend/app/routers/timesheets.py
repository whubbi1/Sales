# backend/app/routers/timesheets.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.timesheet import TimesheetEntry
from app.models.project import Project
from app.schemas.schemas import TimesheetEntryCreate, TimesheetEntryUpdate, TimesheetEntryResponse

router = APIRouter()


@router.get("/", response_model=List[TimesheetEntryResponse])
async def list_timesheet_entries(
    user_email: str = None, project_id: UUID = None,
    date_from: str = None, date_to: str = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(TimesheetEntry)
    if user_email:
        query = query.where(TimesheetEntry.user_email == user_email)
    if project_id:
        query = query.where(TimesheetEntry.project_id == project_id)
    if date_from:
        query = query.where(TimesheetEntry.entry_date >= date_from)
    if date_to:
        query = query.where(TimesheetEntry.entry_date <= date_to)
    query = query.order_by(TimesheetEntry.entry_date.desc())
    r = await db.execute(query)
    return r.scalars().all()


@router.post("/", response_model=TimesheetEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_timesheet_entry(data: TimesheetEntryCreate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Project.id).where(Project.id == data.project_id))
    if not r.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")
    row = TimesheetEntry(**data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.put("/{entry_id}", response_model=TimesheetEntryResponse)
async def update_timesheet_entry(entry_id: UUID, data: TimesheetEntryUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(TimesheetEntry).where(TimesheetEntry.id == entry_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Timesheet entry not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_timesheet_entry(entry_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(TimesheetEntry).where(TimesheetEntry.id == entry_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Timesheet entry not found")
    await db.delete(row)
    await db.commit()
