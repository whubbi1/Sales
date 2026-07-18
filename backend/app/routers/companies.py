# backend/app/routers/companies.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
import os, httpx

from sqlalchemy import text as sql_text

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

from app.database import get_db
from app.models.company import Company, CompanyNote, CompanyArticle, CompanyTask
from app.models.contact import Contact
from app.models.opportunity import Opportunity

# Same open/won classification the Opportunities page already uses client-side
# (frontend/app/opportunities/page.tsx) — kept as literal status lists here rather
# than a shared constant, to avoid touching that page's already-working stat cards.
_LOST_OR_WON_STATUSES = ('Contract Lost', 'PO Received', 'Contract Finalised')
_WON_STATUSES = ('PO Received', 'Contract Finalised')
from app.schemas.schemas import (
    CompanyCreate, CompanyUpdate, CompanyResponse, CompanySummary,
    NoteCreate, NoteResponse, ArticleCreate, ArticleResponse,
    TaskCreate, TaskUpdate, TaskResponse, ContactSummary, OpportunitySummary
)
from app.services.ids import next_internal_id
from app.routers.hr import upload_to_s3, s3_ref_to_presigned

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


async def _attach_logos(companies: list):
    # Mutates the transient in-memory attribute only — safe here since none of this
    # router's read paths commit again after fetching, so the presigned value (unlike
    # the stored s3:// ref) never gets flushed back to the DB.
    for c in companies:
        if c.logo_url and c.logo_url.startswith("s3://"):
            c.logo_url = await s3_ref_to_presigned(c.logo_url)


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
    await _attach_logos(companies)
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
    data['internal_id'] = await next_internal_id(db, 'company_internal_id_seq', 'CMP')
    db_company = Company(**data)
    db.add(db_company)
    await db.commit()
    r = await db.execute(select(Company).options(selectinload(Company.parent), selectinload(Company.children)).where(Company.id == db_company.id))
    row = r.scalar_one()
    await _attach_main_contacts(db, [row])
    await _attach_logos([row])
    return row

# Must come before /{company_id} — otherwise FastAPI tries to parse "dashboard-stats"
# as a UUID for that route and 422s instead of falling through to this one.
@router.get("/dashboard-stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    # _LOST_OR_WON_STATUSES/_WON_STATUSES are fixed module-level constants (not user input),
    # so building the IN-clauses with literal values here is safe.
    lost_or_won_sql = ", ".join(f"'{s}'" for s in _LOST_OR_WON_STATUSES)
    won_sql = ", ".join(f"'{s}'" for s in _WON_STATUSES)
    r = await db.execute(sql_text(f"""
        SELECT
            (SELECT COUNT(*) FROM contacts) AS total_contacts,
            (SELECT COUNT(*) FROM opportunities WHERE deal_status NOT IN ({lost_or_won_sql})) AS open_count,
            (SELECT COALESCE(SUM(deal_amount), 0) FROM opportunities WHERE deal_status NOT IN ({lost_or_won_sql})) AS open_amount,
            (SELECT COUNT(*) FROM opportunities WHERE deal_status IN ({won_sql})) AS won_count,
            (SELECT COALESCE(SUM(deal_amount), 0) FROM opportunities WHERE deal_status IN ({won_sql})) AS won_amount
    """))
    row = r.fetchone()
    return {
        "total_contacts": row.total_contacts,
        "open_count": row.open_count,
        "open_amount": float(row.open_amount),
        "won_count": row.won_count,
        "won_amount": float(row.won_amount),
    }

# Shared by the Research tab's proxy endpoint below and the contact clean-up module's
# LinkedIn check (backend/app/routers/contact_cleanup.py) — one place doing the actual
# Claude+web_search call, both callers just build a prompt.
async def claude_web_search(prompt: str) -> str:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-6", "max_tokens": 1500,
                "tools": [{"type": "web_search_20250305", "name": "web_search"}],
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Claude API error {r.status_code}: {r.text[:200]}")
        d = r.json()
        return "\n".join(b["text"] for b in d.get("content", []) if b.get("type") == "text") or "No results found."


# Must also come before /{company_id} for the same reason as dashboard-stats above.
# Server-side proxy for the company Research tab's AI web search — the frontend previously
# called api.anthropic.com directly with no x-api-key header (would 401 every time); this
# does the actual call, same httpx/header shape as hr.py's existing Claude calls.
@router.post("/research")
async def research(data: dict):
    prompt = data.get("prompt", "")
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")
    result = await claude_web_search(prompt)
    return {"result": result}

# Must also come before /{company_id} for the same reason as dashboard-stats above.
@router.post("/linkedin-enrich")
async def linkedin_enrich_company(data: dict, db: AsyncSession = Depends(get_db)):
    import json
    url = (data.get("linkedin_url") or "").strip()
    company_id = (data.get("company_id") or "").strip() or None
    if not url:
        raise HTTPException(status_code=400, detail="linkedin_url is required")
    prompt = f"""Look up the public LinkedIn company page at this URL: {url}
Return ONLY a valid JSON object with this exact structure (use null for anything you can't find):
{{
  "name": "the company's name",
  "sector": "their industry",
  "country": "the country of their headquarters",
  "domain_names": ["their main website domain, no protocol, e.g. acme.com"],
  "employee_count": your best-guess total employee count as a single integer (not a range string),
  "logo_image_url": "a direct URL to the company's logo image if you can identify one, else null"
}}
Return ONLY the JSON, no markdown, no explanation."""
    text = await claude_web_search(prompt)
    try:
        cleaned = text.strip().replace("```json", "").replace("```", "").strip()
        result = json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=502, detail="Could not read company data from that LinkedIn URL")

    # Best-effort: only when editing an existing company (we need an id for the S3 key),
    # and only if it doesn't break the rest of the enrichment when it fails.
    logo_image_url = result.pop("logo_image_url", None)
    if company_id and logo_image_url:
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                img_resp = await client.get(logo_image_url)
            content_type = img_resp.headers.get("content-type", "")
            if img_resp.status_code == 200 and content_type.startswith("image/"):
                r = await db.execute(select(Company).where(Company.id == company_id))
                company = r.scalar_one_or_none()
                if company:
                    logo_ref = await upload_to_s3(f"companies/{company_id}/logo", img_resp.content, content_type)
                    company.logo_url = logo_ref
                    await db.commit()
                    result["logo_url"] = await s3_ref_to_presigned(logo_ref)
        except Exception:
            pass
    return result

