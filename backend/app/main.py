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
        from app.models import company, contact, opportunity, opportunity_extra, error_log, url_monitor, user_profile, helpdesk, background_jobs, grc, hr
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        from sqlalchemy.ext.asyncio import AsyncSession
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy import text
        S = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with S() as session:
            sqls = [
                # Sales — link a SharePoint site/folder to an opportunity
                "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS sharepoint_site_url TEXT",

                # Home page — each user's main office location (drives which company links they see)
                "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS main_location_id UUID",
                "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS main_location_name VARCHAR(255) DEFAULT 'All'",

                # Access control — excludes a person from logging in or reaching any module/document
                "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_excluded BOOLEAN DEFAULT false",

                # Company Links — shown on the home page, scoped to a location or to all
                """CREATE TABLE IF NOT EXISTS company_links (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    label VARCHAR(255) NOT NULL,
                    url TEXT NOT NULL,
                    icon VARCHAR(20) DEFAULT '🔗',
                    active BOOLEAN DEFAULT true,
                    sort_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                "ALTER TABLE company_links ADD COLUMN IF NOT EXISTS location_id UUID",
                "ALTER TABLE company_links ADD COLUMN IF NOT EXISTS location_name VARCHAR(255) DEFAULT 'All'",
                "ALTER TABLE company_links ADD COLUMN IF NOT EXISTS category VARCHAR(100)",

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
                # Legal Templates — optionally scope a template to several specific entities
                # instead of just one (defaults to applying to all entities, like it_applications' locations)
                "ALTER TABLE legal_templates ADD COLUMN IF NOT EXISTS all_entities BOOLEAN NOT NULL DEFAULT true",
                "ALTER TABLE legal_templates ADD COLUMN IF NOT EXISTS entity_ids JSONB NOT NULL DEFAULT '[]'",
                "ALTER TABLE legal_templates ADD COLUMN IF NOT EXISTS entity_names JSONB NOT NULL DEFAULT '[]'",
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

                # IT module — company equipment registry
                """CREATE TABLE IF NOT EXISTS it_equipment (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    equipment_type VARCHAR(20) NOT NULL DEFAULT 'IT',
                    name VARCHAR(255) NOT NULL,
                    serial_number VARCHAR(255),
                    purchase_date DATE,
                    purchase_price NUMERIC(12,2),
                    entry_service_date DATE,
                    planned_end_service_date DATE,
                    end_service_date DATE,
                    end_service_reason TEXT,
                    comment TEXT,
                    assigned_email VARCHAR(255),
                    assigned_name VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                "ALTER TABLE it_equipment ADD COLUMN IF NOT EXISTS location_id UUID",
                "ALTER TABLE it_equipment ADD COLUMN IF NOT EXISTS location_name VARCHAR(255) DEFAULT 'All'",

                # IT module — software solutions registry
                """CREATE TABLE IF NOT EXISTS it_software (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(255) NOT NULL,
                    editor VARCHAR(255),
                    version VARCHAR(100),
                    install_link TEXT,
                    owner_email VARCHAR(255),
                    owner_name VARCHAR(255),
                    location_id UUID,
                    location_name VARCHAR(255) DEFAULT 'All',
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",

                # IT module — applications registry (locations are multi-select)
                """CREATE TABLE IF NOT EXISTS it_applications (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(255) NOT NULL,
                    editor VARCHAR(255),
                    version VARCHAR(100),
                    app_link TEXT,
                    owner_email VARCHAR(255),
                    owner_name VARCHAR(255),
                    all_locations BOOLEAN NOT NULL DEFAULT true,
                    location_ids JSONB NOT NULL DEFAULT '[]',
                    location_names JSONB NOT NULL DEFAULT '[]',
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                # Use: Demo / Production / Development
                "ALTER TABLE it_applications ADD COLUMN IF NOT EXISTS use VARCHAR(20)",

                # Environments (definition/hosting/name/url) replace the single app_link field
                """CREATE TABLE IF NOT EXISTS it_application_environments (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    application_id UUID NOT NULL REFERENCES it_applications(id) ON DELETE CASCADE,
                    definition VARCHAR(20),
                    hosting_name VARCHAR(20),
                    name VARCHAR(255),
                    url TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",

                # Links — free-form documents/resources attached to an application, each with a description
                """CREATE TABLE IF NOT EXISTS it_application_links (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    application_id UUID NOT NULL REFERENCES it_applications(id) ON DELETE CASCADE,
                    url TEXT NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                # app_link is no longer set/read at the application level (superseded by
                # environments + links) — preserve any pre-existing value as a Link once, rather
                # than silently discarding it. Guarded so it only fires before any real link exists.
                """INSERT INTO it_application_links (id, application_id, url, description, created_at, updated_at)
                   SELECT gen_random_uuid(), a.id, a.app_link, 'Migrated from application link', NOW(), NOW()
                   FROM it_applications a
                   WHERE COALESCE(a.app_link, '') != ''
                     AND NOT EXISTS (SELECT 1 FROM it_application_links l WHERE l.application_id = a.id)""",

                # IT module — per-user saved report views (shared by equipment/software/application reports)
                """CREATE TABLE IF NOT EXISTS it_report_views (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_email VARCHAR(255) NOT NULL,
                    module VARCHAR(30) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    columns JSONB NOT NULL DEFAULT '[]',
                    filters JSONB NOT NULL DEFAULT '{}',
                    sort_field VARCHAR(100),
                    sort_dir VARCHAR(4) DEFAULT 'asc',
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                "ALTER TABLE it_report_views ADD COLUMN IF NOT EXISTS column_widths JSONB NOT NULL DEFAULT '{}'",

                # Personal Profile — Curriculum Vitae
                """CREATE TABLE IF NOT EXISTS employee_cv (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    email VARCHAR(255) UNIQUE NOT NULL,
                    first_name VARCHAR(100),
                    last_name VARCHAR(100),
                    title VARCHAR(255),
                    short_description TEXT,
                    skills JSON DEFAULT '[]',
                    languages JSON DEFAULT '[]',
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS employee_cv_experience (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_email VARCHAR(255) NOT NULL,
                    job_title VARCHAR(255),
                    company VARCHAR(255),
                    start_date VARCHAR(20),
                    end_date VARCHAR(20),
                    location VARCHAR(255),
                    description TEXT,
                    sort_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",

                # Personal Profile — Training, Certifications, HR Training Plan
                """CREATE TABLE IF NOT EXISTS trainings (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_email VARCHAR(255) NOT NULL,
                    training_date DATE,
                    name VARCHAR(255) NOT NULL,
                    file_ref TEXT,
                    file_name VARCHAR(255),
                    description TEXT,
                    plan_id UUID,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS certifications (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_email VARCHAR(255) NOT NULL,
                    cert_date DATE,
                    name VARCHAR(255) NOT NULL,
                    file_ref TEXT,
                    file_name VARCHAR(255),
                    description TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                # Training module — rename the old assignment table to free up
                # "training_plans" for its new meaning (function-based bundle template)
                "ALTER TABLE training_plans RENAME TO training_assignments",
                """CREATE TABLE IF NOT EXISTS training_assignments (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_email VARCHAR(255) NOT NULL,
                    training_name VARCHAR(255) NOT NULL,
                    description TEXT,
                    due_date DATE,
                    status VARCHAR(20) DEFAULT 'assigned',
                    assigned_by_email VARCHAR(255),
                    assigned_by_name VARCHAR(255),
                    completed_training_id UUID,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                "ALTER TABLE training_assignments ADD COLUMN IF NOT EXISTS catalog_id UUID",
                "ALTER TABLE training_assignments ADD COLUMN IF NOT EXISTS source_plan_id UUID",
                "ALTER TABLE training_assignments ADD COLUMN IF NOT EXISTS recurrence VARCHAR(20)",
                "ALTER TABLE training_assignments ADD COLUMN IF NOT EXISTS next_assignment_id UUID",

                """CREATE TABLE IF NOT EXISTS training_catalog (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    training_type VARCHAR(20) NOT NULL DEFAULT 'wcomply',
                    company VARCHAR(255) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    duration VARCHAR(100) NOT NULL,
                    material_link TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS training_plans (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    training_function VARCHAR(255) NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS training_plan_items (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    plan_id UUID NOT NULL,
                    catalog_id UUID NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                "ALTER TABLE training_catalog ADD COLUMN IF NOT EXISTS languages JSON DEFAULT '[]'",
                "ALTER TABLE training_plan_items ADD COLUMN IF NOT EXISTS sequence INTEGER NOT NULL DEFAULT 0",
                "ALTER TABLE training_catalog ADD COLUMN IF NOT EXISTS expertise_level VARCHAR(20) DEFAULT 'beginner'",

                # Task Manager — unified cross-module tasks (absorbs sales_tasks, see backfill below)
                """CREATE TABLE IF NOT EXISTS tasks (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    status VARCHAR(20) NOT NULL DEFAULT 'new',
                    source VARCHAR(50) NOT NULL DEFAULT 'manual',
                    owner_email VARCHAR(255) NOT NULL,
                    owner_name VARCHAR(255),
                    assignee_email VARCHAR(255),
                    assignee_name VARCHAR(255),
                    due_date TIMESTAMP,
                    entity_type VARCHAR(50),
                    entity_id UUID,
                    sync_to_outlook BOOLEAN DEFAULT false,
                    outlook_task_id VARCHAR(255),
                    teams_chat_id TEXT,
                    created_by_email VARCHAR(255),
                    resolved_at TIMESTAMP,
                    closed_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS task_watchers (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    user_email VARCHAR(255) NOT NULL,
                    user_name VARCHAR(255),
                    added_by_email VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(task_id, user_email)
                )""",
                """CREATE TABLE IF NOT EXISTS task_comments (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    author_email VARCHAR(255),
                    author_name VARCHAR(255),
                    content TEXT NOT NULL,
                    source VARCHAR(20) DEFAULT 'web',
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS task_teams_subscriptions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
                    chat_id TEXT NOT NULL UNIQUE,
                    subscription_id TEXT,
                    expires_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                # One-time, idempotent backfill of existing Sales tasks into the unified table.
                # sales_tasks itself is left untouched as a non-destructive historical copy.
                """INSERT INTO tasks (id, title, description, status, source, owner_email, owner_name,
                                     assignee_email, assignee_name, due_date, entity_type, entity_id,
                                     sync_to_outlook, outlook_task_id, created_by_email, created_at, updated_at)
                   SELECT id, title, description,
                          CASE status WHEN 'todo' THEN 'new' WHEN 'in_progress' THEN 'in_progress' WHEN 'done' THEN 'resolved' ELSE 'new' END,
                          'sales', owner_email, owner_name, owner_email, owner_name, due_date, entity_type, entity_id,
                          sync_to_outlook, outlook_task_id, created_by_email, created_at, updated_at
                   FROM sales_tasks
                   WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = sales_tasks.id)""",

                # Task Manager — free-text grouping label, and links/files attached to a task
                "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subject VARCHAR(255)",
                "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_number VARCHAR(50)",
                # Backfill task_number for any tasks created before the column existed
                # (including the sales_tasks import above) — id-derived, so it's stable and idempotent.
                """UPDATE tasks SET task_number = 'TSK-' || to_char(created_at, 'YYYYMM') || '-' || upper(substr(replace(id::text,'-',''), 1, 4))
                   WHERE task_number IS NULL""",
                """CREATE TABLE IF NOT EXISTS task_links (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    label VARCHAR(255) NOT NULL,
                    url TEXT NOT NULL,
                    added_by_email VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )""",

                # GRC — Access Review cycles
                """CREATE TABLE IF NOT EXISTS grc_access_review_cycles (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    cycle_number VARCHAR(30) UNIQUE NOT NULL,
                    review_type VARCHAR(20) NOT NULL DEFAULT 'adhoc',
                    cycle_name VARCHAR(255) NOT NULL,
                    cycle_description TEXT,
                    owner_email VARCHAR(255),
                    owner_name VARCHAR(255),
                    status VARCHAR(20) NOT NULL DEFAULT 'open',
                    due_date TIMESTAMP,
                    scope JSONB NOT NULL DEFAULT '[]',
                    requirement_id UUID,
                    created_by_email VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    closed_at TIMESTAMP
                )""",
                """CREATE TABLE IF NOT EXISTS grc_access_review_links (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    cycle_id UUID NOT NULL REFERENCES grc_access_review_cycles(id) ON DELETE CASCADE,
                    label VARCHAR(255) NOT NULL,
                    url TEXT NOT NULL,
                    added_by_email VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                # Lets the Access Review Requirements view filter grc_requirements down to
                # access-control-related ones, without touching grc_extended.py's existing endpoints.
                "ALTER TABLE grc_requirements ADD COLUMN IF NOT EXISTS category VARCHAR(50)",

                # HR — Onboarding/Offboarding checklists per location
                """CREATE TABLE IF NOT EXISTS hr_checklist_tasks (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    kind VARCHAR(20) NOT NULL,
                    location_id UUID NOT NULL,
                    location_name VARCHAR(255),
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    url TEXT,
                    sharepoint_url TEXT,
                    responsible_email VARCHAR(255),
                    responsible_name VARCHAR(255),
                    sort_order INTEGER DEFAULT 0,
                    created_by_email VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS hr_checklist_cases (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    kind VARCHAR(20) NOT NULL,
                    user_email VARCHAR(255) NOT NULL,
                    user_name VARCHAR(255),
                    location_id UUID,
                    location_name VARCHAR(255),
                    started_by_email VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS hr_checklist_case_tasks (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    case_id UUID NOT NULL REFERENCES hr_checklist_cases(id) ON DELETE CASCADE,
                    checklist_task_id UUID,
                    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",

                # MCP personal access tokens — lets a WHUBBI user connect an MCP client
                # (Claude Code/Desktop) to the same permission-gated tools the Teams bot uses.
                """CREATE TABLE IF NOT EXISTS mcp_tokens (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_email VARCHAR(255) NOT NULL,
                    user_name VARCHAR(255),
                    label VARCHAR(255),
                    token_hash VARCHAR(64) NOT NULL UNIQUE,
                    token_prefix VARCHAR(16) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    last_used_at TIMESTAMP,
                    revoked_at TIMESTAMP
                )""",

                # Sales — Partners (same shape as companies) + linking Opportunities/Contacts to a Partner
                """CREATE TABLE IF NOT EXISTS partners (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(255) NOT NULL,
                    contact_name VARCHAR(255),
                    domain_names JSONB DEFAULT '[]',
                    phone VARCHAR(50),
                    sector VARCHAR(255),
                    country VARCHAR(100),
                    status VARCHAR(50) DEFAULT 'active',
                    main_erp JSONB DEFAULT '[]',
                    cybersecurity_solutions JSONB DEFAULT '[]',
                    sap_hosting_partner JSONB DEFAULT '[]',
                    linkedin_url VARCHAR(500),
                    notes TEXT,
                    assigned_to VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL",
                "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL",
                """CREATE TABLE IF NOT EXISTS partner_action_items (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
                    title VARCHAR(500) NOT NULL,
                    description TEXT,
                    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
                    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
                    owner_email VARCHAR(255),
                    owner_name VARCHAR(255),
                    due_date DATE,
                    status VARCHAR(50) DEFAULT 'open',
                    task_id UUID,
                    created_by_email VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",

                # Marketing — Events with contributors, named URLs, and links to Partners
                """CREATE TABLE IF NOT EXISTS marketing_events (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title VARCHAR(500) NOT NULL,
                    event_date DATE,
                    description TEXT,
                    event_type VARCHAR(50) DEFAULT 'other',
                    location VARCHAR(255),
                    owner_email VARCHAR(255),
                    owner_name VARCHAR(255),
                    created_by_email VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS marketing_event_contributors (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    event_id UUID NOT NULL REFERENCES marketing_events(id) ON DELETE CASCADE,
                    user_email VARCHAR(255) NOT NULL,
                    user_name VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS marketing_event_urls (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    event_id UUID NOT NULL REFERENCES marketing_events(id) ON DELETE CASCADE,
                    label VARCHAR(255) NOT NULL,
                    url TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS marketing_event_partners (
                    event_id UUID NOT NULL REFERENCES marketing_events(id) ON DELETE CASCADE,
                    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
                    PRIMARY KEY (event_id, partner_id)
                )""",

                # HR checklist cases — ongoing/closed status, case-level responsible person
                "ALTER TABLE hr_checklist_cases ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ongoing'",
                "ALTER TABLE hr_checklist_cases ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP",
                "ALTER TABLE hr_checklist_cases ADD COLUMN IF NOT EXISTS responsible_email VARCHAR(255)",
                "ALTER TABLE hr_checklist_cases ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(255)",

                # Development module (Testing) — application submodules (IT prerequisite)
                """CREATE TABLE IF NOT EXISTS it_application_submodules (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    application_id UUID NOT NULL REFERENCES it_applications(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",

                # Development module (Testing) — plans, scripts, campaigns, execution, review, remediation
                """CREATE TABLE IF NOT EXISTS test_plans (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    plan_number VARCHAR(30) UNIQUE,
                    title VARCHAR(500) NOT NULL,
                    description TEXT,
                    application_id UUID REFERENCES it_applications(id) ON DELETE SET NULL,
                    submodule_id UUID REFERENCES it_application_submodules(id) ON DELETE SET NULL,
                    created_by_email VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                # Named test_plan_scripts (not test_scripts) to avoid colliding with Development's
                # own pre-existing test_scripts table (different shape — a flat script tied to a
                # pipeline/request, vs. an ordered step tied to a test plan).
                """CREATE TABLE IF NOT EXISTS test_plan_scripts (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    script_number VARCHAR(30) UNIQUE,
                    plan_id UUID NOT NULL REFERENCES test_plans(id) ON DELETE CASCADE,
                    position INTEGER DEFAULT 0,
                    title VARCHAR(500) NOT NULL,
                    details TEXT,
                    expected_result TEXT,
                    url TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS test_campaigns (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    campaign_number VARCHAR(30) UNIQUE,
                    title VARCHAR(500) NOT NULL,
                    execution_date DATE,
                    owner_email VARCHAR(255),
                    owner_name VARCHAR(255),
                    reviewer_email VARCHAR(255),
                    reviewer_name VARCHAR(255),
                    status VARCHAR(20) DEFAULT 'planned',
                    created_by_email VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS test_campaign_plans (
                    campaign_id UUID NOT NULL REFERENCES test_campaigns(id) ON DELETE CASCADE,
                    plan_id UUID NOT NULL REFERENCES test_plans(id) ON DELETE CASCADE,
                    PRIMARY KEY (campaign_id, plan_id)
                )""",
                """CREATE TABLE IF NOT EXISTS test_campaign_steps (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    campaign_id UUID NOT NULL REFERENCES test_campaigns(id) ON DELETE CASCADE,
                    plan_id UUID REFERENCES test_plans(id) ON DELETE SET NULL,
                    script_id UUID REFERENCES test_plan_scripts(id) ON DELETE SET NULL,
                    position INTEGER DEFAULT 0,
                    title VARCHAR(500) NOT NULL,
                    details TEXT,
                    expected_result TEXT,
                    url TEXT,
                    result VARCHAR(20),
                    screenshot_url TEXT,
                    deviation TEXT,
                    remediation TEXT,
                    criticality VARCHAR(20),
                    executed_at TIMESTAMP,
                    reviewed_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                # test_campaign_steps.script_id used to point at Development's test_scripts table
                # (a naming collision with what should have been a separate table) before it was
                # split out as test_plan_scripts above — repoint the FK on any DB where it's stale.
                # Looked up dynamically rather than assuming Postgres's auto-generated constraint
                # name, and safe to re-run: a fresh install's CREATE TABLE already has it right, so
                # the DROP loop finds nothing and the ADD hits the harmless duplicate_object case.
                """DO $$
                DECLARE r RECORD;
                BEGIN
                    FOR r IN SELECT conname FROM pg_constraint
                             WHERE conrelid = 'test_campaign_steps'::regclass
                               AND confrelid = 'test_scripts'::regclass AND contype = 'f'
                    LOOP EXECUTE format('ALTER TABLE test_campaign_steps DROP CONSTRAINT %I', r.conname); END LOOP;
                END $$""",
                """DO $$ BEGIN
                    ALTER TABLE test_campaign_steps ADD CONSTRAINT test_campaign_steps_script_id_fkey
                        FOREIGN KEY (script_id) REFERENCES test_plan_scripts(id) ON DELETE SET NULL;
                EXCEPTION WHEN duplicate_object THEN NULL; END $$""",
                """CREATE TABLE IF NOT EXISTS remediation_plans (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    plan_number VARCHAR(30) UNIQUE,
                    campaign_id UUID NOT NULL REFERENCES test_campaigns(id) ON DELETE CASCADE,
                    owner_email VARCHAR(255),
                    owner_name VARCHAR(255),
                    status VARCHAR(20) DEFAULT 'new',
                    created_by_email VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS remediation_actions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    remediation_plan_id UUID NOT NULL REFERENCES remediation_plans(id) ON DELETE CASCADE,
                    campaign_step_id UUID REFERENCES test_campaign_steps(id) ON DELETE SET NULL,
                    title VARCHAR(500),
                    description TEXT,
                    criticality VARCHAR(20),
                    owner_email VARCHAR(255),
                    owner_name VARCHAR(255),
                    status VARCHAR(20) DEFAULT 'new',
                    comment TEXT,
                    task_id UUID,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",

                # Companies & Partners — real Contact/employee references instead of free text
                "ALTER TABLE companies ADD COLUMN IF NOT EXISTS main_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL",
                "ALTER TABLE companies ADD COLUMN IF NOT EXISTS assigned_to_email VARCHAR(255)",
                "ALTER TABLE partners ADD COLUMN IF NOT EXISTS main_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL",
                "ALTER TABLE partners ADD COLUMN IF NOT EXISTS assigned_to_email VARCHAR(255)",
                """CREATE TABLE IF NOT EXISTS partner_comments (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
                    author_email VARCHAR(255) NOT NULL,
                    author_name VARCHAR(255),
                    comment TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS partner_links (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
                    url TEXT NOT NULL,
                    title VARCHAR(500),
                    description TEXT,
                    added_by_email VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )""",

                # Sequential human-readable IDs: Company/Contact/Partner get internal_id,
                # Opportunity reuses its existing deal_id column.
                "CREATE SEQUENCE IF NOT EXISTS company_internal_id_seq",
                "CREATE SEQUENCE IF NOT EXISTS contact_internal_id_seq",
                "CREATE SEQUENCE IF NOT EXISTS partner_internal_id_seq",
                "CREATE SEQUENCE IF NOT EXISTS opportunity_deal_id_seq",

                "ALTER TABLE companies ADD COLUMN IF NOT EXISTS internal_id VARCHAR(20)",
                "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS internal_id VARCHAR(20)",
                "ALTER TABLE partners ADD COLUMN IF NOT EXISTS internal_id VARCHAR(20)",
                "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS contracting_party_id UUID REFERENCES companies(id) ON DELETE SET NULL",
                "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS assigned_to_email VARCHAR(255)",

                # Backfill existing rows (oldest first), then advance each sequence past the backfilled max
                """UPDATE companies SET internal_id = 'CMP-' || LPAD(t.rn::text, 5, '0')
                    FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn FROM companies WHERE internal_id IS NULL) t
                    WHERE companies.id = t.id""",
                "SELECT setval('company_internal_id_seq', GREATEST((SELECT COALESCE(MAX(SUBSTRING(internal_id FROM 5)::int), 0) FROM companies), 1))",

                """UPDATE contacts SET internal_id = 'CNT-' || LPAD(t.rn::text, 5, '0')
                    FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn FROM contacts WHERE internal_id IS NULL) t
                    WHERE contacts.id = t.id""",
                "SELECT setval('contact_internal_id_seq', GREATEST((SELECT COALESCE(MAX(SUBSTRING(internal_id FROM 5)::int), 0) FROM contacts), 1))",

                """UPDATE partners SET internal_id = 'PTN-' || LPAD(t.rn::text, 5, '0')
                    FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn FROM partners WHERE internal_id IS NULL) t
                    WHERE partners.id = t.id""",
                "SELECT setval('partner_internal_id_seq', GREATEST((SELECT COALESCE(MAX(SUBSTRING(internal_id FROM 5)::int), 0) FROM partners), 1))",

                # Only backfill NULL deal_ids — pre-existing hand-typed values (e.g. "S001") are left as-is
                """UPDATE opportunities SET deal_id = 'OPP-' || LPAD(t.rn::text, 5, '0')
                    FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn FROM opportunities WHERE deal_id IS NULL) t
                    WHERE opportunities.id = t.id""",
                "SELECT setval('opportunity_deal_id_seq', GREATEST((SELECT COALESCE(MAX(SUBSTRING(deal_id FROM 5)::int), 0) FROM opportunities WHERE deal_id ~ '^OPP-[0-9]+$'), 1))",

                "CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_internal_id ON companies(internal_id)",
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_internal_id ON contacts(internal_id)",
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_internal_id ON partners(internal_id)",
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_deal_id ON opportunities(deal_id)",

                # ─── Finance module: Contract Lifecycle Management, Purchasing, Supplier Invoicing ──
                "CREATE SEQUENCE IF NOT EXISTS finance_supplier_id_seq",
                "CREATE SEQUENCE IF NOT EXISTS finance_contract_id_seq",
                "CREATE SEQUENCE IF NOT EXISTS finance_po_id_seq",
                "CREATE SEQUENCE IF NOT EXISTS finance_invoice_id_seq",

                """CREATE TABLE IF NOT EXISTS finance_suppliers (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    internal_id VARCHAR(20) UNIQUE,
                    name VARCHAR(255) NOT NULL,
                    contact_name VARCHAR(255), email VARCHAR(255), phone VARCHAR(50),
                    sector VARCHAR(255), country VARCHAR(100),
                    status VARCHAR(20) DEFAULT 'active',
                    assigned_to VARCHAR(255), assigned_to_email VARCHAR(255),
                    notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
                )""",

                """CREATE TABLE IF NOT EXISTS finance_contracts (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    internal_id VARCHAR(20) UNIQUE,
                    supplier_id UUID NOT NULL REFERENCES finance_suppliers(id) ON DELETE RESTRICT,
                    contract_name VARCHAR(500) NOT NULL,
                    start_date DATE NOT NULL, end_date DATE,
                    contract_value FLOAT,
                    status VARCHAR(20) DEFAULT 'active',
                    assigned_to VARCHAR(255), assigned_to_email VARCHAR(255),
                    notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
                )""",

                """CREATE TABLE IF NOT EXISTS finance_contract_documents (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    contract_id UUID NOT NULL REFERENCES finance_contracts(id) ON DELETE CASCADE,
                    filename VARCHAR(500), file_url TEXT,
                    uploaded_by_email VARCHAR(255), uploaded_at TIMESTAMP DEFAULT NOW()
                )""",

                """CREATE TABLE IF NOT EXISTS finance_purchase_orders (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    internal_id VARCHAR(20) UNIQUE,
                    supplier_id UUID NOT NULL REFERENCES finance_suppliers(id) ON DELETE RESTRICT,
                    contract_id UUID REFERENCES finance_contracts(id) ON DELETE SET NULL,
                    description VARCHAR(500), amount FLOAT,
                    order_date DATE, expected_delivery_date DATE,
                    status VARCHAR(20) DEFAULT 'draft',
                    assigned_to VARCHAR(255), assigned_to_email VARCHAR(255),
                    notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
                )""",

                """CREATE TABLE IF NOT EXISTS finance_invoices (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    internal_id VARCHAR(20) UNIQUE,
                    supplier_id UUID NOT NULL REFERENCES finance_suppliers(id) ON DELETE RESTRICT,
                    purchase_order_id UUID REFERENCES finance_purchase_orders(id) ON DELETE SET NULL,
                    invoice_number VARCHAR(100),
                    amount FLOAT, invoice_date DATE, due_date DATE,
                    approval_status VARCHAR(20) DEFAULT 'pending',
                    approver_email VARCHAR(255), approver_name VARCHAR(255),
                    approved_by_email VARCHAR(255), approved_at TIMESTAMP, approval_comment TEXT,
                    notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
                )""",

                "CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_suppliers_internal_id ON finance_suppliers(internal_id)",
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_contracts_internal_id ON finance_contracts(internal_id)",
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_po_internal_id ON finance_purchase_orders(internal_id)",
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_invoices_internal_id ON finance_invoices(internal_id)",

                "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS assigned_to_email VARCHAR(255)",

                # Opportunity — manually-curated SharePoint folder/file links, each with a description
                """CREATE TABLE IF NOT EXISTS opportunity_links (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
                    url TEXT NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",

                # RFP tracking, auto-created from an Opportunity when its status flips to
                # "RFP Ongoing" — ADD VALUE must be its own statement (can't run inside a
                # transaction that also uses the new value), which this migration runner already
                # guarantees since every string here gets its own execute+commit. No "IF NOT
                # EXISTS" (unsupported in some Postgres versions/contexts — silently swallowed
                # by this runner's per-statement try/except, leaving the value never added);
                # re-running this after the value already exists is caught the same way instead.
                "ALTER TYPE deal_status_enum ADD VALUE 'RFP Ongoing'",

                """CREATE TABLE IF NOT EXISTS rfps (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(500) NOT NULL,
                    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
                    partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
                    owner_email VARCHAR(255),
                    owner VARCHAR(255),
                    approvers JSONB DEFAULT '[]',
                    documents_folder_url TEXT,
                    status VARCHAR(20) DEFAULT 'Open',
                    ai_summary TEXT,
                    key_dates JSONB DEFAULT '[]',
                    analysis_status VARCHAR(20) DEFAULT 'pending',
                    analysis_error TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",

                """CREATE TABLE IF NOT EXISTS rfp_opportunities (
                    rfp_id UUID REFERENCES rfps(id) ON DELETE CASCADE,
                    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE
                )""",

                """CREATE TABLE IF NOT EXISTS rfp_action_items (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    rfp_id UUID NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
                    description TEXT NOT NULL,
                    due_date TIMESTAMP,
                    owner_type VARCHAR(10),
                    owner_email VARCHAR(255),
                    owner_name VARCHAR(255),
                    owner_contact_id UUID,
                    task_id UUID,
                    status VARCHAR(20) DEFAULT 'pending',
                    position INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",

                """CREATE TABLE IF NOT EXISTS rfp_document_checklist (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    rfp_id UUID NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
                    name VARCHAR(500) NOT NULL,
                    template_url TEXT,
                    status VARCHAR(20) DEFAULT 'pending',
                    position INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )""",
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
_include("app.routers.rfp",            "/rfps",         "RFPs")
_include("app.routers.tasks",          "/tasks",        "Tasks")
_include("app.routers.partners",       "/partners",     "Partners")
_include("app.routers.marketing",      "/marketing",    "Marketing")
_include("app.routers.admin",          "/admin",        "Admin")
_include("app.routers.admin_ops",      "/admin",        "AdminOps")
_include("app.routers.microsoft",      "/microsoft",    "Microsoft")
_include("app.routers.ecs_control",    "/ecs",          "ECS")
_include("app.routers.settings",       "/settings",     "Settings")
_include("app.routers.hr",             "/hr",           "HR")
_include("app.routers.hr_checklists",  "/hr",           "HRChecklists")
_include("app.routers.grc",            "/grc",          "GRC")
_include("app.routers.grc_extended",   "/grc",          "GRCExt")
_include("app.routers.grc_access_review", "/grc",       "GRCAccessReview")
_include("app.routers.helpdesk",       "/helpdesk",     "Helpdesk")
_include("app.routers.helpdesk_teams", "/helpdesk",     "Teams")
_include("app.routers.admin_audit",    "/admin",        "Audit")
_include("app.routers.legal",          "/legal",        "Legal")
_include("app.routers.development",    "/development",  "Development")
_include("app.routers.testing",        "/development",  "Testing")
_include("app.routers.it",             "/it",           "IT")
_include("app.routers.cv",             "/cv",           "CV")
_include("app.routers.training",       "/training",     "Training")
_include("app.routers.task_manager",   "/task-manager", "TaskManager")
_include("app.routers.task_teams",     "/task-manager", "TaskTeams")
_include("app.routers.finance",        "/finance",      "Finance")

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

try:
    from app.routers.mcp_server import mcp_app as _mcp_app

    @app.on_event("startup")
    async def _start_mcp_session_manager():
        import asyncio
        asyncio.create_task(_hold_mcp_session_manager())

    async def _hold_mcp_session_manager():
        import asyncio
        # StreamableHTTPSessionManager.run() must stay entered for the app's lifetime — this app
        # still uses @app.on_event("startup") rather than a lifespan= context manager, so it's
        # held open here via a background task instead of the usual `async with ...: yield` pattern.
        async with _mcp_app.session_manager.run():
            await asyncio.Event().wait()

    app.mount("/", _mcp_app.streamable_http_app())
    print("✓ MCP")
except Exception as e:
    import traceback
    print(f"✗ ROUTER FAILED [MCP]: {e}")
    traceback.print_exc()
