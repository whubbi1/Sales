# backend/app/routers/competitor_analysis.py
# Competitor Analysis + Company Marketing Setup. Mirrors social_influence.py's conventions:
#   - claude_web_search() (app/routers/companies.py) does all the AI web-research work.
#   - Company Marketing Setup is a singleton record, same idiom as social_influence_mailbox.
#   - AI-suggested competitors are ephemeral (never touch the DB) until the user Adds one —
#     unlike the Mailings Inbox, regenerating a suggestion is cheap, so no staging table needed.
#   - The slow claude_web_search call for /analyze never runs with a DB session open (see
#     _check_source in social_influence.py for why that discipline matters).
import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import get_db
from app.routers.companies import claude_web_search

router = APIRouter()

MAX_SUGGEST_COUNTRIES = 5


def _row(d: dict) -> dict:
    for k, v in d.items():
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
    return d


def _normalize_jsonb_list(value) -> list:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (TypeError, ValueError):
            value = []
    return value or []


def _parse_claude_json(text_result: str):
    cleaned = text_result.strip().replace("```json", "").replace("```", "").strip()
    return json.loads(cleaned)


# ─── Company Marketing Setup (singleton) ───────────────────────────────────────────────────
@router.get("/company-setup")
async def get_company_setup(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM company_marketing_setup LIMIT 1"))
    row = r.fetchone()
    if not row:
        return {
            "description": "", "services": "", "target_countries": [],
            "target_audience": "", "marketing_objectives": "", "updated_at": None,
        }
    d = _row(dict(row._mapping))
    d["target_countries"] = _normalize_jsonb_list(d.get("target_countries"))
    return d


@router.put("/company-setup")
async def update_company_setup(data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT id FROM company_marketing_setup LIMIT 1"))
    existing = r.fetchone()
    params = {
        "description": data.get("description", ""), "services": data.get("services", ""),
        "target_countries": json.dumps(data.get("target_countries") or []),
        "target_audience": data.get("target_audience", ""),
        "marketing_objectives": data.get("marketing_objectives", ""),
        "email": data.get("updated_by_email", ""),
    }
    if existing:
        await db.execute(text("""
            UPDATE company_marketing_setup SET description = :description, services = :services,
                target_countries = CAST(:target_countries AS JSONB), target_audience = :target_audience,
                marketing_objectives = :marketing_objectives, updated_by_email = :email, updated_at = NOW()
            WHERE id = :id
        """), {**params, "id": existing.id})
    else:
        await db.execute(text("""
            INSERT INTO company_marketing_setup (id, description, services, target_countries,
                target_audience, marketing_objectives, updated_by_email, updated_at, created_at)
            VALUES (gen_random_uuid(), :description, :services, CAST(:target_countries AS JSONB),
                :target_audience, :marketing_objectives, :email, NOW(), NOW())
        """), params)
    await db.commit()
    return await get_company_setup(db)


# ─── Competitors ────────────────────────────────────────────────────────────────────────────
async def _get_competitor(db: AsyncSession, competitor_id: str) -> dict | None:
    r = await db.execute(text("SELECT * FROM competitors WHERE id = CAST(:id AS UUID)"), {"id": competitor_id})
    row = r.fetchone()
    if not row:
        return None
    d = _row(dict(row._mapping))
    d["countries"] = _normalize_jsonb_list(d.get("countries"))
    d["customers"] = _normalize_jsonb_list(d.get("customers"))
    return d


@router.get("/competitors")
async def list_competitors(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM competitors ORDER BY name"))
    out = []
    for row in r.fetchall():
        d = _row(dict(row._mapping))
        d["countries"] = _normalize_jsonb_list(d.get("countries"))
        d["customers"] = _normalize_jsonb_list(d.get("customers"))
        out.append(d)
    return {"competitors": out}


@router.get("/competitors/{competitor_id}")
async def get_competitor(competitor_id: str, db: AsyncSession = Depends(get_db)):
    competitor = await _get_competitor(db, competitor_id)
    if not competitor:
        raise HTTPException(status_code=404, detail="Competitor not found")
    return competitor


@router.post("/competitors")
async def create_competitor(data: dict, db: AsyncSession = Depends(get_db)):
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    competitor_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO competitors (id, name, countries, website, linkedin_url, active, source, created_by_email, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :name, CAST(:countries AS JSONB), :website, :linkedin_url, TRUE, :source, :email, NOW(), NOW())
    """), {
        "id": competitor_id, "name": name, "countries": json.dumps(data.get("countries") or []),
        "website": data.get("website"), "linkedin_url": data.get("linkedin_url"),
        "source": data.get("source") if data.get("source") in ("manual", "ai_suggested") else "manual",
        "email": data.get("created_by_email", ""),
    })
    await db.commit()
    return await _get_competitor(db, competitor_id)


@router.put("/competitors/{competitor_id}")
async def update_competitor(competitor_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    existing = await _get_competitor(db, competitor_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Competitor not found")
    fields = {k: data[k] for k in ("name", "website", "linkedin_url", "active") if k in data}
    if "countries" in data:
        fields["countries"] = json.dumps(data["countries"] or [])
    if not fields:
        return existing
    set_clause = ", ".join(
        f"{k} = CAST(:{k} AS JSONB)" if k == "countries" else f"{k} = :{k}"
        for k in fields
    )
    await db.execute(text(f"UPDATE competitors SET {set_clause}, updated_at = NOW() WHERE id = CAST(:id AS UUID)"),
                      {**fields, "id": competitor_id})
    await db.commit()
    return await _get_competitor(db, competitor_id)


@router.delete("/competitors/{competitor_id}")
async def delete_competitor(competitor_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM competitors WHERE id = CAST(:id AS UUID)"), {"id": competitor_id})
    await db.commit()
    return {"status": "ok"}


@router.post("/competitors/suggest")
async def suggest_competitors(data: dict, db: AsyncSession = Depends(get_db)):
    countries = [c.strip() for c in (data.get("countries") or []) if c and c.strip()][:MAX_SUGGEST_COUNTRIES]
    if not countries:
        raise HTTPException(status_code=400, detail="At least one country is required")

    setup = await get_company_setup(db)
    if setup.get("description") or setup.get("services"):
        context = (
            f"Our company: {setup.get('description') or ''}\n"
            f"Our services: {setup.get('services') or ''}\n"
            f"Our target audience: {setup.get('target_audience') or ''}\n"
        )
    else:
        context = "Our company is a SaaS platform for HR, compliance (GRC), sales, legal and operations management.\n"

    suggestions = []
    last_error = None
    for country in countries:
        prompt = (
            f"{context}\n"
            f"Propose up to 6 real, notable competitor companies operating in {country} that a "
            "marketing team tracking the competitive landscape should be aware of. Search the web "
            "for real, currently-operating companies — do not invent any.\n"
            "Return ONLY a valid JSON array with this exact structure (use null for anything you "
            "can't find):\n"
            '[{"name": "company name", "website": "https://...", "linkedin_url": "https://linkedin.com/company/... or null", '
            '"why": "one short sentence on why they compete with us"}]\n'
            "Return ONLY the JSON array, no markdown, no explanation."
        )
        try:
            result = _parse_claude_json(await claude_web_search(prompt))
            for item in result if isinstance(result, list) else []:
                if item.get("name"):
                    suggestions.append({
                        "name": item.get("name"), "website": item.get("website"),
                        "linkedin_url": item.get("linkedin_url"), "why": item.get("why"),
                        "country": country,
                    })
        except (json.JSONDecodeError, ValueError, HTTPException) as e:
            # one country's research failing shouldn't block the others, but if every single
            # one fails it's not "no competitors found" — surface the real error instead of
            # silently returning an empty list that looks identical to a genuine empty result.
            last_error = getattr(e, "detail", None) or str(e)
            continue
    if not suggestions and last_error:
        raise HTTPException(status_code=502, detail=f"Competitor research failed: {last_error}")
    return {"suggestions": suggestions}


async def _analyze_competitor(competitor: dict) -> dict:
    """Same session-safety discipline as _check_source in social_influence.py: the slow Claude
    call runs with no database session open, then one fresh short session does the write."""
    from app.database import AsyncSessionLocal
    prompt = (
        f"Research the company \"{competitor['name']}\""
        + (f" (website: {competitor['website']})" if competitor.get("website") else "")
        + (f" (LinkedIn: {competitor['linkedin_url']})" if competitor.get("linkedin_url") else "")
        + ".\nSearch the web for their LinkedIn company page, their website, and any news or "
        "customer references. Return ONLY a valid JSON object with this exact structure (use "
        "null for anything you can't find):\n"
        '{"linkedin_followers": your best-guess integer follower/connection count on their LinkedIn '
        'company page or null, "employee_count_estimate": a short string like "50-200" or null, '
        '"services": ["up to 6 short service/product names they offer"], '
        '"customer_stories": "a short paragraph (max 100 words) summarizing any customer case '
        'studies or testimonials found on their site, or null", '
        '"customers": ["up to 8 customer/client company names mentioned on their site or in the press"], '
        '"notes": "any other short, relevant finding, or null"}\n'
        "Return ONLY the JSON, no markdown, no explanation."
    )
    try:
        result = _parse_claude_json(await claude_web_search(prompt))
        async with AsyncSessionLocal() as db:
            await db.execute(text("""
                UPDATE competitors SET linkedin_followers = :followers, employee_count_estimate = :emp,
                    services_summary = :services, customer_stories = :stories,
                    customers = CAST(:customers AS JSONB), analysis_notes = :notes,
                    last_analyzed_at = NOW(), last_analysis_error = NULL, updated_at = NOW()
                WHERE id = CAST(:id AS UUID)
            """), {
                "id": competitor["id"],
                "followers": result.get("linkedin_followers"),
                "emp": result.get("employee_count_estimate"),
                "services": ", ".join(result.get("services") or []) if isinstance(result.get("services"), list) else result.get("services"),
                "stories": result.get("customer_stories"),
                "customers": json.dumps(result.get("customers") or []),
                "notes": result.get("notes"),
            })
            await db.commit()
    except Exception as e:
        async with AsyncSessionLocal() as db:
            await db.execute(text("""
                UPDATE competitors SET last_analysis_error = :err, last_analyzed_at = NOW(), updated_at = NOW()
                WHERE id = CAST(:id AS UUID)
            """), {"id": competitor["id"], "err": str(e)[:500]})
            await db.commit()
    async with AsyncSessionLocal() as db:
        return await _get_competitor(db, competitor["id"])


@router.post("/competitors/{competitor_id}/analyze")
async def analyze_competitor(competitor_id: str, db: AsyncSession = Depends(get_db)):
    competitor = await _get_competitor(db, competitor_id)
    if not competitor:
        raise HTTPException(status_code=404, detail="Competitor not found")
    return await _analyze_competitor(competitor)
