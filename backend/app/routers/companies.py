# backend/app/routers/companies.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.company import Company, CompanyNote, CompanyArticle, CompanyTask
from app.models.contact import Contact
from app.models.opportunity import Opportunity
from app.schemas.schemas import (
    CompanyCreate, CompanyUpdate, CompanyResponse, CompanySummary,
    NoteCreate, NoteResponse, ArticleCreate, ArticleResponse,
    TaskCreate, TaskUpdate, TaskResponse, ContactSummary, OpportunitySummary
)

router = APIRouter()


async def _attach_main_contacts(db: AsyncSession, companies: list):
    # main_contact isn't an ORM relationship (kept as a plain FK to avoid a backref collision
    # with Contact.company) — attach it as a transient instance attribute instead, same trick
    # already used for Opportunity/Contact's .partner this session.
    ids = {c.main_contact_id for c in companies if getattr(c, "main_contact_id", None)}
    contacts = {}
    if ids:
        r = await db.execute(select(Contact).where(Contact.id.in_(ids)))
        for contact in r.scalars().all():
            contacts[contact.id] = contact
    for c in companies:
        c.main_contact = contacts.get(c.main_contact_id) if getattr(c, "main_contact_id", None) else None


@router.get("/", response_model=List[CompanyResponse])
async def list_companies(
    skip: int = 0, limit: int = 100,
    status: str = None, search: str = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Company).options(selectinload(Company.parent), selectinload(Company.children))
    if status:
        query = query.where(Company.status == status)
    if search:
        query = query.where(or_(Company.name.ilike(f"%{search}%"), Company.contact_name.ilike(f"%{search}%")))
    query = query.offset(skip).limit(limit).order_by(Company.level, Company.name)
    result = await db.execute(query)
    companies = result.scalars().all()
    await _attach_main_contacts(db, companies)
    return companies

@router.post("/", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(company: CompanyCreate, db: AsyncSession = Depends(get_db)):
    level = 1
    if company.parent_id:
        r = await db.execute(select(Company).where(Company.id == company.parent_id))
        parent = r.scalar_one_or_none()
        if parent:
            level = min(parent.level + 1, 4)
    data = company.model_dump()
    data['level'] = level
    db_company = Company(**data)
    db.add(db_company)
    await db.commit()
    r = await db.execute(select(Company).options(selectinload(Company.parent), selectinload(Company.children)).where(Company.id == db_company.id))
    row = r.scalar_one()
    await _attach_main_contacts(db, [row])
    return row

@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(company_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Company).options(selectinload(Company.parent), selectinload(Company.children)).where(Company.id == company_id))
    company = r.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    await _attach_main_contacts(db, [company])
    return company

@router.put("/{company_id}", response_model=CompanyResponse)
async def update_company(company_id: UUID, data: CompanyUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Company).where(Company.id == company_id))
    company = r.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    update_data = data.model_dump(exclude_unset=True)
    if 'parent_id' in update_data and update_data['parent_id']:
        pr = await db.execute(select(Company).where(Company.id == update_data['parent_id']))
        parent = pr.scalar_one_or_none()
        if parent:
            update_data['level'] = min(parent.level + 1, 4)
    for k, v in update_data.items():
        setattr(company, k, v)
    await db.commit()
    r = await db.execute(select(Company).options(selectinload(Company.parent), selectinload(Company.children)).where(Company.id == company_id))
    row = r.scalar_one()
    await _attach_main_contacts(db, [row])
    return row

@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(company_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Company).where(Company.id == company_id))
    company = r.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    await db.delete(company)
    await db.commit()

# ─── Related records ──────────────────────────────────────────────────────────
@router.get("/{company_id}/contacts", response_model=List[ContactSummary])
async def get_company_contacts(company_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Contact).where(Contact.company_id == company_id))
    return r.scalars().all()

@router.get("/{company_id}/opportunities", response_model=List[OpportunitySummary])
async def get_company_opportunities(company_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Opportunity).where(Opportunity.company_id == company_id))
    return r.scalars().all()

# ─── Notes ────────────────────────────────────────────────────────────────────
@router.get("/{company_id}/notes", response_model=List[NoteResponse])
async def list_notes(company_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(CompanyNote).where(CompanyNote.company_id == company_id).order_by(CompanyNote.created_at.desc()))
    return r.scalars().all()

@router.post("/{company_id}/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(company_id: UUID, note: NoteCreate, db: AsyncSession = Depends(get_db)):
    db_note = CompanyNote(company_id=company_id, **note.model_dump())
    db.add(db_note)
    await db.commit()
    await db.refresh(db_note)
    return db_note

@router.delete("/{company_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(company_id: UUID, note_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(CompanyNote).where(CompanyNote.id == note_id, CompanyNote.company_id == company_id))
    note = r.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.delete(note)
    await db.commit()

# ─── Articles ─────────────────────────────────────────────────────────────────
@router.get("/{company_id}/articles", response_model=List[ArticleResponse])
async def list_articles(company_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(CompanyArticle).where(CompanyArticle.company_id == company_id).order_by(CompanyArticle.created_at.desc()))
    return r.scalars().all()

@router.post("/{company_id}/articles", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(company_id: UUID, article: ArticleCreate, db: AsyncSession = Depends(get_db)):
    db_article = CompanyArticle(company_id=company_id, **article.model_dump())
    db.add(db_article)
    await db.commit()
    await db.refresh(db_article)
    return db_article

@router.delete("/{company_id}/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_article(company_id: UUID, article_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(CompanyArticle).where(CompanyArticle.id == article_id, CompanyArticle.company_id == company_id))
    article = r.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    await db.delete(article)
    await db.commit()

# ─── Tasks ────────────────────────────────────────────────────────────────────
@router.get("/{company_id}/tasks", response_model=List[TaskResponse])
async def list_tasks(company_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(CompanyTask).where(CompanyTask.company_id == company_id).order_by(CompanyTask.due_date.asc()))
    return r.scalars().all()

@router.post("/{company_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(company_id: UUID, task: TaskCreate, db: AsyncSession = Depends(get_db)):
    db_task = CompanyTask(company_id=company_id, **task.model_dump())
    db.add(db_task)
    await db.commit()
    await db.refresh(db_task)
    return db_task

@router.put("/{company_id}/tasks/{task_id}", response_model=TaskResponse)
async def update_task(company_id: UUID, task_id: UUID, task_data: TaskUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(CompanyTask).where(CompanyTask.id == task_id, CompanyTask.company_id == company_id))
    task = r.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for k, v in task_data.model_dump(exclude_unset=True).items():
        setattr(task, k, v)
    await db.commit()
    await db.refresh(task)
    return task

@router.delete("/{company_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(company_id: UUID, task_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(CompanyTask).where(CompanyTask.id == task_id, CompanyTask.company_id == company_id))
    task = r.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    await db.commit()
