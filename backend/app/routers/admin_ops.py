# backend/app/routers/admin_ops.py
# Backup + Background Jobs + License Management
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import boto3, os, uuid
from datetime import datetime, timedelta

router = APIRouter()

AWS_REGION  = os.getenv("AWS_REGION", "eu-west-1")
BACKUP_BUCKET = os.getenv("BACKUP_BUCKET", "whubbi-backups-dev")
ACCOUNT_ID  = "351007427901"

APPLICATIONS = [
    {"name": "WHUBBI",         "slug": "whubbi",         "type": "database+code", "auto": True,  "icon": "🚀"},
    {"name": "Microsoft 365",  "slug": "microsoft-365",  "type": "cloud",        "auto": False, "icon": "🏢"},
    {"name": "Payfit",         "slug": "payfit",         "type": "cloud",        "auto": False, "icon": "💰"},
    {"name": "HubSpot",        "slug": "hubspot",        "type": "cloud",        "auto": False, "icon": "🔶"},
    {"name": "Karanext",       "slug": "karanext",       "type": "cloud",        "auto": False, "icon": "📊"},
]

SLUG_TO_APP = {a["slug"]: a for a in APPLICATIONS}

async def seed_jobs(db: AsyncSession):
    c = await db.execute(text("SELECT COUNT(*) FROM background_jobs"))
    if c.scalar() == 0:
        jobs = [
            {"job_id": "JOB-001", "name": "WHUBBI DB Backup", "description": "Daily PostgreSQL RDS export to S3",
             "job_type": "ecs_scheduled", "schedule": "0 2 * * *",
             "script_url": "https://github.com/whubbi1/Sales/blob/master/scripts/backup_db.sh",
             "script_content": "#!/bin/bash\n# WHUBBI Database Backup\npg_dump $DATABASE_URL | gzip | aws s3 cp - s3://whubbi-backups-dev/db/whubbi_$(date +%Y%m%d_%H%M%S).sql.gz",
             "status": "active"},
            {"job_id": "JOB-002", "name": "URL Health Monitor", "description": "Hourly check of monitored URLs",
             "job_type": "ecs_scheduled", "schedule": "0 * * * *",
             "script_url": "", "script_content": "# Triggered via /admin/urls/check endpoint",
             "status": "active"},
            {"job_id": "JOB-003", "name": "Teams Webhook Renewal", "description": "Renew Teams webhook subscriptions before expiry",
             "job_type": "lambda", "schedule": "0 */12 * * *",
             "script_url": "", "script_content": "# Renew Teams Graph API subscriptions",
             "status": "active"},
            {"job_id": "JOB-004", "name": "ECR Image Cleanup", "description": "Remove old Docker images from ECR",
             "job_type": "lambda", "schedule": "0 3 * * 0",
             "script_url": "", "script_content": "# Keep last 10 images per repo",
             "status": "stopped"},
        ]
        for job in jobs:
            await db.execute(text("""
                INSERT INTO background_jobs (id,job_id,name,description,job_type,schedule,script_url,script_content,status,created_at,updated_at)
                VALUES (gen_random_uuid(),:job_id,:name,:description,:job_type,:schedule,:script_url,:script_content,:status,NOW(),NOW())
            """), job)
        await db.commit()

    # Seed backup records
    c2 = await db.execute(text("SELECT COUNT(*) FROM backup_records"))
    if c2.scalar() == 0:
        for app in APPLICATIONS:
            await db.execute(text("""
                INSERT INTO backup_records (id,application,backup_type,status,notes,created_at)
                VALUES (gen_random_uuid(),:app,'full','unknown','No backup recorded yet',NOW())
            """), {"app": app["name"]})
        await db.commit()

    # Rename old "Microsoft Office" records to "Microsoft 365"
    await db.execute(text("""
        UPDATE backup_records SET application = 'Microsoft 365'
        WHERE application = 'Microsoft Office'
    """))
    await db.commit()
    await db.execute(text("""
        UPDATE backup_app_config SET application = 'Microsoft 365'
        WHERE application = 'Microsoft Office'
    """))
    await db.commit()


