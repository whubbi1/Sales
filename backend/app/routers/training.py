from fastapi import APIRouter, Depends, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import uuid, os, asyncio, json, httpx
import boto3

router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://dev.whubbi.wcomply.com")
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

def _stringify_ids(d: dict) -> dict:
    return {k: (str(v) if isinstance(v, uuid.UUID) else v) for k, v in d.items()}

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

# ─── Training Catalogue ─────────────────────────────────────────────────────────
TRAINING_TYPES = ['wcomply', 'external']
TRAINING_TYPE_LABELS = {'wcomply': 'WCOMPLY', 'external': 'External'}
TRAINING_LANGUAGES = ['English', 'French', 'Portuguese', 'Czech', 'Romanian', 'Spanish']
EXPERTISE_LEVELS = ['beginner', 'intermediate', 'expert']

@router.get("/meta")
async def get_meta():
    return {"training_types": TRAINING_TYPES, "training_type_labels": TRAINING_TYPE_LABELS,
            "training_languages": TRAINING_LANGUAGES, "expertise_levels": EXPERTISE_LEVELS}

@router.get("/catalog")
async def list_catalog(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM training_catalog ORDER BY created_at DESC"))
    return {"catalog": [_stringify_ids(dict(row._mapping)) for row in r.fetchall()]}

@router.post("/catalog")
async def create_catalog_item(data: dict, db: AsyncSession = Depends(get_db)):
    cid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO training_catalog (id, training_type, company, title, description, duration, material_link, languages, expertise_level, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :training_type, :company, :title, :description, :duration, :material_link, CAST(:languages AS JSON), :expertise_level, NOW(), NOW())
    """), {
        "id": cid,
        "training_type": data.get("training_type") or "wcomply",
        "company": data.get("company", ""),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "duration": data.get("duration", ""),
        "material_link": data.get("material_link", ""),
        "languages": json.dumps(data.get("languages") or []),
        "expertise_level": data.get("expertise_level") or "beginner",
    })
    await db.commit()
    return {"status": "ok", "id": cid}

@router.put("/catalog/{cid}")
async def update_catalog_item(cid: str, data: dict, db: AsyncSession = Depends(get_db)):
    params = {
        "id": cid,
        "training_type": data.get("training_type", ""),
        "company": data.get("company", ""),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "duration": data.get("duration", ""),
        "material_link": data.get("material_link", ""),
        "expertise_level": data.get("expertise_level", ""),
    }
    lang_set = "languages = CAST(:languages AS JSON)," if "languages" in data else ""
    if "languages" in data:
        params["languages"] = json.dumps(data.get("languages") or [])
    await db.execute(text(f"""
        UPDATE training_catalog SET
            training_type = COALESCE(NULLIF(:training_type,''), training_type),
            company = COALESCE(NULLIF(:company,''), company),
            title = COALESCE(NULLIF(:title,''), title),
            description = :description,
            duration = COALESCE(NULLIF(:duration,''), duration),
            material_link = :material_link,
            expertise_level = COALESCE(NULLIF(:expertise_level,''), expertise_level),
            {lang_set}
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), params)
    await db.commit()
    return {"status": "ok"}

