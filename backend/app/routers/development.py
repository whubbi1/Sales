from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import uuid
from datetime import datetime

router = APIRouter()

APPLICATIONS = ['WHUBBI', 'Karanext', 'Payfit', 'SAP', 'SharePoint', 'Microsoft 365', 'Other']
PIPELINE_STATUSES = ['to_be_planned', 'planned', 'in_development', 'under_testing', 'in_production', 'closed']
REQUEST_STATUSES = ['open', 'in_progress', 'in_testing', 'done', 'cancelled']
REQUEST_PRIORITIES = ['low', 'medium', 'high', 'critical']
REQUEST_TYPES = ['feature', 'bug', 'enhancement', 'change_request']

def _gen_req_number():
    dt = datetime.utcnow()
    return f"DEV-{dt.year}{dt.month:02d}-{uuid.uuid4().hex[:6].upper()}"

def _gen_pipeline_code():
    dt = datetime.utcnow()
    return f"PL-{dt.year}{dt.month:02d}-{uuid.uuid4().hex[:4].upper()}"

# ─── Meta ─────────────────────────────────────────────────────────────────────
@router.get("/meta")
async def get_meta():
    return {
        "applications": APPLICATIONS,
        "pipeline_statuses": PIPELINE_STATUSES,
        "request_statuses": REQUEST_STATUSES,
        "request_priorities": REQUEST_PRIORITIES,
        "request_types": REQUEST_TYPES,
    }

# ─── Development Requests (sourced from helpdesk tickets of type development_request) ──
@router.get("/requests")
async def list_requests(
    application: str = None,
    status: str = None,
    pipeline_id: str = None,
    search: str = None,
    db: AsyncSession = Depends(get_db)
):
    where = ["t.ticket_type = 'development_request'"]
    params = {}
    if application:
        where.append("t.application = :application")
        params["application"] = application
    if status:
        where.append("t.status = :status")
        params["status"] = status
    if pipeline_id:
        where.append("t.dev_pipeline_id = CAST(:pipeline_id AS UUID)")
        params["pipeline_id"] = pipeline_id
    if search:
        where.append("(t.title ILIKE :search OR t.ticket_number ILIKE :search OR t.requester_name ILIKE :search)")
        params["search"] = f"%{search}%"

    r = await db.execute(text(f"""
        SELECT t.id,
               t.ticket_number  AS request_number,
               t.title, t.description, t.status, t.priority,
               t.application,
               t.requester_email, t.requester_name,
               t.assignee_email, t.assignee_name,
               t.dev_pipeline_id AS pipeline_id,
               t.created_at, t.updated_at,
               dp.name          AS pipeline_name,
               dp.pipeline_code,
               dp.release_number
        FROM tickets t
        LEFT JOIN development_pipelines dp ON t.dev_pipeline_id = dp.id
        WHERE {' AND '.join(where)}
        ORDER BY t.created_at DESC
    """), params)
    rows = r.fetchall()
    result = []
    for row in rows:
        d = dict(row._mapping)
        d["id"] = str(d["id"])
        if d.get("pipeline_id"):
            d["pipeline_id"] = str(d["pipeline_id"])
        result.append(d)
    return {"requests": result}

