from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import uuid, os, asyncio
import boto3

router = APIRouter()

AWS_REGION   = os.getenv("AWS_REGION", "eu-west-1")
S3_HR_BUCKET = os.getenv("S3_HR_BUCKET", "whubbi-backups-dev")

# ─── S3 document storage (same pattern as backend/app/routers/hr.py) ──────────
def _s3_put_sync(bucket: str, key: str, content: bytes, content_type: str) -> None:
    s3 = boto3.client("s3", region_name=AWS_REGION)
    s3.put_object(Bucket=bucket, Key=key, Body=content, ContentType=content_type,
                  ContentDisposition=f'inline; filename="{key.split("/")[-1]}"')

def _s3_presigned_url_sync(bucket: str, key: str, expires: int = 3600) -> str:
    s3 = boto3.client("s3", region_name=AWS_REGION)
    return s3.generate_presigned_url("get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=expires)

async def upload_to_s3(key: str, content: bytes, content_type: str = "application/octet-stream") -> str:
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, lambda: _s3_put_sync(S3_HR_BUCKET, key, content, content_type))
    return f"s3://{S3_HR_BUCKET}/{key}"

async def s3_ref_to_presigned(ref: str, expires: int = 3600) -> str:
    if not ref or not ref.startswith("s3://"):
        return ref
    path = ref[5:]
    bucket, _, key = path.partition("/")
    loop = asyncio.get_running_loop()
    try:
        return await loop.run_in_executor(None, lambda: _s3_presigned_url_sync(bucket, key, expires))
    except Exception as e:
        print(f"S3 presigned URL error: {e}")
        return ref

async def _with_file_url(rows):
    result = []
    for row in rows:
        d = dict(row._mapping)
        d["id"] = str(d["id"])
        if d.get("plan_id"):
            d["plan_id"] = str(d["plan_id"])
        if d.get("file_ref"):
            d["file_url"] = await s3_ref_to_presigned(d["file_ref"])
        result.append(d)
    return result

# ─── Trainings performed (self-service) ────────────────────────────────────────
@router.get("/trainings/{email}")
async def list_trainings(email: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM trainings WHERE user_email = :email ORDER BY training_date DESC"), {"email": email})
    return {"trainings": await _with_file_url(r.fetchall())}

@router.post("/trainings/{email}")
async def create_training(email: str, data: dict, db: AsyncSession = Depends(get_db)):
    tid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO trainings (id, user_email, training_date, name, description, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :email, CAST(NULLIF(:training_date,'') AS DATE), :name, :description, NOW(), NOW())
    """), {"id": tid, "email": email, "training_date": data.get("training_date", ""), "name": data.get("name", ""), "description": data.get("description", "")})
    await db.commit()
    return {"status": "ok", "id": tid}

@router.put("/trainings/{email}/{tid}")
async def update_training(email: str, tid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE trainings SET
            training_date = CAST(NULLIF(:training_date,'') AS DATE),
            name = :name,
            description = :description,
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID) AND user_email = :email
    """), {"id": tid, "email": email, "training_date": data.get("training_date", ""), "name": data.get("name", ""), "description": data.get("description", "")})
    await db.commit()
    return {"status": "ok"}

