# backend/app/routers/contact_cleanup.py
import asyncio
import json
import re
import uuid as uuid_module
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.database import get_db
from app.models.contact import Contact
from app.routers.companies import claude_web_search

router = APIRouter()

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


async def _resolve_current_company(db: AsyncSession, contact: Contact):
    if contact.company_id:
        r = await db.execute(text("SELECT name FROM companies WHERE id = CAST(:id AS UUID)"), {"id": str(contact.company_id)})
        row = r.fetchone()
        if row:
            return row.name
    if contact.partner_id:
        r = await db.execute(text("SELECT name FROM partners WHERE id = CAST(:id AS UUID)"), {"id": str(contact.partner_id)})
        row = r.fetchone()
        if row:
            return row.name
    return None


# ─── LinkedIn check (public web search only — no LinkedIn login/scraping) ──────
@router.post("/{contact_id}/linkedin-check")
async def linkedin_check(contact_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = r.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    current_company = await _resolve_current_company(db, contact)
    current_title = contact.job_name or contact.job_type

    prompt = f"""Search the public web (LinkedIn, company sites, news) for "{contact.first_name} {contact.last_name}",
on file as working at "{current_company or 'an unknown company'}" as "{current_title or 'an unknown role'}".
Return ONLY a valid JSON object, no markdown, no explanation:
{{"still_matches": true/false, "found_company": "company name or null", "found_title": "title or null", "confidence": "high"/"medium"/"low", "summary": "1-2 sentence summary"}}
If you can't find reliable public information, set confidence to "low" and still_matches to true (benefit of the doubt — don't flag on absence of evidence)."""

    raw = await claude_web_search(prompt)
    cleaned = raw.strip().replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail=f"Could not parse AI response: {raw[:200]}")

    suggestion_id = None
    if not parsed.get("still_matches", True):
        suggestion_id = str(uuid_module.uuid4())
        await db.execute(text("""
            INSERT INTO contact_cleanup_suggestions
                (id, contact_id, check_type, current_company, current_title, suggested_company, suggested_title, confidence, summary, created_at)
            VALUES (CAST(:id AS UUID), CAST(:cid AS UUID), 'linkedin', :cur_co, :cur_title, :sug_co, :sug_title, :conf, :summary, NOW())
        """), {
            "id": suggestion_id, "cid": str(contact_id),
            "cur_co": current_company, "cur_title": current_title,
            "sug_co": parsed.get("found_company"), "sug_title": parsed.get("found_title"),
            "conf": parsed.get("confidence", "low"), "summary": parsed.get("summary", ""),
        })
        await db.commit()

    return {"suggestion_id": suggestion_id, **parsed}


@router.get("/suggestions")
async def list_suggestions(status: str = "pending", db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT s.*, c.first_name, c.last_name, c.email
        FROM contact_cleanup_suggestions s
        JOIN contacts c ON c.id = s.contact_id
        WHERE s.status = :status
        ORDER BY s.created_at DESC
    """), {"status": status})
    suggestions = []
    for row in r.fetchall():
        d = dict(row._mapping)
        d["id"] = str(d["id"])
        d["contact_id"] = str(d["contact_id"])
        suggestions.append(d)
    return {"suggestions": suggestions}


@router.put("/suggestions/{suggestion_id}")
async def review_suggestion(suggestion_id: UUID, data: dict, db: AsyncSession = Depends(get_db)):
    action = data.get("action")
    if action not in ("accept", "deny"):
        raise HTTPException(status_code=400, detail="action must be 'accept' or 'deny'")

    r = await db.execute(text("SELECT * FROM contact_cleanup_suggestions WHERE id = CAST(:id AS UUID)"), {"id": str(suggestion_id)})
    sug = r.fetchone()
    if not sug:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    if action == "accept":
        # The reviewer may have edited the suggested title before accepting. Company changes are
        # NOT auto-applied — an AI-found company name isn't reliably matchable to a real Company/
        # Partner record, so mis-linking a contact to the wrong one is a worse outcome than asking
        # the reviewer to update the company manually via the normal contact edit form.
        new_title = data.get("suggested_title", sug.suggested_title)
        if new_title:
            await db.execute(text("""
                UPDATE contacts SET job_name = :title, updated_at = NOW() WHERE id = CAST(:cid AS UUID)
            """), {"title": new_title, "cid": str(sug.contact_id)})

    await db.execute(text("""
        UPDATE contact_cleanup_suggestions SET status = :status, reviewed_by = :by, reviewed_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {"status": "accepted" if action == "accept" else "denied", "by": data.get("reviewed_by", ""), "id": str(suggestion_id)})
    await db.commit()
    return {"status": "ok"}


# ─── Email validity check (syntax + domain MX record — no SMTP mailbox probe) ──
@router.get("/{contact_id}/email-check")
async def email_check(contact_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = r.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    email = contact.email or ""
    if not EMAIL_RE.match(email):
        return {"valid": False, "reason": "invalid_syntax"}

    domain = email.rsplit("@", 1)[-1]
    try:
        import dns.resolver
        answers = await asyncio.to_thread(dns.resolver.resolve, domain, "MX")
        return {"valid": len(answers) > 0, "reason": "mx_ok" if len(answers) > 0 else "no_mx_records"}
    except Exception as e:
        return {"valid": False, "reason": f"dns_lookup_failed: {str(e)[:150]}"}