@router.get("/requests/{rid}")
async def get_request(rid: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT t.id,
               t.ticket_number  AS request_number,
               t.title, t.description, t.status, t.priority,
               t.application,
               t.requester_email, t.requester_name,
               t.assignee_email, t.assignee_name,
               t.dev_pipeline_id AS pipeline_id,
               t.created_at, t.updated_at,
               c.name AS category_name, c.icon AS category_icon,
               dp.name          AS pipeline_name,
               dp.pipeline_code,
               dp.release_number
        FROM tickets t
        LEFT JOIN ticket_categories c   ON t.category_id     = c.id
        LEFT JOIN development_pipelines dp ON t.dev_pipeline_id = dp.id
        WHERE t.id = CAST(:id AS UUID) AND t.ticket_type = 'development_request'
    """), {"id": rid})
    row = r.fetchone()
    if not row:
        return {"request": None, "activity": []}
    req = dict(row._mapping)
    req["id"] = str(req["id"])
    if req.get("pipeline_id"):
        req["pipeline_id"] = str(req["pipeline_id"])

    a = await db.execute(text("""
        SELECT * FROM dev_request_activity
        WHERE request_id = CAST(:id AS UUID)
        ORDER BY created_at ASC
    """), {"id": rid})
    activity = []
    for ar in a.fetchall():
        ad = dict(ar._mapping)
        ad["id"] = str(ad["id"])
        ad["request_id"] = str(ad["request_id"])
        activity.append(ad)
    return {"request": req, "activity": activity}

@router.put("/requests/{rid}")
async def update_request(rid: str, data: dict, db: AsyncSession = Depends(get_db)):
    cur = await db.execute(text("""
        SELECT t.*, dp.name AS pipeline_name
        FROM tickets t
        LEFT JOIN development_pipelines dp ON t.dev_pipeline_id = dp.id
        WHERE t.id = CAST(:id AS UUID) AND t.ticket_type = 'development_request'
    """), {"id": rid})
    current = cur.fetchone()
    if not current:
        return {"status": "not_found"}
    cm = dict(current._mapping)

    track = {
        "title":          "Title",
        "status":         "Status",
        "priority":       "Priority",
        "application":    "Application",
        "assignee_email": "Assignee",
        "pipeline_id":    "Pipeline",
    }
    changes = []
    for field, label in track.items():
        if field not in data:
            continue
        db_col = "dev_pipeline_id" if field == "pipeline_id" else field
        old_val = str(cm.get(db_col) or "")
        new_val = str(data.get(field) or "")
        if old_val != new_val:
            changes.append((field, label, old_val, new_val))

    await db.execute(text("""
        UPDATE tickets SET
            title           = :title,
            status          = :status,
            priority        = :priority,
            application     = :application,
            assignee_email  = :assignee_email,
            assignee_name   = :assignee_name,
            dev_pipeline_id = CAST(:dev_pipeline_id AS UUID),
            updated_at      = NOW()
        WHERE id = CAST(:id AS UUID) AND ticket_type = 'development_request'
    """), {
        "id":              rid,
        "title":           data.get("title",          str(cm.get("title", ""))),
        "status":          data.get("status",         str(cm.get("status", ""))),
        "priority":        data.get("priority",       str(cm.get("priority", ""))),
        "application":     data.get("application",    str(cm.get("application") or "")),
        "assignee_email":  data.get("assignee_email", str(cm.get("assignee_email") or "")),
        "assignee_name":   data.get("assignee_name",  str(cm.get("assignee_name") or "")),
        "dev_pipeline_id": data.get("pipeline_id") or None,
    })

    for field, label, old_val, new_val in changes:
        await db.execute(text("""
            INSERT INTO dev_request_activity
                (id, request_id, content, field_changed, old_value, new_value, author_email, author_name, is_system, created_at)
            VALUES
                (gen_random_uuid(), CAST(:request_id AS UUID), :content, :field, :old_val, :new_val, :author_email, :author_name, true, NOW())
        """), {
            "request_id":   rid,
            "content":      f"Changed {label}: '{old_val or '(empty)'}' → '{new_val or '(empty)'}'",
            "field":        field,
            "old_val":      old_val,
            "new_val":      new_val,
            "author_email": data.get("updated_by", ""),
            "author_name":  data.get("updated_by_name", "System"),
        })

    await db.commit()
    return {"status": "ok", "changes": len(changes)}

@router.post("/requests/{rid}/activity")
async def add_activity(rid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        INSERT INTO dev_request_activity
            (id, request_id, content, author_email, author_name, is_system, created_at)
        VALUES
            (gen_random_uuid(), CAST(:request_id AS UUID), :content, :author_email, :author_name, false, NOW())
    """), {
        "request_id":   rid,
        "content":      data.get("content", ""),
        "author_email": data.get("author_email", ""),
        "author_name":  data.get("author_name", ""),
    })
    await db.commit()
    return {"status": "ok"}

# ─── Development Pipelines ────────────────────────────────────────────────────
@router.get("/pipelines")
async def list_pipelines(
    application: str = None,
    status: str = None,
    db: AsyncSession = Depends(get_db)
):
    where = ["1=1"]
    params = {}
    if application:
        where.append("dp.application = :application")
        params["application"] = application
    if status:
        where.append("dp.status = :status")
        params["status"] = status

    r = await db.execute(text(f"""
        SELECT dp.*,
               COUNT(t.id) AS request_count
        FROM development_pipelines dp
        LEFT JOIN tickets t ON t.dev_pipeline_id = dp.id AND t.ticket_type = 'development_request'
        WHERE {' AND '.join(where)}
        GROUP BY dp.id
        ORDER BY dp.created_at DESC
    """), params)
    rows = r.fetchall()
    result = []
    for row in rows:
        d = dict(row._mapping)
        d["id"] = str(d["id"])
        result.append(d)
    return {"pipelines": result}

