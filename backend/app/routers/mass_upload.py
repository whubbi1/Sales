# backend/app/routers/mass_upload.py
# Mass Upload — parse a CSV/XLSX, let the user map its columns onto an entity's fields,
# then bulk-create Companies/Contacts/Partners from it. Two-step (parse, then import) since
# mapping happens client-side between requests; the parsed rows are stashed in
# mass_upload_sessions rather than kept in memory, since a second backend instance behind the
# load balancer could handle the import request.
import csv
import io
import json
import uuid
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.company import Company
from app.models.contact import Contact
from app.services.ids import next_internal_id

router = APIRouter()

COMPANY_STATUSES = ["lead", "prospect", "client", "partner"]
CONTACT_JOB_TYPES = [
    "CIO", "CTO", "CISO", "SAP Manager", "SAP Architect", "SAP GRC",
    "SAP Security Manager", "SAP Technical Manager", "Cybersecurity Architect",
    "SOC Manager", "Internal Audit", "CFO", "Partner", "Buyer", "Other",
]
CONTACT_LEAD_STATUSES = ["New", "Open", "Connected"]

ENTITY_FIELDS = {
    "companies": [
        {"key": "name", "label": "Company Name", "required": True},
        {"key": "domain_names", "label": "Domains (comma-separated)", "required": False, "type": "list"},
        {"key": "phone", "label": "Phone", "required": False},
        {"key": "sector", "label": "Sector", "required": False},
        {"key": "country", "label": "Country", "required": False},
        {"key": "status", "label": "Status (lead / prospect / client / partner)", "required": False},
        {"key": "employee_count", "label": "Employee Count", "required": False, "type": "number"},
        {"key": "linkedin_url", "label": "LinkedIn URL", "required": False},
        {"key": "notes", "label": "Notes", "required": False},
        {"key": "assigned_to", "label": "Assigned To (name)", "required": False},
        {"key": "assigned_to_email", "label": "Assigned To (email)", "required": False},
    ],
    "contacts": [
        {"key": "first_name", "label": "First Name", "required": True},
        {"key": "last_name", "label": "Last Name", "required": True},
        {"key": "company_name", "label": "Company (matched by name)", "required": False, "type": "lookup"},
        {"key": "partner_name", "label": "Partner (matched by name)", "required": False, "type": "lookup"},
        {"key": "email", "label": "Email", "required": False},
        {"key": "mobile_phone", "label": "Mobile Phone", "required": False},
        {"key": "office_phone", "label": "Office Phone", "required": False},
        {"key": "linkedin_url", "label": "LinkedIn URL", "required": False},
        {"key": "job_name", "label": "Job Title", "required": False},
        {"key": "job_type", "label": "Job Function", "required": False},
        {"key": "preferred_language", "label": "Preferred Language", "required": False},
        {"key": "notes", "label": "Notes", "required": False},
        {"key": "assigned_to", "label": "Assigned To (name)", "required": False},
        {"key": "assigned_to_email", "label": "Assigned To (email)", "required": False},
    ],
    "partners": [
        {"key": "name", "label": "Partner Name", "required": True},
        {"key": "domain_names", "label": "Domains (comma-separated)", "required": False, "type": "list"},
        {"key": "phone", "label": "Phone", "required": False},
        {"key": "sector", "label": "Sector", "required": False},
        {"key": "country", "label": "Country", "required": False},
        {"key": "status", "label": "Status", "required": False},
        {"key": "employee_count", "label": "Employee Count", "required": False, "type": "number"},
        {"key": "linkedin_url", "label": "LinkedIn URL", "required": False},
        {"key": "notes", "label": "Notes", "required": False},
        {"key": "assigned_to", "label": "Assigned To (name)", "required": False},
        {"key": "assigned_to_email", "label": "Assigned To (email)", "required": False},
    ],
}
ENTITY_LABELS = {"companies": "Companies", "contacts": "Contacts", "partners": "Partners"}


@router.get("/entities")
async def list_entities():
    return {"entities": [{"key": k, "label": v} for k, v in ENTITY_LABELS.items()]}


@router.get("/fields")
async def get_fields(entity_type: str):
    if entity_type not in ENTITY_FIELDS:
        raise HTTPException(status_code=400, detail=f"entity_type must be one of {list(ENTITY_FIELDS)}")
    return {"fields": ENTITY_FIELDS[entity_type]}


def _cell_to_json(v):
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    return v


