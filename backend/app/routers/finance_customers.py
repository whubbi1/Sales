# backend/app/routers/finance_customers.py
# Finance > Customers — customer-side sales contracts (Contract Management), distinct from
# the existing supplier-side finance_contracts. Raw-SQL, dict-based, matching finance.py.
# A contract can stand at the customer level alone (contract_type='Master Agreement',
# project_id NULL) or be scoped to one specific Project — the "2 levels" the module covers.
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.services.ids import next_internal_id
from app.routers.hr import upload_to_s3, s3_ref_to_presigned
from datetime import date
import uuid

router = APIRouter()

CONTRACT_TYPES = {"Master Agreement", "Project Agreement", "Purchase Order"}

CONTRACT_FIELDS = [
    "company_id", "opportunity_id", "project_id", "contract_name", "contract_type",
    "contract_start_date", "contract_end_date", "signature_date", "contract_value",
    "invoicing_conditions", "payment_terms",
    "invoice_address_postal", "invoice_address_email", "invoice_address_electronic",
]


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


def _uuid_or_none(v):
    return v or None


_CONTRACT_SELECT = """
    SELECT c.*, co.name AS company_name, co.internal_id AS company_internal_id,
           p.project_number, p.project_name AS linked_project_name,
           o.deal_id AS opportunity_deal_id, o.deal_name AS opportunity_deal_name
    FROM finance_customer_contracts c
    LEFT JOIN companies co ON co.id = c.company_id
    LEFT JOIN projects p ON p.id = c.project_id
    LEFT JOIN opportunities o ON o.id = c.opportunity_id
"""


async def _attach_contacts_and_links(db: AsyncSession, contracts: list):
    for c in contracts:
        r = await db.execute(text("""
            SELECT ct.id, ct.first_name, ct.last_name, ct.email FROM finance_customer_contract_contacts cc
            JOIN contacts ct ON ct.id = cc.contact_id WHERE cc.contract_id = CAST(:id AS UUID) ORDER BY ct.first_name, ct.last_name
        """), {"id": c["id"]})
        c["contacts"] = [dict(row._mapping) for row in r.fetchall()]
        r2 = await db.execute(text("SELECT * FROM finance_customer_contract_links WHERE contract_id = CAST(:id AS UUID) ORDER BY created_at"), {"id": c["id"]})
        c["links"] = [_row(dict(row._mapping)) for row in r2.fetchall()]
        if (c.get("signed_contract_url") or "").startswith("s3://"):
            c["signed_contract_url"] = await s3_ref_to_presigned(c["signed_contract_url"])
        if (c.get("invoicing_documentation_url") or "").startswith("s3://"):
            c["invoicing_documentation_url"] = await s3_ref_to_presigned(c["invoicing_documentation_url"])


# ─── Contracts ───────────────────────────────────────────────────────────────────
@router.get("/customer-contracts")
async def list_customer_contracts(search: str = None, company_id: str = None, project_id: str = None, db: AsyncSession = Depends(get_db)):
    where, params = [], {}
    if search:
        where.append("c.contract_name ILIKE :q")
        params["q"] = f"%{search}%"
    if company_id:
        where.append("c.company_id = CAST(:cid AS UUID)")
        params["cid"] = company_id
    if project_id:
        where.append("c.project_id = CAST(:pid AS UUID)")
        params["pid"] = project_id
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    r = await db.execute(text(f"{_CONTRACT_SELECT} {clause} ORDER BY c.created_at DESC"), params)
    return [_row(dict(row._mapping)) for row in r.fetchall()]


