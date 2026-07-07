# backend/app/routers/finance.py
# Finance module: Suppliers, Contract Lifecycle Management, Purchasing, Supplier Invoicing.
# Raw-SQL, dict-based (no ORM/Pydantic) — matches legal.py/partners.py, the convention for
# every module added after the initial ORM-based Sales module.
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.services.ids import next_internal_id
from app.routers.hr import upload_to_s3, s3_ref_to_presigned
from datetime import date
import uuid

router = APIRouter()


def _row(d: dict) -> dict:
    for k, v in d.items():
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
    return d


def _num(v):
    return float(v) if v not in (None, "") else None


def _date(v):
    # asyncpg infers the bind parameter's PG type from the query and expects an actual
    # date object client-side — it won't parse ISO strings itself, even with CAST(... AS DATE).
    if not v:
        return None
    if isinstance(v, date):
        return v
    return date.fromisoformat(str(v)[:10])


# ─── Suppliers ────────────────────────────────────────────────────────────────
SUPPLIER_FIELDS = ["name", "contact_name", "email", "phone", "sector", "country", "status", "assigned_to", "assigned_to_email", "notes"]


@router.get("/suppliers")
async def list_suppliers(search: str = None, db: AsyncSession = Depends(get_db)):
    where, params = "", {}
    if search:
        where = "WHERE name ILIKE :q OR contact_name ILIKE :q"
        params["q"] = f"%{search}%"
    r = await db.execute(text(f"SELECT * FROM finance_suppliers {where} ORDER BY name"), params)
    return [_row(dict(row._mapping)) for row in r.fetchall()]


@router.post("/suppliers")
async def create_supplier(data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="name is required")
    supplier_id = str(uuid.uuid4())
    internal_id = await next_internal_id(db, "finance_supplier_id_seq", "SUP")
    await db.execute(text("""
        INSERT INTO finance_suppliers (id, internal_id, name, contact_name, email, phone, sector, country,
                                        status, assigned_to, assigned_to_email, notes, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :internal_id, :name, :contact_name, :email, :phone, :sector, :country,
                :status, :assigned_to, :assigned_to_email, :notes, NOW(), NOW())
    """), {
        "id": supplier_id, "internal_id": internal_id,
        "name": data["name"], "contact_name": data.get("contact_name"), "email": data.get("email"),
        "phone": data.get("phone"), "sector": data.get("sector"), "country": data.get("country"),
        "status": data.get("status") or "active",
        "assigned_to": data.get("assigned_to"), "assigned_to_email": data.get("assigned_to_email"),
        "notes": data.get("notes"),
    })
    await db.commit()
    return await get_supplier(supplier_id, db)


