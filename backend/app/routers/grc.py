from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from datetime import datetime
import uuid

router = APIRouter()

# ─── Default Frameworks ────────────────────────────────────────────────────────
DEFAULT_FRAMEWORKS = [
    {
        "name": "ISO 27001", "category": "security", "version": "2022",
        "description": "International standard for information security management systems (ISMS).",
        "controls": [
            ("A.5", "Organizational controls", [
                ("A.5.1", "Policies for information security"),
                ("A.5.2", "Information security roles and responsibilities"),
                ("A.5.3", "Segregation of duties"),
                ("A.5.8", "Information security in project management"),
            ]),
            ("A.6", "People controls", [
                ("A.6.1", "Screening"),
                ("A.6.2", "Terms and conditions of employment"),
                ("A.6.3", "Information security awareness and training"),
            ]),
            ("A.8", "Technological controls", [
                ("A.8.1", "User endpoint devices"),
                ("A.8.2", "Privileged access rights"),
                ("A.8.3", "Information access restriction"),
                ("A.8.5", "Secure authentication"),
                ("A.8.7", "Protection against malware"),
                ("A.8.12", "Data leakage prevention"),
            ]),
        ]
    },
    {
        "name": "GDPR", "category": "privacy", "version": "2018",
        "description": "General Data Protection Regulation — EU data privacy and security law.",
        "controls": [
            ("Chapter II", "Principles", [
                ("Art.5", "Principles relating to processing of personal data"),
                ("Art.6", "Lawfulness of processing"),
                ("Art.7", "Conditions for consent"),
            ]),
            ("Chapter III", "Rights of the data subject", [
                ("Art.12", "Transparent information and communication"),
                ("Art.13", "Information to be provided on collection"),
                ("Art.17", "Right to erasure"),
                ("Art.20", "Right to data portability"),
            ]),
            ("Chapter IV", "Controller and processor", [
                ("Art.24", "Responsibility of the controller"),
                ("Art.25", "Data protection by design and by default"),
                ("Art.32", "Security of processing"),
                ("Art.33", "Notification of personal data breach"),
            ]),
        ]
    },
    {
        "name": "SOC 2", "category": "security", "version": "Type II",
        "description": "Service Organization Control 2 — security, availability, and confidentiality.",
        "controls": [
            ("CC1", "Control Environment", [
                ("CC1.1", "COSO Principle 1: Demonstrates commitment to integrity"),
                ("CC1.2", "COSO Principle 2: Board independence"),
                ("CC1.3", "COSO Principle 3: Management oversight"),
            ]),
            ("CC6", "Logical and Physical Access Controls", [
                ("CC6.1", "Logical access security measures"),
                ("CC6.2", "Prior to issuing system credentials"),
                ("CC6.3", "Role-based access control"),
                ("CC6.6", "Logical access security from outside boundaries"),
            ]),
            ("CC7", "System Operations", [
                ("CC7.1", "Detection and monitoring procedures"),
                ("CC7.2", "Monitor system components for anomalies"),
                ("CC7.3", "Evaluate security events"),
            ]),
        ]
    },
    {
        "name": "NIS2", "category": "security", "version": "2022",
        "description": "EU Network and Information Security Directive — cybersecurity requirements.",
        "controls": [
            ("Art.21", "Cybersecurity risk-management measures", [
                ("Art.21.2.a", "Policies on risk analysis and information system security"),
                ("Art.21.2.b", "Incident handling"),
                ("Art.21.2.c", "Business continuity and crisis management"),
                ("Art.21.2.d", "Supply chain security"),
                ("Art.21.2.e", "Security in network and information systems acquisition"),
                ("Art.21.2.h", "Human resources security, access control and asset management"),
                ("Art.21.2.i", "Use of multi-factor authentication"),
            ]),
            ("Art.23", "Reporting obligations", [
                ("Art.23.1", "Notification of significant incidents"),
                ("Art.23.4", "Early warning within 24 hours"),
            ]),
        ]
    },
]

async def seed_grc(db: AsyncSession):
    count = await db.execute(text("SELECT COUNT(*) FROM grc_frameworks"))
    if count.scalar() > 0:
        return
    for fw in DEFAULT_FRAMEWORKS:
        fw_id = str(uuid.uuid4())
        await db.execute(text("""
            INSERT INTO grc_frameworks (id, name, description, category, version, active, created_at)
            VALUES (:id::uuid, :name, :description, :category, :version, true, NOW())
        """), {"id": fw_id, "name": fw["name"], "description": fw["description"],
               "category": fw["category"], "version": fw["version"]})
        for section_id, section_name, controls in fw["controls"]:
            for ctrl_id, ctrl_title in controls:
                await db.execute(text("""
                    INSERT INTO grc_controls (id, framework_id, control_id, title, category, status, created_at, updated_at)
                    VALUES (gen_random_uuid(), :fw_id::uuid, :ctrl_id, :title, :category, 'not_started', NOW(), NOW())
                """), {"fw_id": fw_id, "ctrl_id": ctrl_id, "title": ctrl_title, "category": section_name})
    await db.commit()