@router.delete("/catalog/{cid}")
async def delete_catalog_item(cid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM training_catalog WHERE id = CAST(:id AS UUID)"), {"id": cid})
    await db.commit()
    return {"status": "ok"}

# ─── Training Plans (function-based bundles of catalog trainings) ─────────────
@router.get("/plans")
async def list_plans(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM training_plans ORDER BY created_at DESC"))
    plans = [_stringify_ids(dict(row._mapping)) for row in r.fetchall()]
    for p in plans:
        ir = await db.execute(text("""
            SELECT tpi.id AS item_id, tpi.sequence AS sequence, tc.* FROM training_plan_items tpi
            JOIN training_catalog tc ON tc.id = tpi.catalog_id
            WHERE tpi.plan_id = CAST(:pid AS UUID)
            ORDER BY tpi.sequence ASC
        """), {"pid": p["id"]})
        p["trainings"] = [_stringify_ids(dict(row._mapping)) for row in ir.fetchall()]
    return {"plans": plans}

@router.post("/plans")
async def create_plan(data: dict, db: AsyncSession = Depends(get_db)):
    pid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO training_plans (id, training_function, description, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :training_function, :description, NOW(), NOW())
    """), {"id": pid, "training_function": data.get("training_function", ""), "description": data.get("description", "")})
    for item in (data.get("items") or []):
        await db.execute(text("""
            INSERT INTO training_plan_items (id, plan_id, catalog_id, sequence, created_at)
            VALUES (gen_random_uuid(), CAST(:pid AS UUID), CAST(:cid AS UUID), :sequence, NOW())
        """), {"pid": pid, "cid": item.get("catalog_id"), "sequence": item.get("sequence", 0)})
    await db.commit()
    return {"status": "ok", "id": pid}

@router.put("/plans/{pid}")
async def update_plan(pid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE training_plans SET
            training_function = COALESCE(NULLIF(:training_function,''), training_function),
            description = :description,
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {"id": pid, "training_function": data.get("training_function", ""), "description": data.get("description", "")})
    await db.commit()
    return {"status": "ok"}

@router.delete("/plans/{pid}")
async def delete_plan(pid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM training_plan_items WHERE plan_id = CAST(:id AS UUID)"), {"id": pid})
    await db.execute(text("DELETE FROM training_plans WHERE id = CAST(:id AS UUID)"), {"id": pid})
    await db.commit()
    return {"status": "ok"}

@router.post("/plans/{pid}/items")
async def add_plan_item(pid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        INSERT INTO training_plan_items (id, plan_id, catalog_id, sequence, created_at)
        VALUES (gen_random_uuid(), CAST(:pid AS UUID), CAST(:cid AS UUID), :sequence, NOW())
    """), {"pid": pid, "cid": data.get("catalog_id"), "sequence": data.get("sequence", 0)})
    await db.commit()
    return {"status": "ok"}

@router.put("/plans/{pid}/items/{item_id}")
async def update_plan_item(pid: str, item_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("UPDATE training_plan_items SET sequence = :sequence WHERE id = CAST(:id AS UUID) AND plan_id = CAST(:pid AS UUID)"),
                      {"id": item_id, "pid": pid, "sequence": data.get("sequence", 0)})
    await db.commit()
    return {"status": "ok"}

