# backend/app/routers/grc_ropa.py
# GRC — Data & Privacy — Record of Processing Activities (ROPA) register.
# Tasks are handled entirely by the generic Task Manager (entity_type='ropa_record');
# this router only embeds them for convenience on GET /ropa/{id}.
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.routers.hr import upload_to_s3, s3_ref_to_presigned
import uuid

router = APIRouter()

RECORD_FIELDS = [
    "name", "objective", "legal_base", "application",
    "data_subject_categories", "data_categories", "data_source",
    "internal_recipients", "external_recipients",
    "transfers_outside_eu", "retention_period",
    "security_measures", "data_subject_rights",
    "legitimate_interest_test", "prospecting_disclosure_notice",
]


def _row(d: dict) -> dict:
    for k, v in d.items():
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
    return d


async def _get_record(db: AsyncSession, ropa_id: str) -> dict | None:
    r = await db.execute(text("SELECT * FROM ropa_records WHERE id = CAST(:id AS UUID)"), {"id": ropa_id})
    row = r.fetchone()
    return _row(dict(row._mapping)) if row else None


# ─── Records ─────────────────────────────────────────────────────────────────────
@router.get("/ropa")
async def list_records(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT r.*,
               (SELECT COUNT(*) FROM tasks t WHERE t.entity_type='ropa_record' AND t.entity_id=r.id) AS tasks_total,
               (SELECT COUNT(*) FROM tasks t WHERE t.entity_type='ropa_record' AND t.entity_id=r.id AND t.status NOT IN ('resolved','closed')) AS tasks_open
        FROM ropa_records r
        ORDER BY r.created_at DESC
    """))
    return {"records": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.post("/ropa")
async def create_record(data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="name is required")
    record_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO ropa_records (
            id, name, objective, legal_base, application,
            data_subject_categories, data_categories, data_source,
            internal_recipients, external_recipients,
            transfers_outside_eu, retention_period, created_by, created_at, updated_at
        ) VALUES (
            CAST(:id AS UUID), :name, :objective, :legal_base, :application,
            :data_subject_categories, :data_categories, :data_source,
            :internal_recipients, :external_recipients,
            :transfers_outside_eu, :retention_period, :created_by, NOW(), NOW()
        )
    """), {
        "id": record_id,
        "name": data["name"],
        "objective": data.get("objective"), "legal_base": data.get("legal_base"),
        "application": data.get("application"),
        "data_subject_categories": data.get("data_subject_categories"),
        "data_categories": data.get("data_categories"),
        "data_source": data.get("data_source"),
        "internal_recipients": data.get("internal_recipients"),
        "external_recipients": data.get("external_recipients"),
        "transfers_outside_eu": data.get("transfers_outside_eu"),
        "retention_period": data.get("retention_period"),
        "created_by": data.get("created_by", ""),
    })
    await db.commit()
    return {"status": "ok", "id": record_id}


@router.get("/ropa/{ropa_id}")
async def get_record(ropa_id: str, db: AsyncSession = Depends(get_db)):
    record = await _get_record(db, ropa_id)
    if not record:
        raise HTTPException(status_code=404, detail="ROPA record not found")
    tasks = await db.execute(text("SELECT * FROM tasks WHERE entity_type='ropa_record' AND entity_id = CAST(:id AS UUID) ORDER BY created_at ASC"), {"id": ropa_id})
    record["tasks"] = [_row(dict(r._mapping)) for r in tasks.fetchall()]
    return record


