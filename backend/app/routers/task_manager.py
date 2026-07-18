# backend/app/routers/task_manager.py
# Unified cross-module Task Manager: workflows, subtasks, watchers, reassignment.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from datetime import datetime
import uuid

router = APIRouter()

TOP_STATUSES = {"new", "open", "in_progress", "resolved", "closed"}
SUB_STATUSES = {"new", "in_progress", "resolved"}


def gen_task_number() -> str:
    n = datetime.utcnow()
    return f"TSK-{n.year}{n.month:02d}-{str(uuid.uuid4())[:4].upper()}"


def _row(d: dict) -> dict:
    for k, v in d.items():
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
    return d


async def _get_task(db: AsyncSession, task_id: str) -> dict | None:
    r = await db.execute(text("SELECT * FROM tasks WHERE id = CAST(:id AS UUID)"), {"id": task_id})
    row = r.fetchone()
    return _row(dict(row._mapping)) if row else None


async def _sibling_subtasks_unresolved_count(db: AsyncSession, parent_id: str) -> int:
    r = await db.execute(text(
        "SELECT COUNT(*) FROM tasks WHERE parent_task_id = CAST(:id AS UUID) AND status != 'resolved'"
    ), {"id": parent_id})
    return r.scalar() or 0


async def _is_subtask_owner_of(db: AsyncSession, parent_id: str, email: str) -> bool:
    r = await db.execute(text(
        "SELECT 1 FROM tasks WHERE parent_task_id = CAST(:pid AS UUID) AND owner_email = :email LIMIT 1"
    ), {"pid": parent_id, "email": email})
    return r.fetchone() is not None


async def _log_comment(db: AsyncSession, task_id: str, content: str, author_email: str = "system", author_name: str = "WHUBBI", source: str = "system"):
    await db.execute(text("""
        INSERT INTO task_comments (id, task_id, author_email, author_name, content, source, created_at)
        VALUES (gen_random_uuid(), CAST(:tid AS UUID), :email, :name, :content, :source, NOW())
    """), {"tid": task_id, "email": author_email, "name": author_name, "content": content, "source": source})


# ─── Core status-transition logic — shared by the HTTP route and the Teams command parser ──
async def set_task_status_internal(db: AsyncSession, task_id: str, acting_email: str, new_status: str, acting_name: str = "") -> dict:
    task = await _get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    is_subtask = task["parent_task_id"] is not None
    # A blank owner_email means this task was migrated from a legacy per-module table that
    # never captured an email (e.g. old Company/Contact tasks) — treat it as unclaimed and
    # let whoever touches it first become the owner, rather than leaving it permanently stuck.
    is_unclaimed = not task["owner_email"]
    is_owner = acting_email == task["owner_email"] or is_unclaimed
    is_assignee = acting_email == task["assignee_email"]
    is_sub_owner = (not is_subtask) and await _is_subtask_owner_of(db, task_id, acting_email)

    if not (is_owner or is_assignee or is_sub_owner):
        raise HTTPException(status_code=403, detail="Only the task's owner, assignee, or a subtask owner can update its status")

    allowed = SUB_STATUSES if is_subtask else TOP_STATUSES
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail=f"'{new_status}' is not a valid status for this task (allowed: {sorted(allowed)})")

    if new_status == "closed" and not is_owner:
        raise HTTPException(status_code=403, detail="Only the task owner can close a task")

    if new_status == "resolved" and not is_owner:
        unresolved = await _sibling_subtasks_unresolved_count(db, task_id)
        if unresolved > 0:
            raise HTTPException(status_code=403, detail="All subtasks must be resolved before this task can be resolved")

    stamps = ""
    if new_status == "resolved":
        stamps = ", resolved_at = NOW()"
    elif new_status == "closed":
        stamps = ", closed_at = NOW()"

    claim_clause = ", owner_email = COALESCE(NULLIF(:acting_email,''), owner_email), owner_name = COALESCE(NULLIF(:acting_name,''), owner_name)" if is_unclaimed and acting_email else ""

    await db.execute(text(f"""
        UPDATE tasks SET status = :status, updated_at = NOW(){stamps}{claim_clause} WHERE id = CAST(:id AS UUID)
    """), {"status": new_status, "id": task_id, "acting_email": acting_email, "acting_name": acting_name})
    await _log_comment(db, task_id, f"Status changed from {task['status']} to {new_status} by {acting_email}")
    await db.commit()
    return {"status": "ok"}


