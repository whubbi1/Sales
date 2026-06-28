from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import uuid, json
from datetime import datetime, timedelta

router = APIRouter()

DEFAULT_RETENTION = {
    "audit_logs":          {"module": "admin",   "days": 365},
    "hr_profiles":         {"module": "hr",      "days": 730},
    "hr_job_positions":    {"module": "hr",      "days": 730},
    "hr_job_descriptions": {"module": "hr",      "days": 730},
    "helpdesk_tickets":    {"module": "helpdesk","days": 365},
    "grc_requirements":    {"module": "grc",     "days": 1825},
    "grc_frameworks":      {"module": "grc",     "days": 1825},
    "backup_records":      {"module": "admin",   "days": 730},
}

async def seed_retention(db: AsyncSession):
    for table, cfg in DEFAULT_RETENTION.items():
        await db.execute(text("""
            INSERT INTO log_retention_settings (id, table_name, module, retention_days, updated_at)
            VALUES (gen_random_uuid(), :tbl, :mod, :days, NOW())
            ON CONFLICT (table_name) DO NOTHING
        """), {"tbl": table, "mod": cfg["module"], "days": cfg["days"]})
    await db.commit()

# ─── Log a change ──────────────────────────────────────────────────────────────
@router.post("/audit/log")
async def create_audit_log(data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        INSERT INTO audit_logs (id, table_name, record_id, action, changed_by, changed_at, old_values, new_values, module, description)
        VALUES (gen_random_uuid(), :table_name, :record_id, :action, :changed_by, NOW(),
                CAST(:old_values AS JSONB), CAST(:new_values AS JSONB), :module, :description)
    """), {
        "table_name":  data.get("table_name", ""),
        "record_id":   data.get("record_id", ""),
        "action":      data.get("action", "UPDATE"),
        "changed_by":  data.get("changed_by", ""),
        "old_values":  json.dumps(data.get("old_values")) if data.get("old_values") is not None else "null",
        "new_values":  json.dumps(data.get("new_values")) if data.get("new_values") is not None else "null",
        "module":      data.get("module", ""),
        "description": data.get("description", ""),
    })
    await db.commit()
    return {"status": "ok"}

# ─── Query audit logs ──────────────────────────────────────────────────────────
@router.get("/audit/logs")
async def get_audit_logs(
    table_name: str = "", module: str = "", action: str = "",
    changed_by: str = "", limit: int = 100, offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    conditions = []
    params: dict = {"limit": limit, "offset": offset}
    if table_name: conditions.append("table_name = :table_name"); params["table_name"] = table_name
    if module:     conditions.append("module = :module");         params["module"]     = module
    if action:     conditions.append("action = :action");         params["action"]     = action
    if changed_by: conditions.append("changed_by ILIKE :cb");    params["cb"]         = f"%{changed_by}%"
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    result = await db.execute(text(f"""
        SELECT id, table_name, record_id, action, changed_by, changed_at, module, description,
               old_values::text as old_values, new_values::text as new_values
        FROM audit_logs {where}
        ORDER BY changed_at DESC
        LIMIT :limit OFFSET :offset
    """), params)
    rows = [dict(r._mapping) for r in result.fetchall()]
    for r in rows:
        r["id"] = str(r["id"])
        if r["changed_at"]: r["changed_at"] = r["changed_at"].isoformat()
        try: r["old_values"] = json.loads(r["old_values"]) if r["old_values"] else None
        except: pass
        try: r["new_values"] = json.loads(r["new_values"]) if r["new_values"] else None
        except: pass
    count_result = await db.execute(text(f"SELECT COUNT(*) FROM audit_logs {where}"), {k:v for k,v in params.items() if k not in ("limit","offset")})
    total = count_result.scalar()
    return {"logs": rows, "total": total}

# ─── Retention settings ────────────────────────────────────────────────────────
@router.get("/audit/retention")
async def get_retention(db: AsyncSession = Depends(get_db)):
    await seed_retention(db)
    result = await db.execute(text("SELECT * FROM log_retention_settings ORDER BY module, table_name"))
    rows = [dict(r._mapping) for r in result.fetchall()]
    for r in rows:
        r["id"] = str(r["id"])
        if r["updated_at"]: r["updated_at"] = r["updated_at"].isoformat()
    return {"settings": rows}

@router.put("/audit/retention/{table_name}")
async def update_retention(table_name: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        INSERT INTO log_retention_settings (id, table_name, module, retention_days, updated_by, updated_at)
        VALUES (gen_random_uuid(), :tbl, :mod, :days, :by, NOW())
        ON CONFLICT (table_name) DO UPDATE SET retention_days=:days, updated_by=:by, updated_at=NOW()
    """), {
        "tbl":  table_name,
        "mod":  data.get("module", ""),
        "days": data.get("retention_days", 365),
        "by":   data.get("updated_by", ""),
    })
    await db.commit()
    return {"status": "ok"}