# ─── Backup ───────────────────────────────────────────────────────────────────
@router.get("/backup/overview")
async def get_backup_overview(db: AsyncSession = Depends(get_db)):
    await seed_jobs(db)

    # Get latest backup per application
    result = await db.execute(text("""
        SELECT DISTINCT ON (application)
            application, backup_type, status, backup_date, size_mb, location, notes, created_at
        FROM backup_records
        ORDER BY application, created_at DESC
    """))
    records = [dict(r._mapping) for r in result.fetchall()]

    # Get WHUBBI RDS automated snapshots
    whubbi_rds = {"auto_snapshots": [], "latest_snapshot": None}
    try:
        rds = boto3.client("rds", region_name=AWS_REGION)
        snaps = rds.describe_db_snapshots(
            DBInstanceIdentifier="whubbi-postgres-dev",
            SnapshotType="automated"
        )
        snapshots = sorted(snaps["DBSnapshots"], key=lambda x: x["SnapshotCreateTime"], reverse=True)
        whubbi_rds["auto_snapshots"] = [{
            "id": s["DBSnapshotIdentifier"],
            "created": s["SnapshotCreateTime"].isoformat(),
            "status": s["Status"],
            "size_gb": s.get("AllocatedStorage", 0)
        } for s in snapshots[:5]]
        if snapshots:
            whubbi_rds["latest_snapshot"] = snapshots[0]["SnapshotCreateTime"].isoformat()
    except Exception as e:
        whubbi_rds["error"] = str(e)

    # Get S3 backups
    s3_backups = []
    try:
        s3 = boto3.client("s3", region_name=AWS_REGION)
        objects = s3.list_objects_v2(Bucket=BACKUP_BUCKET, Prefix="db/", MaxKeys=10)
        for obj in objects.get("Contents", []):
            s3_backups.append({
                "key": obj["Key"],
                "size_mb": round(obj["Size"] / 1024 / 1024, 1),
                "last_modified": obj["LastModified"].isoformat()
            })
        s3_backups.sort(key=lambda x: x["last_modified"], reverse=True)
    except Exception as e:
        s3_backups = []

    return {
        "applications": APPLICATIONS,
        "records": records,
        "whubbi_rds": whubbi_rds,
        "s3_backups": s3_backups,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/backup/trigger")
async def trigger_backup(data: dict, db: AsyncSession = Depends(get_db)):
    """Trigger WHUBBI DB backup via ECS task."""
    try:
        ecs = boto3.client("ecs", region_name=AWS_REGION)
        # Run a one-off ECS task for backup
        response = ecs.run_task(
            cluster="whubbi-cluster-dev",
            taskDefinition="whubbi-backend",
            launchType="FARGATE",
            networkConfiguration={
                "awsvpcConfiguration": {
                    "subnets": ["subnet-0a1b2c3d"],
                    "securityGroups": [],
                    "assignPublicIp": "ENABLED"
                }
            },
            overrides={
                "containerOverrides": [{
                    "name": "whubbi-backend",
                    "command": ["python", "-m", "app.backup"]
                }]
            }
        )
        return {"status": "ok", "message": "Backup task triggered"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.put("/backup/record")
async def update_backup_record(data: dict, db: AsyncSession = Depends(get_db)):
    """Update backup status manually for external apps."""
    await db.execute(text("""
        INSERT INTO backup_records (id,application,backup_type,status,backup_date,size_mb,location,notes,created_by,created_at)
        VALUES (gen_random_uuid(),:application,:backup_type,:status,
                COALESCE(:backup_date::timestamp, NOW()),:size_mb,:location,:notes,:created_by,NOW())
    """), {
        "application": data.get("application"),
        "backup_type": data.get("backup_type", "full"),
        "status": data.get("status", "success"),
        "backup_date": data.get("backup_date"),
        "size_mb": data.get("size_mb"),
        "location": data.get("location", ""),
        "notes": data.get("notes", ""),
        "created_by": data.get("created_by", "admin"),
    })
    await db.commit()
    return {"status": "ok"}


# ─── Background Jobs ──────────────────────────────────────────────────────────
@router.get("/jobs")
async def list_jobs(db: AsyncSession = Depends(get_db)):
    await seed_jobs(db)
    result = await db.execute(text("SELECT * FROM background_jobs ORDER BY job_id"))
    jobs = [dict(r._mapping) for r in result.fetchall()]
    return {"jobs": jobs}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM background_jobs WHERE job_id = :jid"), {"jid": job_id})
    job = result.fetchone()
    if not job:
        return {"error": "Not found"}

    executions = await db.execute(text("""
        SELECT * FROM job_executions WHERE job_id = :jid
        ORDER BY started_at DESC LIMIT 20
    """), {"jid": job_id})

    return {
        "job": dict(job._mapping),
        "executions": [dict(e._mapping) for e in executions.fetchall()]
    }


@router.post("/jobs")
async def create_job(data: dict, db: AsyncSession = Depends(get_db)):
    # Auto-generate job_id
    count = await db.execute(text("SELECT COUNT(*) FROM background_jobs"))
    n = count.scalar() + 1
    job_id = f"JOB-{n:03d}"

    await db.execute(text("""
        INSERT INTO background_jobs (id,job_id,name,description,job_type,schedule,
            script_url,script_content,status,created_at,updated_at)
        VALUES (gen_random_uuid(),:job_id,:name,:description,:job_type,:schedule,
            :script_url,:script_content,:status,NOW(),NOW())
    """), {
        "job_id": job_id,
        "name": data.get("name"),
        "description": data.get("description", ""),
        "job_type": data.get("job_type", "lambda"),
        "schedule": data.get("schedule", ""),
        "script_url": data.get("script_url", ""),
        "script_content": data.get("script_content", ""),
        "status": data.get("status", "active"),
    })
    await db.commit()
    return {"status": "ok", "job_id": job_id}


@router.put("/jobs/{job_id}")
async def update_job(job_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE background_jobs SET
            status = COALESCE(:status, status),
            name = COALESCE(NULLIF(:name,''), name),
            description = COALESCE(NULLIF(:description,''), description),
            script_content = COALESCE(NULLIF(:script_content,''), script_content),
            updated_at = NOW()
        WHERE job_id = :jid
    """), {**{k: v or '' for k,v in data.items()}, "jid": job_id})
    await db.commit()
    return {"status": "ok"}


@router.get("/backup/app/{slug}")
async def get_backup_app_detail(slug: str, db: AsyncSession = Depends(get_db)):
    app = SLUG_TO_APP.get(slug)
    if not app:
        return {"error": "Not found"}

    # Get or create config row
    cfg = await db.execute(text("""
        SELECT backup_policy, tool_name, updated_at, updated_by
        FROM backup_app_config WHERE application = :app
    """), {"app": app["name"]})
    row = cfg.fetchone()
    config = dict(row._mapping) if row else {"backup_policy": None, "tool_name": None, "updated_at": None, "updated_by": None}

    # Get recent backup records
    records = await db.execute(text("""
        SELECT application, backup_type, status, backup_date, size_mb, location, notes, created_by, created_at
        FROM backup_records WHERE application = :app
        ORDER BY created_at DESC LIMIT 10
    """), {"app": app["name"]})
    history = [dict(r._mapping) for r in records.fetchall()]

    return {
        "app": app,
        "config": config,
        "history": history,
    }


@router.put("/backup/app/{slug}")
async def update_backup_app_detail(slug: str, data: dict, db: AsyncSession = Depends(get_db)):
    app = SLUG_TO_APP.get(slug)
    if not app:
        return {"error": "Not found"}

    # Upsert config
    existing = await db.execute(text(
        "SELECT id FROM backup_app_config WHERE application = :app"
    ), {"app": app["name"]})
    row = existing.fetchone()

    if row:
        await db.execute(text("""
            UPDATE backup_app_config SET
                backup_policy = COALESCE(:backup_policy, backup_policy),
                tool_name = COALESCE(:tool_name, tool_name),
                updated_at = NOW(),
                updated_by = COALESCE(:updated_by, updated_by)
            WHERE application = :app
        """), {
            "app": app["name"],
            "backup_policy": data.get("backup_policy"),
            "tool_name": data.get("tool_name"),
            "updated_by": data.get("updated_by"),
        })
    else:
        await db.execute(text("""
            INSERT INTO backup_app_config (id, application, backup_policy, tool_name, updated_at, updated_by)
            VALUES (gen_random_uuid(), :app, :backup_policy, :tool_name, NOW(), :updated_by)
        """), {
            "app": app["name"],
            "backup_policy": data.get("backup_policy"),
            "tool_name": data.get("tool_name"),
            "updated_by": data.get("updated_by"),
        })

    await db.commit()
    return {"status": "ok"}


@router.post("/jobs/{job_id}/executions")
async def log_execution(job_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    """Log a job execution result."""
    await db.execute(text("""
        INSERT INTO job_executions (id,job_id,status,started_at,ended_at,duration_ms,output,error,triggered_by)
        VALUES (gen_random_uuid(),:job_id,:status,
            COALESCE(:started_at::timestamp, NOW()),
            COALESCE(:ended_at::timestamp, NOW()),
            :duration_ms,:output,:error,:triggered_by)
    """), {
        "job_id": job_id,
        "status": data.get("status", "success"),
        "started_at": data.get("started_at"),
        "ended_at": data.get("ended_at"),
        "duration_ms": data.get("duration_ms"),
        "output": data.get("output", ""),
        "error": data.get("error", ""),
        "triggered_by": data.get("triggered_by", "schedule"),
    })
    # Update last run on parent job
    await db.execute(text("""
        UPDATE background_jobs SET
            last_run_at = NOW(), last_run_status = :status, updated_at = NOW()
        WHERE job_id = :jid
    """), {"status": data.get("status"), "jid": job_id})
    await db.commit()
    return {"status": "ok"}
