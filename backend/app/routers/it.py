from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import uuid
import json

router = APIRouter()

EQUIPMENT_TYPES = ['IT', 'Furniture', 'Hardware', 'Others']

# ─── Meta ─────────────────────────────────────────────────────────────────────
@router.get("/meta")
async def get_meta():
    return {"equipment_types": EQUIPMENT_TYPES}

def _stringify_row(d: dict) -> dict:
    for k, v in d.items():
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
    return d

# ─── Equipment ────────────────────────────────────────────────────────────────
@router.get("/equipments")
async def list_equipments(
    equipment_type: str = None,
    assigned_email: str = None,
    search: str = None,
    db: AsyncSession = Depends(get_db)
):
    where = ["1=1"]
    params = {}
    if equipment_type:
        where.append("equipment_type = :equipment_type")
        params["equipment_type"] = equipment_type
    if assigned_email:
        where.append("assigned_email = :assigned_email")
        params["assigned_email"] = assigned_email
    if search:
        where.append("(name ILIKE :search OR serial_number ILIKE :search)")
        params["search"] = f"%{search}%"

    r = await db.execute(text(f"""
        SELECT * FROM it_equipment
        WHERE {' AND '.join(where)}
        ORDER BY created_at DESC
    """), params)
    result = [_stringify_row(dict(row._mapping)) for row in r.fetchall()]
    return {"equipments": result}

@router.post("/equipments")
async def create_equipment(data: dict, db: AsyncSession = Depends(get_db)):
    eq_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO it_equipment
            (id, equipment_type, name, serial_number, purchase_date, purchase_price,
             entry_service_date, planned_end_service_date, end_service_date,
             end_service_reason, comment, assigned_email, assigned_name,
             location_id, location_name,
             created_at, updated_at)
        VALUES
            (CAST(:id AS UUID), :equipment_type, :name, :serial_number,
             CAST(NULLIF(:purchase_date,'') AS DATE), CAST(NULLIF(:purchase_price,'') AS NUMERIC),
             CAST(NULLIF(:entry_service_date,'') AS DATE), CAST(NULLIF(:planned_end_service_date,'') AS DATE),
             CAST(NULLIF(:end_service_date,'') AS DATE),
             :end_service_reason, :comment, :assigned_email, :assigned_name,
             CAST(NULLIF(:location_id,'') AS UUID), :location_name,
             NOW(), NOW())
    """), {
        "id": eq_id,
        "equipment_type": data.get("equipment_type") or "IT",
        "name": data.get("name", ""),
        "serial_number": data.get("serial_number", ""),
        "purchase_date": data.get("purchase_date", ""),
        "purchase_price": data.get("purchase_price", ""),
        "entry_service_date": data.get("entry_service_date", ""),
        "planned_end_service_date": data.get("planned_end_service_date", ""),
        "end_service_date": data.get("end_service_date", ""),
        "end_service_reason": data.get("end_service_reason", ""),
        "comment": data.get("comment", ""),
        "assigned_email": data.get("assigned_email", ""),
        "assigned_name": data.get("assigned_name", ""),
        "location_id": data.get("location_id", ""),
        "location_name": data.get("location_name") or "All",
    })
    await db.commit()
    return {"status": "ok", "id": eq_id}

@router.put("/equipments/{eid}")
async def update_equipment(eid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE it_equipment SET
            equipment_type           = COALESCE(NULLIF(:equipment_type,''), equipment_type),
            name                     = COALESCE(NULLIF(:name,''), name),
            serial_number            = :serial_number,
            purchase_date            = CAST(NULLIF(:purchase_date,'') AS DATE),
            purchase_price           = CAST(NULLIF(:purchase_price,'') AS NUMERIC),
            entry_service_date       = CAST(NULLIF(:entry_service_date,'') AS DATE),
            planned_end_service_date = CAST(NULLIF(:planned_end_service_date,'') AS DATE),
            end_service_date         = CAST(NULLIF(:end_service_date,'') AS DATE),
            end_service_reason       = :end_service_reason,
            comment                  = :comment,
            assigned_email           = :assigned_email,
            assigned_name            = :assigned_name,
            location_id              = CAST(NULLIF(:location_id,'') AS UUID),
            location_name            = COALESCE(NULLIF(:location_name,''), location_name),
            updated_at               = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": eid,
        "equipment_type": data.get("equipment_type", ""),
        "name": data.get("name", ""),
        "serial_number": data.get("serial_number", ""),
        "purchase_date": data.get("purchase_date", ""),
        "purchase_price": data.get("purchase_price", ""),
        "entry_service_date": data.get("entry_service_date", ""),
        "planned_end_service_date": data.get("planned_end_service_date", ""),
        "end_service_date": data.get("end_service_date", ""),
        "end_service_reason": data.get("end_service_reason", ""),
        "comment": data.get("comment", ""),
        "assigned_email": data.get("assigned_email", ""),
        "assigned_name": data.get("assigned_name", ""),
        "location_id": data.get("location_id", ""),
        "location_name": data.get("location_name", ""),
    })
    await db.commit()
    return {"status": "ok"}

@router.delete("/equipments/{eid}")
async def delete_equipment(eid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM it_equipment WHERE id = CAST(:id AS UUID)"), {"id": eid})
    await db.commit()
    return {"status": "ok"}

# ─── Software ─────────────────────────────────────────────────────────────────
@router.get("/software")
async def list_software(search: str = None, db: AsyncSession = Depends(get_db)):
    where = ["1=1"]
    params = {}
    if search:
        where.append("(name ILIKE :search OR editor ILIKE :search)")
        params["search"] = f"%{search}%"

    r = await db.execute(text(f"""
        SELECT * FROM it_software
        WHERE {' AND '.join(where)}
        ORDER BY name ASC
    """), params)
    result = [_stringify_row(dict(row._mapping)) for row in r.fetchall()]
    return {"software": result}

@router.post("/software")
async def create_software(data: dict, db: AsyncSession = Depends(get_db)):
    sid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO it_software
            (id, name, editor, version, install_link, owner_email, owner_name,
             location_id, location_name, created_at, updated_at)
        VALUES
            (CAST(:id AS UUID), :name, :editor, :version, :install_link, :owner_email, :owner_name,
             CAST(NULLIF(:location_id,'') AS UUID), :location_name, NOW(), NOW())
    """), {
        "id": sid,
        "name": data.get("name", ""),
        "editor": data.get("editor", ""),
        "version": data.get("version", ""),
        "install_link": data.get("install_link", ""),
        "owner_email": data.get("owner_email", ""),
        "owner_name": data.get("owner_name", ""),
        "location_id": data.get("location_id", ""),
        "location_name": data.get("location_name") or "All",
    })
    await db.commit()
    return {"status": "ok", "id": sid}

