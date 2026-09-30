# backend/app/routers/project_defaults.py
# Operations > Project Defaults: admin overrides of the 5 standard register-import
# templates (Action List, Project Members, Decision Register, Risk Register,
# Deliverables). Absent an override here, project_management.py generates the standard
# WHUBBI-branded template on the fly (see write_template_xlsx) — this page just lets an
# admin replace that generated file with their own, once, for everyone.
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
import io

from app.database import get_db
from app.authz import require_permission, get_current_user_email
from app.models.project_management import PMDefaultTemplate
from app.routers.hr import upload_to_s3, AWS_REGION
from app.routers.project_management import _s3_get, _standard_template_bytes, TEMPLATE_COLUMNS, _read_upload

router = APIRouter()

# Display order/labels for the 5 register template slots.
REGISTER_TEMPLATE_TYPES = [
    ("action_list", "Action List"),
    ("member_list", "Project Members"),
    ("decision_list", "Decision Register"),
    ("risk_register", "Risk Register"),
    ("deliverable_list", "Deliverables"),
]


@router.get("/templates")
async def list_default_templates(db: AsyncSession = Depends(get_db), _: str = Depends(require_permission("operations", "project_defaults", "view"))):
    rows = (await db.execute(select(PMDefaultTemplate))).scalars().all()
    by_type = {r.template_type: r for r in rows}
    return [
        {
            "template_type": t,
            "label": label,
            "is_custom": t in by_type,
            "filename": by_type[t].filename if t in by_type else None,
            "uploaded_by": by_type[t].uploaded_by if t in by_type else None,
            "updated_at": by_type[t].updated_at if t in by_type else None,
        }
        for t, label in REGISTER_TEMPLATE_TYPES
    ]


@router.post("/templates/{template_type}")
async def upload_default_template(template_type: str, name: str = Form(...), file: UploadFile = File(...),
                                   db: AsyncSession = Depends(get_db),
                                   email: str = Depends(get_current_user_email),
                                   _: str = Depends(require_permission("operations", "project_defaults", "edit"))):
    if template_type not in dict(REGISTER_TEMPLATE_TYPES):
        raise HTTPException(400, f"template_type must be one of {[t for t, _ in REGISTER_TEMPLATE_TYPES]}")
    content = await _read_upload(file)
    file_ref = await upload_to_s3(f"project-defaults/{template_type}/{file.filename}", content,
                                   file.content_type or "application/octet-stream")
    existing = (await db.execute(select(PMDefaultTemplate).where(PMDefaultTemplate.template_type == template_type))).scalar_one_or_none()
    if existing:
        existing.name, existing.file_ref, existing.filename = name.strip() or file.filename, file_ref, file.filename
        existing.content_type, existing.uploaded_by = file.content_type, email
    else:
        db.add(PMDefaultTemplate(template_type=template_type, name=name.strip() or file.filename, file_ref=file_ref,
                                  filename=file.filename, content_type=file.content_type, uploaded_by=email))
    await db.commit()
    return {"status": "ok"}


@router.delete("/templates/{template_type}")
async def delete_default_template(template_type: str, db: AsyncSession = Depends(get_db),
                                   _: str = Depends(require_permission("operations", "project_defaults", "edit"))):
    await db.execute(delete(PMDefaultTemplate).where(PMDefaultTemplate.template_type == template_type))
    await db.commit()
    return {"status": "ok"}


@router.get("/templates/{template_type}/download")
async def download_default_template(template_type: str, db: AsyncSession = Depends(get_db),
                                     _: str = Depends(require_permission("operations", "project_defaults", "view"))):
    if template_type not in TEMPLATE_COLUMNS:
        raise HTTPException(404, "Unknown template type")
    content = await _standard_template_bytes(db, template_type)
    return StreamingResponse(io.BytesIO(content), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{template_type}_standard_template.xlsx"'})
