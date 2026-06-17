# app/routers/outlook.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/status")
async def outlook_status():
    return {"status": "outlook service running"}
