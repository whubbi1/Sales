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
    result = []
    for row in r.fetchall():
        d = dict(row._mapping)
        d["id"] = str(d["id"])
        result.append(d)
    return {"equipments": result}

@router.post("/equipments")
async def create_equipment(data: dict, db: AsyncSession = Depends(get_db)):
    eq_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO it_equipment
            (id, equipment_type, name, serial_number, purchase_date, purchase_price,
             entry_service_date, planned_end_service_date, end_service_date,
             end_service_reason, comment, assigned_email, assigned_name,
             created_at, updated_at)
        VALUES
            (CAST(:id AS UUID), :equipment_type, :name, :serial_number,
             CAST(NULLIF(:purchase_date,'') AS DATE), CAST(NULLIF(:purchase_price,'') AS NUMERIC),
             CAST(NULLIF(:entry_service_date,'') AS DATE), CAST(NULLIF(:planned_end_service_date,'') AS DATE),
             CAST(NULLIF(:end_service_date,'') AS DATE),
             :end_service_reason, :comment, :assigned_email, :assigned_name,
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
    })
    await db.commit()
    return {"status": "ok"}

@router.delete("/equipments/{eid}")
async def delete_equipment(eid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM it_equipment WHERE id = CAST(:id AS UUID)"), {"id": eid})
    await db.commit()
    return {"status": "ok"}
