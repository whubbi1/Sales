# backend/app/main.py
# Application FastAPI principale — Wcomply

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from app.database import engine, Base
from app.routers import auth, clients, opportunities, outlook, copilot

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Démarrage : créer les tables si elles n'existent pas
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Arrêt propre
    await engine.dispose()

app = FastAPI(
    title="Wcomply API",
    description="API de gestion commerciale — connectée à Outlook & Microsoft Copilot",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if os.getenv("ENVIRONMENT") != "prod" else None,
)

# ─── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://wcomply.com",
        "https://www.wcomply.com",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routes ──────────────────────────────────────────────────────────────────
app.include_router(auth.router,          prefix="/auth",          tags=["Authentification"])
app.include_router(clients.router,       prefix="/clients",       tags=["Clients"])
app.include_router(opportunities.router, prefix="/opportunities",  tags=["Opportunités"])
app.include_router(outlook.router,       prefix="/outlook",       tags=["Outlook"])
app.include_router(copilot.router,       prefix="/copilot",       tags=["Copilot IA"])

# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["Système"])
async def health_check():
    return {"status": "healthy", "app": "wcomply", "version": "1.0.0"}
