from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import uuid, json, os

router = APIRouter()

FRAMEWORK_META = {
    "ISO 27001:2022": {"category":"security","version":"2022","color":"#156082","description":"Système de management de la sécurité de l'information (SMSI)"},
    "NIS 2":          {"category":"security","version":"2022","color":"#7C3AED","description":"Directive européenne sur la sécurité des réseaux et systèmes d'information"},
    "RGS":            {"category":"security","version":"2014","color":"#059669","description":"Référentiel Général de Sécurité (France, administrations publiques)"},
    "CRA":            {"category":"security","version":"2024","color":"#DC2626","description":"Cyber Resilience Act — Règlement européen sur les produits numériques"},
    "DORA":           {"category":"financial","version":"2025","color":"#D97706","description":"Digital Operational Resilience Act — Résilience numérique du secteur financier"},
    "ISO 27701:2019": {"category":"privacy","version":"2019","color":"#e97132","description":"Extension PIMS — Gestion des informations privées"},
    "ISO 27701:2025": {"category":"privacy","version":"2025","color":"#EA580C","description":"Version mise à jour du PIMS, publiée en 2025"},
    "HDS v2":         {"category":"health","version":"2","color":"#0891B2","description":"Hébergement de Données de Santé — Certification française"},
    "RGPD":           {"category":"privacy","version":"2018","color":"#4F46E5","description":"Règlement Général sur la Protection des Données — UE"},
    "PCI/DSS":        {"category":"financial","version":"4.0","color":"#B45309","description":"Payment Card Industry Data Security Standard"},
    "E-IDAS":         {"category":"identity","version":"2024","color":"#0D9488","description":"Règlement européen sur l'identité numérique et les services de confiance"},
    "PART-IS":        {"category":"aviation","version":"2023","color":"#6D28D9","description":"Sécurité de l'information dans l'aviation civile — EASA"},
    "NIST":           {"category":"security","version":"2.0","color":"#1D4ED8","description":"Cybersecurity Framework du NIST — États-Unis"},
    "ISO 42001":      {"category":"ai","version":"2023","color":"#7C3AED","description":"Système de management de l'intelligence artificielle"},
}

# ─── Frameworks ────────────────────────────────────────────────────────────────
@router.get("/frameworks")
async def list_frameworks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT f.id, f.name, f.description, f.category, f.version, f.color, f.active,
               COUNT(r.id) as total_requirements,
               COUNT(CASE WHEN r.status='compliant' THEN 1 END) as compliant_count
        FROM grc_frameworks f
        LEFT JOIN grc_requirements r ON r.framework_id = f.id
        GROUP BY f.id ORDER BY f.name
    """))
    rows = [dict(r._mapping) for r in result.fetchall()]
    for r in rows:
        r["id"] = str(r["id"])
        total = r["total_requirements"] or 0
        compliant = r["compliant_count"] or 0
        r["compliance_pct"] = round((compliant / total * 100)) if total > 0 else 0
    return {"frameworks": rows}

@router.get("/frameworks/{fw_id}/requirements")
async def get_framework_requirements(fw_id: str, db: AsyncSession = Depends(get_db)):
    fw = await db.execute(text("SELECT * FROM grc_frameworks WHERE id=CAST(:id AS UUID)"), {"id": fw_id})
    fw_row = fw.fetchone()
    if not fw_row: raise HTTPException(404)
    
    reqs = await db.execute(text("""
        SELECT r.*, d.name as document_name
        FROM grc_requirements r
        LEFT JOIN grc_documents d ON d.id = r.document_id
        WHERE r.framework_id = CAST(:fw_id AS UUID)
        ORDER BY d.name, r.requirement_text
    """), {"fw_id": fw_id})
    requirements = [dict(r._mapping) for r in reqs.fetchall()]
    for r in requirements:
        r["id"] = str(r["id"])
        r["framework_id"] = str(r["framework_id"])
        if r.get("document_id"): r["document_id"] = str(r["document_id"])
    return {"framework": dict(fw_row._mapping) | {"id": str(fw_row.id)}, "requirements": requirements}

@router.post("/frameworks/{fw_id}/requirements")
async def add_requirement(fw_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    req_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO grc_requirements (id, framework_id, document_id, requirement_text, reference_code, status, evidence, owner_email, created_at, updated_at)
        VALUES (CAST(:id AS UUID), CAST(:fw_id AS UUID), :doc_id, :text, :ref, :status, :evidence, :owner, NOW(), NOW())
    """), {
        "id": req_id, "fw_id": fw_id,
        "doc_id": data.get("document_id") or None,
        "text": data.get("requirement_text",""),
        "ref": data.get("reference_code",""),
        "status": data.get("status","not_started"),
        "evidence": data.get("evidence",""),
        "owner": data.get("owner_email",""),
    })
    await db.commit()
    return {"status": "ok", "id": req_id}