@router.put("/ropa/{ropa_id}")
async def update_record(ropa_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    record = await _get_record(db, ropa_id)
    if not record:
        raise HTTPException(status_code=404, detail="ROPA record not found")
    fields = {k: data.get(k) for k in RECORD_FIELDS if k in data}
    if not fields:
        return {"status": "ok"}
    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    await db.execute(text(f"UPDATE ropa_records SET {set_clause}, updated_at = NOW() WHERE id = CAST(:id AS UUID)"), {**fields, "id": ropa_id})
    await db.commit()
    return {"status": "ok"}


@router.delete("/ropa/{ropa_id}")
async def delete_record(ropa_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM ropa_records WHERE id = CAST(:id AS UUID)"), {"id": ropa_id})
    await db.commit()
    return {"status": "ok"}


# ─── Comments ────────────────────────────────────────────────────────────────────
@router.get("/ropa/{ropa_id}/comments/")
async def list_comments(ropa_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM ropa_comments WHERE ropa_id = CAST(:id AS UUID) ORDER BY created_at ASC"), {"id": ropa_id})
    return {"comments": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.post("/ropa/{ropa_id}/comments/")
async def add_comment(ropa_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("comment"):
        raise HTTPException(status_code=400, detail="comment is required")
    comment_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO ropa_comments (id, ropa_id, author_email, author_name, comment, created_at)
        VALUES (CAST(:id AS UUID), CAST(:rid AS UUID), :author_email, :author_name, :comment, NOW())
    """), {"id": comment_id, "rid": ropa_id, "author_email": data.get("author_email", ""), "author_name": data.get("author_name"), "comment": data["comment"]})
    await db.commit()
    return {"status": "ok", "id": comment_id}


@router.delete("/ropa/{ropa_id}/comments/{comment_id}")
async def delete_comment(ropa_id: str, comment_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM ropa_comments WHERE id = CAST(:id AS UUID) AND ropa_id = CAST(:rid AS UUID)"), {"id": comment_id, "rid": ropa_id})
    await db.commit()
    return {"status": "ok"}


# ─── Files (S3-backed attachments) ──────────────────────────────────────────────
@router.get("/ropa/{ropa_id}/files")
async def list_files(ropa_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM ropa_files WHERE ropa_id = CAST(:id AS UUID) ORDER BY uploaded_at DESC"), {"id": ropa_id})
    files = [_row(dict(row._mapping)) for row in r.fetchall()]
    for f in files:
        if (f.get("file_url") or "").startswith("s3://"):
            f["file_url"] = await s3_ref_to_presigned(f["file_url"])
    return {"files": files}


@router.post("/ropa/{ropa_id}/files")
async def upload_file(ropa_id: str, file: UploadFile = File(...), uploaded_by_email: str = Form(""), db: AsyncSession = Depends(get_db)):
    content = await file.read()
    safe_fn = file.filename.replace(" ", "_")
    key = f"grc/ropa/{ropa_id}/{safe_fn}"
    file_url = await upload_to_s3(key, content, file.content_type or "application/octet-stream")
    file_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO ropa_files (id, ropa_id, filename, file_url, uploaded_by_email, uploaded_at)
        VALUES (CAST(:id AS UUID), CAST(:rid AS UUID), :fn, :url, :email, NOW())
    """), {"id": file_id, "rid": ropa_id, "fn": file.filename, "url": file_url, "email": uploaded_by_email})
    await db.commit()
    return {"status": "ok", "id": file_id, "filename": file.filename, "file_url": await s3_ref_to_presigned(file_url)}


@router.delete("/ropa/{ropa_id}/files/{file_id}")
async def delete_file(ropa_id: str, file_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM ropa_files WHERE id = CAST(:id AS UUID) AND ropa_id = CAST(:rid AS UUID)"), {"id": file_id, "rid": ropa_id})
    await db.commit()
    return {"status": "ok"}


# ─── Revision History ───────────────────────────────────────────────────────────
@router.get("/ropa/{ropa_id}/revisions/")
async def list_revisions(ropa_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM ropa_revisions WHERE ropa_id = CAST(:id AS UUID) ORDER BY revision_date DESC"), {"id": ropa_id})
    return {"revisions": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.post("/ropa/{ropa_id}/revisions/")
async def add_revision(ropa_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("content") or not data.get("revision_date"):
        raise HTTPException(status_code=400, detail="revision_date and content are required")
    revision_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO ropa_revisions (id, ropa_id, revision_date, owner_email, owner_name, content, created_at)
        VALUES (CAST(:id AS UUID), CAST(:rid AS UUID), CAST(:revision_date AS TIMESTAMP), :owner_email, :owner_name, :content, NOW())
    """), {
        "id": revision_id, "rid": ropa_id, "revision_date": data["revision_date"],
        "owner_email": data.get("owner_email", ""), "owner_name": data.get("owner_name"), "content": data["content"],
    })
    await db.commit()
    return {"status": "ok", "id": revision_id}


@router.delete("/ropa/{ropa_id}/revisions/{revision_id}")
async def delete_revision(ropa_id: str, revision_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM ropa_revisions WHERE id = CAST(:id AS UUID) AND ropa_id = CAST(:rid AS UUID)"), {"id": revision_id, "rid": ropa_id})
    await db.commit()
    return {"status": "ok"}