@router.post("/trainings/{email}/{tid}/upload")
async def upload_training_file(email: str, tid: str, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    content = await file.read()
    safe_fn = file.filename.replace(" ", "_")
    key = f"hr/training/{email}/{tid}/{safe_fn}"
    s3_ref = await upload_to_s3(key, content, file.content_type or "application/octet-stream")
    await db.execute(text("UPDATE trainings SET file_ref = :ref, file_name = :fn, updated_at = NOW() WHERE id = CAST(:id AS UUID) AND user_email = :email"),
                      {"ref": s3_ref, "fn": file.filename, "id": tid, "email": email})
    await db.commit()
    return {"status": "ok", "file_url": await s3_ref_to_presigned(s3_ref)}

@router.delete("/trainings/{email}/{tid}")
async def delete_training(email: str, tid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM trainings WHERE id = CAST(:id AS UUID) AND user_email = :email"), {"id": tid, "email": email})
    await db.commit()
    return {"status": "ok"}

# ─── Certifications (self-service) ─────────────────────────────────────────────
@router.get("/certifications/{email}")
async def list_certifications(email: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM certifications WHERE user_email = :email ORDER BY cert_date DESC"), {"email": email})
    return {"certifications": await _with_file_url(r.fetchall())}

@router.post("/certifications/{email}")
async def create_certification(email: str, data: dict, db: AsyncSession = Depends(get_db)):
    cid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO certifications (id, user_email, cert_date, name, description, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :email, CAST(NULLIF(:cert_date,'') AS DATE), :name, :description, NOW(), NOW())
    """), {"id": cid, "email": email, "cert_date": data.get("cert_date", ""), "name": data.get("name", ""), "description": data.get("description", "")})
    await db.commit()
    return {"status": "ok", "id": cid}

@router.put("/certifications/{email}/{cid}")
async def update_certification(email: str, cid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE certifications SET
            cert_date = CAST(NULLIF(:cert_date,'') AS DATE),
            name = :name,
            description = :description,
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID) AND user_email = :email
    """), {"id": cid, "email": email, "cert_date": data.get("cert_date", ""), "name": data.get("name", ""), "description": data.get("description", "")})
    await db.commit()
    return {"status": "ok"}

@router.post("/certifications/{email}/{cid}/upload")
async def upload_certification_file(email: str, cid: str, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    content = await file.read()
    safe_fn = file.filename.replace(" ", "_")
    key = f"hr/certifications/{email}/{cid}/{safe_fn}"
    s3_ref = await upload_to_s3(key, content, file.content_type or "application/octet-stream")
    await db.execute(text("UPDATE certifications SET file_ref = :ref, file_name = :fn, updated_at = NOW() WHERE id = CAST(:id AS UUID) AND user_email = :email"),
                      {"ref": s3_ref, "fn": file.filename, "id": cid, "email": email})
    await db.commit()
    return {"status": "ok", "file_url": await s3_ref_to_presigned(s3_ref)}

@router.delete("/certifications/{email}/{cid}")
async def delete_certification(email: str, cid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM certifications WHERE id = CAST(:id AS UUID) AND user_email = :email"), {"id": cid, "email": email})
    await db.commit()
    return {"status": "ok"}

# ─── Training Plan (HR assigns, employee completes) ────────────────────────────
@router.get("/plans/{email}")
async def list_my_plans(email: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM training_plans WHERE user_email = :email ORDER BY due_date ASC NULLS LAST"), {"email": email})
    plans = []
    for row in r.fetchall():
        d = dict(row._mapping)
        d["id"] = str(d["id"])
        if d.get("completed_training_id"):
            d["completed_training_id"] = str(d["completed_training_id"])
        plans.append(d)
    return {"plans": plans}

@router.post("/plans/{email}/{pid}/complete")
async def complete_plan(
    email: str, pid: str,
    completion_date: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(text("SELECT * FROM training_plans WHERE id = CAST(:id AS UUID) AND user_email = :email"), {"id": pid, "email": email})
    plan = r.fetchone()
    if not plan:
        return {"status": "error", "message": "Plan not found"}

    tid = str(uuid.uuid4())
    file_ref, file_name = None, None
    if file is not None:
        content = await file.read()
        safe_fn = file.filename.replace(" ", "_")
        key = f"hr/training/{email}/{tid}/{safe_fn}"
        file_ref = await upload_to_s3(key, content, file.content_type or "application/octet-stream")
        file_name = file.filename

    await db.execute(text("""
        INSERT INTO trainings (id, user_email, training_date, name, description, file_ref, file_name, plan_id, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :email, CAST(NULLIF(:date,'') AS DATE), :name, :description, :file_ref, :file_name, CAST(:plan_id AS UUID), NOW(), NOW())
    """), {
        "id": tid, "email": email, "date": completion_date,
        "name": plan.training_name,
        "description": description or plan.description or "",
        "file_ref": file_ref, "file_name": file_name,
        "plan_id": pid,
    })
    await db.execute(text("""
        UPDATE training_plans SET status = 'completed', completed_training_id = CAST(:tid AS UUID), updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {"tid": tid, "id": pid})
    await db.commit()
    return {"status": "ok", "training_id": tid}

# ─── HR: assign & oversee ───────────────────────────────────────────────────────
@router.get("/plans")
async def list_all_plans(status: str = None, user_email: str = None, db: AsyncSession = Depends(get_db)):
    where, params = ["1=1"], {}
    if status:
        where.append("status = :status")
        params["status"] = status
    if user_email:
        where.append("user_email = :user_email")
        params["user_email"] = user_email
    r = await db.execute(text(f"SELECT * FROM training_plans WHERE {' AND '.join(where)} ORDER BY due_date ASC NULLS LAST"), params)
    plans = []
    for row in r.fetchall():
        d = dict(row._mapping)
        d["id"] = str(d["id"])
        if d.get("completed_training_id"):
            d["completed_training_id"] = str(d["completed_training_id"])
        plans.append(d)
    return {"plans": plans}

@router.post("/plans")
async def create_plans(data: dict, db: AsyncSession = Depends(get_db)):
    emails = data.get("user_emails") or []
    ids = []
    for email in emails:
        pid = str(uuid.uuid4())
        await db.execute(text("""
            INSERT INTO training_plans
                (id, user_email, training_name, description, due_date, status, assigned_by_email, assigned_by_name, created_at, updated_at)
            VALUES
                (CAST(:id AS UUID), :email, :training_name, :description, CAST(NULLIF(:due_date,'') AS DATE), 'assigned', :assigned_by_email, :assigned_by_name, NOW(), NOW())
        """), {
            "id": pid, "email": email,
            "training_name": data.get("training_name", ""),
            "description": data.get("description", ""),
            "due_date": data.get("due_date", ""),
            "assigned_by_email": data.get("assigned_by_email", ""),
            "assigned_by_name": data.get("assigned_by_name", ""),
        })
        ids.append(pid)
    await db.commit()
    return {"status": "ok", "created": len(ids)}

@router.delete("/plans/{pid}")
async def delete_plan(pid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM training_plans WHERE id = CAST(:id AS UUID)"), {"id": pid})
    await db.commit()
    return {"status": "ok"}

@router.get("/overview")
async def training_overview(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT up.email, up.display_name, up.first_name, up.last_name, up.job_title, up.department,
               COUNT(DISTINCT t.id) AS trainings_count,
               COUNT(DISTINCT c.id) AS certifications_count,
               COUNT(DISTINCT tp.id) FILTER (WHERE tp.status = 'assigned') AS active_plans_count
        FROM user_profiles up
        LEFT JOIN trainings t ON t.user_email = up.email
        LEFT JOIN certifications c ON c.user_email = up.email
        LEFT JOIN training_plans tp ON tp.user_email = up.email
        GROUP BY up.email, up.display_name, up.first_name, up.last_name, up.job_title, up.department
        ORDER BY up.last_name, up.first_name
    """))
    return {"users": [dict(row._mapping) for row in r.fetchall()]}
