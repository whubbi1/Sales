from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="WHUBBI API", version="2.0.0")
app.add_middleware(CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    response = JSONResponse({"detail": "Internal server error"}, status_code=500)
    origin = request.headers.get("origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin if origin else "*"
    response.headers["Access-Control-Allow-Credentials"] = "false"
    return response

@app.on_event("startup")
async def startup():
    try:
        from app.database import engine, Base
        from app.models import company, contact, opportunity, error_log, url_monitor, user_profile, helpdesk, background_jobs, grc, hr
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        from sqlalchemy.ext.asyncio import AsyncSession
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy import text
        S = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with S() as session:
            sqls = [
                # Helpdesk migrations
                """CREATE TABLE IF NOT EXISTS helpdesk_groups (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(100) NOT NULL, description TEXT,
                    responsible_email VARCHAR(255), responsible_name VARCHAR(255),
                    active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS helpdesk_group_members (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    group_id UUID, user_email VARCHAR(255) NOT NULL,
                    user_name VARCHAR(255), is_responsible BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS helpdesk_users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_email VARCHAR(255) UNIQUE NOT NULL,
                    user_name VARCHAR(255), role VARCHAR(20) DEFAULT 'end_user',
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS teams_subscriptions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    ticket_id UUID, chat_id TEXT NOT NULL,
                    subscription_id TEXT, expires_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                "ALTER TABLE ticket_categories ADD COLUMN IF NOT EXISTS parent_id UUID",
                "ALTER TABLE ticket_categories ADD COLUMN IF NOT EXISTS group_id UUID",
                "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS subcategory_id UUID",
                "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS group_id UUID",
                "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS teams_chat_id TEXT",
                "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_type VARCHAR(50) DEFAULT 'incident_request'",
                "ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS phone VARCHAR(50)",
                "ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS email VARCHAR(255)",
                "ALTER TABLE legal_locations ADD COLUMN IF NOT EXISTS phone VARCHAR(50)",
                "ALTER TABLE legal_locations ADD COLUMN IF NOT EXISTS email VARCHAR(255)",
                "ALTER TABLE legal_templates ADD COLUMN IF NOT EXISTS entity_id UUID",
                "ALTER TABLE legal_doc_types ADD COLUMN IF NOT EXISTS scope VARCHAR(20) DEFAULT 'both'",
                "ALTER TABLE helpdesk_groups ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false",
                # Seed missing subcategories without dropping existing data
                """INSERT INTO ticket_categories (id,name,description,color,icon,parent_id,active,created_at)
                   SELECT gen_random_uuid(),'WHUBBI','','#e97132','📱',p.id,true,NOW()
                   FROM ticket_categories p WHERE p.name='Applications' AND p.parent_id IS NULL
                   AND NOT EXISTS (SELECT 1 FROM ticket_categories s WHERE s.parent_id=p.id AND s.name='WHUBBI')""",
                """INSERT INTO ticket_categories (id,name,description,color,icon,parent_id,active,created_at)
                   SELECT gen_random_uuid(),'Microsoft Office 365','','#45B6E4','💻',p.id,true,NOW()
                   FROM ticket_categories p WHERE p.name='Software' AND p.parent_id IS NULL
                   AND NOT EXISTS (SELECT 1 FROM ticket_categories s WHERE s.parent_id=p.id AND s.name='Microsoft Office 365')""",
                """INSERT INTO ticket_categories (id,name,description,color,icon,parent_id,active,created_at)
                   SELECT gen_random_uuid(),'SAP','','#45B6E4','🔷',p.id,true,NOW()
                   FROM ticket_categories p WHERE p.name='Software' AND p.parent_id IS NULL
                   AND NOT EXISTS (SELECT 1 FROM ticket_categories s WHERE s.parent_id=p.id AND s.name='SAP')""",
                # Admin ops migrations
                """CREATE TABLE IF NOT EXISTS background_jobs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    job_id VARCHAR(50) UNIQUE NOT NULL,
                    name VARCHAR(255) NOT NULL, description TEXT,
                    job_type VARCHAR(20) DEFAULT 'lambda',
                    script_url VARCHAR(500), script_content TEXT,
                    status VARCHAR(20) DEFAULT 'active',
                    schedule VARCHAR(100),
                    last_run_at TIMESTAMP, last_run_status VARCHAR(20),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS job_executions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    job_id VARCHAR(50) NOT NULL,
                    status VARCHAR(20) NOT NULL,
                    started_at TIMESTAMP DEFAULT NOW(),
                    ended_at TIMESTAMP, duration_ms INTEGER,
                    output TEXT, error TEXT,
                    triggered_by VARCHAR(100) DEFAULT 'schedule'
                )""",
                """CREATE TABLE IF NOT EXISTS backup_records (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    application VARCHAR(100) NOT NULL,
                    backup_type VARCHAR(50),
                    status VARCHAR(20) DEFAULT 'unknown',
                    backup_date TIMESTAMP, size_mb INTEGER,
                    location VARCHAR(500), notes TEXT,
                    created_by VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )""",

                """CREATE TABLE IF NOT EXISTS backup_app_config (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    application VARCHAR(100) UNIQUE NOT NULL,
                    backup_policy TEXT,
                    tool_name VARCHAR(255),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    updated_by VARCHAR(255)
                )""",

                # GRC migrations
                """CREATE TABLE IF NOT EXISTS grc_frameworks (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(100) NOT NULL, description TEXT,
                    category VARCHAR(50), version VARCHAR(20),
                    active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS grc_controls (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    framework_id UUID, control_id VARCHAR(50),
                    title VARCHAR(255) NOT NULL, description TEXT,
                    category VARCHAR(100), status VARCHAR(20) DEFAULT 'not_started',
                    evidence TEXT, owner_email VARCHAR(255), owner_name VARCHAR(255),
                    due_date TIMESTAMP, updated_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS grc_risks (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title VARCHAR(255) NOT NULL, description TEXT,
                    category VARCHAR(100), probability INTEGER, impact INTEGER,
                    status VARCHAR(20) DEFAULT 'open', mitigation TEXT,
                    owner_email VARCHAR(255), owner_name VARCHAR(255),
                    due_date TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS grc_audits (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title VARCHAR(255) NOT NULL, framework_id UUID,
                    audit_type VARCHAR(50), status VARCHAR(20) DEFAULT 'planned',
                    start_date TIMESTAMP, end_date TIMESTAMP,
                    auditor_name VARCHAR(255), scope TEXT,
                    findings_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS grc_findings (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    audit_id UUID, title VARCHAR(255) NOT NULL,
                    description TEXT, severity VARCHAR(20),
                    status VARCHAR(20) DEFAULT 'open',
                    corrective_action TEXT, owner_email VARCHAR(255),
                    due_date TIMESTAMP, created_at TIMESTAMP DEFAULT NOW()
                )""",

                # HR migrations
                """CREATE TABLE IF NOT EXISTS hr_profiles (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    profile_type VARCHAR(20) NOT NULL,
                    first_name VARCHAR(100), last_name VARCHAR(100),
                    email VARCHAR(255), phone VARCHAR(50),
                    linkedin_url VARCHAR(500), country VARCHAR(50), language VARCHAR(10),
                    current_title VARCHAR(255), skills JSON, years_experience INTEGER,
                    cv_sharepoint_url VARCHAR(1000), cv_filename VARCHAR(255),
                    cv_extracted BOOLEAN DEFAULT false,
                    recruitment_status VARCHAR(30) DEFAULT 'new',
                    daily_rate INTEGER, availability_date TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(),
                    created_by VARCHAR(255)
                )""",
                """CREATE TABLE IF NOT EXISTS hr_projects (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    profile_id UUID, title VARCHAR(255), company VARCHAR(255),
                    start_date VARCHAR(20), end_date VARCHAR(20),
                    description TEXT, technologies JSON
                )""",
                """CREATE TABLE IF NOT EXISTS hr_comments (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    profile_id UUID, author_email VARCHAR(255), author_name VARCHAR(255),
                    content TEXT, comment_type VARCHAR(20) DEFAULT 'note',
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS hr_job_descriptions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title VARCHAR(255) NOT NULL, department VARCHAR(100),
                    location VARCHAR(100), contract_type VARCHAR(50),
                    status VARCHAR(20) DEFAULT 'open', description TEXT,
                    responsibilities JSON, requirements JSON,
                    salary_min INTEGER, salary_max INTEGER,
                    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS hr_proposals (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    profile_id UUID, role VARCHAR(255),
                    responsibilities JSON, salary INTEGER, advantages JSON,
                    start_date VARCHAR(50), country VARCHAR(50), language VARCHAR(10),
                    status VARCHAR(20) DEFAULT 'draft',
                    docusign_envelope_id VARCHAR(255), docusign_status VARCHAR(50),
                    signed_at TIMESTAMP, onboarding_token VARCHAR(100) UNIQUE,
                    onboarding_sent_at TIMESTAMP, onboarding_completed_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(), sent_at TIMESTAMP
                )""",
                """CREATE TABLE IF NOT EXISTS hr_onboarding_documents (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    proposal_id UUID, document_type VARCHAR(100),
                    filename VARCHAR(255), sharepoint_url VARCHAR(1000),
                    uploaded_at TIMESTAMP DEFAULT NOW(), personal_data JSON
                )""",

                # GRC Extended migrations
                """CREATE TABLE IF NOT EXISTS grc_documents (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(500) NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS grc_requirements (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    framework_id UUID NOT NULL,
                    document_id UUID,
                    requirement_text TEXT NOT NULL,
                    reference_code VARCHAR(100),
                    status VARCHAR(20) DEFAULT 'not_started',
                    evidence TEXT,
                    owner_email VARCHAR(255),
                    due_date TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS grc_requirement_mappings (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    source_req_id UUID NOT NULL,
                    target_req_id UUID NOT NULL,
                    mapping_type VARCHAR(30) DEFAULT 'related',
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                # HR document tracking
                """CREATE TABLE IF NOT EXISTS hr_profile_documents (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    profile_id UUID NOT NULL,
                    filename VARCHAR(255),
                    sharepoint_url VARCHAR(1000),
                    doc_type VARCHAR(50) DEFAULT 'document',
                    uploaded_at TIMESTAMP DEFAULT NOW()
                )""",
                # Job positions + interview assignments
                """CREATE TABLE IF NOT EXISTS hr_job_positions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title VARCHAR(255) NOT NULL,
                    country VARCHAR(50),
                    job_description_id UUID,
                    status VARCHAR(20) DEFAULT 'open',
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    created_by VARCHAR(255)
                )""",
                """CREATE TABLE IF NOT EXISTS hr_interview_assignments (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    profile_id UUID NOT NULL,
                    interviewer_email VARCHAR(255),
                    interviewer_name VARCHAR(255),
                    assigned_at TIMESTAMP DEFAULT NOW(),
                    assigned_by VARCHAR(255)
                )""",
                "ALTER TABLE hr_profiles ADD COLUMN IF NOT EXISTS job_position_id UUID",
                "ALTER TABLE hr_job_descriptions ADD COLUMN IF NOT EXISTS qualifications TEXT",
                "ALTER TABLE hr_job_descriptions ADD COLUMN IF NOT EXISTS must_have JSON DEFAULT '[]'",
                "ALTER TABLE hr_job_descriptions ADD COLUMN IF NOT EXISTS nice_to_have JSON DEFAULT '[]'",
                """CREATE TABLE IF NOT EXISTS hr_settings (
                    key VARCHAR(100) PRIMARY KEY,
                    value TEXT,
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",

                # Merge interview_2 into interview_1
                "UPDATE hr_profiles SET recruitment_status = 'interview_1' WHERE recruitment_status = 'interview_2'",

                "ALTER TABLE grc_frameworks ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#156082'",
                """CREATE UNIQUE INDEX IF NOT EXISTS idx_grc_mapping_unique
                   ON grc_requirement_mappings(source_req_id, target_req_id)""",
                # Audit logging
                """CREATE TABLE IF NOT EXISTS audit_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    table_name VARCHAR(100) NOT NULL,
                    record_id VARCHAR(255),
                    action VARCHAR(20) NOT NULL,
                    changed_by VARCHAR(255),
                    changed_at TIMESTAMP DEFAULT NOW(),
                    old_values JSONB,
                    new_values JSONB,
                    module VARCHAR(50),
                    description TEXT
                )""",
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name)",
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON audit_logs(changed_at)",
                # Log retention settings
                """CREATE TABLE IF NOT EXISTS log_retention_settings (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    table_name VARCHAR(100) UNIQUE NOT NULL,
                    module VARCHAR(50),
                    retention_days INTEGER NOT NULL DEFAULT 365,
                    updated_by VARCHAR(255),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                # User report configs (per-user report variants)
                """CREATE TABLE IF NOT EXISTS user_report_configs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_email VARCHAR(255) NOT NULL,
                    module VARCHAR(50) NOT NULL,
                    report_name VARCHAR(100) NOT NULL,
                    config JSONB NOT NULL DEFAULT '{}',
                    is_default BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_report_configs ON user_report_configs(user_email, module, report_name)",
                # Interview requests and results
                """CREATE TABLE IF NOT EXISTS hr_interview_requests (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    profile_id UUID NOT NULL,
                    assigned_to_email VARCHAR(255) NOT NULL,
                    assigned_to_name VARCHAR(255),
                    due_date DATE,
                    message TEXT,
                    requested_by VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS hr_interview_results (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    profile_id UUID NOT NULL,
                    interviewer_email VARCHAR(255),
                    interviewer_name VARCHAR(255),
                    questions JSONB DEFAULT '[]',
                    skill_ratings JSONB DEFAULT '{}',
                    recommendation VARCHAR(50),
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                # Permissions - legal entity dimension
                "ALTER TABLE whubbi_permissions ADD COLUMN IF NOT EXISTS legal_entities JSONB DEFAULT '[\"all\"]'",
                # HR Admin Cockpit — interview skills & questions
                """CREATE TABLE IF NOT EXISTS hr_interview_skills (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    skill_name VARCHAR(255) NOT NULL,
                    country VARCHAR(50) DEFAULT 'global',
                    sort_order INTEGER DEFAULT 0,
                    created_by VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS hr_interview_questions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    question_text TEXT NOT NULL,
                    country VARCHAR(50) DEFAULT 'global',
                    sort_order INTEGER DEFAULT 0,
                    created_by VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                "ALTER TABLE hr_interview_results ADD COLUMN IF NOT EXISTS interview_date DATE",
                # Chat broadcasts
                """CREATE TABLE IF NOT EXISTS hr_chat_messages (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    sender_email VARCHAR(255),
                    sender_name VARCHAR(255),
                    message TEXT NOT NULL,
                    recipients JSONB DEFAULT '[]',
                    status VARCHAR(20) DEFAULT 'sent',
                    schedule_type VARCHAR(20),
                    scheduled_at TIMESTAMP,
                    recurrence JSONB DEFAULT '{}',
                    sent_at TIMESTAMP,
                    sent_count INTEGER DEFAULT 0,
                    delivered_count INTEGER DEFAULT 0,
                    delivery_errors TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                "ALTER TABLE hr_chat_messages ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255)",
                "ALTER TABLE hr_chat_messages ADD COLUMN IF NOT EXISTS delivered_count INTEGER DEFAULT 0",
                "ALTER TABLE hr_chat_messages ADD COLUMN IF NOT EXISTS delivery_errors TEXT",
                # Legal module migrations
                """CREATE TABLE IF NOT EXISTS legal_entities (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    legal_name VARCHAR(255) NOT NULL,
                    legal_address TEXT,
                    country VARCHAR(100),
                    registration_description VARCHAR(255),
                    registration_value VARCHAR(255),
                    created_by VARCHAR(255),
                    updated_by VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS legal_entity_documents (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    legal_entity_id UUID NOT NULL,
                    doc_type VARCHAR(100),
                    doc_label VARCHAR(255) NOT NULL,
                    sharepoint_url TEXT,
                    created_by VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS legal_templates (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    doc_type VARCHAR(100),
                    country VARCHAR(100) DEFAULT 'global',
                    sharepoint_url TEXT,
                    sort_order INTEGER DEFAULT 0,
                    created_by VARCHAR(255),
                    updated_by VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                # Legal schema evolution
                "ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS street VARCHAR(255)",
                "ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20)",
                "ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS city VARCHAR(100)",
                "ALTER TABLE legal_entity_documents ALTER COLUMN doc_label DROP NOT NULL",
                """CREATE TABLE IF NOT EXISTS legal_entity_registrations (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    entity_id UUID NOT NULL,
                    reg_type VARCHAR(100),
                    reg_value VARCHAR(255) NOT NULL,
                    sort_order INTEGER DEFAULT 0,
                    created_by VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS legal_entity_websites (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    entity_id UUID NOT NULL,
                    label VARCHAR(255),
                    url TEXT NOT NULL,
                    created_by VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS legal_locations (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    location_name VARCHAR(255) NOT NULL,
                    street VARCHAR(255),
                    postal_code VARCHAR(20),
                    city VARCHAR(100),
                    country VARCHAR(100),
                    created_by VARCHAR(255),
                    updated_by VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS legal_location_registrations (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    location_id UUID NOT NULL,
                    reg_type VARCHAR(100),
                    reg_value VARCHAR(255) NOT NULL,
                    created_by VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS legal_location_documents (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    location_id UUID NOT NULL,
                    doc_type VARCHAR(100),
                    sharepoint_url TEXT,
                    created_by VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS legal_location_websites (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    location_id UUID NOT NULL,
                    label VARCHAR(255),
                    url TEXT NOT NULL,
                    created_by VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS legal_doc_types (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    label VARCHAR(255) NOT NULL,
                    sort_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """INSERT INTO legal_doc_types (label, sort_order)
                   SELECT v.label, v.sort_order FROM (VALUES
                       ('KBIS', 1), ('SIREN/SIRET', 2), ('VAT Certificate', 3),
                       ('Articles of Incorporation', 4), ('Insurance Certificate', 5),
                       ('Bank Certificate', 6), ('Tax Certificate', 7), ('Other', 99)
                   ) AS v(label, sort_order)
                   WHERE NOT EXISTS (SELECT 1 FROM legal_doc_types LIMIT 1)""",

                # Development module
                """CREATE TABLE IF NOT EXISTS development_pipelines (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    pipeline_code VARCHAR(50) UNIQUE NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    application VARCHAR(100),
                    status VARCHAR(50) DEFAULT 'to_be_planned',
                    release_number VARCHAR(50),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS development_requests (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    request_number VARCHAR(50) UNIQUE NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    application VARCHAR(100),
                    status VARCHAR(50) DEFAULT 'open',
                    priority VARCHAR(20) DEFAULT 'medium',
                    request_type VARCHAR(50) DEFAULT 'feature',
                    requester_email VARCHAR(255),
                    requester_name VARCHAR(255),
                    assignee_email VARCHAR(255),
                    assignee_name VARCHAR(255),
                    pipeline_id UUID,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS dev_request_activity (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    request_id UUID NOT NULL,
                    content TEXT,
                    field_changed VARCHAR(100),
                    old_value TEXT,
                    new_value TEXT,
                    author_email VARCHAR(255),
                    author_name VARCHAR(255),
                    is_system BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS test_scripts (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title VARCHAR(255) NOT NULL,
                    application VARCHAR(100),
                    description TEXT,
                    script_steps TEXT,
                    expected_results TEXT,
                    request_id UUID,
                    pipeline_id UUID,
                    created_by VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS test_executions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    script_id UUID,
                    pipeline_id UUID,
                    status VARCHAR(50) DEFAULT 'not_started',
                    result TEXT,
                    executed_by VARCHAR(255),
                    notes TEXT,
                    executed_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                # Link helpdesk tickets to the development module
                "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS application VARCHAR(100)",
                "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS dev_pipeline_id UUID",
            ]
            for sql in sqls:
                try:
                    await session.execute(text(sql))
                    await session.commit()
                    print(f"OK: {sql[:50]}")
                except Exception as e:
                    await session.rollback()
                    print(f"Skip: {str(e)[:60]}")

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
async def health(): return {"status":"healthy","app":"whubbi","version":"2.0.4"}

@app.get("/")
async def root(): return {"message":"WHUBBI API","version":"2.0.0"}

@app.get("/debug/routes")
async def debug_routes():
    routes = []
    for route in app.routes:
        if hasattr(route, "path") and hasattr(route, "methods"):
            routes.append({"path": route.path, "methods": sorted(route.methods)})
    return {"total": len(routes), "routes": sorted(routes, key=lambda r: r["path"])}

def _include(module_path: str, prefix: str, tag: str):
    try:
        import importlib
        mod = importlib.import_module(module_path)
        app.include_router(mod.router, prefix=prefix, tags=[tag])
        print(f"✓ {tag}")
    except Exception as e:
        import traceback
        print(f"✗ ROUTER FAILED [{tag}]: {e}")
        traceback.print_exc()

_include("app.routers.companies",      "/companies",    "Companies")
_include("app.routers.contacts",       "/contacts",     "Contacts")
_include("app.routers.opportunities",  "/opportunities","Opportunities")
_include("app.routers.admin",          "/admin",        "Admin")
_include("app.routers.admin_ops",      "/admin",        "AdminOps")
_include("app.routers.microsoft",      "/microsoft",    "Microsoft")
_include("app.routers.ecs_control",    "/ecs",          "ECS")
_include("app.routers.settings",       "/settings",     "Settings")
_include("app.routers.hr",             "/hr",           "HR")
_include("app.routers.grc",            "/grc",          "GRC")
_include("app.routers.grc_extended",   "/grc",          "GRCExt")
_include("app.routers.helpdesk",       "/helpdesk",     "Helpdesk")
_include("app.routers.helpdesk_teams", "/helpdesk",     "Teams")
_include("app.routers.admin_audit",    "/admin",        "Audit")
_include("app.routers.legal",          "/legal",        "Legal")
_include("app.routers.development",    "/development",  "Development")

try:
    from app.routers import auth, outlook, copilot
    app.include_router(auth.router,    prefix="/auth",    tags=["Auth"])
    app.include_router(outlook.router, prefix="/outlook", tags=["Outlook"])
    app.include_router(copilot.router, prefix="/copilot", tags=["Copilot"])
except Exception as e:
    print(f"✗ ROUTER FAILED [auth/outlook/copilot]: {e}")

try:
    from app.routers import bot
    app.include_router(bot.router, prefix="/bot", tags=["Bot"])
    print("✓ Bot")
except Exception as e:
    import traceback
    print(f"✗ ROUTER FAILED [Bot]: {e}")
    traceback.print_exc()
