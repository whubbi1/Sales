from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="WHUBBI API", version="2.0.0")
app.add_middleware(CORSMiddleware,
    allow_origins=["https://dev.whubbi.wcomply.com","https://whubbi.wcomply.com","http://localhost:3000","http://localhost:3001"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    try:
        from app.database import engine, Base
        from app.models import company, contact, opportunity, error_log, url_monitor, user_profile, helpdesk
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        from sqlalchemy.ext.asyncio import AsyncSession
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy import text
        S = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with S() as session:

            # Run each migration separately with individual try/except
            sqls = [
                """CREATE TABLE IF NOT EXISTS helpdesk_groups (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(100) NOT NULL,
                    description TEXT,
                    responsible_email VARCHAR(255),
                    responsible_name VARCHAR(255),
                    active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS helpdesk_group_members (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    group_id UUID,
                    user_email VARCHAR(255) NOT NULL,
                    user_name VARCHAR(255),
                    is_responsible BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS helpdesk_users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_email VARCHAR(255) UNIQUE NOT NULL,
                    user_name VARCHAR(255),
                    role VARCHAR(20) DEFAULT 'end_user',
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS teams_subscriptions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    ticket_id UUID,
                    chat_id TEXT NOT NULL,
                    subscription_id TEXT,
                    expires_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                "ALTER TABLE ticket_categories ADD COLUMN IF NOT EXISTS parent_id UUID",
                "ALTER TABLE ticket_categories ADD COLUMN IF NOT EXISTS group_id UUID",
                "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS subcategory_id UUID",
                "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS group_id UUID",
                "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS teams_chat_id TEXT",
            ]

            for sql in sqls:
                try:
                    await session.execute(text(sql))
                    await session.commit()
                    print(f"OK: {sql[:50]}")
                except Exception as e:
                    await session.rollback()
                    print(f"Skip: {str(e)[:80]}")

            try:
                await session.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_whubbi_perm ON whubbi_permissions(user_email,module,submodule)"))
                await session.commit()
            except Exception: pass

            r = await session.execute(text("SELECT COUNT(*) FROM monitored_urls"))
            if r.scalar() == 0:
                for item in [("WHUBBI Frontend","https://dev.whubbi.wcomply.com"),("WCOMPLY Website","https://wcomply.com"),("SharePoint","https://wcomply.sharepoint.com")]:
                    await session.execute(text("INSERT INTO monitored_urls (id,name,url,active,created_at) VALUES (gen_random_uuid(),:name,:url,true,NOW())"),{"name":item[0],"url":item[1]})
                await session.commit()

        print("Database ready!")
    except Exception as e:
        print(f"STARTUP ERROR: {e}")
        import traceback; traceback.print_exc()

@app.get("/health")
async def health(): return {"status":"healthy","app":"whubbi","version":"2.0.0"}

@app.get("/")
async def root(): return {"message":"WHUBBI API","version":"2.0.0"}

try:
    from app.routers.companies import router as companies_router
    from app.routers.contacts import router as contacts_router
    from app.routers.opportunities import router as opportunities_router
    from app.routers.admin import router as admin_router
    from app.routers.microsoft import router as microsoft_router
    from app.routers.ecs_control import router as ecs_router
    from app.routers.settings import router as settings_router
    from app.routers.helpdesk import router as helpdesk_router
    from app.routers.helpdesk_teams import router as teams_router
    from app.routers import auth, outlook, copilot
    app.include_router(companies_router,    prefix="/companies",    tags=["Companies"])
    app.include_router(contacts_router,     prefix="/contacts",     tags=["Contacts"])
    app.include_router(opportunities_router,prefix="/opportunities", tags=["Opportunities"])
    app.include_router(admin_router,        prefix="/admin",        tags=["Admin"])
    app.include_router(microsoft_router,    prefix="/microsoft",    tags=["Microsoft"])
    app.include_router(ecs_router,          prefix="/ecs",          tags=["ECS"])
    app.include_router(settings_router,     prefix="/settings",     tags=["Settings"])
    app.include_router(helpdesk_router,     prefix="/helpdesk",     tags=["Helpdesk"])
    app.include_router(teams_router,        prefix="/helpdesk",     tags=["Teams"])
    app.include_router(auth.router,         prefix="/auth",         tags=["Auth"])
    app.include_router(outlook.router,      prefix="/outlook",      tags=["Outlook"])
    app.include_router(copilot.router,      prefix="/copilot",      tags=["Copilot"])
except Exception as e: print(f"Warning: {e}")
