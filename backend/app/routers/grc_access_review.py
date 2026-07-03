# backend/app/routers/grc_access_review.py
# GRC Access Review: launch review cycles, scope them to IT applications/software,
# auto-generate a task per in-scope item for its owner, gate closing on those tasks.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from datetime import datetime
import uuid, json

router = APIRouter()

REVIEW_TYPES = {"annual", "quarterly", "monthly", "adhoc"}
CYCLE_STATUSES = {"open", "in_progress", "closed"}


def gen_cycle_number() -> str:
    n = datetime.utcnow()
    return f"ARC-{n.year}{n.month:02d}-{str(uuid.uuid4())[:4].upper()}"


def _row(d: dict) -> dict:
    for k, v in d.items():
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
    return d


async def _get_cycle(db: AsyncSession, cycle_id: str) -> dict | None:
    r = await db.execute(text("SELECT * FROM grc_access_review_cycles WHERE id = CAST(:id AS UUID)"), {"id": cycle_id})
    row = r.fetchone()
    return _row(dict(row._mapping)) if row else None


# ─── Cycles ─────────────────────────────────────────────────────────────────────
@router.get("/access-review")
async def list_cycles(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT c.*, jsonb_array_length(c.scope) AS scope_count,
               (SELECT COUNT(*) FROM tasks t WHERE t.entity_type='access_review' AND t.entity_id=c.id) AS tasks_total,
               (SELECT COUNT(*) FROM tasks t WHERE t.entity_type='access_review' AND t.entity_id=c.id AND t.status NOT IN ('resolved','closed')) AS tasks_open
        FROM grc_access_review_cycles c
        ORDER BY c.created_at DESC
    """))
    return {"cycles": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.post("/access-review")
async def create_cycle(data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("cycle_name"):
        raise HTTPException(status_code=400, detail="cycle_name is required")
    review_type = data.get("review_type") or "adhoc"
    if review_type not in REVIEW_TYPES:
        raise HTTPException(status_code=400, detail=f"review_type must be one of {sorted(REVIEW_TYPES)}")
    cycle_id = str(uuid.uuid4())
    cycle_number = gen_cycle_number()
    await db.execute(text("""
        INSERT INTO grc_access_review_cycles (id, cycle_number, review_type, cycle_name, cycle_description, created_by_email, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :cycle_number, :review_type, :cycle_name, :cycle_description, :created_by_email, NOW(), NOW())
    """), {
        "id": cycle_id, "cycle_number": cycle_number, "review_type": review_type,
        "cycle_name": data["cycle_name"], "cycle_description": data.get("cycle_description", ""),
        "created_by_email": data.get("created_by_email", ""),
    })
    await db.commit()
    return {"status": "ok", "id": cycle_id, "cycle_number": cycle_number}


@router.get("/access-review/{cycle_id}")
async def get_cycle(cycle_id: str, db: AsyncSession = Depends(get_db)):
    cycle = await _get_cycle(db, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Review cycle not found")
    links = await db.execute(text("SELECT * FROM grc_access_review_links WHERE cycle_id = CAST(:id AS UUID) ORDER BY created_at ASC"), {"id": cycle_id})
    tasks = await db.execute(text("SELECT * FROM tasks WHERE entity_type='access_review' AND entity_id = CAST(:id AS UUID) ORDER BY created_at ASC"), {"id": cycle_id})
    cycle["links"] = [_row(dict(r._mapping)) for r in links.fetchall()]
    cycle["tasks"] = [_row(dict(r._mapping)) for r in tasks.fetchall()]
    return cycle


@router.put("/access-review/{cycle_id}")
async def update_cycle(cycle_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    cycle = await _get_cycle(db, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Review cycle not found")
    review_type = data.get("review_type") or ""
    if review_type and review_type not in REVIEW_TYPES:
        raise HTTPException(status_code=400, detail=f"review_type must be one of {sorted(REVIEW_TYPES)}")
    await db.execute(text("""
        UPDATE grc_access_review_cycles SET
            cycle_name = COALESCE(NULLIF(:cycle_name,''), cycle_name),
            cycle_description = COALESCE(:cycle_description, cycle_description),
            review_type = COALESCE(NULLIF(:review_type,''), review_type),
            owner_email = COALESCE(NULLIF(:owner_email,''), owner_email),
            owner_name = COALESCE(:owner_name, owner_name),
            due_date = CAST(NULLIF(:due_date,'') AS TIMESTAMP),
            requirement_id = COALESCE(CAST(NULLIF(:requirement_id,'') AS UUID), requirement_id),
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": cycle_id,
        "cycle_name": data.get("cycle_name", ""), "cycle_description": data.get("cycle_description"),
        "review_type": review_type, "owner_email": data.get("owner_email", ""),
        "owner_name": data.get("owner_name"), "due_date": data.get("due_date") or "",
        "requirement_id": data.get("requirement_id") or "",
    })
    await db.commit()
    return {"status": "ok"}