@router.put("/software/{sid}")
async def update_software(sid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE it_software SET
            name         = COALESCE(NULLIF(:name,''), name),
            editor       = :editor,
            version      = :version,
            install_link = :install_link,
            owner_email  = :owner_email,
            owner_name   = :owner_name,
            location_id  = CAST(NULLIF(:location_id,'') AS UUID),
            location_name = COALESCE(NULLIF(:location_name,''), location_name),
            updated_at   = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": sid,
        "name": data.get("name", ""),
        "editor": data.get("editor", ""),
        "version": data.get("version", ""),
        "install_link": data.get("install_link", ""),
        "owner_email": data.get("owner_email", ""),
        "owner_name": data.get("owner_name", ""),
        "location_id": data.get("location_id", ""),
        "location_name": data.get("location_name", ""),
    })
    await db.commit()
    return {"status": "ok"}

@router.delete("/software/{sid}")
async def delete_software(sid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM it_software WHERE id = CAST(:id AS UUID)"), {"id": sid})
    await db.commit()
    return {"status": "ok"}

# ─── Applications ───────────────────────────────────────────────────────────────
@router.get("/applications")
async def list_applications(search: str = None, db: AsyncSession = Depends(get_db)):
    where = ["1=1"]
    params = {}
    if search:
        where.append("(name ILIKE :search OR editor ILIKE :search)")
        params["search"] = f"%{search}%"

    r = await db.execute(text(f"""
        SELECT * FROM it_applications
        WHERE {' AND '.join(where)}
        ORDER BY name ASC
    """), params)
    result = [_stringify_row(dict(row._mapping)) for row in r.fetchall()]
    return {"applications": result}

@router.post("/applications")
async def create_application(data: dict, db: AsyncSession = Depends(get_db)):
    aid = str(uuid.uuid4())
    all_locations = data.get("all_locations")
    if all_locations is None:
        all_locations = not data.get("location_ids")
    await db.execute(text("""
        INSERT INTO it_applications
            (id, name, editor, version, use, owner_email, owner_name,
             all_locations, location_ids, location_names, created_at, updated_at)
        VALUES
            (CAST(:id AS UUID), :name, :editor, :version, :use, :owner_email, :owner_name,
             :all_locations, CAST(:location_ids AS JSONB), CAST(:location_names AS JSONB), NOW(), NOW())
    """), {
        "id": aid,
        "name": data.get("name", ""),
        "editor": data.get("editor", ""),
        "version": data.get("version", ""),
        "use": data.get("use") or "",
        "owner_email": data.get("owner_email", ""),
        "owner_name": data.get("owner_name", ""),
        "all_locations": bool(all_locations),
        "location_ids": json.dumps(data.get("location_ids") or []),
        "location_names": json.dumps(data.get("location_names") or []),
    })
    await db.commit()
    return {"status": "ok", "id": aid}

@router.put("/applications/{aid}")
async def update_application(aid: str, data: dict, db: AsyncSession = Depends(get_db)):
    all_locations = data.get("all_locations")
    if all_locations is None:
        all_locations = not data.get("location_ids")
    await db.execute(text("""
        UPDATE it_applications SET
            name           = COALESCE(NULLIF(:name,''), name),
            editor         = :editor,
            version        = :version,
            use            = :use,
            owner_email    = :owner_email,
            owner_name     = :owner_name,
            all_locations  = :all_locations,
            location_ids   = CAST(:location_ids AS JSONB),
            location_names = CAST(:location_names AS JSONB),
            updated_at     = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": aid,
        "name": data.get("name", ""),
        "editor": data.get("editor", ""),
        "version": data.get("version", ""),
        "use": data.get("use", ""),
        "owner_email": data.get("owner_email", ""),
        "owner_name": data.get("owner_name", ""),
        "all_locations": bool(all_locations),
        "location_ids": json.dumps(data.get("location_ids") or []),
        "location_names": json.dumps(data.get("location_names") or []),
    })
    await db.commit()
    return {"status": "ok"}

@router.delete("/applications/{aid}")
async def delete_application(aid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM it_applications WHERE id = CAST(:id AS UUID)"), {"id": aid})
    await db.commit()
    return {"status": "ok"}

# ─── Application submodules (used by the Development module to scope a test plan) ──
@router.get("/applications/{aid}/submodules")
async def list_application_submodules(aid: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT * FROM it_application_submodules WHERE application_id = CAST(:aid AS UUID) ORDER BY name
    """), {"aid": aid})
    return {"submodules": [_stringify_row(dict(row._mapping)) for row in r.fetchall()]}

@router.post("/applications/{aid}/submodules")
async def create_application_submodule(aid: str, data: dict, db: AsyncSession = Depends(get_db)):
    sid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO it_application_submodules (id, application_id, name, description, created_at, updated_at)
        VALUES (CAST(:id AS UUID), CAST(:aid AS UUID), :name, :description, NOW(), NOW())
    """), {"id": sid, "aid": aid, "name": data.get("name", ""), "description": data.get("description", "")})
    await db.commit()
    return {"status": "ok", "id": sid}

@router.put("/applications/{aid}/submodules/{sid}")
async def update_application_submodule(aid: str, sid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE it_application_submodules SET
            name = COALESCE(NULLIF(:name,''), name),
            description = COALESCE(:description, description),
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID) AND application_id = CAST(:aid AS UUID)
    """), {"id": sid, "aid": aid, "name": data.get("name", ""), "description": data.get("description")})
    await db.commit()
    return {"status": "ok"}

