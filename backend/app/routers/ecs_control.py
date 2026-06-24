# backend/app/routers/ecs_control.py
from fastapi import APIRouter
import boto3
import os

router = APIRouter()

AWS_REGION  = os.getenv("AWS_REGION", "eu-west-1")
ECS_CLUSTER = "whubbi-cluster-dev"
ECS_SERVICE = "whubbi-backend-service"

@router.post("/restart")
async def restart_service():
    """Force a new deployment — replaces running containers."""
    try:
        ecs = boto3.client("ecs", region_name=AWS_REGION)
        ecs.update_service(
            cluster=ECS_CLUSTER,
            service=ECS_SERVICE,
            forceNewDeployment=True
        )
        return {"status": "ok", "action": "restart", "message": "New deployment triggered — containers will be replaced in ~2 minutes."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/stop")
async def stop_service():
    """Set desiredCount to 0 — stops all containers."""
    try:
        ecs = boto3.client("ecs", region_name=AWS_REGION)
        ecs.update_service(
            cluster=ECS_CLUSTER,
            service=ECS_SERVICE,
            desiredCount=0
        )
        return {"status": "ok", "action": "stop", "message": "Service stopped — all containers will shut down in ~30 seconds."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/start")
async def start_service():
    """Set desiredCount to 1 — starts the service."""
    try:
        ecs = boto3.client("ecs", region_name=AWS_REGION)
        ecs.update_service(
            cluster=ECS_CLUSTER,
            service=ECS_SERVICE,
            desiredCount=1
        )
        return {"status": "ok", "action": "start", "message": "Service starting — containers will be ready in ~2 minutes."}
    except Exception as e:
        return {"status": "error", "message": str(e)}