@router.delete("/access-review/{cycle_id}")
async def delete_cycle(cycle_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM grc_access_review_cycles WHERE id = CAST(:id AS UUID)"), {"id": cycle_id})
    await db.commit()
    return {"status": "ok"}


# ─── Status transition — closing is gated on every generated task being done ───
@router.put("/access-review/{cycle_id}/status")
async def set_cycle_status(cycle_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    cycle = await _get_cycle(db, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Review cycle not found")
    new_status = data.get("status", "")
    if new_status not in CYCLE_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(CYCLE_STATUSES)}")

    if new_status == "closed":
        r = await db.execute(text("""
            SELECT COUNT(*) FROM tasks t
            WHERE t.id IN (
                SELECT (elem->>'task_id')::uuid
                FROM grc_access_review_cycles c, jsonb_array_elements(c.scope) elem
                WHERE c.id = CAST(:id AS UUID) AND elem->>'task_id' IS NOT NULL
            ) AND t.status NOT IN ('resolved','closed')
        """), {"id": cycle_id})
        unresolved = r.scalar() or 0
        if unresolved > 0:
            raise HTTPException(status_code=400, detail=f"{unresolved} task(s) generated for this review are not yet resolved or closed. All must be done before closing the cycle.")

    stamp = ", closed_at = NOW()" if new_status == "closed" else ""
    await db.execute(text(f"""
        UPDATE grc_access_review_cycles SET status = :status, updated_at = NOW(){stamp} WHERE id = CAST(:id AS UUID)
    """), {"status": new_status, "id": cycle_id})
    await db.commit()
    return {"status": "ok"}


# ─── Scope — diffed against current scope; new entries spawn a task + watcher ──
@router.put("/access-review/{cycle_id}/scope")
async def set_cycle_scope(cycle_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    cycle = await _get_cycle(db, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Review cycle not found")
    if not cycle.get("owner_email"):
        raise HTTPException(status_code=400, detail="Set a review owner before defining scope")

    incoming = data.get("scope") or []
    existing = cycle.get("scope") or []
    existing_by_key = {(e.get("type"), e.get("id")): e for e in existing}

    from app.routers.task_manager import create_task, add_watcher

    merged = []
    created_task_ids = []
    warnings = []
    for entry in incoming:
        key = (entry.get("type"), entry.get("id"))
        if key in existing_by_key:
            merged.append(existing_by_key[key])
            continue

        owner_email = entry.get("owner_email") or ""
        owner_name = entry.get("owner_name") or ""
        task_id = None
        if owner_email:
            created = await create_task({
                "title": f"Access review: {entry.get('name', '')}",
                "description": "Please review the access of your application and provide evidence of the review.",
                "owner_email": owner_email, "owner_name": owner_name,
                "source": "grc", "entity_type": "access_review", "entity_id": cycle_id,
                "created_by_email": cycle["owner_email"], "acting_email": cycle["owner_email"],
            }, db)
            task_id = created["id"]
            created_task_ids.append(task_id)
            try:
                await add_watcher(task_id, {
                    "acting_email": owner_email,
                    "user_email": cycle["owner_email"], "user_name": cycle.get("owner_name") or cycle["owner_email"],
                }, db)
            except Exception as e:
                print(f"Access review watcher add skipped: {e}")
        else:
            warnings.append(f"{entry.get('name', '(unnamed)')} has no owner in IT — no task was created")

        merged.append({
            "type": entry.get("type"), "id": entry.get("id"), "name": entry.get("name"),
            "owner_email": owner_email, "owner_name": owner_name,
            "task_id": task_id, "added_at": datetime.utcnow().isoformat(),
        })

    await db.execute(text("""
        UPDATE grc_access_review_cycles SET scope = CAST(:scope AS JSONB), updated_at = NOW() WHERE id = CAST(:id AS UUID)
    """), {"scope": json.dumps(merged), "id": cycle_id})
    await db.commit()
    return {"status": "ok", "created_task_ids": created_task_ids, "warnings": warnings}


# ─── Documents & links ──────────────────────────────────────────────────────────
@router.get("/access-review/{cycle_id}/links")
async def list_cycle_links(cycle_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM grc_access_review_links WHERE cycle_id = CAST(:id AS UUID) ORDER BY created_at ASC"), {"id": cycle_id})
    return {"links": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.post("/access-review/{cycle_id}/links")
async def add_cycle_link(cycle_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("label") or not data.get("url"):
        raise HTTPException(status_code=400, detail="label and url are required")
    link_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO grc_access_review_links (id, cycle_id, label, url, added_by_email, created_at)
        VALUES (CAST(:id AS UUID), CAST(:cid AS UUID), :label, :url, :by, NOW())
    """), {"id": link_id, "cid": cycle_id, "label": data["label"], "url": data["url"], "by": data.get("added_by_email", "")})
    await db.commit()
    return {"status": "ok", "id": link_id}


@router.delete("/access-review/{cycle_id}/links/{link_id}")
async def delete_cycle_link(cycle_id: str, link_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM grc_access_review_links WHERE id = CAST(:id AS UUID) AND cycle_id = CAST(:cid AS UUID)"), {"id": link_id, "cid": cycle_id})
    await db.commit()
    return {"status": "ok"}


# ─── Access Review Requirements — access-control-tagged compliance requirements ─
@router.get("/access-review/requirements")
async def list_access_review_requirements(show_all: bool = False, db: AsyncSession = Depends(get_db)):
    where = "" if show_all else "WHERE r.category = 'access_control'"
    r = await db.execute(text(f"""
        SELECT r.*, f.name AS framework_name
        FROM grc_requirements r
        JOIN grc_frameworks f ON f.id = r.framework_id
        {where}
        ORDER BY f.name, r.reference_code
    """))
    return {"requirements": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.put("/requirements/{req_id}/category")
async def set_requirement_category(req_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("UPDATE grc_requirements SET category = :category, updated_at = NOW() WHERE id = CAST(:id AS UUID)"),
                      {"category": data.get("category") or None, "id": req_id})
    await db.commit()
    return {"status": "ok"}


# ─── Overview / KPIs — deliberately not /dashboard, which grc.py already shadows ─
@router.get("/overview")
async def grc_overview(db: AsyncSession = Depends(get_db)):
    frameworks = await db.execute(text("""
        SELECT f.id, f.name, f.color, COUNT(r.id) AS total, COUNT(CASE WHEN r.status='compliant' THEN 1 END) AS compliant
        FROM grc_frameworks f
        LEFT JOIN grc_requirements r ON r.framework_id = f.id
        WHERE f.active = true
        GROUP BY f.id ORDER BY f.name
    """))
    fw_rows = []
    for row in frameworks.fetchall():
        d = dict(row._mapping)
        d["id"] = str(d["id"])
        total = d["total"] or 0
        d["compliance_pct"] = round((d["compliant"] / total * 100)) if total > 0 else 0
        fw_rows.append(d)

    open_risks = await db.execute(text("SELECT COUNT(*) FROM grc_risks WHERE status = 'open'"))
    ongoing_audits = await db.execute(text("SELECT COUNT(*) FROM grc_audits WHERE status IN ('planned','in_progress')"))
    ongoing_reviews = await db.execute(text("SELECT COUNT(*) FROM grc_access_review_cycles WHERE status IN ('open','in_progress')"))

    return {
        "frameworks": fw_rows,
        "open_risks": open_risks.scalar() or 0,
        "ongoing_audits": ongoing_audits.scalar() or 0,
        "ongoing_access_reviews": ongoing_reviews.scalar() or 0,
    }
