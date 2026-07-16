# backend/app/routers/marketing.py
# Marketing — Events (owner, contributors, named URLs, linked Partners).
# Company Website / Competitor Analysis / Social Marketing / Marketing Plan / Marketing Material
# are nav placeholders only for now — no backend endpoints for those yet.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import uuid

router = APIRouter()

EVENT_TYPES = {"webinar", "physical", "mailing", "other"}


def _row(d: dict) -> dict:
    for k, v in d.items():
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
    return d


async def _get_event(db: AsyncSession, event_id: str) -> dict | None:
    r = await db.execute(text("SELECT * FROM marketing_events WHERE id = CAST(:id AS UUID)"), {"id": event_id})
    row = r.fetchone()
    return _row(dict(row._mapping)) if row else None


# ─── Events ──────────────────────────────────────────────────────────────────────
@router.get("/events")
async def list_events(event_type: str = None, db: AsyncSession = Depends(get_db)):
    where = "WHERE event_type = :t" if event_type else ""
    params = {"t": event_type} if event_type else {}
    r = await db.execute(text(f"SELECT * FROM marketing_events {where} ORDER BY event_date DESC NULLS LAST, created_at DESC"), params)
    return {"events": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.post("/events")
async def create_event(data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("title"):
        raise HTTPException(status_code=400, detail="title is required")
    event_type = data.get("event_type") or "other"
    if event_type not in EVENT_TYPES:
        raise HTTPException(status_code=400, detail=f"event_type must be one of {sorted(EVENT_TYPES)}")
    event_id = str(uuid.uuid4())
    # A multi-day event's end_date defaults to its start date when not given, so single-day
    # events (the common case) keep working with no frontend changes required.
    event_date = data.get("event_date") or ""
    end_date = data.get("end_date") or event_date
    await db.execute(text("""
        INSERT INTO marketing_events (id, title, event_date, end_date, description, event_type, location,
                                       owner_email, owner_name, created_by_email, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :title, CAST(NULLIF(:event_date,'') AS DATE), CAST(NULLIF(:end_date,'') AS DATE), :description, :event_type, :location,
                :owner_email, :owner_name, :created_by_email, NOW(), NOW())
    """), {
        "id": event_id, "title": data["title"], "event_date": event_date, "end_date": end_date,
        "description": data.get("description", ""), "event_type": event_type, "location": data.get("location", ""),
        "owner_email": data.get("owner_email", ""), "owner_name": data.get("owner_name", ""),
        "created_by_email": data.get("created_by_email", ""),
    })
    await db.commit()
    return await _get_event(db, event_id)


@router.get("/events/{event_id}")
async def get_event(event_id: str, db: AsyncSession = Depends(get_db)):
    event = await _get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    contributors = await db.execute(text("SELECT * FROM marketing_event_contributors WHERE event_id = CAST(:id AS UUID) ORDER BY created_at"), {"id": event_id})
    urls = await db.execute(text("SELECT * FROM marketing_event_urls WHERE event_id = CAST(:id AS UUID) ORDER BY created_at"), {"id": event_id})
    partners = await db.execute(text("""
        SELECT p.id, p.name, p.status FROM marketing_event_partners ep
        JOIN partners p ON p.id = ep.partner_id WHERE ep.event_id = CAST(:id AS UUID) ORDER BY p.name
    """), {"id": event_id})
    event["contributors"] = [_row(dict(r._mapping)) for r in contributors.fetchall()]
    event["urls"] = [_row(dict(r._mapping)) for r in urls.fetchall()]
    event["partners"] = [_row(dict(r._mapping)) for r in partners.fetchall()]
    return event


@router.put("/events/{event_id}")
async def update_event(event_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    event = await _get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event_type = data.get("event_type", "")
    if event_type and event_type not in EVENT_TYPES:
        raise HTTPException(status_code=400, detail=f"event_type must be one of {sorted(EVENT_TYPES)}")
    await db.execute(text("""
        UPDATE marketing_events SET
            title = COALESCE(NULLIF(:title,''), title),
            event_date = COALESCE(CAST(NULLIF(:event_date,'') AS DATE), event_date),
            end_date = COALESCE(CAST(NULLIF(:end_date,'') AS DATE), end_date),
            description = COALESCE(:description, description),
            event_type = COALESCE(NULLIF(:event_type,''), event_type),
            location = COALESCE(:location, location),
            owner_email = COALESCE(:owner_email, owner_email),
            owner_name = COALESCE(:owner_name, owner_name),
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": event_id, "title": data.get("title", ""), "event_date": data.get("event_date", ""),
        "end_date": data.get("end_date", ""),
        "description": data.get("description"), "event_type": event_type, "location": data.get("location"),
        "owner_email": data.get("owner_email"), "owner_name": data.get("owner_name"),
    })
    await db.commit()
    return await _get_event(db, event_id)


@router.delete("/events/{event_id}")
async def delete_event(event_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM marketing_events WHERE id = CAST(:id AS UUID)"), {"id": event_id})
    await db.commit()
    return {"status": "ok"}


# ─── Contributors ────────────────────────────────────────────────────────────────
@router.post("/events/{event_id}/contributors")
async def add_contributor(event_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("user_email"):
        raise HTTPException(status_code=400, detail="user_email is required")
    cid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO marketing_event_contributors (id, event_id, user_email, user_name, created_at)
        VALUES (CAST(:id AS UUID), CAST(:eid AS UUID), :email, :name, NOW())
    """), {"id": cid, "eid": event_id, "email": data["user_email"], "name": data.get("user_name", "")})
    await db.commit()
    return {"status": "ok", "id": cid}


@router.delete("/events/{event_id}/contributors/{contributor_id}")
async def remove_contributor(event_id: str, contributor_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM marketing_event_contributors WHERE id = CAST(:id AS UUID) AND event_id = CAST(:eid AS UUID)"),
                      {"id": contributor_id, "eid": event_id})
    await db.commit()
    return {"status": "ok"}


# ─── Named URLs ──────────────────────────────────────────────────────────────────
@router.post("/events/{event_id}/urls")
async def add_url(event_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("label") or not data.get("url"):
        raise HTTPException(status_code=400, detail="label and url are required")
    uid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO marketing_event_urls (id, event_id, label, url, created_at)
        VALUES (CAST(:id AS UUID), CAST(:eid AS UUID), :label, :url, NOW())
    """), {"id": uid, "eid": event_id, "label": data["label"], "url": data["url"]})
    await db.commit()
    return {"status": "ok", "id": uid}


@router.delete("/events/{event_id}/urls/{url_id}")
async def remove_url(event_id: str, url_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM marketing_event_urls WHERE id = CAST(:id AS UUID) AND event_id = CAST(:eid AS UUID)"),
                      {"id": url_id, "eid": event_id})
    await db.commit()
    return {"status": "ok"}


# ─── Linked Partners (many-to-many) ──────────────────────────────────────────────
@router.post("/events/{event_id}/partners/{partner_id}")
async def link_partner(event_id: str, partner_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        INSERT INTO marketing_event_partners (event_id, partner_id)
        VALUES (CAST(:eid AS UUID), CAST(:pid AS UUID))
        ON CONFLICT DO NOTHING
    """), {"eid": event_id, "pid": partner_id})
    await db.commit()
    return {"status": "ok"}


@router.delete("/events/{event_id}/partners/{partner_id}")
async def unlink_partner(event_id: str, partner_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM marketing_event_partners WHERE event_id = CAST(:eid AS UUID) AND partner_id = CAST(:pid AS UUID)"),
                      {"eid": event_id, "pid": partner_id})
    await db.commit()
    return {"status": "ok"}
