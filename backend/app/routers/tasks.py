# backend/app/routers/tasks.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.database import get_db
from app.authz import require_permission
from app.models.opportunity_extra import SalesTask
from app.schemas.schemas import SalesTaskCreate, SalesTaskUpdate, SalesTaskResponse

router = APIRouter()

# NOTE: despite the filename, this is the legacy Sales-module task list (SalesTask /
# sales_tasks table), a different thing from the unified Task Manager in
# task_manager.py (which owns the `tasks` DB table and the "tasks" MODULES key).
# This one belongs to MODULES["sales"] = [..., "tasks", ...] — gated as ("sales","tasks").

@router.get("/", response_model=List[SalesTaskResponse])
async def list_tasks(
    entity_type: str = None, entity_id: UUID = None,
    owner_email: str = None, status_filter: str = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_permission("sales", "tasks", "view")),
):
    query = select(SalesTask)
    if entity_type:
        query = query.where(SalesTask.entity_type == entity_type)
    if entity_id:
        query = query.where(SalesTask.entity_id == entity_id)
    if owner_email:
        query = query.where(SalesTask.owner_email == owner_email)
    if status_filter:
        query = query.where(SalesTask.status == status_filter)
    query = query.order_by(SalesTask.due_date.asc().nulls_last(), SalesTask.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=SalesTaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(task: SalesTaskCreate, db: AsyncSession = Depends(get_db), _: str = Depends(require_permission("sales", "tasks", "edit"))):
    db_task = SalesTask(**task.model_dump())
    db.add(db_task)
    await db.commit()
    await db.refresh(db_task)
    return db_task

@router.get("/{task_id}", response_model=SalesTaskResponse)
async def get_task(task_id: UUID, db: AsyncSession = Depends(get_db), _: str = Depends(require_permission("sales", "tasks", "view"))):
    r = await db.execute(select(SalesTask).where(SalesTask.id == task_id))
    task = r.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.put("/{task_id}", response_model=SalesTaskResponse)
async def update_task(task_id: UUID, data: SalesTaskUpdate, db: AsyncSession = Depends(get_db), _: str = Depends(require_permission("sales", "tasks", "edit"))):
    r = await db.execute(select(SalesTask).where(SalesTask.id == task_id))
    task = r.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(task, k, v)
    await db.commit()
    await db.refresh(task)
    return task

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: UUID, db: AsyncSession = Depends(get_db), _: str = Depends(require_permission("sales", "tasks", "edit"))):
    r = await db.execute(select(SalesTask).where(SalesTask.id == task_id))
    task = r.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    await db.commit()