@router.delete("/plans/{pid}/items/{item_id}")
async def remove_plan_item(pid: str, item_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM training_plan_items WHERE id = CAST(:id AS UUID) AND plan_id = CAST(:pid AS UUID)"), {"id": item_id, "pid": pid})
    await db.commit()
    return {"status": "ok"}

# ─── Training Assignments (Training Manager assigns, employee completes) ──────
async def _renew_due_recurring(db: AsyncSession):
    """Fixed-schedule renewal: any recurring assignment past its due date with no
    successor yet gets the next occurrence created now, regardless of completion."""
    r = await db.execute(text("""
        SELECT * FROM training_assignments
        WHERE recurrence IS NOT NULL AND due_date IS NOT NULL AND due_date <= CURRENT_DATE
          AND next_assignment_id IS NULL
    """))
    due = r.fetchall()
    for row in due:
        nid = str(uuid.uuid4())
        await db.execute(text("""
            INSERT INTO training_assignments
                (id, user_email, training_name, description, catalog_id, source_plan_id,
                 due_date, status, recurrence, assigned_by_email, assigned_by_name, created_at, updated_at)
            VALUES
                (CAST(:id AS UUID), :email, :name, :description, CAST(:catalog_id AS UUID), CAST(:source_plan_id AS UUID),
                 CAST(:due_date AS DATE) + INTERVAL '1 year', 'assigned', :recurrence, :assigned_by_email, :assigned_by_name, NOW(), NOW())
        """), {
            "id": nid, "email": row.user_email, "name": row.training_name, "description": row.description,
            "catalog_id": str(row.catalog_id) if row.catalog_id else None,
            "source_plan_id": str(row.source_plan_id) if row.source_plan_id else None,
            "due_date": row.due_date, "recurrence": row.recurrence,
            "assigned_by_email": row.assigned_by_email, "assigned_by_name": row.assigned_by_name,
        })
        await db.execute(text("UPDATE training_assignments SET next_assignment_id = CAST(:nid AS UUID) WHERE id = CAST(:id AS UUID)"),
                          {"nid": nid, "id": str(row.id)})
    if due:
        await db.commit()

@router.get("/assignments/{email}")
async def list_my_assignments(email: str, db: AsyncSession = Depends(get_db)):
    await _renew_due_recurring(db)
    r = await db.execute(text("SELECT * FROM training_assignments WHERE user_email = :email ORDER BY due_date ASC NULLS LAST"), {"email": email})
    return {"assignments": [_stringify_ids(dict(row._mapping)) for row in r.fetchall()]}

@router.post("/assignments/{email}/{aid}/complete")
async def complete_assignment(
    email: str, aid: str,
    completion_date: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(text("SELECT * FROM training_assignments WHERE id = CAST(:id AS UUID) AND user_email = :email"), {"id": aid, "email": email})
    assignment = r.fetchone()
    if not assignment:
        return {"status": "error", "message": "Assignment not found"}

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
        VALUES (CAST(:id AS UUID), :email, CAST(NULLIF(:date,'') AS DATE), :name, :description, :file_ref, :file_name, CAST(:assignment_id AS UUID), NOW(), NOW())
    """), {
        "id": tid, "email": email, "date": completion_date,
        "name": assignment.training_name,
        "description": description or assignment.description or "",
        "file_ref": file_ref, "file_name": file_name,
        "assignment_id": aid,
    })
    await db.execute(text("""
        UPDATE training_assignments SET status = 'completed', completed_training_id = CAST(:tid AS UUID), updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {"tid": tid, "id": aid})
    await db.commit()
    return {"status": "ok", "training_id": tid}

@router.get("/assignments")
async def list_all_assignments(status: str = None, user_email: str = None, catalog_id: str = None, db: AsyncSession = Depends(get_db)):
    await _renew_due_recurring(db)
    where, params = ["1=1"], {}
    if status:
        where.append("status = :status")
        params["status"] = status
    if user_email:
        where.append("user_email = :user_email")
        params["user_email"] = user_email
    if catalog_id:
        where.append("catalog_id = CAST(:catalog_id AS UUID)")
        params["catalog_id"] = catalog_id
    r = await db.execute(text(f"SELECT * FROM training_assignments WHERE {' AND '.join(where)} ORDER BY due_date ASC NULLS LAST"), params)
    return {"assignments": [_stringify_ids(dict(row._mapping)) for row in r.fetchall()]}

# ─── Assignment notifications: a WHUBBI Chat (Teams) message + a personal email ──
async def _notify_teams_assignment(recipients: list, training_names: list):
    from app.routers.hr import send_teams_messages_bulk, HR_SENDER_EMAIL
    from app.database import AsyncSessionLocal
    if not recipients or not training_names:
        return
    plural = len(training_names) != 1
    names_list = ", ".join(training_names[:5]) + ("…" if len(training_names) > 5 else "")
    message = (
        f"📚 New training{'s' if plural else ''} assigned to you in WHUBBI: {names_list}. "
        f"View and complete {'them' if plural else 'it'} on your Training page: {FRONTEND_URL}/settings/training"
    )
    msg_id = str(uuid.uuid4())
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("""
                INSERT INTO hr_chat_messages
                    (id, sender_email, sender_name, message, recipients, status, sent_at, sent_count, delivered_count, created_at)
                VALUES
                    (CAST(:id AS UUID), :sender, :sender_name, :message, CAST(:recipients AS JSONB),
                     'sent', NOW(), :count, 0, NOW())
            """), {"id": msg_id, "sender": HR_SENDER_EMAIL, "sender_name": "WHUBBI Training",
                   "message": message, "recipients": json.dumps(recipients), "count": len(recipients)})
            await session.commit()
        await send_teams_messages_bulk(msg_id, recipients, message, HR_SENDER_EMAIL)
    except Exception as e:
        print(f"⚠️ Training assignment Teams notification failed: {e}")