@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(company_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Company).options(selectinload(Company.parent), selectinload(Company.children)).where(Company.id == company_id))
    company = r.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    await _attach_main_contacts(db, [company])
    await _attach_logos([company])
    return company

@router.post("/{company_id}/logo")
async def upload_company_logo(company_id: UUID, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Company).where(Company.id == company_id))
    company = r.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    content = await file.read()
    logo_ref = await upload_to_s3(f"companies/{company_id}/logo", content, file.content_type or "application/octet-stream")
    company.logo_url = logo_ref
    await db.commit()
    return {"status": "ok", "logo_url": await s3_ref_to_presigned(logo_ref)}

# Best-effort AI web search for people at this company holding one of the given job
# functions — results are returned for review only, never written to the DB directly;
# the frontend lets the user pick which (if any) to actually create as Contacts.
@router.post("/{company_id}/linkedin-people-search")
async def linkedin_people_search(company_id: UUID, data: dict, db: AsyncSession = Depends(get_db)):
    import json
    job_functions = data.get("job_functions") or []
    if not job_functions:
        raise HTTPException(status_code=400, detail="job_functions is required")
    r = await db.execute(select(Company).where(Company.id == company_id))
    company = r.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    domains = ", ".join(company.domain_names or []) or "unknown domain"
    functions_list = ", ".join(job_functions)
    prompt = f"""Search LinkedIn for people currently working at the company "{company.name}" (website domain(s): {domains}) who hold one of these roles or functions: {functions_list}.
Return ONLY a JSON array (no markdown, no prose) of up to 15 distinct people, each shaped exactly like this:
{{"first_name": "...", "last_name": "...", "job_title": "...", "location": "...", "linkedin_url": "https://www.linkedin.com/in/..."}}
Only include people you're reasonably confident are real, current employees with a real LinkedIn profile URL. If you can't find anyone for a given role, just omit it. Return ONLY the JSON array, nothing else."""
    text_result = await claude_web_search(prompt)
    try:
        cleaned = text_result.strip().replace("```json", "").replace("```", "").strip()
        results = json.loads(cleaned)
        if not isinstance(results, list):
            raise ValueError("not a list")
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=502, detail="Could not read LinkedIn search results")

    cleaned_results = [
        item for item in results
        if isinstance(item, dict) and item.get("first_name") and item.get("last_name") and item.get("linkedin_url")
    ][:15]
    return {"results": cleaned_results}

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
    await _attach_logos([row])
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
# An article's `company_id` is the company it was originally created under (kept so this
# query, and every other pre-existing caller, keeps working unchanged); `article_companies`
# is purely additive, for linking the same article to other companies afterward.
@router.get("/{company_id}/articles", response_model=List[ArticleResponse])
async def list_articles(company_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(sql_text("""
        SELECT * FROM (
            SELECT a.*, a.created_at AS link_date FROM company_articles a WHERE a.company_id = :cid
            UNION
            SELECT a.*, ac.linked_at AS link_date FROM company_articles a
            JOIN article_companies ac ON ac.article_id = a.id
            WHERE ac.company_id = :cid
        ) sub ORDER BY link_date DESC
    """), {"cid": str(company_id)})
    return [dict(row._mapping) for row in r.fetchall()]

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

# Additional company/contact/partner links for an article, beyond whichever it was created under.
@router.get("/articles/{article_id}/links")
async def get_article_links(article_id: UUID, db: AsyncSession = Depends(get_db)):
    companies_r = await db.execute(sql_text("""
        SELECT c.id, c.name FROM article_companies ac JOIN companies c ON c.id = ac.company_id WHERE ac.article_id = :aid
    """), {"aid": str(article_id)})
    contacts_r = await db.execute(sql_text("""
        SELECT ct.id, ct.first_name, ct.last_name FROM article_contacts ac JOIN contacts ct ON ct.id = ac.contact_id WHERE ac.article_id = :aid
    """), {"aid": str(article_id)})
    partners_r = await db.execute(sql_text("""
        SELECT p.id, p.name FROM article_partners ap JOIN partners p ON p.id = ap.partner_id WHERE ap.article_id = :aid
    """), {"aid": str(article_id)})
    return {
        "companies": [{"id": str(row.id), "name": row.name} for row in companies_r.fetchall()],
        "contacts": [{"id": str(row.id), "name": f"{row.first_name} {row.last_name}"} for row in contacts_r.fetchall()],
        "partners": [{"id": str(row.id), "name": row.name} for row in partners_r.fetchall()],
    }

@router.post("/articles/{article_id}/companies/{company_id}")
async def link_article_company(article_id: UUID, company_id: UUID, db: AsyncSession = Depends(get_db)):
    exists = await db.execute(sql_text("SELECT 1 FROM article_companies WHERE article_id = :aid AND company_id = :cid"), {"aid": str(article_id), "cid": str(company_id)})
    if not exists.first():
        await db.execute(sql_text("INSERT INTO article_companies (article_id, company_id) VALUES (:aid, :cid)"), {"aid": str(article_id), "cid": str(company_id)})
        await db.commit()
    return {"status": "ok"}

@router.delete("/articles/{article_id}/companies/{company_id}")
async def unlink_article_company(article_id: UUID, company_id: UUID, db: AsyncSession = Depends(get_db)):
    await db.execute(sql_text("DELETE FROM article_companies WHERE article_id = :aid AND company_id = :cid"), {"aid": str(article_id), "cid": str(company_id)})
    await db.commit()
    return {"status": "ok"}

@router.post("/articles/{article_id}/contacts/{contact_id}")
async def link_article_contact(article_id: UUID, contact_id: UUID, db: AsyncSession = Depends(get_db)):
    exists = await db.execute(sql_text("SELECT 1 FROM article_contacts WHERE article_id = :aid AND contact_id = :cid"), {"aid": str(article_id), "cid": str(contact_id)})
    if not exists.first():
        await db.execute(sql_text("INSERT INTO article_contacts (article_id, contact_id) VALUES (:aid, :cid)"), {"aid": str(article_id), "cid": str(contact_id)})
        await db.commit()
    return {"status": "ok"}

@router.delete("/articles/{article_id}/contacts/{contact_id}")
async def unlink_article_contact(article_id: UUID, contact_id: UUID, db: AsyncSession = Depends(get_db)):
    await db.execute(sql_text("DELETE FROM article_contacts WHERE article_id = :aid AND contact_id = :cid"), {"aid": str(article_id), "cid": str(contact_id)})
    await db.commit()

@router.post("/articles/{article_id}/partners/{partner_id}")
async def link_article_partner(article_id: UUID, partner_id: UUID, db: AsyncSession = Depends(get_db)):
    exists = await db.execute(sql_text("SELECT 1 FROM article_partners WHERE article_id = :aid AND partner_id = :pid"), {"aid": str(article_id), "pid": str(partner_id)})
    if not exists.first():
        await db.execute(sql_text("INSERT INTO article_partners (article_id, partner_id) VALUES (:aid, :pid)"), {"aid": str(article_id), "pid": str(partner_id)})
        await db.commit()
    return {"status": "ok"}

@router.delete("/articles/{article_id}/partners/{partner_id}")
async def unlink_article_partner(article_id: UUID, partner_id: UUID, db: AsyncSession = Depends(get_db)):
    await db.execute(sql_text("DELETE FROM article_partners WHERE article_id = :aid AND partner_id = :pid"), {"aid": str(article_id), "pid": str(partner_id)})
    await db.commit()
    return {"status": "ok"}

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