@router.get("/suppliers/{supplier_id}")
async def get_supplier(supplier_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM finance_suppliers WHERE id = CAST(:id AS UUID)"), {"id": supplier_id})
    row = r.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return _row(dict(row._mapping))


@router.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    existing = await get_supplier(supplier_id, db)
    merged = {**existing, **{k: v for k, v in data.items() if k in SUPPLIER_FIELDS}}
    await db.execute(text("""
        UPDATE finance_suppliers SET name=:name, contact_name=:contact_name, email=:email, phone=:phone,
            sector=:sector, country=:country, status=:status, assigned_to=:assigned_to,
            assigned_to_email=:assigned_to_email, notes=:notes, updated_at=NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": supplier_id, "name": merged["name"], "contact_name": merged.get("contact_name"),
        "email": merged.get("email"), "phone": merged.get("phone"), "sector": merged.get("sector"),
        "country": merged.get("country"), "status": merged.get("status") or "active",
        "assigned_to": merged.get("assigned_to"), "assigned_to_email": merged.get("assigned_to_email"),
        "notes": merged.get("notes"),
    })
    await db.commit()
    return await get_supplier(supplier_id, db)


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM finance_suppliers WHERE id = CAST(:id AS UUID)"), {"id": supplier_id})
    await db.commit()
    return {"status": "deleted"}


# ─── Contracts ────────────────────────────────────────────────────────────────
CONTRACT_FIELDS = ["supplier_id", "contract_name", "start_date", "end_date", "contract_value", "status", "assigned_to", "assigned_to_email", "notes"]

_CONTRACT_SELECT = """
    SELECT c.*, s.name AS supplier_name, s.internal_id AS supplier_internal_id
    FROM finance_contracts c LEFT JOIN finance_suppliers s ON s.id = c.supplier_id
"""


@router.get("/contracts")
async def list_contracts(search: str = None, supplier_id: str = None, db: AsyncSession = Depends(get_db)):
    where, params = [], {}
    if search:
        where.append("c.contract_name ILIKE :q")
        params["q"] = f"%{search}%"
    if supplier_id:
        where.append("c.supplier_id = CAST(:sid AS UUID)")
        params["sid"] = supplier_id
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    r = await db.execute(text(f"{_CONTRACT_SELECT} {clause} ORDER BY c.created_at DESC"), params)
    return [_row(dict(row._mapping)) for row in r.fetchall()]


@router.post("/contracts")
async def create_contract(data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("supplier_id"):
        raise HTTPException(status_code=400, detail="supplier_id is required")
    if not data.get("contract_name"):
        raise HTTPException(status_code=400, detail="contract_name is required")
    if not data.get("start_date"):
        raise HTTPException(status_code=400, detail="start_date is required")
    contract_id = str(uuid.uuid4())
    internal_id = await next_internal_id(db, "finance_contract_id_seq", "CTR")
    await db.execute(text("""
        INSERT INTO finance_contracts (id, internal_id, supplier_id, contract_name, start_date, end_date,
            contract_value, status, assigned_to, assigned_to_email, notes, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :internal_id, CAST(:supplier_id AS UUID), :contract_name, CAST(:start_date AS DATE), CAST(:end_date AS DATE),
            :contract_value, :status, :assigned_to, :assigned_to_email, :notes, NOW(), NOW())
    """), {
        "id": contract_id, "internal_id": internal_id, "supplier_id": data["supplier_id"],
        "contract_name": data["contract_name"], "start_date": _date(data["start_date"]), "end_date": _date(data.get("end_date")),
        "contract_value": _num(data.get("contract_value")), "status": data.get("status") or "active",
        "assigned_to": data.get("assigned_to"), "assigned_to_email": data.get("assigned_to_email"),
        "notes": data.get("notes"),
    })
    await db.commit()
    return await get_contract(contract_id, db)


@router.get("/contracts/{contract_id}")
async def get_contract(contract_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text(f"{_CONTRACT_SELECT} WHERE c.id = CAST(:id AS UUID)"), {"id": contract_id})
    row = r.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Contract not found")
    return _row(dict(row._mapping))


@router.put("/contracts/{contract_id}")
async def update_contract(contract_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    existing = await get_contract(contract_id, db)
    merged = {**existing, **{k: v for k, v in data.items() if k in CONTRACT_FIELDS}}
    await db.execute(text("""
        UPDATE finance_contracts SET supplier_id=CAST(:supplier_id AS UUID), contract_name=:contract_name,
            start_date=CAST(:start_date AS DATE), end_date=CAST(:end_date AS DATE), contract_value=:contract_value, status=:status,
            assigned_to=:assigned_to, assigned_to_email=:assigned_to_email, notes=:notes, updated_at=NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": contract_id, "supplier_id": merged["supplier_id"], "contract_name": merged["contract_name"],
        "start_date": _date(merged["start_date"]), "end_date": _date(merged.get("end_date")),
        "contract_value": _num(merged.get("contract_value")), "status": merged.get("status") or "active",
        "assigned_to": merged.get("assigned_to"), "assigned_to_email": merged.get("assigned_to_email"),
        "notes": merged.get("notes"),
    })
    await db.commit()
    return await get_contract(contract_id, db)


@router.delete("/contracts/{contract_id}")
async def delete_contract(contract_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM finance_contracts WHERE id = CAST(:id AS UUID)"), {"id": contract_id})
    await db.commit()
    return {"status": "deleted"}


# ─── Contract Documents (S3-backed attachments) ───────────────────────────────
@router.get("/contracts/{contract_id}/documents")
async def list_contract_documents(contract_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT id, filename, file_url, uploaded_by_email, uploaded_at
        FROM finance_contract_documents WHERE contract_id = CAST(:id AS UUID) ORDER BY uploaded_at DESC
    """), {"id": contract_id})
    docs = [_row(dict(row._mapping)) for row in r.fetchall()]
    for d in docs:
        if (d.get("file_url") or "").startswith("s3://"):
            d["file_url"] = await s3_ref_to_presigned(d["file_url"])
    return docs


@router.post("/contracts/{contract_id}/documents")
async def upload_contract_document(
    contract_id: str, file: UploadFile = File(...), uploaded_by_email: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    safe_fn = file.filename.replace(" ", "_")
    key = f"finance/contracts/{contract_id}/{safe_fn}"
    file_url = await upload_to_s3(key, content, file.content_type or "application/octet-stream")
    doc_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO finance_contract_documents (id, contract_id, filename, file_url, uploaded_by_email, uploaded_at)
        VALUES (CAST(:id AS UUID), CAST(:cid AS UUID), :fn, :url, :email, NOW())
    """), {"id": doc_id, "cid": contract_id, "fn": file.filename, "url": file_url, "email": uploaded_by_email})
    await db.commit()
    return {"status": "ok", "id": doc_id, "filename": file.filename, "file_url": await s3_ref_to_presigned(file_url)}


@router.delete("/contracts/{contract_id}/documents/{doc_id}")
async def delete_contract_document(contract_id: str, doc_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        DELETE FROM finance_contract_documents WHERE id = CAST(:id AS UUID) AND contract_id = CAST(:cid AS UUID)
    """), {"id": doc_id, "cid": contract_id})
    await db.commit()
    return {"status": "deleted"}


# ─── Purchase Orders ───────────────────────────────────────────────────────────
PO_FIELDS = ["supplier_id", "contract_id", "description", "amount", "order_date", "expected_delivery_date", "status", "assigned_to", "assigned_to_email", "notes"]

_PO_SELECT = """
    SELECT po.*, s.name AS supplier_name, s.internal_id AS supplier_internal_id,
           c.contract_name, c.internal_id AS contract_internal_id
    FROM finance_purchase_orders po
    LEFT JOIN finance_suppliers s ON s.id = po.supplier_id
    LEFT JOIN finance_contracts c ON c.id = po.contract_id
"""


@router.get("/purchase-orders")
async def list_purchase_orders(search: str = None, supplier_id: str = None, contract_id: str = None, db: AsyncSession = Depends(get_db)):
    where, params = [], {}
    if search:
        where.append("po.description ILIKE :q")
        params["q"] = f"%{search}%"
    if supplier_id:
        where.append("po.supplier_id = CAST(:sid AS UUID)")
        params["sid"] = supplier_id
    if contract_id:
        where.append("po.contract_id = CAST(:cid AS UUID)")
        params["cid"] = contract_id
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    r = await db.execute(text(f"{_PO_SELECT} {clause} ORDER BY po.created_at DESC"), params)
    return [_row(dict(row._mapping)) for row in r.fetchall()]


@router.post("/purchase-orders")
async def create_purchase_order(data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("supplier_id"):
        raise HTTPException(status_code=400, detail="supplier_id is required")
    po_id = str(uuid.uuid4())
    internal_id = await next_internal_id(db, "finance_po_id_seq", "PO")
    await db.execute(text("""
        INSERT INTO finance_purchase_orders (id, internal_id, supplier_id, contract_id, description, amount,
            order_date, expected_delivery_date, status, assigned_to, assigned_to_email, notes, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :internal_id, CAST(:supplier_id AS UUID), CAST(NULLIF(:contract_id,'') AS UUID),
            :description, :amount, CAST(:order_date AS DATE), CAST(:expected_delivery_date AS DATE), :status, :assigned_to, :assigned_to_email, :notes, NOW(), NOW())
    """), {
        "id": po_id, "internal_id": internal_id, "supplier_id": data["supplier_id"],
        "contract_id": data.get("contract_id") or "",
        "description": data.get("description"), "amount": _num(data.get("amount")),
        "order_date": _date(data.get("order_date")), "expected_delivery_date": _date(data.get("expected_delivery_date")),
        "status": data.get("status") or "draft",
        "assigned_to": data.get("assigned_to"), "assigned_to_email": data.get("assigned_to_email"),
        "notes": data.get("notes"),
    })
    await db.commit()
    return await get_purchase_order(po_id, db)


@router.get("/purchase-orders/{po_id}")
async def get_purchase_order(po_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text(f"{_PO_SELECT} WHERE po.id = CAST(:id AS UUID)"), {"id": po_id})
    row = r.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return _row(dict(row._mapping))


@router.put("/purchase-orders/{po_id}")
async def update_purchase_order(po_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    existing = await get_purchase_order(po_id, db)
    merged = {**existing, **{k: v for k, v in data.items() if k in PO_FIELDS}}
    await db.execute(text("""
        UPDATE finance_purchase_orders SET supplier_id=CAST(:supplier_id AS UUID),
            contract_id=CAST(NULLIF(:contract_id,'') AS UUID), description=:description, amount=:amount,
            order_date=CAST(:order_date AS DATE), expected_delivery_date=CAST(:expected_delivery_date AS DATE), status=:status,
            assigned_to=:assigned_to, assigned_to_email=:assigned_to_email, notes=:notes, updated_at=NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": po_id, "supplier_id": merged["supplier_id"], "contract_id": merged.get("contract_id") or "",
        "description": merged.get("description"), "amount": _num(merged.get("amount")),
        "order_date": _date(merged.get("order_date")), "expected_delivery_date": _date(merged.get("expected_delivery_date")),
        "status": merged.get("status") or "draft",
        "assigned_to": merged.get("assigned_to"), "assigned_to_email": merged.get("assigned_to_email"),
        "notes": merged.get("notes"),
    })
    await db.commit()
    return await get_purchase_order(po_id, db)