@router.delete("/applications/{aid}/submodules/{sid}")
async def delete_application_submodule(aid: str, sid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        DELETE FROM it_application_submodules WHERE id = CAST(:id AS UUID) AND application_id = CAST(:aid AS UUID)
    """), {"id": sid, "aid": aid})
    await db.commit()
    return {"status": "ok"}

# ─── Application environments (Definition/Hosting/Name/URL) ───────────────────
@router.get("/applications/{aid}/environments")
async def list_application_environments(aid: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT * FROM it_application_environments WHERE application_id = CAST(:aid AS UUID) ORDER BY name
    """), {"aid": aid})
    return {"environments": [_stringify_row(dict(row._mapping)) for row in r.fetchall()]}

@router.post("/applications/{aid}/environments")
async def create_application_environment(aid: str, data: dict, db: AsyncSession = Depends(get_db)):
    eid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO it_application_environments (id, application_id, definition, hosting_name, name, url, created_at, updated_at)
        VALUES (CAST(:id AS UUID), CAST(:aid AS UUID), :definition, :hosting_name, :name, :url, NOW(), NOW())
    """), {"id": eid, "aid": aid, "definition": data.get("definition", ""), "hosting_name": data.get("hosting_name", ""),
           "name": data.get("name", ""), "url": data.get("url", "")})
    await db.commit()
    return {"status": "ok", "id": eid}

@router.put("/applications/{aid}/environments/{eid}")
async def update_application_environment(aid: str, eid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE it_application_environments SET
            definition = COALESCE(NULLIF(:definition,''), definition),
            hosting_name = COALESCE(NULLIF(:hosting_name,''), hosting_name),
            name = COALESCE(NULLIF(:name,''), name),
            url = COALESCE(:url, url),
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID) AND application_id = CAST(:aid AS UUID)
    """), {"id": eid, "aid": aid, "definition": data.get("definition", ""), "hosting_name": data.get("hosting_name", ""),
           "name": data.get("name", ""), "url": data.get("url")})
    await db.commit()
    return {"status": "ok"}