def _parse_csv(content: bytes):
    text_content = None
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            text_content = content.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if text_content is None:
        raise HTTPException(status_code=400, detail="Could not decode this file as text")
    sample = text_content[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    all_rows = list(csv.reader(io.StringIO(text_content), dialect))
    if not all_rows:
        return [], []
    headers = [(h or "").strip() for h in all_rows[0]]
    rows = []
    for r in all_rows[1:]:
        if not any((c or "").strip() for c in r):
            continue
        rows.append({headers[i]: (r[i].strip() if i < len(r) and r[i] is not None else None) for i in range(len(headers))})
    return headers, rows


def _parse_xlsx(content: bytes):
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows_iter = ws.iter_rows(values_only=True)
    try:
        header_row = next(rows_iter)
    except StopIteration:
        return [], []
    headers = [str(h).strip() if h is not None else f"Column {i + 1}" for i, h in enumerate(header_row)]
    rows = []
    for r in rows_iter:
        if r is None or all(c is None for c in r):
            continue
        rows.append({headers[i]: _cell_to_json(r[i]) if i < len(r) else None for i in range(len(headers))})
    return headers, rows


@router.post("/parse")
async def parse_file(file: UploadFile = File(...), created_by_email: str = "", db: AsyncSession = Depends(get_db)):
    content = await file.read()
    filename = file.filename or "upload"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "csv":
        headers, rows = _parse_csv(content)
    elif ext in ("xlsx", "xlsm"):
        headers, rows = _parse_xlsx(content)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type — please upload a .csv or .xlsx file")
    if not headers:
        raise HTTPException(status_code=400, detail="Could not find a header row in this file")
    if not rows:
        raise HTTPException(status_code=400, detail="No data rows found below the header row")

    session_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO mass_upload_sessions (id, filename, headers, rows, row_count, created_by_email, created_at)
        VALUES (CAST(:id AS UUID), :filename, CAST(:headers AS JSONB), CAST(:rows AS JSONB), :row_count, :email, NOW())
    """), {
        "id": session_id, "filename": filename, "headers": json.dumps(headers),
        "rows": json.dumps(rows), "row_count": len(rows), "email": created_by_email,
    })
    await db.commit()
    return {"session_id": session_id, "headers": headers, "preview": rows[:10], "row_count": len(rows)}


def _val(row: dict, mapping: dict, field: str):
    header = mapping.get(field)
    if not header:
        return None
    v = row.get(header)
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


def _list_val(row, mapping, field):
    v = _val(row, mapping, field)
    if v is None:
        return []
    if isinstance(v, list):
        return v
    return [p.strip() for p in str(v).split(",") if p.strip()]


def _int_val(row, mapping, field):
    v = _val(row, mapping, field)
    if v is None or v == "":
        return None
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


def _match_enum(value, valid_values):
    if not value:
        return None
    for v in valid_values:
        if v.lower() == str(value).strip().lower():
            return v
    return None


async def _lookup_company_id(db: AsyncSession, name):
    if not name:
        return None
    r = await db.execute(select(Company.id).where(func.lower(Company.name) == str(name).strip().lower()))
    row = r.first()
    return row[0] if row else None


async def _lookup_partner_id(db: AsyncSession, name):
    if not name:
        return None
    r = await db.execute(text("SELECT id FROM partners WHERE lower(name) = :n"), {"n": str(name).strip().lower()})
    row = r.fetchone()
    return row.id if row else None


async def _import_companies(db: AsyncSession, rows, mapping):
    created, errors = 0, []
    for idx, row in enumerate(rows):
        name = _val(row, mapping, "name")
        if not name:
            errors.append({"row": idx + 2, "error": "Company Name is required"})
            continue
        try:
            data = {
                "name": name,
                "domain_names": _list_val(row, mapping, "domain_names"),
                "phone": _val(row, mapping, "phone"),
                "sector": _val(row, mapping, "sector"),
                "country": _val(row, mapping, "country"),
                "status": _match_enum(_val(row, mapping, "status"), COMPANY_STATUSES) or "lead",
                "employee_count": _int_val(row, mapping, "employee_count"),
                "linkedin_url": _val(row, mapping, "linkedin_url"),
                "notes": _val(row, mapping, "notes"),
                "assigned_to": _val(row, mapping, "assigned_to"),
                "assigned_to_email": _val(row, mapping, "assigned_to_email"),
                "level": 1,
            }
            data["internal_id"] = await next_internal_id(db, "company_internal_id_seq", "CMP")
            db.add(Company(**data))
            await db.commit()
            created += 1
        except Exception as e:
            await db.rollback()
            errors.append({"row": idx + 2, "error": str(e)[:300]})
    return created, errors


async def _import_contacts(db: AsyncSession, rows, mapping):
    created, errors = 0, []
    for idx, row in enumerate(rows):
        first_name = _val(row, mapping, "first_name")
        last_name = _val(row, mapping, "last_name")
        if not first_name or not last_name:
            errors.append({"row": idx + 2, "error": "First Name and Last Name are required"})
            continue
        try:
            company_id = await _lookup_company_id(db, _val(row, mapping, "company_name"))
            partner_id = await _lookup_partner_id(db, _val(row, mapping, "partner_name"))
            data = {
                "first_name": first_name,
                "last_name": last_name,
                "company_id": company_id,
                "partner_id": partner_id,
                "email": _val(row, mapping, "email"),
                "mobile_phone": _val(row, mapping, "mobile_phone"),
                "office_phone": _val(row, mapping, "office_phone"),
                "linkedin_url": _val(row, mapping, "linkedin_url"),
                "job_name": _val(row, mapping, "job_name"),
                "job_type": _match_enum(_val(row, mapping, "job_type"), CONTACT_JOB_TYPES),
                "lead_status": "New",
                "preferred_language": _val(row, mapping, "preferred_language"),
                "notes": _val(row, mapping, "notes"),
                "assigned_to": _val(row, mapping, "assigned_to"),
                "assigned_to_email": _val(row, mapping, "assigned_to_email"),
                "data_source": "Mass Upload",
            }
            data["internal_id"] = await next_internal_id(db, "contact_internal_id_seq", "CNT")
            db.add(Contact(**data))
            await db.commit()
            created += 1
        except Exception as e:
            await db.rollback()
            errors.append({"row": idx + 2, "error": str(e)[:300]})
    return created, errors


async def _import_partners(db: AsyncSession, rows, mapping):
    created, errors = 0, []
    for idx, row in enumerate(rows):
        name = _val(row, mapping, "name")
        if not name:
            errors.append({"row": idx + 2, "error": "Partner Name is required"})
            continue
        try:
            partner_id = str(uuid.uuid4())
            internal_id = await next_internal_id(db, "partner_internal_id_seq", "PTN")
            await db.execute(text("""
                INSERT INTO partners (id, internal_id, name, domain_names, phone, sector, country, status,
                                       employee_count, linkedin_url, notes, assigned_to, assigned_to_email, created_at, updated_at)
                VALUES (CAST(:id AS UUID), :internal_id, :name, CAST(:domain_names AS JSONB), :phone, :sector, :country, :status,
                        :employee_count, :linkedin_url, :notes, :assigned_to, :assigned_to_email, NOW(), NOW())
            """), {
                "id": partner_id, "internal_id": internal_id, "name": name,
                "domain_names": json.dumps(_list_val(row, mapping, "domain_names")),
                "phone": _val(row, mapping, "phone"), "sector": _val(row, mapping, "sector"),
                "country": _val(row, mapping, "country"),
                "status": _val(row, mapping, "status") or "active",
                "employee_count": _int_val(row, mapping, "employee_count"),
                "linkedin_url": _val(row, mapping, "linkedin_url"), "notes": _val(row, mapping, "notes"),
                "assigned_to": _val(row, mapping, "assigned_to"), "assigned_to_email": _val(row, mapping, "assigned_to_email"),
            })
            await db.commit()
            created += 1
        except Exception as e:
            await db.rollback()
            errors.append({"row": idx + 2, "error": str(e)[:300]})
    return created, errors


IMPORTERS = {"companies": _import_companies, "contacts": _import_contacts, "partners": _import_partners}


@router.post("/import")
async def import_rows(data: dict, db: AsyncSession = Depends(get_db)):
    session_id = data.get("session_id")
    entity_type = data.get("entity_type")
    mapping = data.get("mapping") or {}
    if not session_id or entity_type not in IMPORTERS:
        raise HTTPException(status_code=400, detail=f"entity_type must be one of {list(IMPORTERS)}")

    r = await db.execute(text("SELECT rows FROM mass_upload_sessions WHERE id = CAST(:id AS UUID)"), {"id": session_id})
    row = r.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Upload session not found or already imported — please re-upload the file")
    rows = row.rows

    required = [f["key"] for f in ENTITY_FIELDS[entity_type] if f["required"]]
    missing = [k for k in required if not mapping.get(k)]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required field mapping for: {', '.join(missing)}")

    created, errors = await IMPORTERS[entity_type](db, rows, mapping)

    await db.execute(text("DELETE FROM mass_upload_sessions WHERE id = CAST(:id AS UUID)"), {"id": session_id})
    await db.commit()

    return {"created": created, "failed": len(errors), "total": len(rows), "errors": errors[:50]}
