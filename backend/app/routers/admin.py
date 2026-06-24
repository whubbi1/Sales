# backend/app/routers/admin.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.database import get_db
import boto3
import os
from datetime import datetime, timedelta
from typing import Optional
import json

router = APIRouter()

AWS_REGION = os.getenv("AWS_REGION", "eu-west-1")
ECS_CLUSTER = os.getenv("ECS_CLUSTER", "whubbi-cluster-dev")
ECS_SERVICE = os.getenv("ECS_SERVICE", "whubbi-backend-service")
RDS_INSTANCE = os.getenv("RDS_INSTANCE", "whubbi-postgres-dev")
AMPLIFY_APP_ID = os.getenv("AMPLIFY_APP_ID", "d1hr8uwjmgl4wq")
ALB_NAME = os.getenv("ALB_NAME", "whubbi-alb-dev")
LOG_GROUP = os.getenv("LOG_GROUP", "/ecs/whubbi-backend")

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
        services.append({
            "name": "ECS Backend",
            "type": "ecs",
            "status": "healthy" if running == desired and running > 0 else "degraded" if running > 0 else "down",
            "details": f"{running}/{desired} tasks running",
            "taskDef": svc["taskDefinition"].split("/")[-1],
        })
    except Exception as e:
        services.append({"name": "ECS Backend", "type": "ecs", "status": "unknown", "details": str(e)})

    # RDS
    try:
        rds = boto3.client("rds", region_name=AWS_REGION)
        resp = rds.describe_db_instances(DBInstanceIdentifier=RDS_INSTANCE)
        db = resp["DBInstances"][0]
        status = db["DBInstanceStatus"]
        services.append({
            "name": "RDS PostgreSQL",
            "type": "rds",
            "status": "healthy" if status == "available" else "degraded",
            "details": f"{db['DBInstanceClass']} — {status}",
            "engine": f"PostgreSQL {db['EngineVersion']}",
        })
    except Exception as e:
        services.append({"name": "RDS PostgreSQL", "type": "rds", "status": "unknown", "details": str(e)})

    # Amplify
    try:
        amplify = boto3.client("amplify", region_name=AWS_REGION)
        resp = amplify.get_app(appId=AMPLIFY_APP_ID)
        app = resp["app"]
        prod = app.get("productionBranch", {})
        status = prod.get("status", "unknown")
        services.append({
            "name": "Amplify Frontend",
            "type": "amplify",
            "status": "healthy" if status == "SUCCEED" else "degraded",
            "details": f"Branch: {prod.get('branchName', 'master')} — {status}",
            "lastDeploy": prod.get("lastDeployTime", ""),
        })
    except Exception as e:
        services.append({"name": "Amplify Frontend", "type": "amplify", "status": "unknown", "details": str(e)})

    # ALB
    try:
        elb = boto3.client("elbv2", region_name=AWS_REGION)
        resp = elb.describe_load_balancers()
        albs = [lb for lb in resp["LoadBalancers"] if ALB_NAME in lb["LoadBalancerName"]]
        if albs:
            alb = albs[0]
            services.append({
                "name": "Load Balancer",
                "type": "alb",
                "status": "healthy" if alb["State"]["Code"] == "active" else "degraded",
                "details": f"{alb['State']['Code']} — {alb['DNSName'][:40]}...",
            })
    except Exception as e:
        services.append({"name": "Load Balancer", "type": "alb", "status": "unknown", "details": str(e)})

    # Cognito
    try:
        cognito = boto3.client("cognito-idp", region_name=AWS_REGION)
        pools = cognito.list_user_pools(MaxResults=10)
        whubbi_pools = [p for p in pools["UserPools"] if "whubbi" in p["Name"].lower() or "Bz7GN3iOP" in p.get("Id", "")]
        if whubbi_pools:
            pool = whubbi_pools[0]
            services.append({
                "name": "Cognito Auth",
                "type": "cognito",
                "status": "healthy",
                "details": f"User Pool: {pool['Name']}",
            })
        else:
            services.append({"name": "Cognito Auth", "type": "cognito", "status": "healthy", "details": "User pool active"})
    except Exception as e:
        services.append({"name": "Cognito Auth", "type": "cognito", "status": "unknown", "details": str(e)})

    # ECR
    try:
        ecr = boto3.client("ecr", region_name=AWS_REGION)
        repos = ecr.describe_repositories()
        whubbi_repos = [r for r in repos["repositories"] if "whubbi" in r["repositoryName"]]
        if whubbi_repos:
            repo = whubbi_repos[0]
            images = ecr.list_images(repositoryName=repo["repositoryName"])
            services.append({
                "name": "ECR Registry",
                "type": "ecr",
                "status": "healthy",
                "details": f"{len(images['imageIds'])} images — {repo['repositoryName']}",
            })
    except Exception as e:
        services.append({"name": "ECR Registry", "type": "ecr", "status": "unknown", "details": str(e)})

    # CloudWatch
    try:
        logs = boto3.client("logs", region_name=AWS_REGION)
        groups = logs.describe_log_groups(logGroupNamePrefix="/ecs/whubbi")
        services.append({
            "name": "CloudWatch Logs",
            "type": "cloudwatch",
            "status": "healthy",
            "details": f"{len(groups['logGroups'])} log groups active",
        })
    except Exception as e:
        services.append({"name": "CloudWatch Logs", "type": "cloudwatch", "status": "unknown", "details": str(e)})

    healthy = sum(1 for s in services if s["status"] == "healthy")
    return {
        "services": services,
        "summary": {"total": len(services), "healthy": healthy, "degraded": len(services) - healthy},
        "timestamp": datetime.utcnow().isoformat()
    }


