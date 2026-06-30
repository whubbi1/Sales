from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db

router = APIRouter()


# ─── Legal Entities ──────────────────────────────────────────────────────────

@router.get("/entities")
async def list_entities(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT e.id::text, e.legal_name, e.legal_address, e.country,
               e.registration_description, e.registration_value,
               e.created_at, e.created_by, e.updated_at, e.updated_by,
               COALESCE(
                   json_agg(
                       json_build_object(
                           'id', d.id::text,
                           'doc_type', d.doc_type,
                           'doc_label', d.doc_label,
                           'sharepoint_url', d.sharepoint_url,
                           'created_at', d.created_at
                       ) ORDER BY d.created_at
                   ) FILTER (WHERE d.id IS NOT NULL),
                   '[]'::json
               ) AS documents
        FROM legal_entities e
        LEFT JOIN legal_entity_documents d ON d.legal_entity_id = e.id
        GROUP BY e.id, e.legal_name, e.legal_address, e.country,
                 e.registration_description, e.registration_value,
                 e.created_at, e.created_by, e.updated_at, e.updated_by
        ORDER BY e.country, e.legal_name
    """))
    rows = r.fetchall()
    return {"entities": [dict(row._mapping) for row in rows]}


@router.post("/entities")
async def create_entity(data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        INSERT INTO legal_entities
            (id, legal_name, legal_address, country, registration_description,
             registration_value, created_by, created_at, updated_at)
        VALUES
            (gen_random_uuid(), :legal_name, :legal_address, :country,
             :registration_description, :registration_value, :created_by, NOW(), NOW())
        RETURNING id::text
    """), {
        "legal_name": data.get("legal_name", ""),
        "legal_address": data.get("legal_address", ""),
        "country": data.get("country", ""),
        "registration_description": data.get("registration_description", ""),
        "registration_value": data.get("registration_value", ""),
        "created_by": data.get("created_by", ""),
    })
    await db.commit()
    return {"id": r.fetchone()[0], "status": "created"}


@router.put("/entities/{entity_id}")
async def update_entity(entity_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE legal_entities SET
            legal_name = :legal_name,
            legal_address = :legal_address,
            country = :country,
            registration_description = :registration_description,
            registration_value = :registration_value,
            updated_by = :updated_by,
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": entity_id,
        "legal_name": data.get("legal_name", ""),
        "legal_address": data.get("legal_address", ""),
        "country": data.get("country", ""),
        "registration_description": data.get("registration_description", ""),
        "registration_value": data.get("registration_value", ""),
        "updated_by": data.get("updated_by", ""),
    })
    await db.commit()
    return {"status": "updated"}


@router.delete("/entities/{entity_id}")
async def delete_entity(entity_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text(
        "DELETE FROM legal_entity_documents WHERE legal_entity_id = CAST(:id AS UUID)"
    ), {"id": entity_id})
    await db.execute(text(
        "DELETE FROM legal_entities WHERE id = CAST(:id AS UUID)"
    ), {"id": entity_id})
    await db.commit()
    return {"status": "deleted"}


@router.post("/entities/{entity_id}/documents")
async def add_document(entity_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        INSERT INTO legal_entity_documents
            (id, legal_entity_id, doc_type, doc_label, sharepoint_url, created_by, created_at)
        VALUES
            (gen_random_uuid(), CAST(:entity_id AS UUID), :doc_type, :doc_label, :sharepoint_url, :created_by, NOW())
        RETURNING id::text
    """), {
        "entity_id": entity_id,
        "doc_type": data.get("doc_type", ""),
        "doc_label": data.get("doc_label", ""),
        "sharepoint_url": data.get("sharepoint_url", ""),
        "created_by": data.get("created_by", ""),
    })
    await db.commit()
    return {"id": r.fetchone()[0], "status": "created"}


@router.delete("/entities/{entity_id}/documents/{doc_id}")
async def delete_document(entity_id: str, doc_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        DELETE FROM legal_entity_documents
        WHERE id = CAST(:id AS UUID) AND legal_entity_id = CAST(:eid AS UUID)
    """), {"id": doc_id, "eid": entity_id})
    await db.commit()
    return {"status": "deleted"}


# ─── Legal Templates ─────────────────────────────────────────────────────────

@router.get("/templates")
async def list_templates(country: str = None, db: AsyncSession = Depends(get_db)):
    if country and country != "global":
        r = await db.execute(text("""
            SELECT id::text, title, description, doc_type, country, sharepoint_url, sort_order, created_at
            FROM legal_templates
            WHERE country = :country OR country = 'global'
            ORDER BY sort_order, title
        """), {"country": country})
    else:
        r = await db.execute(text("""
            SELECT id::text, title, description, doc_type, country, sharepoint_url, sort_order, created_at
            FROM legal_templates
            ORDER BY country, sort_order, title
        """))
    rows = r.fetchall()
    return {"templates": [dict(row._mapping) for row in rows]}


@router.post("/templates")
async def create_template(data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        INSERT INTO legal_templates
            (id, title, description, doc_type, country, sharepoint_url, sort_order, created_by, created_at, updated_at)
        VALUES
            (gen_random_uuid(), :title, :description, :doc_type, :country, :sharepoint_url, :sort_order, :created_by, NOW(), NOW())
        RETURNING id::text
    """), {
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "doc_type": data.get("doc_type", ""),
        "country": data.get("country", "global"),
        "sharepoint_url": data.get("sharepoint_url", ""),
        "sort_order": data.get("sort_order", 0),
        "created_by": data.get("created_by", ""),
    })
    await db.commit()
    return {"id": r.fetchone()[0], "status": "created"}


@router.put("/templates/{tmpl_id}")
async def update_template(tmpl_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE legal_templates SET
            title = :title, description = :description, doc_type = :doc_type,
            country = :country, sharepoint_url = :sharepoint_url,
            sort_order = :sort_order, updated_by = :updated_by, updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": tmpl_id,
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "doc_type": data.get("doc_type", ""),
        "country": data.get("country", "global"),
        "sharepoint_url": data.get("sharepoint_url", ""),
        "sort_order": data.get("sort_order", 0),
        "updated_by": data.get("updated_by", ""),
    })
    await db.commit()
    return {"status": "updated"}


@router.delete("/templates/{tmpl_id}")
async def delete_template(tmpl_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM legal_templates WHERE id = CAST(:id AS UUID)"), {"id": tmpl_id})
    await db.commit()
    return {"status": "deleted"}