# ─── Dashboard ────────────────────────────────────────────────────────────────
@router.get("/dashboard")
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    await seed_grc(db)

    # Frameworks compliance overview
    frameworks = await db.execute(text("""
        SELECT f.id, f.name, f.category, f.version,
               COUNT(c.id) as total_controls,
               SUM(CASE WHEN c.status = 'compliant' THEN 1 ELSE 0 END) as compliant,
               SUM(CASE WHEN c.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
               SUM(CASE WHEN c.status = 'not_started' THEN 1 ELSE 0 END) as not_started,
               SUM(CASE WHEN c.status = 'not_applicable' THEN 1 ELSE 0 END) as not_applicable
        FROM grc_frameworks f
        LEFT JOIN grc_controls c ON c.framework_id = f.id
        WHERE f.active = true
        GROUP BY f.id, f.name, f.category, f.version
        ORDER BY f.name
    """))
    fw_list = [dict(r._mapping) for r in frameworks.fetchall()]
    for fw in fw_list:
        applicable = fw["total_controls"] - fw["not_applicable"]
        fw["compliance_pct"] = round((fw["compliant"] / applicable * 100) if applicable > 0 else 0, 1)
        fw["id"] = str(fw["id"])

    # Risk summary
    risks = await db.execute(text("""
        SELECT status, COUNT(*) as count,
               AVG(probability * impact) as avg_score
        FROM grc_risks GROUP BY status
    """))
    risk_summary = {r.status: {"count": r.count, "avg_score": round(r.avg_score or 0, 1)} for r in risks.fetchall()}

    high_risks = await db.execute(text("""
        SELECT id, title, category, probability, impact, status, owner_name
        FROM grc_risks WHERE probability * impact >= 12 AND status IN ('open','mitigated')
        ORDER BY probability * impact DESC LIMIT 5
    """))

    # Audit summary
    audits = await db.execute(text("""
        SELECT status, COUNT(*) as count FROM grc_audits GROUP BY status
    """))
    audit_summary = {r.status: r.count for r in audits.fetchall()}

    upcoming_audits = await db.execute(text("""
        SELECT id, title, audit_type, status, start_date, end_date, auditor_name
        FROM grc_audits WHERE status IN ('planned','in_progress')
        ORDER BY start_date ASC LIMIT 5
    """))

    return {
        "frameworks": fw_list,
        "risks": {
            "summary": risk_summary,
            "total": sum(v["count"] for v in risk_summary.values()),
            "high_risks": [dict(r._mapping) for r in high_risks.fetchall()]
        },
        "audits": {
            "summary": audit_summary,
            "total": sum(audit_summary.values()),
            "upcoming": [dict(r._mapping) for r in upcoming_audits.fetchall()]
        }
    }

# ─── Frameworks ───────────────────────────────────────────────────────────────
@router.get("/frameworks")
async def list_frameworks(db: AsyncSession = Depends(get_db)):
    await seed_grc(db)
    result = await db.execute(text("""
        SELECT f.*, COUNT(c.id) as total_controls,
               SUM(CASE WHEN c.status='compliant' THEN 1 ELSE 0 END) as compliant_controls
        FROM grc_frameworks f LEFT JOIN grc_controls c ON c.framework_id = f.id
        WHERE f.active = true GROUP BY f.id ORDER BY f.name
    """))
    frameworks = []
    for r in result.fetchall():
        fw = dict(r._mapping)
        fw["id"] = str(fw["id"])
        applicable = fw["total_controls"] - 0
        fw["compliance_pct"] = round((fw["compliant_controls"] / applicable * 100) if applicable > 0 else 0, 1)
        frameworks.append(fw)
    return {"frameworks": frameworks}

@router.get("/frameworks/{framework_id}/controls")
async def get_framework_controls(framework_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT * FROM grc_controls WHERE framework_id = :id::uuid ORDER BY control_id
    """), {"id": framework_id})
    controls = [dict(r._mapping) for r in result.fetchall()]
    for c in controls:
        c["id"] = str(c["id"])
        c["framework_id"] = str(c["framework_id"])
    fw = await db.execute(text("SELECT * FROM grc_frameworks WHERE id = :id::uuid"), {"id": framework_id})
    fw_row = fw.fetchone()
    return {"framework": dict(fw_row._mapping) if fw_row else {}, "controls": controls}

@router.put("/controls/{control_id}")
async def update_control(control_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE grc_controls SET
            status = COALESCE(:status, status),
            evidence = COALESCE(:evidence, evidence),
            owner_email = COALESCE(:owner_email, owner_email),
            owner_name = COALESCE(:owner_name, owner_name),
            updated_at = NOW()
        WHERE id = :id::uuid
    """), {**data, "id": control_id})
    await db.commit()
    return {"status": "ok"}

