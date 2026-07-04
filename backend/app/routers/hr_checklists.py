# backend/app/routers/hr_checklists.py
# HR Onboarding/Offboarding checklists: location-scoped task templates, turned into
# real Task Manager tasks when a specific person is onboarded/offboarded.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import uuid

router = APIRouter()

KINDS = {"onboarding", "offboarding"}


def _row(d: dict) -> dict:
    for k, v in d.items():
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
    return d


def _validate_kind(kind: str):
    if kind not in KINDS:
        raise HTTPException(status_code=400, detail=f"kind must be one of {sorted(KINDS)}")


# ─── Template tasks ─────────────────────────────────────────────────────────────
@router.get("/checklist-tasks")
async def list_checklist_tasks(kind: str = None, location_id: str = None, db: AsyncSession = Depends(get_db)):
    where = ["1=1"]
    params = {}
    if kind:
        _validate_kind(kind)
        where.append("kind = :kind")
        params["kind"] = kind
    if location_id:
        where.append("location_id = CAST(:location_id AS UUID)")
        params["location_id"] = location_id
    r = await db.execute(text(f"""
        SELECT * FROM hr_checklist_tasks WHERE {' AND '.join(where)} ORDER BY sort_order, created_at
    """), params)
    return {"tasks": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.post("/checklist-tasks")
async def create_checklist_task(data: dict, db: AsyncSession = Depends(get_db)):
    kind = data.get("kind", "")
    _validate_kind(kind)
    if not data.get("title") or not data.get("location_id"):
        raise HTTPException(status_code=400, detail="title and location_id are required")
    task_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO hr_checklist_tasks (id, kind, location_id, location_name, title, description, url, sharepoint_url,
                                          responsible_email, responsible_name, sort_order, created_by_email, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :kind, CAST(:location_id AS UUID), :location_name, :title, :description, :url, :sharepoint_url,
                :responsible_email, :responsible_name, :sort_order, :created_by_email, NOW(), NOW())
    """), {
        "id": task_id, "kind": kind, "location_id": data["location_id"], "location_name": data.get("location_name", ""),
        "title": data["title"], "description": data.get("description", ""), "url": data.get("url", ""),
        "sharepoint_url": data.get("sharepoint_url", ""), "responsible_email": data.get("responsible_email", ""),
        "responsible_name": data.get("responsible_name", ""), "sort_order": data.get("sort_order", 0),
        "created_by_email": data.get("created_by_email", ""),
    })
    await db.commit()
    return {"status": "ok", "id": task_id}


@router.put("/checklist-tasks/{task_id}")
async def update_checklist_task(task_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE hr_checklist_tasks SET
            title = COALESCE(NULLIF(:title,''), title),
            description = COALESCE(:description, description),
            url = COALESCE(:url, url),
            sharepoint_url = COALESCE(:sharepoint_url, sharepoint_url),
            responsible_email = COALESCE(:responsible_email, responsible_email),
            responsible_name = COALESCE(:responsible_name, responsible_name),
            sort_order = COALESCE(:sort_order, sort_order),
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": task_id, "title": data.get("title", ""), "description": data.get("description"),
        "url": data.get("url"), "sharepoint_url": data.get("sharepoint_url"),
        "responsible_email": data.get("responsible_email"), "responsible_name": data.get("responsible_name"),
        "sort_order": data.get("sort_order"),
    })
    await db.commit()
    return {"status": "ok"}


@router.delete("/checklist-tasks/{task_id}")
async def delete_checklist_task(task_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM hr_checklist_tasks WHERE id = CAST(:id AS UUID)"), {"id": task_id})
    await db.commit()
    return {"status": "ok"}


# ─── Cases — one run of a checklist for one real person ────────────────────────
@router.get("/checklist-cases")
async def list_checklist_cases(kind: str = None, db: AsyncSession = Depends(get_db)):
    where = ["1=1"]
    params = {}
    if kind:
        _validate_kind(kind)
        where.append("kind = :kind")
        params["kind"] = kind
    r = await db.execute(text(f"""
        SELECT c.*,
               (SELECT COUNT(*) FROM hr_checklist_case_tasks ct JOIN tasks t ON t.id = ct.task_id WHERE ct.case_id = c.id) AS tasks_total,
               (SELECT COUNT(*) FROM hr_checklist_case_tasks ct JOIN tasks t ON t.id = ct.task_id WHERE ct.case_id = c.id AND t.status NOT IN ('resolved','closed')) AS tasks_open
        FROM hr_checklist_cases c
        WHERE {' AND '.join(where)}
        ORDER BY c.created_at DESC
    """), params)
    return {"cases": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.post("/checklist-cases")
async def start_checklist_case(data: dict, db: AsyncSession = Depends(get_db)):
    kind = data.get("kind", "")
    _validate_kind(kind)
    user_email = data.get("user_email", "")
    if not user_email:
        raise HTTPException(status_code=400, detail="user_email is required")

    location_id = data.get("location_id")
    location_name = data.get("location_name", "")
    if not location_id:
        r = await db.execute(text("SELECT main_location_id, main_location_name FROM user_profiles WHERE email = :email"), {"email": user_email})
        row = r.fetchone()
        if row and row.main_location_id:
            location_id = str(row.main_location_id)
            location_name = row.main_location_name or ""
    if not location_id:
        raise HTTPException(status_code=400, detail="This person has no main location set (see WHUBBI Permissions), and no location was provided")

    templates = await db.execute(text("""
        SELECT * FROM hr_checklist_tasks WHERE kind = :kind AND location_id = CAST(:location_id AS UUID) ORDER BY sort_order, created_at
    """), {"kind": kind, "location_id": location_id})
    template_rows = [_row(dict(r._mapping)) for r in templates.fetchall()]
    if not template_rows:
        raise HTTPException(status_code=400, detail=f"No {kind} checklist tasks are configured for this location yet")

    case_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO hr_checklist_cases (id, kind, user_email, user_name, location_id, location_name, started_by_email, created_at)
        VALUES (CAST(:id AS UUID), :kind, :user_email, :user_name, CAST(:location_id AS UUID), :location_name, :started_by_email, NOW())
    """), {
        "id": case_id, "kind": kind, "user_email": user_email, "user_name": data.get("user_name", ""),
        "location_id": location_id, "location_name": location_name, "started_by_email": data.get("started_by_email", ""),
    })
    await db.commit()

    from app.routers.task_manager import create_task, add_watcher

    overrides = data.get("overrides") or {}
    created_task_ids = []
    warnings = []
    for tmpl in template_rows:
        override = overrides.get(tmpl["id"]) or {}
        assignee_email = override.get("assignee_email") or tmpl.get("responsible_email") or ""
        assignee_name = override.get("assignee_name") or tmpl.get("responsible_name") or ""
        if not assignee_email:
            warnings.append(f"{tmpl['title']} has no responsible person — no task was created")
            continue

        created = await create_task({
            "title": tmpl["title"],
            "description": tmpl.get("description") or f"Please complete this {kind} task.",
            "owner_email": assignee_email, "owner_name": assignee_name,
            "source": f"hr_{kind}", "created_by_email": data.get("started_by_email") or assignee_email,
            "acting_email": data.get("started_by_email") or assignee_email,
        }, db)
        task_id = created["id"]
        created_task_ids.append(task_id)

        if user_email != assignee_email:
            try:
                await add_watcher(task_id, {
                    "acting_email": assignee_email, "user_email": user_email, "user_name": data.get("user_name") or user_email,
                }, db)
            except Exception as e:
                print(f"Checklist watcher add skipped: {e}")

        if tmpl.get("sharepoint_url"):
            await db.execute(text("""
                INSERT INTO task_links (id, task_id, label, url, added_by_email, created_at)
                VALUES (gen_random_uuid(), CAST(:tid AS UUID), 'Reference document', :url, :by, NOW())
            """), {"tid": task_id, "url": tmpl["sharepoint_url"], "by": data.get("started_by_email", "")})
        if tmpl.get("url"):
            await db.execute(text("""
                INSERT INTO task_links (id, task_id, label, url, added_by_email, created_at)
                VALUES (gen_random_uuid(), CAST(:tid AS UUID), 'Link', :url, :by, NOW())
            """), {"tid": task_id, "url": tmpl["url"], "by": data.get("started_by_email", "")})

        await db.execute(text("""
            INSERT INTO hr_checklist_case_tasks (id, case_id, checklist_task_id, task_id, created_at)
            VALUES (gen_random_uuid(), CAST(:case_id AS UUID), CAST(:checklist_task_id AS UUID), CAST(:task_id AS UUID), NOW())
        """), {"case_id": case_id, "checklist_task_id": tmpl["id"], "task_id": task_id})

    await db.commit()
    return {"status": "ok", "id": case_id, "created_task_ids": created_task_ids, "warnings": warnings}


@router.get("/checklist-cases/{case_id}")
async def get_checklist_case(case_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM hr_checklist_cases WHERE id = CAST(:id AS UUID)"), {"id": case_id})
    row = r.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Case not found")
    case = _row(dict(row._mapping))

    tasks = await db.execute(text("""
        SELECT t.* FROM hr_checklist_case_tasks ct
        JOIN tasks t ON t.id = ct.task_id
        WHERE ct.case_id = CAST(:id AS UUID)
        ORDER BY t.created_at ASC
    """), {"id": case_id})
    case["tasks"] = [_row(dict(r._mapping)) for r in tasks.fetchall()]
    return case