@router.put("/requirements/{req_id}")
async def update_requirement(req_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE grc_requirements SET
            requirement_text = COALESCE(:text, requirement_text),
            reference_code = COALESCE(:ref, reference_code),
            status = COALESCE(:status, status),
            evidence = COALESCE(:evidence, evidence),
            owner_email = COALESCE(:owner, owner_email),
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": req_id,
        "text": data.get("requirement_text"),
        "ref": data.get("reference_code"),
        "status": data.get("status"),
        "evidence": data.get("evidence"),
        "owner": data.get("owner_email"),
    })
    await db.commit()
    return {"status": "ok"}

@router.delete("/requirements/{req_id}")
async def delete_requirement(req_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM grc_requirement_mappings WHERE source_req_id=CAST(:id AS UUID) OR target_req_id=CAST(:id AS UUID)"), {"id": req_id})
    await db.execute(text("DELETE FROM grc_requirements WHERE id=CAST(:id AS UUID)"), {"id": req_id})
    await db.commit()
    return {"status": "ok"}

# ─── Documents ─────────────────────────────────────────────────────────────────
@router.get("/documents")
async def list_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT d.id, d.name, COUNT(r.id) as requirement_count
        FROM grc_documents d
        LEFT JOIN grc_requirements r ON r.document_id = d.id
        GROUP BY d.id ORDER BY d.name
    """))
    docs = [dict(r._mapping) for r in result.fetchall()]
    for d in docs: d["id"] = str(d["id"])
    return {"documents": docs}

@router.get("/documents/{doc_id}/requirements")
async def get_document_requirements(doc_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT r.*, f.name as framework_name, f.color as framework_color
        FROM grc_requirements r
        JOIN grc_frameworks f ON f.id = r.framework_id
        WHERE r.document_id = CAST(:doc_id AS UUID)
        ORDER BY f.name
    """), {"doc_id": doc_id})
    reqs = [dict(r._mapping) for r in result.fetchall()]
    for r in reqs:
        r["id"] = str(r["id"])
        r["framework_id"] = str(r["framework_id"])
    return {"requirements": reqs}

# ─── Mapping ───────────────────────────────────────────────────────────────────
@router.get("/mapping")
async def get_mapping(db: AsyncSession = Depends(get_db)):
    """Get full cross-framework mapping matrix"""
    result = await db.execute(text("""
        SELECT m.id, m.source_req_id, m.target_req_id, m.mapping_type, m.notes,
               sr.requirement_text as source_text, sr.reference_code as source_ref,
               sf.name as source_framework, sf.color as source_color,
               tr.requirement_text as target_text, tr.reference_code as target_ref,
               tf.name as target_framework, tf.color as target_color,
               sd.name as source_document, td.name as target_document
        FROM grc_requirement_mappings m
        JOIN grc_requirements sr ON sr.id = m.source_req_id
        JOIN grc_requirements tr ON tr.id = m.target_req_id
        JOIN grc_frameworks sf ON sf.id = sr.framework_id
        JOIN grc_frameworks tf ON tf.id = tr.framework_id
        LEFT JOIN grc_documents sd ON sd.id = sr.document_id
        LEFT JOIN grc_documents td ON td.id = tr.document_id
        ORDER BY sf.name, sd.name
    """))
    mappings = [dict(r._mapping) for r in result.fetchall()]
    for m in mappings:
        m["id"] = str(m["id"])
        m["source_req_id"] = str(m["source_req_id"])
        m["target_req_id"] = str(m["target_req_id"])
    return {"mappings": mappings}

