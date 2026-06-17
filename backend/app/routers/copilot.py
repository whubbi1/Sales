# app/routers/copilot.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/status")
async def copilot_status():
    return {"status": "copilot service running"}