@router.delete("/purchase-orders/{po_id}")
async def delete_purchase_order(po_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM finance_purchase_orders WHERE id = CAST(:id AS UUID)"), {"id": po_id})
    await db.commit()
    return {"status": "deleted"}


# ─── Supplier Invoices ─────────────────────────────────────────────────────────
INVOICE_FIELDS = ["supplier_id", "purchase_order_id", "invoice_number", "amount", "invoice_date", "due_date", "approver_email", "approver_name", "notes"]

_INVOICE_SELECT = """
    SELECT i.*, s.name AS supplier_name, s.internal_id AS supplier_internal_id,
           po.internal_id AS po_internal_id, po.description AS po_description
    FROM finance_invoices i
    LEFT JOIN finance_suppliers s ON s.id = i.supplier_id
    LEFT JOIN finance_purchase_orders po ON po.id = i.purchase_order_id
"""


@router.get("/invoices")
async def list_invoices(search: str = None, supplier_id: str = None, approval_status: str = None, db: AsyncSession = Depends(get_db)):
    where, params = [], {}
    if search:
        where.append("i.invoice_number ILIKE :q")
        params["q"] = f"%{search}%"
    if supplier_id:
        where.append("i.supplier_id = CAST(:sid AS UUID)")
        params["sid"] = supplier_id
    if approval_status:
        where.append("i.approval_status = :astatus")
        params["astatus"] = approval_status
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    r = await db.execute(text(f"{_INVOICE_SELECT} {clause} ORDER BY i.created_at DESC"), params)
    return [_row(dict(row._mapping)) for row in r.fetchall()]


@router.post("/invoices")
async def create_invoice(data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("supplier_id"):
        raise HTTPException(status_code=400, detail="supplier_id is required")
    invoice_id = str(uuid.uuid4())
    internal_id = await next_internal_id(db, "finance_invoice_id_seq", "INV")
    await db.execute(text("""
        INSERT INTO finance_invoices (id, internal_id, supplier_id, purchase_order_id, invoice_number, amount,
            invoice_date, due_date, approval_status, approver_email, approver_name, notes, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :internal_id, CAST(:supplier_id AS UUID), CAST(NULLIF(:po_id,'') AS UUID),
            :invoice_number, :amount, CAST(:invoice_date AS DATE), CAST(:due_date AS DATE), 'pending', :approver_email, :approver_name, :notes, NOW(), NOW())
    """), {
        "id": invoice_id, "internal_id": internal_id, "supplier_id": data["supplier_id"],
        "po_id": data.get("purchase_order_id") or "",
        "invoice_number": data.get("invoice_number"), "amount": _num(data.get("amount")),
        "invoice_date": _date(data.get("invoice_date")), "due_date": _date(data.get("due_date")),
        "approver_email": data.get("approver_email"), "approver_name": data.get("approver_name"),
        "notes": data.get("notes"),
    })
    await db.commit()
    return await get_invoice(invoice_id, db)


@router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text(f"{_INVOICE_SELECT} WHERE i.id = CAST(:id AS UUID)"), {"id": invoice_id})
    row = r.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return _row(dict(row._mapping))


@router.put("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    existing = await get_invoice(invoice_id, db)
    merged = {**existing, **{k: v for k, v in data.items() if k in INVOICE_FIELDS}}
    await db.execute(text("""
        UPDATE finance_invoices SET supplier_id=CAST(:supplier_id AS UUID),
            purchase_order_id=CAST(NULLIF(:po_id,'') AS UUID), invoice_number=:invoice_number, amount=:amount,
            invoice_date=CAST(:invoice_date AS DATE), due_date=CAST(:due_date AS DATE), approver_email=:approver_email,
            approver_name=:approver_name, notes=:notes, updated_at=NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": invoice_id, "supplier_id": merged["supplier_id"], "po_id": merged.get("purchase_order_id") or "",
        "invoice_number": merged.get("invoice_number"), "amount": _num(merged.get("amount")),
        "invoice_date": _date(merged.get("invoice_date")), "due_date": _date(merged.get("due_date")),
        "approver_email": merged.get("approver_email"), "approver_name": merged.get("approver_name"),
        "notes": merged.get("notes"),
    })
    await db.commit()
    return await get_invoice(invoice_id, db)


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM finance_invoices WHERE id = CAST(:id AS UUID)"), {"id": invoice_id})
    await db.commit()
    return {"status": "deleted"}


@router.put("/invoices/{invoice_id}/approval")
async def set_invoice_approval(invoice_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    action = data.get("action")
    acting_email = data.get("acting_email")
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")
    invoice = await get_invoice(invoice_id, db)
    if not invoice.get("approver_email"):
        raise HTTPException(status_code=400, detail="This invoice has no assigned approver")
    if acting_email != invoice["approver_email"]:
        raise HTTPException(status_code=403, detail="Only the assigned approver can approve or reject this invoice")
    new_status = "approved" if action == "approve" else "rejected"
    await db.execute(text("""
        UPDATE finance_invoices SET approval_status=:status, approved_by_email=:email,
            approved_at=NOW(), approval_comment=:comment, updated_at=NOW()
        WHERE id = CAST(:id AS UUID)
    """), {"id": invoice_id, "status": new_status, "email": acting_email, "comment": data.get("comment")})
    await db.commit()
    return await get_invoice(invoice_id, db)