@router.delete("/applications/{aid}/environments/{eid}")
async def delete_application_environment(aid: str, eid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        DELETE FROM it_application_environments WHERE id = CAST(:id AS UUID) AND application_id = CAST(:aid AS UUID)
    """), {"id": eid, "aid": aid})
    await db.commit()
    return {"status": "ok"}

# ─── Application links (free-form documents/resources, each with a description) ─
@router.get("/applications/{aid}/links")
async def list_application_links(aid: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT * FROM it_application_links WHERE application_id = CAST(:aid AS UUID) ORDER BY created_at DESC
    """), {"aid": aid})
    return {"links": [_stringify_row(dict(row._mapping)) for row in r.fetchall()]}

@router.post("/applications/{aid}/links")
async def create_application_link(aid: str, data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("url"):
        raise HTTPException(status_code=400, detail="url is required")
    lid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO it_application_links (id, application_id, url, description, created_at, updated_at)
        VALUES (CAST(:id AS UUID), CAST(:aid AS UUID), :url, :description, NOW(), NOW())
    """), {"id": lid, "aid": aid, "url": data["url"], "description": data.get("description", "")})
    await db.commit()
    return {"status": "ok", "id": lid}

@router.put("/applications/{aid}/links/{lid}")
async def update_application_link(aid: str, lid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE it_application_links SET
            url = COALESCE(NULLIF(:url,''), url),
            description = COALESCE(:description, description),
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID) AND application_id = CAST(:aid AS UUID)
    """), {"id": lid, "aid": aid, "url": data.get("url", ""), "description": data.get("description")})
    await db.commit()
    return {"status": "ok"}

@router.delete("/applications/{aid}/links/{lid}")
async def delete_application_link(aid: str, lid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        DELETE FROM it_application_links WHERE id = CAST(:id AS UUID) AND application_id = CAST(:aid AS UUID)
    """), {"id": lid, "aid": aid})
    await db.commit()
    return {"status": "ok"}

# ─── Saved report views (Equipment / Software / Application) ──────────────────
@router.get("/report-views")
async def list_report_views(module: str, user_email: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT * FROM it_report_views
        WHERE module = :module AND user_email = :user_email
        ORDER BY name ASC
    """), {"module": module, "user_email": user_email})
    result = [_stringify_row(dict(row._mapping)) for row in r.fetchall()]
    return {"views": result}

@router.post("/report-views")
async def create_report_view(data: dict, db: AsyncSession = Depends(get_db)):
    vid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO it_report_views
            (id, user_email, module, name, columns, filters, sort_field, sort_dir, created_at, updated_at)
        VALUES
            (CAST(:id AS UUID), :user_email, :module, :name, CAST(:columns AS JSONB), CAST(:filters AS JSONB),
             :sort_field, :sort_dir, NOW(), NOW())
    """), {
        "id": vid,
        "user_email": data.get("user_email", ""),
        "module": data.get("module", ""),
        "name": data.get("name", ""),
        "columns": json.dumps(data.get("columns") or []),
        "filters": json.dumps(data.get("filters") or {}),
        "sort_field": data.get("sort_field") or "",
        "sort_dir": data.get("sort_dir") or "asc",
    })
    await db.commit()
    return {"status": "ok", "id": vid}

@router.put("/report-views/{vid}")
async def update_report_view(vid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE it_report_views SET
            name       = COALESCE(NULLIF(:name,''), name),
            columns    = CAST(:columns AS JSONB),
            filters    = CAST(:filters AS JSONB),
            sort_field = :sort_field,
            sort_dir   = :sort_dir,
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": vid,
        "name": data.get("name", ""),
        "columns": json.dumps(data.get("columns") or []),
        "filters": json.dumps(data.get("filters") or {}),
        "sort_field": data.get("sort_field") or "",
        "sort_dir": data.get("sort_dir") or "asc",
    })
    await db.commit()
    return {"status": "ok"}

@router.delete("/report-views/{vid}")
async def delete_report_view(vid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM it_report_views WHERE id = CAST(:id AS UUID)"), {"id": vid})
    await db.commit()
    return {"status": "ok"}