async def _notify_email_assignment(email: str, trainings: list):
    from app.routers.settings import get_ms_token
    from app.routers.hr import HR_SENDER_EMAIL
    try:
        token = await get_ms_token()
        if not token:
            return
        plural = len(trainings) != 1
        rows = "".join(
            f"<li><strong>{t['name']}</strong>" +
            (f' — <a href="{t["material_link"]}">Training material</a>' if t.get("material_link") else "") +
            "</li>" for t in trainings
        )
        html = f"""
            <p>Hello,</p>
            <p>The following training{'s' if plural else ''} {'have' if plural else 'has'} been assigned to you in WHUBBI:</p>
            <ul>{rows}</ul>
            <p>You can view and complete {'them' if plural else 'it'} from your
            <a href="{FRONTEND_URL}/settings/training">Training page</a>.</p>
        """
        async with httpx.AsyncClient(timeout=15) as client:
            await client.post(
                f"https://graph.microsoft.com/v1.0/users/{HR_SENDER_EMAIL}/sendMail",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"message": {
                    "subject": f"New training{'s' if plural else ''} assigned to you",
                    "body": {"contentType": "HTML", "content": html},
                    "toRecipients": [{"emailAddress": {"address": email}}],
                }},
            )
    except Exception as e:
        print(f"⚠️ Training assignment email failed for {email}: {e}")

async def _notify_assignments(assignments_by_email: dict):
    if not assignments_by_email:
        return
    all_names = sorted({t["name"] for trainings in assignments_by_email.values() for t in trainings})
    await _notify_teams_assignment(list(assignments_by_email.keys()), all_names)
    for email, trainings in assignments_by_email.items():
        await _notify_email_assignment(email, trainings)

