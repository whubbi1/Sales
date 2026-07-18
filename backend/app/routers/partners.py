# backend/app/routers/partners.py
# Partners — same information as a Company, plus flat action items (each targeting a
# company/contact with an owner; an internal wcomply owner auto-creates a Task Manager task).
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.services.ids import next_internal_id
from app.routers.hr import upload_to_s3, s3_ref_to_presigned
from app.routers.companies import claude_web_search
import uuid, json, re, html
import httpx

router = APIRouter()

PARTNER_FIELDS = [
    "name", "contact_name", "main_contact_id", "domain_names", "phone", "sector", "country", "status",
    "main_erp", "cybersecurity_solutions", "sap_hosting_partner", "linkedin_url", "employee_count", "logo_url",
    "notes", "assigned_to", "assigned_to_email",
]

_PARTNER_SELECT = """
    SELECT p.*, c.first_name AS main_contact_first_name, c.last_name AS main_contact_last_name
    FROM partners p LEFT JOIN contacts c ON c.id = p.main_contact_id
"""


def _row(d: dict) -> dict:
    for k, v in d.items():
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
    return d


async def _attach_logo(partner: dict):
    # Mirrors companies.py's _attach_logos — resolves the stored s3:// ref to a presigned
    # URL for reading only, never re-persisted.
    if partner.get("logo_url") and partner["logo_url"].startswith("s3://"):
        partner["logo_url"] = await s3_ref_to_presigned(partner["logo_url"])
    return partner


async def _get_partner(db: AsyncSession, partner_id: str) -> dict | None:
    # Raw (s3:// ref, not presigned) — used both to return read responses (after
    # _attach_logo) and to seed update_partner's merge, where it must stay the durable
    # ref rather than an expiring presigned URL that would otherwise get written back.
    r = await db.execute(text(f"{_PARTNER_SELECT} WHERE p.id = CAST(:id AS UUID)"), {"id": partner_id})
    row = r.fetchone()
    return _row(dict(row._mapping)) if row else None


# ─── Partner CRUD ────────────────────────────────────────────────────────────────
@router.get("/")
async def list_partners(search: str = None, db: AsyncSession = Depends(get_db)):
    where = ""
    params = {}
    if search:
        where = "WHERE p.name ILIKE :q OR p.contact_name ILIKE :q"
        params["q"] = f"%{search}%"
    r = await db.execute(text(f"{_PARTNER_SELECT} {where} ORDER BY p.name"), params)
    return [await _attach_logo(_row(dict(row._mapping))) for row in r.fetchall()]


@router.post("/")
async def create_partner(data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="name is required")
    partner_id = str(uuid.uuid4())
    internal_id = await next_internal_id(db, 'partner_internal_id_seq', 'PTN')
    await db.execute(text("""
        INSERT INTO partners (id, internal_id, name, contact_name, main_contact_id, domain_names, phone, sector, country, status,
                               main_erp, cybersecurity_solutions, sap_hosting_partner, linkedin_url, employee_count, logo_url, notes,
                               assigned_to, assigned_to_email, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :internal_id, :name, :contact_name, CAST(NULLIF(:main_contact_id,'') AS UUID),
                CAST(:domain_names AS JSONB), :phone, :sector, :country, :status,
                CAST(:main_erp AS JSONB), CAST(:cybersecurity_solutions AS JSONB), CAST(:sap_hosting_partner AS JSONB),
                :linkedin_url, :employee_count, :logo_url, :notes, :assigned_to, :assigned_to_email, NOW(), NOW())
    """), {
        "id": partner_id, "internal_id": internal_id,
        "name": data["name"], "contact_name": data.get("contact_name"),
        "main_contact_id": data.get("main_contact_id") or "",
        "domain_names": json.dumps(data.get("domain_names") or []),
        "phone": data.get("phone"), "sector": data.get("sector"), "country": data.get("country"),
        "status": data.get("status") or "active",
        "main_erp": json.dumps(data.get("main_erp") or []),
        "cybersecurity_solutions": json.dumps(data.get("cybersecurity_solutions") or []),
        "sap_hosting_partner": json.dumps(data.get("sap_hosting_partner") or []),
        "linkedin_url": data.get("linkedin_url"), "employee_count": data.get("employee_count"), "logo_url": data.get("logo_url"),
        "notes": data.get("notes"),
        "assigned_to": data.get("assigned_to"), "assigned_to_email": data.get("assigned_to_email"),
    })
    await db.commit()
    return await _attach_logo(await _get_partner(db, partner_id))


