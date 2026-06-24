from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.database import get_db
import boto3
import os
import httpx
import asyncio
from datetime import datetime, timedelta

router = APIRouter()

AWS_REGION   = os.getenv("AWS_REGION", "eu-west-1")
ECS_CLUSTER  = os.getenv("ECS_CLUSTER", "whubbi-cluster-dev")
ECS_SERVICE  = os.getenv("ECS_SERVICE", "whubbi-backend-service")
RDS_INSTANCE = os.getenv("RDS_INSTANCE", "whubbi-postgres-dev")
AMPLIFY_APP  = os.getenv("AMPLIFY_APP_ID", "d1hr8uwjmgl4wq")
ALB_NAME     = os.getenv("ALB_NAME", "whubbi-alb-dev")
LOG_GROUP    = os.getenv("LOG_GROUP", "/ecs/whubbi-backend")

DEFAULT_URLS = [
    {"name": "WHUBBI Frontend",  "url": "https://dev.whubbi.wcomply.com"},
    {"name": "Wcomply Website",  "url": "https://wcomply.com"},
    {"name": "SharePoint",       "url": "https://wcomply.sharepoint.com"},
]

# ─── Service Health ───────────────────────────────────────────────────────────
@router.get("/health")
async def get_services_health():
    services = []

    # ECS
    try:
        ecs = boto3.client("ecs", region_name=AWS_REGION)
        resp = ecs.describe_services(cluster=ECS_CLUSTER, services=[ECS_SERVICE])
        svc = resp["services"][0]
        running = svc["runningCount"]
        desired = svc["desiredCount"]
        services.append({"name": "ECS Backend", "type": "ecs",
            "status": "healthy" if running == desired and running > 0 else "degraded" if running > 0 else "down",
            "details": f"{running}/{desired} tasks running", "taskDef": svc["taskDefinition"].split("/")[-1]})
    except Exception as e:
        services.append({"name": "ECS Backend", "type": "ecs", "status": "unknown", "details": str(e)})

    # RDS
    try:
        rds = boto3.client("rds", region_name=AWS_REGION)
        resp = rds.describe_db_instances(DBInstanceIdentifier=RDS_INSTANCE)
        db = resp["DBInstances"][0]
        status = db["DBInstanceStatus"]
        services.append({"name": "RDS PostgreSQL", "type": "rds",
            "status": "healthy" if status == "available" else "degraded",
            "details": f"{db['DBInstanceClass']} — {status}", "engine": f"PostgreSQL {db['EngineVersion']}"})
    except Exception as e:
        services.append({"name": "RDS PostgreSQL", "type": "rds", "status": "unknown", "details": str(e)})

    # Amplify
    try:
        amplify = boto3.client("amplify", region_name=AWS_REGION)
        resp = amplify.get_app(appId=AMPLIFY_APP)
        prod = resp["app"].get("productionBranch", {})
        status = prod.get("status", "unknown")
        services.append({"name": "Amplify Frontend", "type": "amplify",
            "status": "healthy" if status == "SUCCEED" else "degraded",
            "details": f"Branch: {prod.get('branchName','master')} — {status}",
            "lastDeploy": str(prod.get("lastDeployTime", ""))})
    except Exception as e:
        services.append({"name": "Amplify Frontend", "type": "amplify", "status": "unknown", "details": str(e)})

    # ALB
    try:
        elb = boto3.client("elbv2", region_name=AWS_REGION)
        resp = elb.describe_load_balancers()
        albs = [lb for lb in resp["LoadBalancers"] if ALB_NAME in lb["LoadBalancerName"]]
        if albs:
            alb = albs[0]
            services.append({"name": "Load Balancer", "type": "alb",
                "status": "healthy" if alb["State"]["Code"] == "active" else "degraded",
                "details": f"{alb['State']['Code']} — {alb['DNSName'][:40]}..."})
    except Exception as e:
        services.append({"name": "Load Balancer", "type": "alb", "status": "unknown", "details": str(e)})

    # Cognito
    try:
        cognito = boto3.client("cognito-idp", region_name=AWS_REGION)
        pools = cognito.list_user_pools(MaxResults=10)
        pool = next((p for p in pools["UserPools"] if "whubbi" in p["Name"].lower()), pools["UserPools"][0] if pools["UserPools"] else None)
        services.append({"name": "Cognito Auth", "type": "cognito", "status": "healthy",
            "details": f"User Pool: {pool['Name']}" if pool else "Active"})
    except Exception as e:
        services.append({"name": "Cognito Auth", "type": "cognito", "status": "unknown", "details": str(e)})

    # ECR
    try:
        ecr = boto3.client("ecr", region_name=AWS_REGION)
        repos = ecr.describe_repositories()
        whubbi = [r for r in repos["repositories"] if "whubbi" in r["repositoryName"]]
        if whubbi:
            images = ecr.list_images(repositoryName=whubbi[0]["repositoryName"])
            services.append({"name": "ECR Registry", "type": "ecr", "status": "healthy",
                "details": f"{len(images['imageIds'])} images — {whubbi[0]['repositoryName']}"})
    except Exception as e:
        services.append({"name": "ECR Registry", "type": "ecr", "status": "unknown", "details": str(e)})

    # CloudWatch
    try:
        logs = boto3.client("logs", region_name=AWS_REGION)
        groups = logs.describe_log_groups(logGroupNamePrefix="/ecs/whubbi")
        services.append({"name": "CloudWatch Logs", "type": "cloudwatch", "status": "healthy",
            "details": f"{len(groups['logGroups'])} log groups active"})
    except Exception as e:
        services.append({"name": "CloudWatch Logs", "type": "cloudwatch", "status": "unknown", "details": str(e)})

    healthy = sum(1 for s in services if s["status"] == "healthy")
    return {"services": services, "summary": {"total": len(services), "healthy": healthy, "degraded": len(services) - healthy}, "timestamp": datetime.utcnow().isoformat()}