@router.get("/mapping/document/{doc_id}")
async def get_document_mapping(doc_id: str, db: AsyncSession = Depends(get_db)):
    """Get all framework mappings for a specific document"""
    result = await db.execute(text("""
        SELECT f.name as framework_name, f.color, f.version,
               r.id as req_id, r.requirement_text, r.reference_code, r.status
        FROM grc_requirements r
        JOIN grc_frameworks f ON f.id = r.framework_id
        WHERE r.document_id = CAST(:doc_id AS UUID)
        ORDER BY f.name
    """), {"doc_id": doc_id})
    rows = [dict(r._mapping) for r in result.fetchall()]
    for r in rows: r["req_id"] = str(r["req_id"])
    return {"frameworks": rows}

@router.post("/mapping")
async def create_mapping(data: dict, db: AsyncSession = Depends(get_db)):
    mapping_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO grc_requirement_mappings (id, source_req_id, target_req_id, mapping_type, notes, created_at)
        VALUES (CAST(:id AS UUID), CAST(:src AS UUID), CAST(:tgt AS UUID), :mtype, :notes, NOW())
        ON CONFLICT (source_req_id, target_req_id) DO UPDATE SET
            mapping_type = EXCLUDED.mapping_type, notes = EXCLUDED.notes
    """), {
        "id": mapping_id,
        "src": data["source_req_id"],
        "tgt": data["target_req_id"],
        "mtype": data.get("mapping_type","related"),
        "notes": data.get("notes",""),
    })
    await db.commit()
    return {"status": "ok", "id": mapping_id}

@router.delete("/mapping/{mapping_id}")
async def delete_mapping(mapping_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM grc_requirement_mappings WHERE id=CAST(:id AS UUID)"), {"id": mapping_id})
    await db.commit()
    return {"status": "ok"}

# ─── Seeder ────────────────────────────────────────────────────────────────────
@router.post("/seed")
async def seed_frameworks(db: AsyncSession = Depends(get_db)):
    """Seed all 14 frameworks + 67 documents + requirements from Excel mapping"""
    import openpyxl

    # Check if already seeded
    r = await db.execute(text("SELECT COUNT(*) FROM grc_frameworks"))
    if r.scalar() >= 14:
        return {"status": "already_seeded", "message": "Frameworks already seeded"}

    xlsx_path = "/app/data/DOCS_PAR_NORMES_FINAL.xlsx"
    if not os.path.exists(xlsx_path):
        # Try fallback path
        xlsx_path = "/tmp/DOCS_PAR_NORMES_FINAL.xlsx"
    
    if not os.path.exists(xlsx_path):
        # Seed with framework metadata only (no Excel)
        return await seed_frameworks_only(db)

    wb = openpyxl.load_workbook(xlsx_path, read_only=True)
    ws = wb["Mapping documentaire"]
    rows = list(ws.iter_rows(values_only=True))
    headers = list(rows[0])
    frameworks_row = headers[1:]

    # Create frameworks
    fw_ids = {}
    for fw_name, meta in FRAMEWORK_META.items():
        fw_id = str(uuid.uuid4())
        await db.execute(text("""
            INSERT INTO grc_frameworks (id, name, description, category, version, color, active, created_at)
            VALUES (CAST(:id AS UUID), :name, :desc, :cat, :ver, :color, true, NOW())
            ON CONFLICT DO NOTHING
        """), {"id": fw_id, "name": fw_name, "desc": meta["description"],
               "cat": meta["category"], "ver": meta["version"], "color": meta["color"]})
        fw_ids[fw_name] = fw_id
    await db.commit()

    # Re-fetch actual IDs
    result = await db.execute(text("SELECT id, name FROM grc_frameworks"))
    fw_ids = {r.name: str(r.id) for r in result.fetchall()}

    # Create documents and requirements
    doc_ids = {}
    req_count = 0
    for row in rows[1:]:
        if not row[0] or str(row[0]).strip() == '': continue
        doc_name = str(row[0]).strip().replace('\n', ' ').replace('    ', ' ')
        if len(doc_name) < 3: continue

        # Create document
        if doc_name not in doc_ids:
            doc_id = str(uuid.uuid4())
            await db.execute(text("""
                INSERT INTO grc_documents (id, name, created_at)
                VALUES (CAST(:id AS UUID), :name, NOW()) ON CONFLICT DO NOTHING
            """), {"id": doc_id, "name": doc_name})
            doc_ids[doc_name] = doc_id
        
        doc_id = doc_ids[doc_name]

        # Create requirements per framework
        for i, fw_name in enumerate(frameworks_row):
            if fw_name not in fw_ids: continue
            val = row[i+1]
            if not val or str(val).strip() in ('', 'N/C'): continue
            
            req_text = str(val).strip()
            req_id = str(uuid.uuid4())
            await db.execute(text("""
                INSERT INTO grc_requirements (id, framework_id, document_id, requirement_text, status, created_at, updated_at)
                VALUES (CAST(:id AS UUID), CAST(:fw_id AS UUID), CAST(:doc_id AS UUID), :text, 'not_started', NOW(), NOW())
            """), {"id": req_id, "fw_id": fw_ids[fw_name], "doc_id": doc_id, "text": req_text})
            req_count += 1

    await db.commit()
    return {"status": "ok", "frameworks": len(fw_ids), "documents": len(doc_ids), "requirements": req_count}

async def seed_frameworks_only(db: AsyncSession):
    """Seed just the 14 framework records without requirements"""
    for fw_name, meta in FRAMEWORK_META.items():
        fw_id = str(uuid.uuid4())
        await db.execute(text("""
            INSERT INTO grc_frameworks (id, name, description, category, version, color, active, created_at)
            VALUES (CAST(:id AS UUID), :name, :desc, :cat, :ver, :color, true, NOW())
            ON CONFLICT DO NOTHING
        """), {"id": fw_id, "name": fw_name, "desc": meta["description"],
               "cat": meta["category"], "ver": meta["version"], "color": meta["color"]})
    await db.commit()
    return {"status": "ok", "frameworks": 14, "note": "Excel file not found, seeded frameworks only"}

# ─── Dashboard ─────────────────────────────────────────────────────────────────
@router.get("/dashboard")
async def grc_dashboard(db: AsyncSession = Depends(get_db)):
    fw_count = await db.execute(text("SELECT COUNT(*) FROM grc_frameworks"))
    req_count = await db.execute(text("SELECT COUNT(*) FROM grc_requirements"))
    compliant = await db.execute(text("SELECT COUNT(*) FROM grc_requirements WHERE status='compliant'"))
    risk_count = await db.execute(text("SELECT COUNT(*) FROM grc_risks WHERE status='open'"))
    audit_count = await db.execute(text("SELECT COUNT(*) FROM grc_audits WHERE status='planned'"))
    mapping_count = await db.execute(text("SELECT COUNT(*) FROM grc_requirement_mappings"))
    
    by_status = await db.execute(text("""
        SELECT status, COUNT(*) as count FROM grc_requirements GROUP BY status
    """))
    
    by_framework = await db.execute(text("""
        SELECT f.name, f.color, COUNT(r.id) as total,
               COUNT(CASE WHEN r.status='compliant' THEN 1 END) as compliant
        FROM grc_frameworks f
        LEFT JOIN grc_requirements r ON r.framework_id = f.id
        GROUP BY f.id ORDER BY f.name
    """))
    
    total_reqs = req_count.scalar() or 1
    compliant_reqs = compliant.scalar() or 0
    
    return {
        "stats": {
            "frameworks": fw_count.scalar(),
            "requirements": req_count.scalar(),
            "compliant": compliant_reqs,
            "compliance_pct": round(compliant_reqs/total_reqs*100),
            "open_risks": risk_count.scalar(),
            "planned_audits": audit_count.scalar(),
            "mappings": mapping_count.scalar(),
        },
        "by_status": {r.status: r.count for r in by_status.fetchall()},
        "by_framework": [{"name":r.name,"color":r.color,"total":r.total,"compliant":r.compliant,"pct":round((r.compliant/r.total*100) if r.total else 0)} for r in by_framework.fetchall()],
    }
