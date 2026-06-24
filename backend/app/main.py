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
        from app.models import company, contact, opportunity, error_log, url_monitor
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("Database tables created successfully!")

        from sqlalchemy.ext.asyncio import AsyncSession
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy import text
        AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("SELECT COUNT(*) FROM monitored_urls"))
            count = result.scalar()
            if count == 0:
                for item in [
                    ("WHUBBI Frontend", "https://dev.whubbi.wcomply.com"),
                    ("Wcomply Website", "https://wcomply.com"),
                    ("SharePoint", "https://wcomply.sharepoint.com"),
                ]:
                    await session.execute(text(
                        "INSERT INTO monitored_urls (id, name, url, active, created_at) VALUES (gen_random_uuid(), :name, :url, true, NOW())"
                    ), {"name": item[0], "url": item[1]})
                await session.commit()
                print("Default URLs seeded!")
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
    from app.routers.microsoft import router as microsoft_router
    from app.routers import auth, outlook, copilot

    app.include_router(companies_router,    prefix="/companies",    tags=["Companies"])
    app.include_router(contacts_router,     prefix="/contacts",     tags=["Contacts"])
    app.include_router(opportunities_router,prefix="/opportunities", tags=["Opportunities"])
    app.include_router(admin_router,        prefix="/admin",        tags=["Admin"])
    app.include_router(microsoft_router,    prefix="/microsoft",    tags=["Microsoft"])
    app.include_router(auth.router,         prefix="/auth",         tags=["Auth"])
    app.include_router(outlook.router,      prefix="/outlook",      tags=["Outlook"])
    app.include_router(copilot.router,      prefix="/copilot",      tags=["Copilot"])
except Exception as e:
    print(f"Warning: Could not load routers: {e}")