# ─── Cost Tracking ────────────────────────────────────────────────────────────
@router.get("/costs")
async def get_costs():
    end = datetime.utcnow().date()
    month_start = datetime.utcnow().replace(day=1).date()
    start_30 = (datetime.utcnow() - timedelta(days=30)).date()
    services_map = {
        "Amazon EC2": "ECS / EC2", "Amazon Elastic Container Service": "ECS",
        "Amazon Relational Database Service": "RDS PostgreSQL", "AWS Amplify": "Amplify Frontend",
        "Amazon CloudWatch": "CloudWatch", "Amazon Elastic Container Registry": "ECR",
        "Amazon Cognito": "Cognito",
    }
    try:
        ce = boto3.client("ce", region_name="us-east-1")
        current = ce.get_cost_and_usage(
            TimePeriod={"Start": str(month_start), "End": str(end)},
            Granularity="MONTHLY", Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}]
        )
        daily = ce.get_cost_and_usage(
            TimePeriod={"Start": str(start_30), "End": str(end)},
            Granularity="DAILY", Metrics=["UnblendedCost"]
        )
        by_service = []
        total_month = 0
        for group in (current["ResultsByTime"][0]["Groups"] if current["ResultsByTime"] else []):
            cost = float(group["Metrics"]["UnblendedCost"]["Amount"])
            if cost > 0.01:
                mapped = services_map.get(group["Keys"][0], group["Keys"][0])
                by_service.append({"service": mapped, "cost": round(cost, 2), "currency": "USD"})
                total_month += cost
        by_service.sort(key=lambda x: x["cost"], reverse=True)
        daily_costs = [{"date": r["TimePeriod"]["Start"], "cost": round(float(r["Total"]["UnblendedCost"]["Amount"]), 2)} for r in daily["ResultsByTime"]]
        days_elapsed = (end - month_start).days + 1
        return {"current_month": round(total_month, 2), "estimated_month": round(total_month / days_elapsed * 30, 2),
                "currency": "USD", "by_service": by_service, "daily": daily_costs,
                "period": {"start": str(month_start), "end": str(end)}}
    except Exception as e:
        return {"current_month": 0, "estimated_month": 0, "currency": "USD", "by_service": [], "daily": [], "error": str(e)}


# ─── URL Monitoring ───────────────────────────────────────────────────────────
async def check_url(url: str, name: str, url_id: str) -> dict:
    start = datetime.utcnow()
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "WHUBBI-Monitor/1.0"})
            elapsed = (datetime.utcnow() - start).total_seconds() * 1000
            status = "up" if resp.status_code < 400 else "down"
            if status == "up" and elapsed > 3000:
                status = "slow"
            return {"url_id": url_id, "url": url, "name": name, "status": status,
                    "status_code": resp.status_code, "response_time": round(elapsed, 0), "error": None,
                    "checked_at": datetime.utcnow().isoformat()}
    except Exception as e:
        elapsed = (datetime.utcnow() - start).total_seconds() * 1000
        return {"url_id": url_id, "url": url, "name": name, "status": "down",
                "status_code": None, "response_time": round(elapsed, 0), "error": str(e)[:200],
                "checked_at": datetime.utcnow().isoformat()}


