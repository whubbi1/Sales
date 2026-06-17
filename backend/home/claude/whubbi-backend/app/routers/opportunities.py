# app/routers/opportunities.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def list_opportunities():
    return {"opportunities": [], "message": "Module opportunites - en cours de développement"}