async def reassign_task_internal(db: AsyncSession, task_id: str, acting_email: str, new_assignee_email: str, new_assignee_name: str) -> dict:
    task = await _get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if acting_email not in (task["owner_email"], task["assignee_email"]):
        raise HTTPException(status_code=403, detail="Only the task's owner or current assignee can reassign it")

    await db.execute(text("""
        UPDATE tasks SET assignee_email = :email, assignee_name = :name, updated_at = NOW() WHERE id = CAST(:id AS UUID)
    """), {"email": new_assignee_email, "name": new_assignee_name, "id": task_id})
    await _log_comment(db, task_id, f"Reassigned from {task['assignee_email'] or 'unassigned'} to {new_assignee_email} by {acting_email}")
    await db.commit()

    try:
        from app.routers.task_teams import add_member_to_task_chat
        if task["teams_chat_id"]:
            await add_member_to_task_chat(task["teams_chat_id"], new_assignee_email)
    except Exception as e:
        print(f"Task Teams member add skipped: {e}")

    return {"status": "ok"}


async def transfer_owner_internal(db: AsyncSession, task_id: str, acting_email: str, new_owner_email: str, new_owner_name: str) -> dict:
    task = await _get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if acting_email != task["owner_email"]:
        raise HTTPException(status_code=403, detail="Only the current owner can transfer ownership of a task")
    if not new_owner_email:
        raise HTTPException(status_code=400, detail="new_owner_email is required")

    await db.execute(text("""
        UPDATE tasks SET owner_email = :email, owner_name = :name, updated_at = NOW() WHERE id = CAST(:id AS UUID)
    """), {"email": new_owner_email, "name": new_owner_name, "id": task_id})
    await _log_comment(db, task_id, f"Ownership transferred from {task['owner_email']} to {new_owner_email}")
    await db.commit()

    try:
        from app.routers.task_teams import add_member_to_task_chat
        if task["teams_chat_id"]:
            await add_member_to_task_chat(task["teams_chat_id"], new_owner_email)
    except Exception as e:
        print(f"Task Teams member add skipped: {e}")

    return {"status": "ok"}