@router.post("/urls/check")
async def run_checks(db: AsyncSession = Depends(get_db)):
    """Run health checks on all monitored URLs and store results."""
    try:
        result = await db.execute(text("SELECT id, name, url FROM monitored_urls WHERE active = true"))
        urls = result.fetchall()
    except Exception:
        urls = []

    if not urls:
        # Use defaults if table empty
        checks = await asyncio.gather(*[check_url(u["url"], u["name"], "default") for u in DEFAULT_URLS])
        return {"checks": checks, "source": "defaults"}

    checks = await asyncio.gather(*[check_url(str(row.url), str(row.name), str(row.id)) for row in urls])

    # Store results
    for check in checks:
        try:
            await db.execute(text("""
                INSERT INTO health_checks (id, url_id, url, name, status, status_code, response_time, error, checked_at)
                VALUES (gen_random_uuid(), :url_id::uuid, :url, :name, :status, :status_code, :response_time, :error, NOW())
            """), {**check, "url_id": check["url_id"] if check["url_id"] != "default" else None})
        except Exception:
            pass
    try:
        await db.commit()
    except Exception:
        pass

    return {"checks": checks, "stored": len(checks)}


@router.get("/urls")
async def get_monitored_urls(db: AsyncSession = Depends(get_db)):
    """Get all monitored URLs with their latest check result."""
    try:
        result = await db.execute(text("SELECT id, name, url, active, created_at FROM monitored_urls ORDER BY created_at"))
        urls = result.fetchall()
        if not urls:
            # Run live checks on defaults
            checks = await asyncio.gather(*[check_url(u["url"], u["name"], "default") for u in DEFAULT_URLS])
            return {"urls": checks, "source": "live"}

        url_list = []
        for row in urls:
            latest = await db.execute(text("""
                SELECT status, status_code, response_time, error, checked_at
                FROM health_checks WHERE url_id = :id
                ORDER BY checked_at DESC LIMIT 1
            """), {"id": str(row.id)})
            last = latest.fetchone()
            url_list.append({
                "id": str(row.id), "name": row.name, "url": row.url, "active": row.active,
                "status": last.status if last else "unknown",
                "status_code": last.status_code if last else None,
                "response_time": last.response_time if last else None,
                "last_checked": last.checked_at.isoformat() if last else None,
            })
        return {"urls": url_list, "source": "db"}
    except Exception as e:
        checks = await asyncio.gather(*[check_url(u["url"], u["name"], "default") for u in DEFAULT_URLS])
        return {"urls": checks, "source": "live", "error": str(e)}


@router.post("/urls")
async def add_url(data: dict, db: AsyncSession = Depends(get_db)):
    """Add a new URL to monitor."""
    try:
        await db.execute(text("""
            INSERT INTO monitored_urls (id, name, url, active, created_at)
            VALUES (gen_random_uuid(), :name, :url, true, NOW())
        """), {"name": data.get("name"), "url": data.get("url")})
        await db.commit()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@router.delete("/urls/{url_id}")
async def delete_url(url_id: str, db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("DELETE FROM monitored_urls WHERE id = :id"), {"id": url_id})
        await db.commit()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


# ─── Error Logs ───────────────────────────────────────────────────────────────
@router.get("/logs")
async def get_error_logs(limit: int = 50, db: AsyncSession = Depends(get_db)):
    logs = []
    try:
        cw = boto3.client("logs", region_name=AWS_REGION)
        streams = cw.describe_log_streams(logGroupName=LOG_GROUP, orderBy="LastEventTime", descending=True, limit=3)
        for stream in streams["logStreams"][:2]:
            events = cw.get_log_events(logGroupName=LOG_GROUP, logStreamName=stream["logStreamName"], limit=20, startFromHead=False)
            for event in events["events"]:
                msg = event["message"]
                if any(kw in msg.upper() for kw in ["ERROR", "WARNING", "EXCEPTION", "TRACEBACK"]):
                    logs.append({"source": "CloudWatch", "timestamp": datetime.utcfromtimestamp(event["timestamp"]/1000).isoformat(),
                        "level": "ERROR" if "ERROR" in msg.upper() else "WARNING", "message": msg[:200],
                        "user": "system", "page": "backend", "service": "ECS Backend"})
    except Exception as e:
        logs.append({"source": "CloudWatch", "timestamp": datetime.utcnow().isoformat(), "level": "INFO",
            "message": f"CloudWatch unavailable: {e}", "user": "system", "page": "admin", "service": "CloudWatch"})
    try:
        result = await db.execute(text("SELECT * FROM error_logs ORDER BY created_at DESC LIMIT :limit"), {"limit": limit})
        for row in result.fetchall():
            logs.append({"source": "Application", "timestamp": row.created_at.isoformat(),
                "level": row.level, "message": row.message, "user": row.user_email, "page": row.page, "service": "Application"})
    except Exception:
        pass
    logs.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"logs": logs[:limit], "total": len(logs)}


@router.post("/logs")
async def create_error_log(data: dict, db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("""
            INSERT INTO error_logs (user_email, page, level, message, created_at)
            VALUES (:user_email, :page, :level, :message, NOW())
        """), {"user_email": data.get("user_email", "unknown"), "page": data.get("page", ""),
               "level": data.get("level", "ERROR"), "message": data.get("message", "")})
        await db.commit()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