# ─── Cleanup old logs ──────────────────────────────────────────────────────────
@router.post("/audit/cleanup")
async def cleanup_logs(data: dict = {}, db: AsyncSession = Depends(get_db)):
    """Delete audit_logs entries older than their configured retention period."""
    result = await db.execute(text("SELECT table_name, retention_days FROM log_retention_settings"))
    settings = {r[0]: r[1] for r in result.fetchall()}
    audit_days = settings.get("audit_logs", 365)
    cutoff = datetime.utcnow() - timedelta(days=audit_days)
    del_result = await db.execute(text(
        "DELETE FROM audit_logs WHERE changed_at < :cutoff"
    ), {"cutoff": cutoff})
    deleted_count = del_result.rowcount
    await db.commit()
    return {
        "status": "ok",
        "deleted": deleted_count,
        "cutoff": cutoff.isoformat(),
        "retention_days": audit_days,
    }

# ─── User report configs ───────────────────────────────────────────────────────
@router.get("/reports/configs/{module}")
async def get_report_configs(module: str, user_email: str = "", db: AsyncSession = Depends(get_db)):
    params: dict = {"module": module}
    where = "WHERE module = :module"
    if user_email:
        where += " AND user_email = :email"
        params["email"] = user_email
    result = await db.execute(text(f"SELECT * FROM user_report_configs {where} ORDER BY created_at DESC"), params)
    rows = [dict(r._mapping) for r in result.fetchall()]
    for r in rows:
        r["id"] = str(r["id"])
        if isinstance(r.get("config"), str):
            try: r["config"] = json.loads(r["config"])
            except: r["config"] = {}
        if r.get("created_at"): r["created_at"] = r["created_at"].isoformat()
        if r.get("updated_at"): r["updated_at"] = r["updated_at"].isoformat()
    return {"configs": rows}

@router.post("/reports/configs/{module}")
async def create_report_config(module: str, data: dict, db: AsyncSession = Depends(get_db)):
    cfg_id = str(uuid.uuid4())
    if data.get("is_default"):
        await db.execute(text("""
            UPDATE user_report_configs SET is_default=FALSE
            WHERE user_email=:email AND module=:module
        """), {"email": data.get("user_email",""), "module": module})
    await db.execute(text("""
        INSERT INTO user_report_configs (id, user_email, module, report_name, config, is_default, created_at, updated_at)
        VALUES (gen_random_uuid(), :email, :module, :name, CAST(:config AS JSONB), :is_default, NOW(), NOW())
        ON CONFLICT (user_email, module, report_name) DO UPDATE
          SET config=CAST(:config AS JSONB), is_default=:is_default, updated_at=NOW()
    """), {
        "email": data.get("user_email",""),
        "module": module,
        "name": data.get("report_name","Default"),
        "config": json.dumps(data.get("config",{})),
        "is_default": data.get("is_default", False),
    })
    await db.commit()
    return {"status": "ok", "id": cfg_id}

@router.delete("/reports/configs/{config_id}")
async def delete_report_config(config_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM user_report_configs WHERE id=CAST(:id AS UUID)"), {"id": config_id})
    await db.commit()
    return {"status": "ok"}