# ─── Tasks ──────────────────────────────────────────────────────────────────────
@router.get("/tasks")
async def list_tasks(
    email: str = None, scope: str = "company", source: str = None, status_filter: str = None,
    entity_type: str = None, entity_id: str = None, include_subtasks: bool = False,
    db: AsyncSession = Depends(get_db),
):
    where = ["1=1"]
    params = {}
    # "own"/"team" scope means "show me what's mine" — a subtask assigned to me is mine too,
    # so only top-level-only filtering applies to the unscoped/company-wide browse view.
    if not include_subtasks and scope not in ("own", "team"):
        where.append("parent_task_id IS NULL")
    if scope in ("own", "team") and email:
        where.append("""(owner_email = :email OR assignee_email = :email
                          OR EXISTS (SELECT 1 FROM task_watchers w WHERE w.task_id = t.id AND w.user_email = :email))""")
        params["email"] = email
    if source:
        where.append("source = :source")
        params["source"] = source
    if status_filter:
        where.append("status = :status_filter")
        params["status_filter"] = status_filter
    if entity_type:
        where.append("entity_type = :entity_type")
        params["entity_type"] = entity_type
    if entity_id:
        where.append("entity_id = CAST(:entity_id AS UUID)")
        params["entity_id"] = entity_id

    r = await db.execute(text(f"""
        SELECT t.*, (SELECT COUNT(*) FROM tasks s WHERE s.parent_task_id = t.id) AS subtask_count
        FROM tasks t WHERE {' AND '.join(where)}
        ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC
    """), params)
    return {"tasks": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.post("/tasks")
async def create_task(data: dict, db: AsyncSession = Depends(get_db)):
    owner_email = data.get("owner_email", "")
    if not data.get("title") or not owner_email:
        raise HTTPException(status_code=400, detail="title and owner_email are required")
    task_id = str(uuid.uuid4())
    assignee_email = data.get("assignee_email") or owner_email
    assignee_name = data.get("assignee_name") or data.get("owner_name") or ""

    task_number = gen_task_number()
    await db.execute(text("""
        INSERT INTO tasks (id, task_number, title, description, status, source, subject, owner_email, owner_name,
                            assignee_email, assignee_name, due_date, entity_type, entity_id,
                            sync_to_outlook, created_by_email, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :task_number, :title, :description, 'new', :source, :subject, :owner_email, :owner_name,
                :assignee_email, :assignee_name, CAST(NULLIF(:due_date,'') AS TIMESTAMP),
                :entity_type, CAST(NULLIF(:entity_id,'') AS UUID),
                :sync_to_outlook, :created_by_email, NOW(), NOW())
    """), {
        "id": task_id, "task_number": task_number, "title": data["title"], "description": data.get("description", ""),
        "source": data.get("source") or "manual", "subject": data.get("subject") or None,
        "owner_email": owner_email, "owner_name": data.get("owner_name", ""),
        "assignee_email": assignee_email, "assignee_name": assignee_name,
        "due_date": data.get("due_date") or "", "entity_type": data.get("entity_type"),
        "entity_id": data.get("entity_id") or "",
        "sync_to_outlook": bool(data.get("sync_to_outlook", False)),
        "created_by_email": data.get("created_by_email") or owner_email,
    })
    await db.commit()

    try:
        from app.routers.task_teams import create_task_teams_chat
        await create_task_teams_chat(task_id, data["title"], data.get("description", ""), owner_email, assignee_email, db)
    except Exception as e:
        print(f"Task Teams chat creation skipped: {e}")

    return {"status": "ok", "id": task_id, "task_number": task_number}


@router.post("/tasks/{parent_id}/subtasks")
async def create_subtask(parent_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    parent = await _get_task(db, parent_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Parent task not found")
    if parent["parent_task_id"] is not None:
        raise HTTPException(status_code=400, detail="Subtasks cannot themselves have subtasks")

    owner_email = data.get("owner_email", "")
    if not data.get("title") or not owner_email:
        raise HTTPException(status_code=400, detail="title and owner_email are required")
    task_id = str(uuid.uuid4())
    assignee_email = data.get("assignee_email") or owner_email
    assignee_name = data.get("assignee_name") or data.get("owner_name") or ""

    task_number = gen_task_number()
    await db.execute(text("""
        INSERT INTO tasks (id, task_number, parent_task_id, title, description, status, source, owner_email, owner_name,
                            assignee_email, assignee_name, due_date, entity_type, entity_id,
                            created_by_email, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :task_number, CAST(:parent_id AS UUID), :title, :description, 'new', :source,
                :owner_email, :owner_name, :assignee_email, :assignee_name,
                CAST(NULLIF(:due_date,'') AS TIMESTAMP), :entity_type, CAST(NULLIF(:entity_id,'') AS UUID),
                :created_by_email, NOW(), NOW())
    """), {
        "id": task_id, "task_number": task_number, "parent_id": parent_id, "title": data["title"], "description": data.get("description", ""),
        "source": data.get("source") or parent["source"],
        "owner_email": owner_email, "owner_name": data.get("owner_name", ""),
        "assignee_email": assignee_email, "assignee_name": assignee_name,
        "due_date": data.get("due_date") or "", "entity_type": data.get("entity_type"),
        "entity_id": data.get("entity_id") or "",
        "created_by_email": data.get("created_by_email") or owner_email,
    })
    await _log_comment(db, parent_id, f"Subtask \"{data['title']}\" added, owned by {owner_email}")
    await db.commit()
    return {"status": "ok", "id": task_id, "task_number": task_number}


@router.get("/tasks/{task_id}")
async def get_task(task_id: str, db: AsyncSession = Depends(get_db)):
    task = await _get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    subtasks = await db.execute(text("SELECT * FROM tasks WHERE parent_task_id = CAST(:id AS UUID) ORDER BY created_at ASC"), {"id": task_id})
    watchers = await db.execute(text("SELECT * FROM task_watchers WHERE task_id = CAST(:id AS UUID) ORDER BY created_at ASC"), {"id": task_id})
    comments = await db.execute(text("SELECT * FROM task_comments WHERE task_id = CAST(:id AS UUID) ORDER BY created_at ASC"), {"id": task_id})
    links = await db.execute(text("SELECT * FROM task_links WHERE task_id = CAST(:id AS UUID) ORDER BY created_at ASC"), {"id": task_id})

    task["subtasks"] = [_row(dict(r._mapping)) for r in subtasks.fetchall()]
    task["watchers"] = [_row(dict(r._mapping)) for r in watchers.fetchall()]
    task["comments"] = [_row(dict(r._mapping)) for r in comments.fetchall()]
    task["links"] = [_row(dict(r._mapping)) for r in links.fetchall()]
    return task


@router.put("/tasks/{task_id}")
async def update_task(task_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    task = await _get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    acting_email = data.get("acting_email", "")
    # Blank owner_email = legacy-imported/unclaimed task (see set_task_status_internal) — let
    # anyone edit it, and claim ownership for whoever does so it behaves normally afterward.
    if task["owner_email"] and acting_email not in (task["owner_email"], task["assignee_email"]):
        raise HTTPException(status_code=403, detail="Only the task's owner or assignee can edit it")

    await db.execute(text("""
        UPDATE tasks SET
            title = COALESCE(NULLIF(:title,''), title),
            description = COALESCE(:description, description),
            due_date = CAST(NULLIF(:due_date,'') AS TIMESTAMP),
            subject = COALESCE(:subject, subject),
            entity_type = COALESCE(:entity_type, entity_type),
            entity_id = COALESCE(CAST(NULLIF(:entity_id,'') AS UUID), entity_id),
            owner_email = CASE WHEN owner_email = '' THEN COALESCE(NULLIF(:acting_email,''), owner_email) ELSE owner_email END,
            owner_name  = CASE WHEN owner_email = '' THEN COALESCE(NULLIF(:acting_name,''), owner_name)  ELSE owner_name  END,
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "title": data.get("title", ""), "description": data.get("description"),
        "due_date": data.get("due_date") or "", "subject": data.get("subject"),
        "entity_type": data.get("entity_type"),
        "entity_id": data.get("entity_id") or "", "id": task_id,
        "acting_email": acting_email, "acting_name": data.get("acting_name", ""),
    })
    await db.commit()
    return {"status": "ok"}


@router.put("/tasks/{task_id}/status")
async def update_task_status(task_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    return await set_task_status_internal(db, task_id, data.get("acting_email", ""), data.get("status", ""), data.get("acting_name", ""))


@router.post("/tasks/{task_id}/reassign")
async def reassign_task(task_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    return await reassign_task_internal(
        db, task_id, data.get("acting_email", ""),
        data.get("new_assignee_email", ""), data.get("new_assignee_name", ""),
    )


@router.post("/tasks/{task_id}/transfer-owner")
async def transfer_owner(task_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    return await transfer_owner_internal(
        db, task_id, data.get("acting_email", ""),
        data.get("new_owner_email", ""), data.get("new_owner_name", ""),
    )


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, acting_email: str = "", db: AsyncSession = Depends(get_db)):
    task = await _get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task["owner_email"] and acting_email != task["owner_email"]:
        raise HTTPException(status_code=403, detail="Only the task owner can delete it")
    await db.execute(text("DELETE FROM tasks WHERE id = CAST(:id AS UUID)"), {"id": task_id})
    await db.commit()
    return {"status": "ok"}


# ─── Watchers ───────────────────────────────────────────────────────────────────
@router.post("/tasks/{task_id}/watchers")
async def add_watcher(task_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    task = await _get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    acting_email = data.get("acting_email", "")
    if acting_email not in (task["owner_email"], task["assignee_email"]):
        raise HTTPException(status_code=403, detail="Only the task's owner or assignee can add watchers")
    await db.execute(text("""
        INSERT INTO task_watchers (id, task_id, user_email, user_name, added_by_email, created_at)
        VALUES (gen_random_uuid(), CAST(:tid AS UUID), :email, :name, :by, NOW())
        ON CONFLICT (task_id, user_email) DO NOTHING
    """), {"tid": task_id, "email": data.get("user_email", ""), "name": data.get("user_name", ""), "by": acting_email})
    await db.commit()
    return {"status": "ok"}


@router.delete("/tasks/{task_id}/watchers/{watcher_email}")
async def remove_watcher(task_id: str, watcher_email: str, acting_email: str = "", db: AsyncSession = Depends(get_db)):
    task = await _get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if acting_email not in (task["owner_email"], task["assignee_email"], watcher_email):
        raise HTTPException(status_code=403, detail="Only the task's owner, assignee, or the watcher themselves can remove a watcher")
    await db.execute(text("DELETE FROM task_watchers WHERE task_id = CAST(:tid AS UUID) AND user_email = :email"),
                      {"tid": task_id, "email": watcher_email})
    await db.commit()
    return {"status": "ok"}


# ─── Comments ───────────────────────────────────────────────────────────────────
@router.get("/tasks/{task_id}/comments")
async def list_comments(task_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM task_comments WHERE task_id = CAST(:id AS UUID) ORDER BY created_at ASC"), {"id": task_id})
    return {"comments": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.post("/tasks/{task_id}/comments")
async def add_comment(task_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await _log_comment(db, task_id, data.get("content", ""), data.get("author_email", ""), data.get("author_name", ""), "web")
    await db.execute(text("UPDATE tasks SET updated_at = NOW() WHERE id = CAST(:id AS UUID)"), {"id": task_id})
    await db.commit()
    return {"status": "ok"}


# ─── Links & Files ──────────────────────────────────────────────────────────────
@router.get("/tasks/{task_id}/links")
async def list_links(task_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM task_links WHERE task_id = CAST(:id AS UUID) ORDER BY created_at ASC"), {"id": task_id})
    return {"links": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.post("/tasks/{task_id}/links")
async def add_link(task_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("label") or not data.get("url"):
        raise HTTPException(status_code=400, detail="label and url are required")
    link_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO task_links (id, task_id, label, url, added_by_email, created_at)
        VALUES (CAST(:id AS UUID), CAST(:tid AS UUID), :label, :url, :by, NOW())
    """), {"id": link_id, "tid": task_id, "label": data["label"], "url": data["url"], "by": data.get("acting_email", "")})
    await db.commit()
    return {"status": "ok", "id": link_id}


@router.delete("/tasks/{task_id}/links/{link_id}")
async def delete_link(task_id: str, link_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM task_links WHERE id = CAST(:id AS UUID) AND task_id = CAST(:tid AS UUID)"), {"id": link_id, "tid": task_id})
    await db.commit()
    return {"status": "ok"}
