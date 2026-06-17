# app/routers/clients.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def list_clients():
    return {"clients": [], "message": "Module clients - en cours de développement"}
