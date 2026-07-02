from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import uuid

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