@router.post("/pipelines")
async def create_pipeline(data: dict, db: AsyncSession = Depends(get_db)):
    pl_id = str(uuid.uuid4())
    pl_code = data.get("pipeline_code") or _gen_pipeline_code()
    await db.execute(text("""
        INSERT INTO development_pipelines
            (id, pipeline_code, name, description, application, status, release_number, created_at, updated_at)
        VALUES
            (CAST(:id AS UUID), :pipeline_code, :name, :description, :application, :status, :release_number, NOW(), NOW())
    """), {
        "id":             pl_id,
        "pipeline_code":  pl_code,
        "name":           data.get("name", ""),
        "description":    data.get("description", ""),
        "application":    data.get("application", ""),
        "status":         data.get("status", "to_be_planned"),
        "release_number": data.get("release_number", ""),
    })
    await db.commit()
    return {"status": "ok", "id": pl_id, "pipeline_code": pl_code}

@router.get("/pipelines/{pid}")
async def get_pipeline(pid: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        text("SELECT * FROM development_pipelines WHERE id = CAST(:id AS UUID)"),
        {"id": pid}
    )
    row = r.fetchone()
    if not row:
        return {"pipeline": None, "requests": []}
    pl = dict(row._mapping)
    pl["id"] = str(pl["id"])

    rr = await db.execute(text("""
        SELECT id, ticket_number AS request_number, title, status, priority,
               application, assignee_email, assignee_name, created_at
        FROM tickets
        WHERE dev_pipeline_id = CAST(:id AS UUID) AND ticket_type = 'development_request'
        ORDER BY created_at DESC
    """), {"id": pid})
    requests = []
    for req in rr.fetchall():
        d = dict(req._mapping)
        d["id"] = str(d["id"])
        requests.append(d)
    return {"pipeline": pl, "requests": requests}

@router.put("/pipelines/{pid}")
async def update_pipeline(pid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE development_pipelines SET
            pipeline_code  = COALESCE(NULLIF(:pipeline_code, ''), pipeline_code),
            name           = COALESCE(NULLIF(:name, ''), name),
            description    = :description,
            application    = COALESCE(NULLIF(:application, ''), application),
            status         = COALESCE(NULLIF(:status, ''), status),
            release_number = :release_number,
            updated_at     = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id":             pid,
        "pipeline_code":  data.get("pipeline_code", ""),
        "name":           data.get("name", ""),
        "description":    data.get("description", ""),
        "application":    data.get("application", ""),
        "status":         data.get("status", ""),
        "release_number": data.get("release_number", ""),
    })
    await db.commit()
    return {"status": "ok"}

