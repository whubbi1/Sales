from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="WHUBBI API", description="Commercial Management API", version="2.0.0")

app.add_middleware(CORSMiddleware,
    allow_origins=["https://dev.whubbi.wcomply.com","https://whubbi.wcomply.com","http://localhost:3000","http://localhost:3001"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    try:
        from app.database import engine, Base
        from app.models import company, contact, opportunity, error_log
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("Database tables created successfully!")
    except Exception as e:
        print(f"ERROR during startup: {e}")
        import traceback; traceback.print_exc()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "app": "whubbi", "version": "2.0.0"}

@app.get("/")
async def root():
    return {"message": "WHUBBI API", "version": "2.0.0"}

try:
    from app.routers.companies import router as companies_router
    from app.routers.contacts import router as contacts_router
    from app.routers.opportunities import router as opportunities_router
    from app.routers.admin import router as admin_router
    from app.routers import auth, outlook, copilot

    app.include_router(companies_router,    prefix="/companies",    tags=["Companies"])
    app.include_router(contacts_router,     prefix="/contacts",     tags=["Contacts"])
    app.include_router(opportunities_router,prefix="/opportunities", tags=["Opportunities"])
    app.include_router(admin_router,        prefix="/admin",        tags=["Admin"])
    app.include_router(auth.router,         prefix="/auth",         tags=["Auth"])
    app.include_router(outlook.router,      prefix="/outlook",      tags=["Outlook"])
    app.include_router(copilot.router,      prefix="/copilot",      tags=["Copilot"])
except Exception as e:
    print(f"Warning: Could not load routers: {e}")
