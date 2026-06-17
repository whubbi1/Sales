# backend/app/routers/clients.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.client import Client, ClientNote, ClientArticle, ClientTask
from app.schemas.client import (
    ClientCreate, ClientUpdate, ClientResponse, ClientSummary,
    NoteCreate, NoteResponse,
    ArticleCreate, ArticleResponse,
    TaskCreate, TaskUpdate, TaskResponse
)

router = APIRouter()

# ─── Clients ──────────────────────────────────────────────────────────────────
@router.get("/", response_model=List[ClientResponse])
async def list_clients(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    search: str = None,
    group_id: str = None,  # Filter by group (show all companies in same hierarchy)
    db: AsyncSession = Depends(get_db)
):
    query = select(Client).options(
        selectinload(Client.parent),
        selectinload(Client.children)
    )

    if status:
        query = query.where(Client.status == status)

    if search:
        query = query.where(
            or_(
                Client.company.ilike(f"%{search}%"),
                Client.name.ilike(f"%{search}%")
            )
        )

    if group_id:
        # Find root of the group and get all related companies
        root = await _get_root(group_id, db)
        group_ids = await _get_all_descendants(root, db)
        query = query.where(Client.id.in_(group_ids))

    query = query.offset(skip).limit(limit).order_by(Client.level, Client.company)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(client: ClientCreate, db: AsyncSession = Depends(get_db)):
    # Auto-set level based on parent
    if client.parent_id:
        parent_result = await db.execute(select(Client).where(Client.id == client.parent_id))
        parent = parent_result.scalar_one_or_none()
        if parent:
            level = min(parent.level + 1, 4)
        else:
            level = 1
    else:
        level = client.level or 1

    data = client.model_dump()
    data['level'] = level
    db_client = Client(**data)
    db.add(db_client)
    await db.commit()
    await db.refresh(db_client)

    # Reload with relationships
    result = await db.execute(
        select(Client).options(selectinload(Client.parent), selectinload(Client.children))
        .where(Client.id == db_client.id)
    )
    return result.scalar_one()

@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(client_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Client).options(selectinload(Client.parent), selectinload(Client.children))
        .where(Client.id == client_id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(client_id: UUID, client_data: ClientUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    data = client_data.model_dump(exclude_unset=True)

    # Recalculate level if parent changed
    if 'parent_id' in data and data['parent_id']:
        parent_result = await db.execute(select(Client).where(Client.id == data['parent_id']))
        parent = parent_result.scalar_one_or_none()
        if parent:
            data['level'] = min(parent.level + 1, 4)

    for key, value in data.items():
        setattr(client, key, value)

    await db.commit()

    result = await db.execute(
        select(Client).options(selectinload(Client.parent), selectinload(Client.children))
        .where(Client.id == client_id)
    )
    return result.scalar_one()

@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(client_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    await db.delete(client)
    await db.commit()

# ─── Hierarchy helpers ────────────────────────────────────────────────────────
async def _get_root(client_id: str, db: AsyncSession) -> Client:
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if client and client.parent_id:
        return await _get_root(str(client.parent_id), db)
    return client

async def _get_all_descendants(client: Client, db: AsyncSession) -> List[UUID]:
    ids = [client.id]
    result = await db.execute(select(Client).where(Client.parent_id == client.id))
    children = result.scalars().all()
    for child in children:
        ids.extend(await _get_all_descendants(child, db))
    return ids

# ─── Notes ────────────────────────────────────────────────────────────────────
@router.get("/{client_id}/notes", response_model=List[NoteResponse])
async def list_notes(client_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ClientNote).where(ClientNote.client_id == client_id).order_by(ClientNote.created_at.desc())
    )
    return result.scalars().all()

@router.post("/{client_id}/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(client_id: UUID, note: NoteCreate, db: AsyncSession = Depends(get_db)):
    db_note = ClientNote(client_id=client_id, **note.model_dump())
    db.add(db_note)
    await db.commit()
    await db.refresh(db_note)
    return db_note

@router.delete("/{client_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(client_id: UUID, note_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ClientNote).where(ClientNote.id == note_id, ClientNote.client_id == client_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.delete(note)
    await db.commit()

# ─── Articles ─────────────────────────────────────────────────────────────────
@router.get("/{client_id}/articles", response_model=List[ArticleResponse])
async def list_articles(client_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ClientArticle).where(ClientArticle.client_id == client_id).order_by(ClientArticle.created_at.desc())
    )
    return result.scalars().all()

@router.post("/{client_id}/articles", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(client_id: UUID, article: ArticleCreate, db: AsyncSession = Depends(get_db)):
    db_article = ClientArticle(client_id=client_id, **article.model_dump())
    db.add(db_article)
    await db.commit()
    await db.refresh(db_article)
    return db_article

@router.delete("/{client_id}/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_article(client_id: UUID, article_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ClientArticle).where(ClientArticle.id == article_id, ClientArticle.client_id == client_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    await db.delete(article)
    await db.commit()

# ─── Tasks ────────────────────────────────────────────────────────────────────
@router.get("/{client_id}/tasks", response_model=List[TaskResponse])
async def list_tasks(client_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ClientTask).where(ClientTask.client_id == client_id).order_by(ClientTask.due_date.asc())
    )
    return result.scalars().all()

@router.post("/{client_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(client_id: UUID, task: TaskCreate, db: AsyncSession = Depends(get_db)):
    db_task = ClientTask(client_id=client_id, **task.model_dump())
    db.add(db_task)
    await db.commit()
    await db.refresh(db_task)
    return db_task

@router.put("/{client_id}/tasks/{task_id}", response_model=TaskResponse)
async def update_task(client_id: UUID, task_id: UUID, task_data: TaskUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ClientTask).where(ClientTask.id == task_id, ClientTask.client_id == client_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for key, value in task_data.model_dump(exclude_unset=True).items():
        setattr(task, key, value)
    await db.commit()
    await db.refresh(task)
    return task

@router.delete("/{client_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(client_id: UUID, task_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ClientTask).where(ClientTask.id == task_id, ClientTask.client_id == client_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    await db.commit()