@router.post("/customer-contracts")
async def create_customer_contract(data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("company_id"):
        raise HTTPException(status_code=400, detail="company_id is required")
    contract_type = data.get("contract_type") or ""
    if contract_type and contract_type not in CONTRACT_TYPES:
        raise HTTPException(status_code=400, detail=f"contract_type must be one of {sorted(CONTRACT_TYPES)}")
    contract_id = str(uuid.uuid4())
    internal_id = await next_internal_id(db, "finance_customer_contract_id_seq", "CCT")
    await db.execute(text("""
        INSERT INTO finance_customer_contracts (
            id, internal_id, company_id, opportunity_id, project_id, contract_name, contract_type,
            contract_start_date, contract_end_date, signature_date, contract_value,
            invoicing_conditions, payment_terms, invoice_address_postal, invoice_address_email,
            invoice_address_electronic, created_by, created_at, updated_at
        ) VALUES (
            CAST(:id AS UUID), :internal_id, CAST(:company_id AS UUID), CAST(:opportunity_id AS UUID), CAST(:project_id AS UUID),
            :contract_name, :contract_type, CAST(:contract_start_date AS DATE), CAST(:contract_end_date AS DATE), CAST(:signature_date AS DATE),
            :contract_value, :invoicing_conditions, :payment_terms, :invoice_address_postal, :invoice_address_email,
            :invoice_address_electronic, :created_by, NOW(), NOW()
        )
    """), {
        "id": contract_id, "internal_id": internal_id,
        "company_id": data["company_id"],
        "opportunity_id": _uuid_or_none(data.get("opportunity_id")),
        "project_id": _uuid_or_none(data.get("project_id")),
        "contract_name": data.get("contract_name"),
        "contract_type": contract_type or None,
        "contract_start_date": _date(data.get("contract_start_date")),
        "contract_end_date": _date(data.get("contract_end_date")),
        "signature_date": _date(data.get("signature_date")),
        "contract_value": _num(data.get("contract_value")),
        "invoicing_conditions": data.get("invoicing_conditions"),
        "payment_terms": data.get("payment_terms"),
        "invoice_address_postal": data.get("invoice_address_postal"),
        "invoice_address_email": data.get("invoice_address_email"),
        "invoice_address_electronic": data.get("invoice_address_electronic"),
        "created_by": data.get("created_by", ""),
    })
    for cid in (data.get("contact_ids") or []):
        await db.execute(text("""
            INSERT INTO finance_customer_contract_contacts (contract_id, contact_id)
            VALUES (CAST(:cid AS UUID), CAST(:ctid AS UUID)) ON CONFLICT DO NOTHING
        """), {"cid": contract_id, "ctid": cid})
    await db.commit()
    return await get_customer_contract(contract_id, db)


@router.get("/customer-contracts/{contract_id}")
async def get_customer_contract(contract_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text(f"{_CONTRACT_SELECT} WHERE c.id = CAST(:id AS UUID)"), {"id": contract_id})
    row = r.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Contract not found")
    contract = _row(dict(row._mapping))
    await _attach_contacts_and_links(db, [contract])
    return contract


@router.put("/customer-contracts/{contract_id}")
async def update_customer_contract(contract_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    existing = await get_customer_contract(contract_id, db)
    contract_type = data.get("contract_type", existing.get("contract_type")) or ""
    if contract_type and contract_type not in CONTRACT_TYPES:
        raise HTTPException(status_code=400, detail=f"contract_type must be one of {sorted(CONTRACT_TYPES)}")
    merged = {**existing, **{k: v for k, v in data.items() if k in CONTRACT_FIELDS}}
    await db.execute(text("""
        UPDATE finance_customer_contracts SET
            company_id = CAST(:company_id AS UUID), opportunity_id = CAST(:opportunity_id AS UUID), project_id = CAST(:project_id AS UUID),
            contract_name = :contract_name, contract_type = :contract_type,
            contract_start_date = CAST(:contract_start_date AS DATE), contract_end_date = CAST(:contract_end_date AS DATE),
            signature_date = CAST(:signature_date AS DATE), contract_value = :contract_value,
            invoicing_conditions = :invoicing_conditions, payment_terms = :payment_terms,
            invoice_address_postal = :invoice_address_postal, invoice_address_email = :invoice_address_email,
            invoice_address_electronic = :invoice_address_electronic, updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": contract_id,
        "company_id": _uuid_or_none(merged.get("company_id")),
        "opportunity_id": _uuid_or_none(merged.get("opportunity_id")),
        "project_id": _uuid_or_none(merged.get("project_id")),
        "contract_name": merged.get("contract_name"),
        "contract_type": contract_type or None,
        "contract_start_date": _date(merged.get("contract_start_date")),
        "contract_end_date": _date(merged.get("contract_end_date")),
        "signature_date": _date(merged.get("signature_date")),
        "contract_value": _num(merged.get("contract_value")),
        "invoicing_conditions": merged.get("invoicing_conditions"),
        "payment_terms": merged.get("payment_terms"),
        "invoice_address_postal": merged.get("invoice_address_postal"),
        "invoice_address_email": merged.get("invoice_address_email"),
        "invoice_address_electronic": merged.get("invoice_address_electronic"),
    })
    await db.commit()
    return await get_customer_contract(contract_id, db)


@router.delete("/customer-contracts/{contract_id}")
async def delete_customer_contract(contract_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM finance_customer_contracts WHERE id = CAST(:id AS UUID)"), {"id": contract_id})
    await db.commit()
    return {"status": "deleted"}


# ─── Contacts (many-to-many) ─────────────────────────────────────────────────────
@router.post("/customer-contracts/{contract_id}/contacts/{contact_id}")
async def link_contract_contact(contract_id: str, contact_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        INSERT INTO finance_customer_contract_contacts (contract_id, contact_id)
        VALUES (CAST(:cid AS UUID), CAST(:ctid AS UUID)) ON CONFLICT DO NOTHING
    """), {"cid": contract_id, "ctid": contact_id})
    await db.commit()
    return {"status": "ok"}


@router.delete("/customer-contracts/{contract_id}/contacts/{contact_id}")
async def unlink_contract_contact(contract_id: str, contact_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        DELETE FROM finance_customer_contract_contacts WHERE contract_id = CAST(:cid AS UUID) AND contact_id = CAST(:ctid AS UUID)
    """), {"cid": contract_id, "ctid": contact_id})
    await db.commit()
    return {"status": "ok"}


# ─── Invoicing platform links ────────────────────────────────────────────────────
@router.post("/customer-contracts/{contract_id}/links")
async def add_contract_link(contract_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("label") or not data.get("url"):
        raise HTTPException(status_code=400, detail="label and url are required")
    link_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO finance_customer_contract_links (id, contract_id, label, url, created_at)
        VALUES (CAST(:id AS UUID), CAST(:cid AS UUID), :label, :url, NOW())
    """), {"id": link_id, "cid": contract_id, "label": data["label"], "url": data["url"]})
    await db.commit()
    return {"status": "ok", "id": link_id}


@router.delete("/customer-contracts/{contract_id}/links/{link_id}")
async def delete_contract_link(contract_id: str, link_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        DELETE FROM finance_customer_contract_links WHERE id = CAST(:id AS UUID) AND contract_id = CAST(:cid AS UUID)
    """), {"id": link_id, "cid": contract_id})
    await db.commit()
    return {"status": "ok"}


# ─── Signed contract / invoicing documentation (S3-backed single-file fields) ──
@router.post("/customer-contracts/{contract_id}/signed-contract")
async def upload_signed_contract(contract_id: str, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    content = await file.read()
    key = f"finance/customer-contracts/{contract_id}/signed/{file.filename.replace(' ', '_')}"
    file_url = await upload_to_s3(key, content, file.content_type or "application/octet-stream")
    await db.execute(text("UPDATE finance_customer_contracts SET signed_contract_url = :url, updated_at = NOW() WHERE id = CAST(:id AS UUID)"),
                      {"url": file_url, "id": contract_id})
    await db.commit()
    return {"status": "ok", "filename": file.filename, "signed_contract_url": await s3_ref_to_presigned(file_url)}


@router.post("/customer-contracts/{contract_id}/invoicing-documentation")
async def upload_invoicing_documentation(contract_id: str, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    content = await file.read()
    key = f"finance/customer-contracts/{contract_id}/invoicing-doc/{file.filename.replace(' ', '_')}"
    file_url = await upload_to_s3(key, content, file.content_type or "application/octet-stream")
    await db.execute(text("UPDATE finance_customer_contracts SET invoicing_documentation_url = :url, updated_at = NOW() WHERE id = CAST(:id AS UUID)"),
                      {"url": file_url, "id": contract_id})
    await db.commit()
    return {"status": "ok", "filename": file.filename, "invoicing_documentation_url": await s3_ref_to_presigned(file_url)}


# ─── Auto-creation on Contract Won — mirrors _maybe_create_project in projects.py ──
async def _maybe_create_customer_contract(db: AsyncSession, opp, project):
    # Fires alongside _maybe_create_project, for the same Opportunity/Project pair — carries
    # over what a contract can reuse from the Opportunity (company, dates, value); the
    # contract_type, signature, invoicing details, and documents are filled in manually since
    # they have no Opportunity equivalent.
    if opp.deal_status != 'Contract Won' or not project:
        return None
    # A unique index on opportunity_id (see main.py migrations) makes this the actual guard —
    # two ECS tasks racing the startup backfill concurrently can both pass a plain SELECT-based
    # check before either commits, which is exactly what produced duplicate contracts once.
    # ON CONFLICT DO NOTHING + RETURNING makes the insert itself atomic against that race.
    contract_id = str(uuid.uuid4())
    internal_id = await next_internal_id(db, "finance_customer_contract_id_seq", "CCT")
    result = await db.execute(text("""
        INSERT INTO finance_customer_contracts (
            id, internal_id, company_id, opportunity_id, project_id, contract_name,
            contract_start_date, contract_end_date, contract_value, created_at, updated_at
        ) VALUES (
            CAST(:id AS UUID), :internal_id, CAST(:company_id AS UUID), CAST(:oid AS UUID), CAST(:pid AS UUID),
            :contract_name, CAST(:start_date AS DATE), CAST(:end_date AS DATE), :value, NOW(), NOW()
        )
        ON CONFLICT (opportunity_id) DO NOTHING
        RETURNING id
    """), {
        "id": contract_id, "internal_id": internal_id,
        "company_id": str(opp.company_id) if opp.company_id else None,
        "oid": str(opp.id), "pid": str(project.id),
        "contract_name": opp.deal_name,
        "start_date": _date(opp.contract_start_date.isoformat() if opp.contract_start_date else None),
        "end_date": _date(opp.contract_end_date.isoformat() if opp.contract_end_date else None),
        "value": _num(opp.deal_amount),
    })
    await db.commit()
    row = result.first()
    return str(row[0]) if row else None