@router.get("/{partner_id}")
async def get_partner(partner_id: str, db: AsyncSession = Depends(get_db)):
    partner = await _get_partner(db, partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return await _attach_logo(partner)


@router.put("/{partner_id}")
async def update_partner(partner_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    partner = await _get_partner(db, partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    merged = {**partner, **{k: v for k, v in data.items() if k in PARTNER_FIELDS}}
    await db.execute(text("""
        UPDATE partners SET name=:name, contact_name=:contact_name,
            main_contact_id=CAST(NULLIF(:main_contact_id,'') AS UUID), domain_names=CAST(:domain_names AS JSONB),
            phone=:phone, sector=:sector, country=:country, status=:status,
            main_erp=CAST(:main_erp AS JSONB), cybersecurity_solutions=CAST(:cybersecurity_solutions AS JSONB),
            sap_hosting_partner=CAST(:sap_hosting_partner AS JSONB), linkedin_url=:linkedin_url,
            employee_count=:employee_count, logo_url=:logo_url,
            notes=:notes, assigned_to=:assigned_to, assigned_to_email=:assigned_to_email, updated_at=NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": partner_id, "name": merged["name"], "contact_name": merged.get("contact_name"),
        "main_contact_id": merged.get("main_contact_id") or "",
        "domain_names": json.dumps(merged.get("domain_names") or []),
        "phone": merged.get("phone"), "sector": merged.get("sector"), "country": merged.get("country"),
        "status": merged.get("status") or "active",
        "main_erp": json.dumps(merged.get("main_erp") or []),
        "cybersecurity_solutions": json.dumps(merged.get("cybersecurity_solutions") or []),
        "sap_hosting_partner": json.dumps(merged.get("sap_hosting_partner") or []),
        "linkedin_url": merged.get("linkedin_url"), "employee_count": merged.get("employee_count"), "logo_url": merged.get("logo_url"),
        "notes": merged.get("notes"),
        "assigned_to": merged.get("assigned_to"), "assigned_to_email": merged.get("assigned_to_email"),
    })
    await db.commit()
    return await _attach_logo(await _get_partner(db, partner_id))


@router.post("/{partner_id}/logo")
async def upload_partner_logo(partner_id: str, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    partner = await _get_partner(db, partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    content = await file.read()
    logo_ref = await upload_to_s3(f"partners/{partner_id}/logo", content, file.content_type or "application/octet-stream")
    await db.execute(text("UPDATE partners SET logo_url = :logo_url, updated_at = NOW() WHERE id = CAST(:id AS UUID)"),
                      {"logo_url": logo_ref, "id": partner_id})
    await db.commit()
    return {"status": "ok", "logo_url": await s3_ref_to_presigned(logo_ref)}


# Must come before /{partner_id} for the same reason as companies.py's equivalent routes —
# otherwise FastAPI tries (and fails) to parse "linkedin-enrich" as a partner_id.
@router.post("/linkedin-enrich")
async def linkedin_enrich_partner(data: dict, db: AsyncSession = Depends(get_db)):
    import json
    url = (data.get("linkedin_url") or "").strip()
    partner_id = (data.get("partner_id") or "").strip() or None
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
    text_result = await claude_web_search(prompt)
    try:
        cleaned = text_result.strip().replace("```json", "").replace("```", "").strip()
        result = json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=502, detail="Could not read company data from that LinkedIn URL")

    logo_image_url = result.pop("logo_image_url", None)
    if partner_id and logo_image_url:
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                img_resp = await client.get(logo_image_url)
            content_type = img_resp.headers.get("content-type", "")
            if img_resp.status_code == 200 and content_type.startswith("image/"):
                logo_ref = await upload_to_s3(f"partners/{partner_id}/logo", img_resp.content, content_type)
                await db.execute(text("UPDATE partners SET logo_url = :logo_url, updated_at = NOW() WHERE id = CAST(:id AS UUID)"),
                                  {"logo_url": logo_ref, "id": partner_id})
                await db.commit()
                result["logo_url"] = await s3_ref_to_presigned(logo_ref)
        except Exception:
            pass
    return result


@router.delete("/{partner_id}")
async def delete_partner(partner_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM partners WHERE id = CAST(:id AS UUID)"), {"id": partner_id})
    await db.commit()
    return {"status": "ok"}


# ─── Related records ─────────────────────────────────────────────────────────────
@router.get("/{partner_id}/contacts")
async def get_partner_contacts(partner_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM contacts WHERE partner_id = CAST(:id AS UUID)"), {"id": partner_id})
    return [_row(dict(row._mapping)) for row in r.fetchall()]


@router.get("/{partner_id}/opportunities")
async def get_partner_opportunities(partner_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM opportunities WHERE partner_id = CAST(:id AS UUID)"), {"id": partner_id})
    return [_row(dict(row._mapping)) for row in r.fetchall()]


@router.get("/{partner_id}/leads")
async def get_partner_leads(partner_id: str, db: AsyncSession = Depends(get_db)):
    # A Lead can involve more than one Partner (lead_partners is many-to-many) — join
    # rather than a plain partner_id column like Opportunity's.
    r = await db.execute(text("""
        SELECT l.* FROM leads l
        JOIN lead_partners lp ON lp.lead_id = l.id
        WHERE lp.partner_id = CAST(:id AS UUID)
        ORDER BY l.created_at DESC
    """), {"id": partner_id})
    return [_row(dict(row._mapping)) for row in r.fetchall()]


# ─── Action items — flat, each optionally auto-creates a Task Manager task ──────
@router.get("/{partner_id}/action-items")
async def list_action_items(partner_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT a.*, c.name AS company_name, ct.first_name AS contact_first_name, ct.last_name AS contact_last_name
        FROM partner_action_items a
        LEFT JOIN companies c ON c.id = a.company_id
        LEFT JOIN contacts ct ON ct.id = a.contact_id
        WHERE a.partner_id = CAST(:id AS UUID)
        ORDER BY a.created_at DESC
    """), {"id": partner_id})
    return [_row(dict(row._mapping)) for row in r.fetchall()]


async def _maybe_create_task(db: AsyncSession, item_id: str, partner_id: str, title: str,
                              description: str, owner_email: str, owner_name: str, created_by_email: str) -> str | None:
    if not owner_email or not owner_email.lower().endswith("@wcomply.com"):
        return None
    from app.routers.task_manager import create_task
    created = await create_task({
        "title": title, "description": description or "",
        "owner_email": owner_email, "owner_name": owner_name,
        "source": "partner_action", "entity_type": "partner_action_item", "entity_id": item_id,
        "created_by_email": created_by_email or owner_email, "acting_email": created_by_email or owner_email,
    }, db)
    return created["id"]


@router.post("/{partner_id}/action-items")
async def create_action_item(partner_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("title"):
        raise HTTPException(status_code=400, detail="title is required")
    item_id = str(uuid.uuid4())
    owner_email = data.get("owner_email") or ""
    task_id = await _maybe_create_task(
        db, item_id, partner_id, data["title"], data.get("description", ""),
        owner_email, data.get("owner_name") or "", data.get("created_by_email") or "",
    )
    await db.execute(text("""
        INSERT INTO partner_action_items (id, partner_id, title, description, company_id, contact_id,
                                           owner_email, owner_name, due_date, status, task_id, created_by_email,
                                           created_at, updated_at)
        VALUES (CAST(:id AS UUID), CAST(:pid AS UUID), :title, :description,
                CAST(NULLIF(:company_id,'') AS UUID), CAST(NULLIF(:contact_id,'') AS UUID),
                :owner_email, :owner_name, CAST(NULLIF(:due_date,'') AS DATE), :status,
                CAST(:task_id AS UUID), :created_by_email, NOW(), NOW())
    """), {
        "id": item_id, "pid": partner_id, "title": data["title"], "description": data.get("description", ""),
        "company_id": data.get("company_id") or "", "contact_id": data.get("contact_id") or "",
        "owner_email": owner_email, "owner_name": data.get("owner_name", ""),
        "due_date": data.get("due_date") or "", "status": data.get("status") or "open",
        "task_id": task_id, "created_by_email": data.get("created_by_email", ""),
    })
    await db.commit()
    r = await db.execute(text("SELECT * FROM partner_action_items WHERE id = CAST(:id AS UUID)"), {"id": item_id})
    return _row(dict(r.fetchone()._mapping))


@router.put("/{partner_id}/action-items/{item_id}")
async def update_action_item(partner_id: str, item_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM partner_action_items WHERE id = CAST(:id AS UUID) AND partner_id = CAST(:pid AS UUID)"),
                          {"id": item_id, "pid": partner_id})
    row = r.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Action item not found")
    item = _row(dict(row._mapping))

    new_owner = data.get("owner_email", item.get("owner_email") or "")
    task_id = item.get("task_id")
    if new_owner != (item.get("owner_email") or "") and not task_id:
        task_id = await _maybe_create_task(
            db, item_id, partner_id, data.get("title", item["title"]), data.get("description", item.get("description", "")),
            new_owner, data.get("owner_name", item.get("owner_name") or ""), item.get("created_by_email") or "",
        )

    # company_id/contact_id: resolve in Python rather than SQL COALESCE, so that omitting the key
    # (e.g. cycleStatus/saveTitle only send {status}/{title}) keeps the existing value, while an
    # explicit "" (the edit modal's "No company"/"No contact" option) actually clears it to NULL.
    company_id = data["company_id"] if "company_id" in data else (item.get("company_id") or "")
    contact_id = data["contact_id"] if "contact_id" in data else (item.get("contact_id") or "")

    await db.execute(text("""
        UPDATE partner_action_items SET
            title = COALESCE(NULLIF(:title,''), title),
            description = COALESCE(:description, description),
            company_id = CAST(NULLIF(:company_id,'') AS UUID),
            contact_id = CAST(NULLIF(:contact_id,'') AS UUID),
            owner_email = :owner_email, owner_name = COALESCE(:owner_name, owner_name),
            due_date = COALESCE(CAST(NULLIF(:due_date,'') AS DATE), due_date),
            status = COALESCE(NULLIF(:status,''), status),
            task_id = CAST(:task_id AS UUID),
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": item_id, "title": data.get("title", ""), "description": data.get("description"),
        "company_id": company_id, "contact_id": contact_id,
        "owner_email": new_owner, "owner_name": data.get("owner_name"),
        "due_date": data.get("due_date", ""), "status": data.get("status", ""), "task_id": task_id,
    })
    await db.commit()
    r = await db.execute(text("SELECT * FROM partner_action_items WHERE id = CAST(:id AS UUID)"), {"id": item_id})
    return _row(dict(r.fetchone()._mapping))


@router.delete("/{partner_id}/action-items/{item_id}")
async def delete_action_item(partner_id: str, item_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM partner_action_items WHERE id = CAST(:id AS UUID) AND partner_id = CAST(:pid AS UUID)"),
                      {"id": item_id, "pid": partner_id})
    await db.commit()
    return {"status": "ok"}


# ─── Comments (Overview tab) ──────────────────────────────────────────────────────
@router.get("/{partner_id}/comments")
async def list_comments(partner_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT * FROM partner_comments WHERE partner_id = CAST(:id AS UUID) ORDER BY created_at DESC
    """), {"id": partner_id})
    return [_row(dict(row._mapping)) for row in r.fetchall()]


@router.post("/{partner_id}/comments")
async def add_comment(partner_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("comment"):
        raise HTTPException(status_code=400, detail="comment is required")
    comment_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO partner_comments (id, partner_id, author_email, author_name, comment, created_at)
        VALUES (CAST(:id AS UUID), CAST(:pid AS UUID), :author_email, :author_name, :comment, NOW())
    """), {"id": comment_id, "pid": partner_id, "author_email": data.get("author_email", ""),
           "author_name": data.get("author_name", ""), "comment": data["comment"]})
    await db.commit()
    return {"status": "ok", "id": comment_id}


@router.delete("/{partner_id}/comments/{comment_id}")
async def delete_comment(partner_id: str, comment_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM partner_comments WHERE id = CAST(:id AS UUID) AND partner_id = CAST(:pid AS UUID)"),
                      {"id": comment_id, "pid": partner_id})
    await db.commit()
    return {"status": "ok"}


# ─── Information — pasted links, title/description auto-fetched server-side ────
async def _fetch_link_metadata(url: str) -> tuple[str, str]:
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; WhubbiBot/1.0)"})
            body = resp.text[:200000]
    except Exception:
        return "", ""
    title = ""
    m = re.search(r"<title[^>]*>(.*?)</title>", body, re.IGNORECASE | re.DOTALL)
    if m:
        title = html.unescape(re.sub(r"\s+", " ", m.group(1)).strip())
    description = ""
    for pattern in (
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']',
        r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\'](.*?)["\']',
        r'<meta[^>]+content=["\'](.*?)["\'][^>]+name=["\']description["\']',
    ):
        m = re.search(pattern, body, re.IGNORECASE | re.DOTALL)
        if m:
            description = html.unescape(re.sub(r"\s+", " ", m.group(1)).strip())
            break
    return title[:500], description


@router.get("/{partner_id}/links")
async def list_links(partner_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT * FROM partner_links WHERE partner_id = CAST(:id AS UUID) ORDER BY created_at DESC
    """), {"id": partner_id})
    return [_row(dict(row._mapping)) for row in r.fetchall()]


@router.post("/{partner_id}/links")
async def add_link(partner_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("url"):
        raise HTTPException(status_code=400, detail="url is required")
    title, description = await _fetch_link_metadata(data["url"])
    link_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO partner_links (id, partner_id, url, title, description, added_by_email, created_at)
        VALUES (CAST(:id AS UUID), CAST(:pid AS UUID), :url, :title, :description, :by, NOW())
    """), {"id": link_id, "pid": partner_id, "url": data["url"], "title": title, "description": description,
           "by": data.get("added_by_email", "")})
    await db.commit()
    return {"id": link_id, "url": data["url"], "title": title, "description": description}


@router.delete("/{partner_id}/links/{link_id}")
async def delete_link(partner_id: str, link_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM partner_links WHERE id = CAST(:id AS UUID) AND partner_id = CAST(:pid AS UUID)"),
                      {"id": link_id, "pid": partner_id})
    await db.commit()
    return {"status": "ok"}


# ─── Articles — shares company_articles/article_companies/article_contacts/
# article_partners with Companies and Contacts (see companies.py's Articles section)
# ────────────────────────────────────────────────────────────────────────────────
@router.get("/{partner_id}/articles")
async def list_partner_articles(partner_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT * FROM (
            SELECT a.*, a.created_at AS link_date FROM company_articles a WHERE a.partner_id = CAST(:pid AS UUID)
            UNION
            SELECT a.*, ap.linked_at AS link_date FROM company_articles a
            JOIN article_partners ap ON ap.article_id = a.id
            WHERE ap.partner_id = CAST(:pid AS UUID)
        ) sub ORDER BY link_date DESC
    """), {"pid": partner_id})
    return [_row(dict(row._mapping)) for row in r.fetchall()]


@router.post("/{partner_id}/articles")
async def create_partner_article(partner_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("title") or not data.get("url"):
        raise HTTPException(status_code=400, detail="title and url are required")
    article_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO company_articles (id, partner_id, title, url, description, created_by, created_at)
        VALUES (CAST(:id AS UUID), CAST(:pid AS UUID), :title, :url, :description, :by, NOW())
    """), {"id": article_id, "pid": partner_id, "title": data["title"], "url": data["url"],
           "description": data.get("description"), "by": data.get("created_by")})
    await db.commit()
    return {"id": article_id, "partner_id": partner_id, "title": data["title"], "url": data["url"], "description": data.get("description")}


@router.delete("/{partner_id}/articles/{article_id}")
async def delete_partner_article(partner_id: str, article_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT 1 FROM company_articles WHERE id = CAST(:id AS UUID) AND partner_id = CAST(:pid AS UUID)"),
                          {"id": article_id, "pid": partner_id})
    if not r.first():
        raise HTTPException(status_code=404, detail="Article not found")
    await db.execute(text("DELETE FROM company_articles WHERE id = CAST(:id AS UUID)"), {"id": article_id})
    await db.commit()
    return {"status": "ok"}


# ─── Events — Marketing events linked to this partner ──────────────────────────
@router.get("/{partner_id}/events")
async def list_partner_events(partner_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT e.* FROM marketing_event_partners ep
        JOIN marketing_events e ON e.id = ep.event_id
        WHERE ep.partner_id = CAST(:id AS UUID)
        ORDER BY e.event_date DESC NULLS LAST
    """), {"id": partner_id})
    return [_row(dict(row._mapping)) for row in r.fetchall()]


# ─── Customers — companies listing this partner's name as a Cybersecurity Solution ─
@router.get("/{partner_id}/customers")
async def list_partner_customers(partner_id: str, db: AsyncSession = Depends(get_db)):
    partner = await _get_partner(db, partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    r = await db.execute(text("""
        SELECT * FROM companies WHERE cybersecurity_solutions ? :name ORDER BY name
    """), {"name": partner["name"]})
    return [_row(dict(row._mapping)) for row in r.fetchall()]