@router.post("/assignments")
async def create_assignments(data: dict, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    emails = data.get("user_emails") or []
    due_date = data.get("due_date", "")
    recurrence = data.get("recurrence") or None
    assigned_by_email = data.get("assigned_by_email", "")
    assigned_by_name = data.get("assigned_by_name", "")

    # Resolve what's being assigned: either one catalog training, or a whole plan
    # (expands into one assignment per training in the plan).
    catalog_items = []
    plan_id = data.get("plan_id")
    if plan_id:
        ir = await db.execute(text("""
            SELECT tc.* FROM training_plan_items tpi
            JOIN training_catalog tc ON tc.id = tpi.catalog_id
            WHERE tpi.plan_id = CAST(:pid AS UUID)
        """), {"pid": plan_id})
        catalog_items = [dict(row._mapping) for row in ir.fetchall()]
    elif data.get("catalog_id"):
        cr = await db.execute(text("SELECT * FROM training_catalog WHERE id = CAST(:id AS UUID)"), {"id": data.get("catalog_id")})
        row = cr.fetchone()
        if row:
            catalog_items = [dict(row._mapping)]

    created = 0
    assignments_by_email: dict = {}
    for email in emails:
        for item in catalog_items:
            aid = str(uuid.uuid4())
            await db.execute(text("""
                INSERT INTO training_assignments
                    (id, user_email, training_name, description, catalog_id, source_plan_id,
                     due_date, status, recurrence, assigned_by_email, assigned_by_name, created_at, updated_at)
                VALUES
                    (CAST(:id AS UUID), :email, :name, :description, CAST(:catalog_id AS UUID), CAST(:source_plan_id AS UUID),
                     CAST(NULLIF(:due_date,'') AS DATE), 'assigned', :recurrence, :assigned_by_email, :assigned_by_name, NOW(), NOW())
            """), {
                "id": aid, "email": email,
                "name": item["title"], "description": item.get("description", ""),
                "catalog_id": str(item["id"]), "source_plan_id": plan_id,
                "due_date": due_date, "recurrence": recurrence,
                "assigned_by_email": assigned_by_email, "assigned_by_name": assigned_by_name,
            })
            created += 1
            assignments_by_email.setdefault(email, []).append({"name": item["title"], "material_link": item.get("material_link", "")})
    await db.commit()
    if assignments_by_email:
        background_tasks.add_task(_notify_assignments, assignments_by_email)
    return {"status": "ok", "created": created}

@router.delete("/assignments/{aid}")
async def delete_assignment(aid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM training_assignments WHERE id = CAST(:id AS UUID)"), {"id": aid})
    await db.commit()
    return {"status": "ok"}

# ─── Execution / follow-up reporting ────────────────────────────────────────────
@router.get("/overview")
async def training_overview(db: AsyncSession = Depends(get_db)):
    await _renew_due_recurring(db)
    # Reuse the same live-directory-with-DB-fallback source /settings/users uses,
    # so employees who've never synced their profile still show up here.
    from app.routers.settings import list_users as _list_users
    users_resp = await _list_users(db)
    users = users_resp.get("users", [])

    tr = await db.execute(text("SELECT user_email, COUNT(*) AS c FROM trainings GROUP BY user_email"))
    training_counts = {row.user_email: row.c for row in tr.fetchall()}
    cr = await db.execute(text("SELECT user_email, COUNT(*) AS c FROM certifications GROUP BY user_email"))
    cert_counts = {row.user_email: row.c for row in cr.fetchall()}
    pr = await db.execute(text("SELECT user_email, COUNT(*) AS c FROM training_assignments WHERE status = 'assigned' GROUP BY user_email"))
    active_counts = {row.user_email: row.c for row in pr.fetchall()}

    lr = await db.execute(text("""
        SELECT user_email, training_name, due_date FROM training_assignments
        WHERE status = 'assigned' AND due_date IS NOT NULL AND due_date < CURRENT_DATE
        ORDER BY due_date ASC
    """))
    late_by_email: dict = {}
    for row in lr.fetchall():
        late_by_email.setdefault(row.user_email, []).append({"name": row.training_name, "due_date": str(row.due_date)})

    result = []
    for u in users:
        email = u.get("email")
        result.append({
            **u,
            "trainings_count": training_counts.get(email, 0),
            "certifications_count": cert_counts.get(email, 0),
            "active_assignments_count": active_counts.get(email, 0),
            "late_assignments_count": len(late_by_email.get(email, [])),
            "late_trainings": late_by_email.get(email, []),
        })
    return {"users": result}

@router.get("/overview/training/{catalog_id}")
async def training_overview_by_training(catalog_id: str, db: AsyncSession = Depends(get_db)):
    await _renew_due_recurring(db)
    from app.routers.settings import list_users as _list_users
    users_resp = await _list_users(db)
    names_by_email = {u.get("email"): u for u in users_resp.get("users", [])}

    r = await db.execute(text("""
        SELECT * FROM training_assignments WHERE catalog_id = CAST(:id AS UUID) ORDER BY user_email
    """), {"id": catalog_id})
    assignments = []
    for row in r.fetchall():
        a = _stringify_ids(dict(row._mapping))
        u = names_by_email.get(a.get("user_email"), {})
        a["first_name"] = u.get("first_name", "")
        a["last_name"] = u.get("last_name", "")
        assignments.append(a)
    return {"assignments": assignments}

# ─── Dashboard stats ─────────────────────────────────────────────────────────
@router.get("/dashboard-stats")
async def training_dashboard_stats(db: AsyncSession = Depends(get_db)):
    await _renew_due_recurring(db)
    assigned_r = await db.execute(text("SELECT COUNT(*) AS c FROM training_assignments WHERE status = 'assigned'"))
    assigned_count = assigned_r.fetchone().c

    executed_r = await db.execute(text("""
        SELECT COUNT(*) AS c FROM training_assignments
        WHERE status = 'completed' AND updated_at >= NOW() - INTERVAL '1 year'
    """))
    executed_count = executed_r.fetchone().c

    late_r = await db.execute(text("""
        SELECT COUNT(*) AS c FROM training_assignments
        WHERE status = 'assigned' AND due_date IS NOT NULL AND due_date < CURRENT_DATE
    """))
    late_count = late_r.fetchone().c

    available_r = await db.execute(text("SELECT COUNT(*) AS c FROM training_catalog"))
    available_count = available_r.fetchone().c

    return {
        "assigned_count": assigned_count,
        "executed_count": executed_count,
        "late_count": late_count,
        "available_count": available_count,
    }