# ─── Risks ────────────────────────────────────────────────────────────────────
@router.get("/risks")
async def list_risks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT *, probability * impact as score FROM grc_risks ORDER BY score DESC, created_at DESC
    """))
    risks = [dict(r._mapping) for r in result.fetchall()]
    for r in risks:
        r["id"] = str(r["id"])
    return {"risks": risks}

@router.post("/risks")
async def create_risk(data: dict, db: AsyncSession = Depends(get_db)):
    risk_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO grc_risks (id, title, description, category, probability, impact, status, mitigation, owner_email, owner_name, created_at, updated_at)
        VALUES (:id::uuid, :title, :description, :category, :probability, :impact, :status, :mitigation, :owner_email, :owner_name, NOW(), NOW())
    """), {
        "id": risk_id, "title": data.get("title"), "description": data.get("description", ""),
        "category": data.get("category", "operational"), "probability": data.get("probability", 3),
        "impact": data.get("impact", 3), "status": data.get("status", "open"),
        "mitigation": data.get("mitigation", ""), "owner_email": data.get("owner_email", ""),
        "owner_name": data.get("owner_name", ""),
    })
    await db.commit()
    return {"status": "ok", "id": risk_id}

@router.put("/risks/{risk_id}")
async def update_risk(risk_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE grc_risks SET
            title = COALESCE(:title, title), description = COALESCE(:description, description),
            category = COALESCE(:category, category), probability = COALESCE(:probability, probability),
            impact = COALESCE(:impact, impact), status = COALESCE(:status, status),
            mitigation = COALESCE(:mitigation, mitigation), owner_name = COALESCE(:owner_name, owner_name),
            updated_at = NOW()
        WHERE id = :id::uuid
    """), {**data, "id": risk_id})
    await db.commit()
    return {"status": "ok"}

@router.delete("/risks/{risk_id}")
async def delete_risk(risk_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM grc_risks WHERE id = :id::uuid"), {"id": risk_id})
    await db.commit()
    return {"status": "ok"}

# ─── Audits ───────────────────────────────────────────────────────────────────
@router.get("/audits")
async def list_audits(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT a.*, COUNT(f.id) as findings_count
        FROM grc_audits a LEFT JOIN grc_findings f ON f.audit_id = a.id
        GROUP BY a.id ORDER BY a.created_at DESC
    """))
    audits = [dict(r._mapping) for r in result.fetchall()]
    for a in audits:
        a["id"] = str(a["id"])
    return {"audits": audits}

@router.post("/audits")
async def create_audit(data: dict, db: AsyncSession = Depends(get_db)):
    audit_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO grc_audits (id, title, audit_type, status, start_date, end_date, auditor_name, scope, created_at, updated_at)
        VALUES (:id::uuid, :title, :audit_type, :status, :start_date, :end_date, :auditor_name, :scope, NOW(), NOW())
    """), {
        "id": audit_id, "title": data.get("title"), "audit_type": data.get("audit_type", "internal"),
        "status": data.get("status", "planned"), "start_date": data.get("start_date"),
        "end_date": data.get("end_date"), "auditor_name": data.get("auditor_name", ""),
        "scope": data.get("scope", ""),
    })
    await db.commit()
    return {"status": "ok", "id": audit_id}

@router.get("/audits/{audit_id}")
async def get_audit(audit_id: str, db: AsyncSession = Depends(get_db)):
    audit = await db.execute(text("SELECT * FROM grc_audits WHERE id = :id::uuid"), {"id": audit_id})
    findings = await db.execute(text("SELECT * FROM grc_findings WHERE audit_id = :id::uuid ORDER BY created_at DESC"), {"id": audit_id})
    audit_row = audit.fetchone()
    return {"audit": dict(audit_row._mapping) if audit_row else {}, "findings": [dict(r._mapping) for r in findings.fetchall()]}

@router.post("/audits/{audit_id}/findings")
async def add_finding(audit_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        INSERT INTO grc_findings (id, audit_id, title, description, severity, status, corrective_action, owner_email, created_at)
        VALUES (gen_random_uuid(), :audit_id::uuid, :title, :description, :severity, 'open', :corrective_action, :owner_email, NOW())
    """), {
        "audit_id": audit_id, "title": data.get("title"), "description": data.get("description", ""),
        "severity": data.get("severity", "medium"), "corrective_action": data.get("corrective_action", ""),
        "owner_email": data.get("owner_email", ""),
    })
    await db.commit()
    return {"status": "ok"}
