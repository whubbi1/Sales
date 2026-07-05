# backend/app/routers/testing.py
# Testing module — Test Plans (scoped to an IT Application/submodule) with ordered Test
# Scripts, Test Campaigns that snapshot selected plans' scripts for execution, a review
# phase that rates deviations by criticality, and auto-generated Remediation Plans whose
# status is computed from their actions rather than set directly.
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from datetime import datetime
import uuid, os, asyncio
import boto3

router = APIRouter()

CRITICALITIES = {"Blocking", "Critical", "High", "Medium", "Low"}
CAMPAIGN_STATUSES = {"planned", "in_execution", "in_review", "completed"}
REMEDIATION_ACTION_STATUSES = {"new", "in_progress", "closed"}

AWS_REGION   = os.getenv("AWS_REGION", "eu-west-1")
S3_HR_BUCKET = os.getenv("S3_HR_BUCKET", "whubbi-backups-dev")


# ─── S3 screenshot storage (same pattern as backend/app/routers/hr.py / training.py) ──
def _s3_put_sync(bucket: str, key: str, content: bytes, content_type: str) -> None:
    s3 = boto3.client("s3", region_name=AWS_REGION)
    s3.put_object(Bucket=bucket, Key=key, Body=content, ContentType=content_type,
                  ContentDisposition=f'inline; filename="{key.split("/")[-1]}"')


async def upload_to_s3(key: str, content: bytes, content_type: str = "application/octet-stream") -> str:
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, lambda: _s3_put_sync(S3_HR_BUCKET, key, content, content_type))
    return f"s3://{S3_HR_BUCKET}/{key}"


def _row(d: dict) -> dict:
    for k, v in d.items():
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
    return d


def _gen_number(prefix: str) -> str:
    n = datetime.utcnow()
    return f"{prefix}-{n.year}{n.month:02d}-{str(uuid.uuid4())[:4].upper()}"


async def _link_task(db: AsyncSession, task_id: str, label: str, url: str, by_email: str):
    await db.execute(text("""
        INSERT INTO task_links (id, task_id, label, url, added_by_email, created_at)
        VALUES (gen_random_uuid(), CAST(:tid AS UUID), :label, :url, :by, NOW())
    """), {"tid": task_id, "label": label, "url": url, "by": by_email})


FRONTEND_URL = os.getenv("FRONTEND_URL", "https://app.whubbi.wcomply.com")