@router.delete("/pipelines/{pid}")
async def delete_pipeline(pid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(
        text("UPDATE tickets SET dev_pipeline_id = NULL WHERE dev_pipeline_id = CAST(:id AS UUID) AND ticket_type = 'development_request'"),
        {"id": pid}
    )
    await db.execute(
        text("DELETE FROM development_pipelines WHERE id = CAST(:id AS UUID)"),
        {"id": pid}
    )
    await db.commit()
    return {"status": "ok"}

# ─── Test Scripts ─────────────────────────────────────────────────────────────
@router.get("/test-scripts")
async def list_test_scripts(
    pipeline_id: str = None,
    request_id: str = None,
    db: AsyncSession = Depends(get_db)
):
    where = ["1=1"]
    params = {}
    if pipeline_id:
        where.append("ts.pipeline_id = CAST(:pipeline_id AS UUID)")
        params["pipeline_id"] = pipeline_id
    if request_id:
        where.append("ts.request_id = CAST(:request_id AS UUID)")
        params["request_id"] = request_id

    r = await db.execute(text(f"""
        SELECT ts.*,
               dp.name AS pipeline_name,
               dp.pipeline_code,
               dr.title AS request_title,
               dr.ticket_number AS request_number
        FROM test_scripts ts
        LEFT JOIN development_pipelines dp ON ts.pipeline_id = dp.id
        LEFT JOIN tickets dr ON ts.request_id = dr.id AND dr.ticket_type = 'development_request'
        WHERE {' AND '.join(where)}
        ORDER BY ts.created_at DESC
    """), params)
    rows = r.fetchall()
    result = []
    for row in rows:
        d = dict(row._mapping)
        d["id"] = str(d["id"])
        if d.get("pipeline_id"):
            d["pipeline_id"] = str(d["pipeline_id"])
        if d.get("request_id"):
            d["request_id"] = str(d["request_id"])
        result.append(d)
    return {"scripts": result}

@router.post("/test-scripts")
async def create_test_script(data: dict, db: AsyncSession = Depends(get_db)):
    sid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO test_scripts
            (id, title, application, description, script_steps, expected_results, request_id, pipeline_id, created_by, created_at, updated_at)
        VALUES
            (CAST(:id AS UUID), :title, :application, :description, :script_steps, :expected_results,
             CAST(:request_id AS UUID), CAST(:pipeline_id AS UUID), :created_by, NOW(), NOW())
    """), {
        "id":               sid,
        "title":            data.get("title", ""),
        "application":      data.get("application", ""),
        "description":      data.get("description", ""),
        "script_steps":     data.get("script_steps", ""),
        "expected_results": data.get("expected_results", ""),
        "request_id":       data.get("request_id") or None,
        "pipeline_id":      data.get("pipeline_id") or None,
        "created_by":       data.get("created_by", ""),
    })
    await db.commit()
    return {"status": "ok", "id": sid}

@router.put("/test-scripts/{sid}")
async def update_test_script(sid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE test_scripts SET
            title            = COALESCE(NULLIF(:title, ''), title),
            application      = COALESCE(NULLIF(:application, ''), application),
            description      = :description,
            script_steps     = :script_steps,
            expected_results = :expected_results,
            request_id       = CAST(:request_id AS UUID),
            pipeline_id      = CAST(:pipeline_id AS UUID),
            updated_at       = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id":               sid,
        "title":            data.get("title", ""),
        "application":      data.get("application", ""),
        "description":      data.get("description", ""),
        "script_steps":     data.get("script_steps", ""),
        "expected_results": data.get("expected_results", ""),
        "request_id":       data.get("request_id") or None,
        "pipeline_id":      data.get("pipeline_id") or None,
    })
    await db.commit()
    return {"status": "ok"}

@router.delete("/test-scripts/{sid}")
async def delete_test_script(sid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(
        text("DELETE FROM test_executions WHERE script_id = CAST(:id AS UUID)"),
        {"id": sid}
    )
    await db.execute(
        text("DELETE FROM test_scripts WHERE id = CAST(:id AS UUID)"),
        {"id": sid}
    )
    await db.commit()
    return {"status": "ok"}

# ─── Test Executions ──────────────────────────────────────────────────────────
@router.get("/test-executions")
async def list_test_executions(
    pipeline_id: str = None,
    script_id: str = None,
    db: AsyncSession = Depends(get_db)
):
    where = ["1=1"]
    params = {}
    if pipeline_id:
        where.append("te.pipeline_id = CAST(:pipeline_id AS UUID)")
        params["pipeline_id"] = pipeline_id
    if script_id:
        where.append("te.script_id = CAST(:script_id AS UUID)")
        params["script_id"] = script_id

    r = await db.execute(text(f"""
        SELECT te.*,
               ts.title AS script_title,
               ts.application,
               dp.name AS pipeline_name,
               dp.pipeline_code
        FROM test_executions te
        LEFT JOIN test_scripts          ts ON te.script_id   = ts.id
        LEFT JOIN development_pipelines dp ON te.pipeline_id = dp.id
        WHERE {' AND '.join(where)}
        ORDER BY te.created_at DESC
    """), params)
    rows = r.fetchall()
    result = []
    for row in rows:
        d = dict(row._mapping)
        d["id"] = str(d["id"])
        if d.get("script_id"):
            d["script_id"] = str(d["script_id"])
        if d.get("pipeline_id"):
            d["pipeline_id"] = str(d["pipeline_id"])
        result.append(d)
    return {"executions": result}

@router.post("/test-executions")
async def create_test_execution(data: dict, db: AsyncSession = Depends(get_db)):
    eid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO test_executions
            (id, script_id, pipeline_id, status, result, executed_by, notes, created_at)
        VALUES
            (CAST(:id AS UUID), CAST(:script_id AS UUID), CAST(:pipeline_id AS UUID),
             :status, :result, :executed_by, :notes, NOW())
    """), {
        "id":          eid,
        "script_id":   data.get("script_id") or None,
        "pipeline_id": data.get("pipeline_id") or None,
        "status":      data.get("status", "not_started"),
        "result":      data.get("result", ""),
        "executed_by": data.get("executed_by", ""),
        "notes":       data.get("notes", ""),
    })
    await db.commit()
    return {"status": "ok", "id": eid}

@router.put("/test-executions/{eid}")
async def update_test_execution(eid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE test_executions SET
            status      = COALESCE(NULLIF(:status, ''), status),
            result      = :result,
            executed_by = COALESCE(NULLIF(:executed_by, ''), executed_by),
            notes       = :notes,
            executed_at = CASE WHEN :status IN ('passed', 'failed') THEN NOW() ELSE executed_at END
        WHERE id = CAST(:id AS UUID)
    """), {
        "id":          eid,
        "status":      data.get("status", ""),
        "result":      data.get("result", ""),
        "executed_by": data.get("executed_by", ""),
        "notes":       data.get("notes", ""),
    })
    await db.commit()
    return {"status": "ok"}

@router.delete("/test-executions/{eid}")
async def delete_test_execution(eid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(
        text("DELETE FROM test_executions WHERE id = CAST(:id AS UUID)"),
        {"id": eid}
    )
    await db.commit()
    return {"status": "ok"}