# ─── Cost Tracking ────────────────────────────────────────────────────────────
@router.get("/costs")
async def get_costs():
    end = datetime.utcnow().date()
    start = (datetime.utcnow() - timedelta(days=30)).date()
    month_start = datetime.utcnow().replace(day=1).date()

    services_map = {
        "Amazon EC2": "ECS / EC2",
        "Amazon Elastic Container Service": "ECS",
        "Amazon Relational Database Service": "RDS PostgreSQL",
        "AWS Amplify": "Amplify Frontend",
        "Amazon CloudWatch": "CloudWatch",
        "Amazon Elastic Container Registry": "ECR",
        "Amazon Cognito": "Cognito",
        "AWS Secrets Manager": "Secrets Manager",
        "Amazon EC2 Container Registry": "ECR",
    }

    try:
        ce = boto3.client("ce", region_name="us-east-1")

        # Current month
        current = ce.get_cost_and_usage(
            TimePeriod={"Start": str(month_start), "End": str(end)},
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}]
        )

        # Last 30 days daily
        daily = ce.get_cost_and_usage(
            TimePeriod={"Start": str(start), "End": str(end)},
            Granularity="DAILY",
            Metrics=["UnblendedCost"]
        )

        by_service = []
        total_month = 0
        for group in current["ResultsByTime"][0]["Groups"] if current["ResultsByTime"] else []:
            svc_name = group["Keys"][0]
            cost = float(group["Metrics"]["UnblendedCost"]["Amount"])
            if cost > 0.01:
                mapped = services_map.get(svc_name, svc_name)
                by_service.append({"service": mapped, "cost": round(cost, 2), "currency": "USD"})
                total_month += cost

        by_service.sort(key=lambda x: x["cost"], reverse=True)

        daily_costs = []
        for result in daily["ResultsByTime"]:
            daily_costs.append({
                "date": result["TimePeriod"]["Start"],
                "cost": round(float(result["Total"]["UnblendedCost"]["Amount"]), 2)
            })

        # Monthly estimate
        days_elapsed = (end - month_start).days + 1
        days_in_month = 30
        estimated_month = (total_month / days_elapsed * days_in_month) if days_elapsed > 0 else 0

        return {
            "current_month": round(total_month, 2),
            "estimated_month": round(estimated_month, 2),
            "currency": "USD",
            "by_service": by_service,
            "daily": daily_costs,
            "period": {"start": str(month_start), "end": str(end)}
        }
    except Exception as e:
        return {
            "current_month": 0,
            "estimated_month": 0,
            "currency": "USD",
            "by_service": [],
            "daily": [],
            "error": str(e)
        }


# ─── Error Logs ───────────────────────────────────────────────────────────────
@router.get("/logs")
async def get_error_logs(limit: int = 50, db: AsyncSession = Depends(get_db)):
    logs = []

    # CloudWatch logs
    try:
        cw = boto3.client("logs", region_name=AWS_REGION)
        streams = cw.describe_log_streams(
            logGroupName=LOG_GROUP,
            orderBy="LastEventTime",
            descending=True,
            limit=3
        )
        for stream in streams["logStreams"][:2]:
            events = cw.get_log_events(
                logGroupName=LOG_GROUP,
                logStreamName=stream["logStreamName"],
                limit=20,
                startFromHead=False
            )
            for event in events["events"]:
                msg = event["message"]
                if any(kw in msg.upper() for kw in ["ERROR", "WARNING", "EXCEPTION", "TRACEBACK"]):
                    logs.append({
                        "source": "CloudWatch",
                        "timestamp": datetime.utcfromtimestamp(event["timestamp"]/1000).isoformat(),
                        "level": "ERROR" if "ERROR" in msg.upper() or "EXCEPTION" in msg.upper() else "WARNING",
                        "message": msg[:200],
                        "user": "system",
                        "page": "backend",
                        "service": "ECS Backend"
                    })
    except Exception as e:
        logs.append({"source": "CloudWatch", "timestamp": datetime.utcnow().isoformat(), "level": "INFO", "message": f"Could not fetch CloudWatch logs: {e}", "user": "system", "page": "admin", "service": "CloudWatch"})

    # DB error logs
    try:
        result = await db.execute(text("""
            SELECT * FROM error_logs 
            ORDER BY created_at DESC 
            LIMIT :limit
        """), {"limit": limit})
        rows = result.fetchall()
        for row in rows:
            logs.append({
                "source": "Application",
                "timestamp": row.created_at.isoformat() if hasattr(row, 'created_at') else "",
                "level": row.level if hasattr(row, 'level') else "ERROR",
                "message": row.message if hasattr(row, 'message') else "",
                "user": row.user_email if hasattr(row, 'user_email') else "unknown",
                "page": row.page if hasattr(row, 'page') else "",
                "service": "Application"
            })
    except Exception:
        pass  # Table may not exist yet

    logs.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"logs": logs[:limit], "total": len(logs)}


# ─── Log error endpoint (called by frontend) ─────────────────────────────────
@router.post("/logs")
async def create_error_log(data: dict, db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("""
            INSERT INTO error_logs (user_email, page, level, message, created_at)
            VALUES (:user_email, :page, :level, :message, NOW())
        """), {
            "user_email": data.get("user_email", "unknown"),
            "page": data.get("page", ""),
            "level": data.get("level", "ERROR"),
            "message": data.get("message", ""),
        })
        await db.commit()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