# ─── Test Plans ──────────────────────────────────────────────────────────────────
@router.get("/plans")
async def list_plans(application_id: str = None, search: str = None, db: AsyncSession = Depends(get_db)):
    where = ["1=1"]
    params = {}
    if application_id:
        where.append("p.application_id = CAST(:aid AS UUID)")
        params["aid"] = application_id
    if search:
        where.append("p.title ILIKE :q")
        params["q"] = f"%{search}%"
    r = await db.execute(text(f"""
        SELECT p.*, a.name AS application_name, s.name AS submodule_name,
               (SELECT COUNT(*) FROM test_scripts ts WHERE ts.plan_id = p.id) AS script_count
        FROM test_plans p
        LEFT JOIN it_applications a ON a.id = p.application_id
        LEFT JOIN it_application_submodules s ON s.id = p.submodule_id
        WHERE {' AND '.join(where)}
        ORDER BY p.created_at DESC
    """), params)
    return {"plans": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.post("/plans")
async def create_plan(data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("title"):
        raise HTTPException(status_code=400, detail="title is required")
    plan_id = str(uuid.uuid4())
    plan_number = _gen_number("TP")
    await db.execute(text("""
        INSERT INTO test_plans (id, plan_number, title, description, application_id, submodule_id, created_by_email, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :plan_number, :title, :description, CAST(NULLIF(:application_id,'') AS UUID),
                CAST(NULLIF(:submodule_id,'') AS UUID), :created_by_email, NOW(), NOW())
    """), {
        "id": plan_id, "plan_number": plan_number, "title": data["title"], "description": data.get("description", ""),
        "application_id": data.get("application_id") or "", "submodule_id": data.get("submodule_id") or "",
        "created_by_email": data.get("created_by_email", ""),
    })
    await db.commit()
    return {"status": "ok", "id": plan_id, "plan_number": plan_number}


@router.get("/plans/{plan_id}")
async def get_plan(plan_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT p.*, a.name AS application_name, s.name AS submodule_name
        FROM test_plans p
        LEFT JOIN it_applications a ON a.id = p.application_id
        LEFT JOIN it_application_submodules s ON s.id = p.submodule_id
        WHERE p.id = CAST(:id AS UUID)
    """), {"id": plan_id})
    row = r.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Test plan not found")
    plan = _row(dict(row._mapping))
    scripts = await db.execute(text("SELECT * FROM test_scripts WHERE plan_id = CAST(:id AS UUID) ORDER BY position, created_at"), {"id": plan_id})
    plan["scripts"] = [_row(dict(r._mapping)) for r in scripts.fetchall()]
    return plan


@router.put("/plans/{plan_id}")
async def update_plan(plan_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE test_plans SET
            title = COALESCE(NULLIF(:title,''), title),
            description = COALESCE(:description, description),
            application_id = COALESCE(CAST(NULLIF(:application_id,'') AS UUID), application_id),
            submodule_id = CAST(NULLIF(:submodule_id,'') AS UUID),
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": plan_id, "title": data.get("title", ""), "description": data.get("description"),
        "application_id": data.get("application_id", ""), "submodule_id": data.get("submodule_id", ""),
    })
    await db.commit()
    return {"status": "ok"}


@router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM test_plans WHERE id = CAST(:id AS UUID)"), {"id": plan_id})
    await db.commit()
    return {"status": "ok"}


# ─── Test Scripts (= steps, belong to exactly one plan) ─────────────────────────
@router.post("/plans/{plan_id}/scripts")
async def create_script(plan_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("title"):
        raise HTTPException(status_code=400, detail="title is required")
    r = await db.execute(text("SELECT COUNT(*) FROM test_scripts WHERE plan_id = CAST(:id AS UUID)"), {"id": plan_id})
    position = r.scalar() or 0
    script_id = str(uuid.uuid4())
    script_number = _gen_number("TS")
    await db.execute(text("""
        INSERT INTO test_scripts (id, script_number, plan_id, position, title, details, expected_result, url, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :script_number, CAST(:plan_id AS UUID), :position, :title, :details, :expected_result, :url, NOW(), NOW())
    """), {
        "id": script_id, "script_number": script_number, "plan_id": plan_id, "position": position,
        "title": data["title"], "details": data.get("details", ""), "expected_result": data.get("expected_result", ""),
        "url": data.get("url", ""),
    })
    await db.commit()
    return {"status": "ok", "id": script_id, "script_number": script_number}


@router.put("/plans/{plan_id}/scripts/{script_id}")
async def update_script(plan_id: str, script_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE test_scripts SET
            title = COALESCE(NULLIF(:title,''), title),
            details = COALESCE(:details, details),
            expected_result = COALESCE(:expected_result, expected_result),
            url = COALESCE(:url, url),
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID) AND plan_id = CAST(:plan_id AS UUID)
    """), {"id": script_id, "plan_id": plan_id, "title": data.get("title", ""), "details": data.get("details"),
           "expected_result": data.get("expected_result"), "url": data.get("url")})
    await db.commit()
    return {"status": "ok"}


@router.delete("/plans/{plan_id}/scripts/{script_id}")
async def delete_script(plan_id: str, script_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM test_scripts WHERE id = CAST(:id AS UUID) AND plan_id = CAST(:plan_id AS UUID)"), {"id": script_id, "plan_id": plan_id})
    await db.commit()
    return {"status": "ok"}


# ─── Test Campaigns ──────────────────────────────────────────────────────────────
async def _campaign_task(db: AsyncSession, campaign: dict, role_label: str, owner_email: str, owner_name: str, created_by_email: str):
    if not owner_email:
        return
    from app.routers.task_manager import create_task
    created = await create_task({
        "title": f"{role_label} test campaign: {campaign['title']}",
        "description": f"You've been assigned as the {role_label.lower()} for this test campaign.",
        "owner_email": owner_email, "owner_name": owner_name,
        "source": "testing_campaign", "entity_type": "test_campaign", "entity_id": campaign["id"],
        "created_by_email": created_by_email or owner_email, "acting_email": created_by_email or owner_email,
    }, db)
    await _link_task(db, created["id"], f"{campaign.get('campaign_number','')} — {campaign['title']}",
                      f"{FRONTEND_URL}/testing/test-campaigns/{campaign['id']}", created_by_email or owner_email)


@router.get("/campaigns")
async def list_campaigns(status: str = None, db: AsyncSession = Depends(get_db)):
    where = ["1=1"]
    params = {}
    if status:
        where.append("status = :status")
        params["status"] = status
    r = await db.execute(text(f"""
        SELECT c.*,
               (SELECT COUNT(*) FROM test_campaign_steps s WHERE s.campaign_id = c.id) AS steps_total,
               (SELECT COUNT(*) FROM test_campaign_steps s WHERE s.campaign_id = c.id AND s.executed_at IS NOT NULL) AS steps_executed
        FROM test_campaigns c WHERE {' AND '.join(where)} ORDER BY c.created_at DESC
    """), params)
    return {"campaigns": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.post("/campaigns")
async def create_campaign(data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("title"):
        raise HTTPException(status_code=400, detail="title is required")
    plan_ids = data.get("plan_ids") or []
    if not plan_ids:
        raise HTTPException(status_code=400, detail="Select at least one test plan")

    campaign_id = str(uuid.uuid4())
    campaign_number = _gen_number("TC")
    owner_email = data.get("owner_email", "")
    reviewer_email = data.get("reviewer_email", "")
    await db.execute(text("""
        INSERT INTO test_campaigns (id, campaign_number, title, execution_date, owner_email, owner_name,
                                     reviewer_email, reviewer_name, status, created_by_email, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :campaign_number, :title, CAST(NULLIF(:execution_date,'') AS DATE),
                :owner_email, :owner_name, :reviewer_email, :reviewer_name, 'planned', :created_by_email, NOW(), NOW())
    """), {
        "id": campaign_id, "campaign_number": campaign_number, "title": data["title"],
        "execution_date": data.get("execution_date") or "", "owner_email": owner_email,
        "owner_name": data.get("owner_name", ""), "reviewer_email": reviewer_email,
        "reviewer_name": data.get("reviewer_name", ""), "created_by_email": data.get("created_by_email", ""),
    })

    position = 0
    for plan_id in plan_ids:
        await db.execute(text("""
            INSERT INTO test_campaign_plans (campaign_id, plan_id) VALUES (CAST(:cid AS UUID), CAST(:pid AS UUID))
            ON CONFLICT DO NOTHING
        """), {"cid": campaign_id, "pid": plan_id})
        scripts = await db.execute(text("SELECT * FROM test_scripts WHERE plan_id = CAST(:id AS UUID) ORDER BY position, created_at"), {"id": plan_id})
        for s in scripts.fetchall():
            sd = _row(dict(s._mapping))
            await db.execute(text("""
                INSERT INTO test_campaign_steps (id, campaign_id, plan_id, script_id, position, title, details, expected_result, url, created_at, updated_at)
                VALUES (gen_random_uuid(), CAST(:cid AS UUID), CAST(:pid AS UUID), CAST(:sid AS UUID), :position, :title, :details, :expected_result, :url, NOW(), NOW())
            """), {"cid": campaign_id, "pid": plan_id, "sid": sd["id"], "position": position,
                   "title": sd["title"], "details": sd.get("details", ""), "expected_result": sd.get("expected_result", ""), "url": sd.get("url", "")})
            position += 1

    await db.commit()

    campaign = {"id": campaign_id, "campaign_number": campaign_number, "title": data["title"]}
    await _campaign_task(db, campaign, "Execute", owner_email, data.get("owner_name", ""), data.get("created_by_email", ""))
    await _campaign_task(db, campaign, "Review", reviewer_email, data.get("reviewer_name", ""), data.get("created_by_email", ""))
    await db.commit()

    return {"status": "ok", "id": campaign_id, "campaign_number": campaign_number}


async def _get_campaign(db: AsyncSession, campaign_id: str) -> dict | None:
    r = await db.execute(text("SELECT * FROM test_campaigns WHERE id = CAST(:id AS UUID)"), {"id": campaign_id})
    row = r.fetchone()
    return _row(dict(row._mapping)) if row else None


@router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, db: AsyncSession = Depends(get_db)):
    campaign = await _get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Test campaign not found")
    steps = await db.execute(text("SELECT * FROM test_campaign_steps WHERE campaign_id = CAST(:id AS UUID) ORDER BY position"), {"id": campaign_id})
    campaign["steps"] = [_row(dict(r._mapping)) for r in steps.fetchall()]
    plans = await db.execute(text("""
        SELECT p.id, p.plan_number, p.title FROM test_campaign_plans cp
        JOIN test_plans p ON p.id = cp.plan_id WHERE cp.campaign_id = CAST(:id AS UUID)
    """), {"id": campaign_id})
    campaign["plans"] = [_row(dict(r._mapping)) for r in plans.fetchall()]
    remediation = await db.execute(text("SELECT id, plan_number, status FROM remediation_plans WHERE campaign_id = CAST(:id AS UUID)"), {"id": campaign_id})
    rrow = remediation.fetchone()
    campaign["remediation_plan"] = _row(dict(rrow._mapping)) if rrow else None
    return campaign


@router.put("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    campaign = await _get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Test campaign not found")

    new_owner = data.get("owner_email", campaign.get("owner_email") or "")
    new_reviewer = data.get("reviewer_email", campaign.get("reviewer_email") or "")
    acting_email = data.get("acting_email", "")

    if new_owner and new_owner != (campaign.get("owner_email") or ""):
        await _campaign_task(db, campaign, "Execute", new_owner, data.get("owner_name", ""), acting_email)
    if new_reviewer and new_reviewer != (campaign.get("reviewer_email") or ""):
        await _campaign_task(db, campaign, "Review", new_reviewer, data.get("reviewer_name", ""), acting_email)

    await db.execute(text("""
        UPDATE test_campaigns SET
            title = COALESCE(NULLIF(:title,''), title),
            execution_date = COALESCE(CAST(NULLIF(:execution_date,'') AS DATE), execution_date),
            owner_email = :owner_email, owner_name = COALESCE(:owner_name, owner_name),
            reviewer_email = :reviewer_email, reviewer_name = COALESCE(:reviewer_name, reviewer_name),
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": campaign_id, "title": data.get("title", ""), "execution_date": data.get("execution_date", ""),
        "owner_email": new_owner, "owner_name": data.get("owner_name"),
        "reviewer_email": new_reviewer, "reviewer_name": data.get("reviewer_name"),
    })
    await db.commit()
    return {"status": "ok"}


# ─── Execution — steps displayed one by one, executor records result/deviation/remediation ─
@router.put("/campaigns/{campaign_id}/steps/{step_id}/execute")
async def execute_step(campaign_id: str, step_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    campaign = await _get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Test campaign not found")
    if campaign["status"] not in ("planned", "in_execution"):
        raise HTTPException(status_code=400, detail=f"Cannot execute steps while campaign is {campaign['status']}")

    await db.execute(text("""
        UPDATE test_campaign_steps SET
            result = :result, deviation = :deviation, remediation = :remediation,
            executed_at = NOW(), updated_at = NOW()
        WHERE id = CAST(:id AS UUID) AND campaign_id = CAST(:cid AS UUID)
    """), {"id": step_id, "cid": campaign_id, "result": data.get("result", ""),
           "deviation": data.get("deviation", ""), "remediation": data.get("remediation", "")})

    if campaign["status"] == "planned":
        await db.execute(text("UPDATE test_campaigns SET status = 'in_execution', updated_at = NOW() WHERE id = CAST(:id AS UUID)"), {"id": campaign_id})

    remaining = await db.execute(text("""
        SELECT COUNT(*) FROM test_campaign_steps WHERE campaign_id = CAST(:id AS UUID) AND executed_at IS NULL
    """), {"id": campaign_id})
    if (remaining.scalar() or 0) == 0:
        await db.execute(text("UPDATE test_campaigns SET status = 'in_review', updated_at = NOW() WHERE id = CAST(:id AS UUID)"), {"id": campaign_id})

    await db.commit()
    return {"status": "ok"}


@router.post("/campaigns/{campaign_id}/steps/{step_id}/screenshot")
async def upload_step_screenshot(campaign_id: str, step_id: str, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    content = await file.read()
    key = f"testing/{campaign_id}/{step_id}/{file.filename}"
    ref = await upload_to_s3(key, content, file.content_type or "application/octet-stream")
    await db.execute(text("""
        UPDATE test_campaign_steps SET screenshot_url = :ref, updated_at = NOW()
        WHERE id = CAST(:id AS UUID) AND campaign_id = CAST(:cid AS UUID)
    """), {"id": step_id, "cid": campaign_id, "ref": ref})
    await db.commit()
    return {"status": "ok", "screenshot_url": ref}


# ─── Review — reviewer refines deviation/remediation, sets criticality ──────────
@router.put("/campaigns/{campaign_id}/steps/{step_id}/review")
async def review_step(campaign_id: str, step_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    campaign = await _get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Test campaign not found")
    if campaign["status"] != "in_review":
        raise HTTPException(status_code=400, detail="This campaign is not in review")
    criticality = data.get("criticality") or None
    if criticality and criticality not in CRITICALITIES:
        raise HTTPException(status_code=400, detail=f"criticality must be one of {sorted(CRITICALITIES)}")

    await db.execute(text("""
        UPDATE test_campaign_steps SET
            deviation = COALESCE(:deviation, deviation),
            remediation = COALESCE(:remediation, remediation),
            criticality = COALESCE(:criticality, criticality),
            reviewed_at = NOW(), updated_at = NOW()
        WHERE id = CAST(:id AS UUID) AND campaign_id = CAST(:cid AS UUID)
    """), {"id": step_id, "cid": campaign_id, "deviation": data.get("deviation"),
           "remediation": data.get("remediation"), "criticality": criticality})
    await db.commit()
    return {"status": "ok"}


@router.post("/campaigns/{campaign_id}/complete-review")
async def complete_review(campaign_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    campaign = await _get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Test campaign not found")
    if campaign["status"] != "in_review":
        raise HTTPException(status_code=400, detail="This campaign is not in review")

    steps = await db.execute(text("""
        SELECT * FROM test_campaign_steps WHERE campaign_id = CAST(:id AS UUID) AND COALESCE(deviation,'') != ''
    """), {"id": campaign_id})
    deviated = [_row(dict(r._mapping)) for r in steps.fetchall()]

    remediation_plan_id = None
    if deviated:
        remediation_plan_id = str(uuid.uuid4())
        plan_number = _gen_number("RP")
        await db.execute(text("""
            INSERT INTO remediation_plans (id, plan_number, campaign_id, status, created_by_email, created_at, updated_at)
            VALUES (CAST(:id AS UUID), :plan_number, CAST(:cid AS UUID), 'new', :by, NOW(), NOW())
        """), {"id": remediation_plan_id, "plan_number": plan_number, "cid": campaign_id, "by": data.get("acting_email", "")})
        for step in deviated:
            await db.execute(text("""
                INSERT INTO remediation_actions (id, remediation_plan_id, campaign_step_id, title, description, criticality, status, created_at, updated_at)
                VALUES (gen_random_uuid(), CAST(:pid AS UUID), CAST(:sid AS UUID), :title, :description, :criticality, 'new', NOW(), NOW())
            """), {"pid": remediation_plan_id, "sid": step["id"], "title": step["title"],
                   "description": step.get("remediation", ""), "criticality": step.get("criticality")})

    await db.execute(text("UPDATE test_campaigns SET status = 'completed', updated_at = NOW() WHERE id = CAST(:id AS UUID)"), {"id": campaign_id})
    await db.commit()
    return {"status": "ok", "remediation_plan_id": remediation_plan_id}


# ─── Remediation Plans — status computed from actions, never set directly ──────
async def _recompute_remediation_status(db: AsyncSession, plan_id: str):
    plan_row = await db.execute(text("SELECT * FROM remediation_plans WHERE id = CAST(:id AS UUID)"), {"id": plan_id})
    plan = _row(dict(plan_row.fetchone()._mapping))
    actions_r = await db.execute(text("SELECT * FROM remediation_actions WHERE remediation_plan_id = CAST(:id AS UUID)"), {"id": plan_id})
    actions = [_row(dict(r._mapping)) for r in actions_r.fetchall()]

    if actions and all(a["status"] == "closed" for a in actions):
        status = "closed"
    elif actions and all(a.get("owner_email") for a in actions):
        status = "in_progress"
    elif plan.get("owner_email"):
        status = "open"
    else:
        status = "new"

    await db.execute(text("UPDATE remediation_plans SET status = :status, updated_at = NOW() WHERE id = CAST(:id AS UUID)"), {"id": plan_id, "status": status})


async def _remediation_task(db: AsyncSession, title: str, url_path: str, entity_type: str, entity_id: str,
                             owner_email: str, owner_name: str, created_by_email: str):
    if not owner_email:
        return
    from app.routers.task_manager import create_task
    created = await create_task({
        "title": title, "description": "You've been assigned a remediation follow-up from a test campaign.",
        "owner_email": owner_email, "owner_name": owner_name,
        "source": "testing_remediation", "entity_type": entity_type, "entity_id": entity_id,
        "created_by_email": created_by_email or owner_email, "acting_email": created_by_email or owner_email,
    }, db)
    await _link_task(db, created["id"], title, f"{FRONTEND_URL}{url_path}", created_by_email or owner_email)


@router.get("/remediation-plans")
async def list_remediation_plans(status: str = None, db: AsyncSession = Depends(get_db)):
    where = ["1=1"]
    params = {}
    if status:
        where.append("rp.status = :status")
        params["status"] = status
    r = await db.execute(text(f"""
        SELECT rp.*, c.title AS campaign_title, c.campaign_number,
               (SELECT COUNT(*) FROM remediation_actions ra WHERE ra.remediation_plan_id = rp.id) AS actions_total,
               (SELECT COUNT(*) FROM remediation_actions ra WHERE ra.remediation_plan_id = rp.id AND ra.status = 'closed') AS actions_closed
        FROM remediation_plans rp
        JOIN test_campaigns c ON c.id = rp.campaign_id
        WHERE {' AND '.join(where)}
        ORDER BY rp.created_at DESC
    """), params)
    return {"plans": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.get("/remediation-plans/{plan_id}")
async def get_remediation_plan(plan_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT rp.*, c.title AS campaign_title, c.campaign_number FROM remediation_plans rp
        JOIN test_campaigns c ON c.id = rp.campaign_id WHERE rp.id = CAST(:id AS UUID)
    """), {"id": plan_id})
    row = r.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Remediation plan not found")
    plan = _row(dict(row._mapping))
    actions = await db.execute(text("SELECT * FROM remediation_actions WHERE remediation_plan_id = CAST(:id AS UUID) ORDER BY created_at"), {"id": plan_id})
    plan["actions"] = [_row(dict(r._mapping)) for r in actions.fetchall()]
    return plan


@router.put("/remediation-plans/{plan_id}")
async def update_remediation_plan(plan_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM remediation_plans WHERE id = CAST(:id AS UUID)"), {"id": plan_id})
    row = r.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Remediation plan not found")
    plan = _row(dict(row._mapping))

    new_owner = data.get("owner_email", plan.get("owner_email") or "")
    if new_owner and new_owner != (plan.get("owner_email") or ""):
        await _remediation_task(db, f"Remediation plan owner: {plan['plan_number']}", f"/testing/remediation-plans/{plan_id}",
                                 "remediation_plan", plan_id, new_owner, data.get("owner_name", ""), data.get("acting_email", ""))

    await db.execute(text("""
        UPDATE remediation_plans SET owner_email = :owner_email, owner_name = COALESCE(:owner_name, owner_name), updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {"id": plan_id, "owner_email": new_owner, "owner_name": data.get("owner_name")})
    await _recompute_remediation_status(db, plan_id)
    await db.commit()
    return {"status": "ok"}


@router.put("/remediation-actions/{action_id}")
async def update_remediation_action(action_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM remediation_actions WHERE id = CAST(:id AS UUID)"), {"id": action_id})
    row = r.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Remediation action not found")
    action = _row(dict(row._mapping))

    new_status = data.get("status", action.get("status") or "new")
    if new_status not in REMEDIATION_ACTION_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(REMEDIATION_ACTION_STATUSES)}")
    new_owner = data.get("owner_email", action.get("owner_email") or "")
    if new_owner and new_owner != (action.get("owner_email") or ""):
        await _remediation_task(db, f"Remediation: {action['title']}", f"/testing/remediation-plans/{action['remediation_plan_id']}",
                                 "remediation_action", action_id, new_owner, data.get("owner_name", ""), data.get("acting_email", ""))

    await db.execute(text("""
        UPDATE remediation_actions SET
            owner_email = :owner_email, owner_name = COALESCE(:owner_name, owner_name),
            status = :status, comment = COALESCE(:comment, comment),
            description = COALESCE(:description, description), updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {"id": action_id, "owner_email": new_owner, "owner_name": data.get("owner_name"),
           "status": new_status, "comment": data.get("comment"), "description": data.get("description")})
    await _recompute_remediation_status(db, action["remediation_plan_id"])
    await db.commit()
    return {"status": "ok"}
