from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import json

router = APIRouter()


# ─── Doc Types (configurable) ────────────────────────────────────────────────

@router.get("/doc-types")
async def list_doc_types(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT id::text, label, label AS type_key, scope, sort_order FROM legal_doc_types ORDER BY sort_order, label"))
    return {"doc_types": [dict(row._mapping) for row in r.fetchall()]}


@router.post("/doc-types")
async def create_doc_type(data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        INSERT INTO legal_doc_types (id, label, scope, sort_order, created_at)
        VALUES (gen_random_uuid(), :label, :scope, :sort_order, NOW())
        RETURNING id::text
    """), {"label": data.get("label", ""), "scope": data.get("scope", "both"), "sort_order": data.get("sort_order", 99)})
    await db.commit()
    return {"id": r.fetchone()[0], "status": "created"}


@router.put("/doc-types/{dt_id}")
async def update_doc_type(dt_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE legal_doc_types SET label = :label, scope = :scope, sort_order = :sort_order
        WHERE id = CAST(:id AS UUID)
    """), {"id": dt_id, "label": data.get("label", ""), "scope": data.get("scope", "both"), "sort_order": data.get("sort_order", 99)})
    await db.commit()
    return {"status": "updated"}


@router.delete("/doc-types/{dt_id}")
async def delete_doc_type(dt_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM legal_doc_types WHERE id = CAST(:id AS UUID)"), {"id": dt_id})
    await db.commit()
    return {"status": "deleted"}


# ─── Legal Entities ──────────────────────────────────────────────────────────

@router.get("/entities")
async def list_entities(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT
            e.id::text, e.legal_name, e.street, e.postal_code, e.city, e.country,
            e.phone, e.email, e.created_at, e.created_by, e.updated_at, e.updated_by,
            COALESCE(
                (SELECT json_agg(json_build_object('id', r.id::text, 'reg_type', r.reg_type, 'reg_value', r.reg_value)
                        ORDER BY r.sort_order, r.created_at)
                 FROM legal_entity_registrations r WHERE r.entity_id = e.id),
                '[]'::json
            ) AS registrations,
            COALESCE(
                (SELECT json_agg(json_build_object('id', d.id::text, 'doc_type', d.doc_type, 'sharepoint_url', d.sharepoint_url)
                        ORDER BY d.created_at)
                 FROM legal_entity_documents d WHERE d.legal_entity_id = e.id),
                '[]'::json
            ) AS documents,
            COALESCE(
                (SELECT json_agg(json_build_object('id', w.id::text, 'label', w.label, 'url', w.url)
                        ORDER BY w.created_at)
                 FROM legal_entity_websites w WHERE w.entity_id = e.id),
                '[]'::json
            ) AS websites
        FROM legal_entities e
        ORDER BY e.country, e.legal_name
    """))
    return {"entities": [dict(row._mapping) for row in r.fetchall()]}


@router.post("/entities")
async def create_entity(data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        INSERT INTO legal_entities (id, legal_name, street, postal_code, city, country, created_by, created_at, updated_at)
        VALUES (gen_random_uuid(), :legal_name, :street, :postal_code, :city, :country, :created_by, NOW(), NOW())
        RETURNING id::text
    """), {
        "legal_name": data.get("legal_name", ""),
        "street":     data.get("street", ""),
        "postal_code": data.get("postal_code", ""),
        "city":       data.get("city", ""),
        "country":    data.get("country", ""),
        "created_by": data.get("created_by", ""),
    })
    await db.commit()
    return {"id": r.fetchone()[0], "status": "created"}


@router.put("/entities/{entity_id}")
async def update_entity(entity_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE legal_entities SET
            legal_name = :legal_name, street = :street, postal_code = :postal_code,
            city = :city, country = :country, phone = :phone, email = :email,
            updated_by = :updated_by, updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id":         entity_id,
        "legal_name": data.get("legal_name", ""),
        "street":     data.get("street", ""),
        "postal_code": data.get("postal_code", ""),
        "city":       data.get("city", ""),
        "country":    data.get("country", ""),
        "phone":      data.get("phone", "") or "",
        "email":      data.get("email", "") or "",
        "updated_by": data.get("updated_by", ""),
    })
    await db.commit()
    return {"status": "updated"}


@router.delete("/entities/{entity_id}")
async def delete_entity(entity_id: str, db: AsyncSession = Depends(get_db)):
    for tbl, col in [("legal_entity_registrations", "entity_id"),
                     ("legal_entity_websites", "entity_id"),
                     ("legal_entity_documents", "legal_entity_id")]:
        await db.execute(text(f"DELETE FROM {tbl} WHERE {col} = CAST(:id AS UUID)"), {"id": entity_id})
    await db.execute(text("DELETE FROM legal_entities WHERE id = CAST(:id AS UUID)"), {"id": entity_id})
    await db.commit()
    return {"status": "deleted"}


@router.post("/entities/{entity_id}/registrations")
async def add_entity_registration(entity_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        INSERT INTO legal_entity_registrations (id, entity_id, reg_type, reg_value, sort_order, created_by, created_at)
        VALUES (gen_random_uuid(), CAST(:eid AS UUID), :reg_type, :reg_value, :sort_order, :created_by, NOW())
        RETURNING id::text
    """), {
        "eid":        entity_id,
        "reg_type":   data.get("reg_type", ""),
        "reg_value":  data.get("reg_value", ""),
        "sort_order": data.get("sort_order", 0),
        "created_by": data.get("created_by", ""),
    })
    await db.commit()
    return {"id": r.fetchone()[0], "status": "created"}


@router.put("/entities/{entity_id}/registrations/{reg_id}")
async def update_entity_registration(entity_id: str, reg_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("UPDATE legal_entity_registrations SET reg_type=:reg_type, reg_value=:reg_value WHERE id=CAST(:id AS UUID) AND entity_id=CAST(:eid AS UUID)"),
        {"id": reg_id, "eid": entity_id, "reg_type": data.get("reg_type",""), "reg_value": data.get("reg_value","")})
    await db.commit(); return {"status": "updated"}


@router.delete("/entities/{entity_id}/registrations/{reg_id}")
async def delete_entity_registration(entity_id: str, reg_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM legal_entity_registrations WHERE id = CAST(:id AS UUID) AND entity_id = CAST(:eid AS UUID)"), {"id": reg_id, "eid": entity_id})
    await db.commit()
    return {"status": "deleted"}


@router.post("/entities/{entity_id}/documents")
async def add_entity_document(entity_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        INSERT INTO legal_entity_documents (id, legal_entity_id, doc_type, doc_label, sharepoint_url, created_by, created_at)
        VALUES (gen_random_uuid(), CAST(:eid AS UUID), :doc_type, '', :sharepoint_url, :created_by, NOW())
        RETURNING id::text
    """), {
        "eid":          entity_id,
        "doc_type":     data.get("doc_type", ""),
        "sharepoint_url": data.get("sharepoint_url", ""),
        "created_by":   data.get("created_by", ""),
    })
    await db.commit()
    return {"id": r.fetchone()[0], "status": "created"}


@router.put("/entities/{entity_id}/documents/{doc_id}")
async def update_entity_document(entity_id: str, doc_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("UPDATE legal_entity_documents SET doc_type=:doc_type, sharepoint_url=:sharepoint_url WHERE id=CAST(:id AS UUID) AND legal_entity_id=CAST(:eid AS UUID)"),
        {"id": doc_id, "eid": entity_id, "doc_type": data.get("doc_type",""), "sharepoint_url": data.get("sharepoint_url","")})
    await db.commit(); return {"status": "updated"}


@router.delete("/entities/{entity_id}/documents/{doc_id}")
async def delete_entity_document(entity_id: str, doc_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM legal_entity_documents WHERE id = CAST(:id AS UUID) AND legal_entity_id = CAST(:eid AS UUID)"), {"id": doc_id, "eid": entity_id})
    await db.commit()
    return {"status": "deleted"}


@router.post("/entities/{entity_id}/websites")
async def add_entity_website(entity_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        INSERT INTO legal_entity_websites (id, entity_id, label, url, created_by, created_at)
        VALUES (gen_random_uuid(), CAST(:eid AS UUID), :label, :url, :created_by, NOW())
        RETURNING id::text
    """), {
        "eid":        entity_id,
        "label":      data.get("label", ""),
        "url":        data.get("url", ""),
        "created_by": data.get("created_by", ""),
    })
    await db.commit()
    return {"id": r.fetchone()[0], "status": "created"}


@router.put("/entities/{entity_id}/websites/{web_id}")
async def update_entity_website(entity_id: str, web_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("UPDATE legal_entity_websites SET label=:label, url=:url WHERE id=CAST(:id AS UUID) AND entity_id=CAST(:eid AS UUID)"),
        {"id": web_id, "eid": entity_id, "label": data.get("label",""), "url": data.get("url","")})
    await db.commit(); return {"status": "updated"}


@router.delete("/entities/{entity_id}/websites/{web_id}")
async def delete_entity_website(entity_id: str, web_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM legal_entity_websites WHERE id = CAST(:id AS UUID) AND entity_id = CAST(:eid AS UUID)"), {"id": web_id, "eid": entity_id})
    await db.commit()
    return {"status": "deleted"}


# ─── Legal Locations ─────────────────────────────────────────────────────────

@router.get("/locations")
async def list_locations(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT
            l.id::text, l.location_name, l.street, l.postal_code, l.city, l.country,
            l.phone, l.email, l.created_at, l.created_by, l.updated_at, l.updated_by,
            COALESCE(
                (SELECT json_agg(json_build_object('id', r.id::text, 'reg_type', r.reg_type, 'reg_value', r.reg_value)
                        ORDER BY r.created_at)
                 FROM legal_location_registrations r WHERE r.location_id = l.id),
                '[]'::json
            ) AS registrations,
            COALESCE(
                (SELECT json_agg(json_build_object('id', d.id::text, 'doc_type', d.doc_type, 'sharepoint_url', d.sharepoint_url)
                        ORDER BY d.created_at)
                 FROM legal_location_documents d WHERE d.location_id = l.id),
                '[]'::json
            ) AS documents,
            COALESCE(
                (SELECT json_agg(json_build_object('id', w.id::text, 'label', w.label, 'url', w.url)
                        ORDER BY w.created_at)
                 FROM legal_location_websites w WHERE w.location_id = l.id),
                '[]'::json
            ) AS websites
        FROM legal_locations l
        ORDER BY l.country, l.location_name
    """))
    return {"locations": [dict(row._mapping) for row in r.fetchall()]}


@router.post("/locations")
async def create_location(data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        INSERT INTO legal_locations (id, location_name, street, postal_code, city, country, created_by, created_at, updated_at)
        VALUES (gen_random_uuid(), :location_name, :street, :postal_code, :city, :country, :created_by, NOW(), NOW())
        RETURNING id::text
    """), {
        "location_name": data.get("location_name", ""),
        "street":        data.get("street", ""),
        "postal_code":   data.get("postal_code", ""),
        "city":          data.get("city", ""),
        "country":       data.get("country", ""),
        "created_by":    data.get("created_by", ""),
    })
    await db.commit()
    return {"id": r.fetchone()[0], "status": "created"}


@router.put("/locations/{loc_id}")
async def update_location(loc_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE legal_locations SET
            location_name = :location_name, street = :street, postal_code = :postal_code,
            city = :city, country = :country, phone = :phone, email = :email,
            updated_by = :updated_by, updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id":            loc_id,
        "location_name": data.get("location_name", ""),
        "street":        data.get("street", ""),
        "postal_code":   data.get("postal_code", ""),
        "city":          data.get("city", ""),
        "country":       data.get("country", ""),
        "phone":         data.get("phone", "") or "",
        "email":         data.get("email", "") or "",
        "updated_by":    data.get("updated_by", ""),
    })
    await db.commit()
    return {"status": "updated"}


@router.delete("/locations/{loc_id}")
async def delete_location(loc_id: str, db: AsyncSession = Depends(get_db)):
    for tbl, col in [("legal_location_registrations", "location_id"),
                     ("legal_location_websites", "location_id"),
                     ("legal_location_documents", "location_id")]:
        await db.execute(text(f"DELETE FROM {tbl} WHERE {col} = CAST(:id AS UUID)"), {"id": loc_id})
    await db.execute(text("DELETE FROM legal_locations WHERE id = CAST(:id AS UUID)"), {"id": loc_id})
    await db.commit()
    return {"status": "deleted"}


@router.post("/locations/{loc_id}/registrations")
async def add_location_registration(loc_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        INSERT INTO legal_location_registrations (id, location_id, reg_type, reg_value, created_by, created_at)
        VALUES (gen_random_uuid(), CAST(:lid AS UUID), :reg_type, :reg_value, :created_by, NOW())
        RETURNING id::text
    """), {"lid": loc_id, "reg_type": data.get("reg_type", ""), "reg_value": data.get("reg_value", ""), "created_by": data.get("created_by", "")})
    await db.commit()
    return {"id": r.fetchone()[0], "status": "created"}


@router.put("/locations/{loc_id}/registrations/{reg_id}")
async def update_location_registration(loc_id: str, reg_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("UPDATE legal_location_registrations SET reg_type=:reg_type, reg_value=:reg_value WHERE id=CAST(:id AS UUID) AND location_id=CAST(:lid AS UUID)"),
        {"id": reg_id, "lid": loc_id, "reg_type": data.get("reg_type",""), "reg_value": data.get("reg_value","")})
    await db.commit(); return {"status": "updated"}


@router.delete("/locations/{loc_id}/registrations/{reg_id}")
async def delete_location_registration(loc_id: str, reg_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM legal_location_registrations WHERE id = CAST(:id AS UUID) AND location_id = CAST(:lid AS UUID)"), {"id": reg_id, "lid": loc_id})
    await db.commit()
    return {"status": "deleted"}


@router.post("/locations/{loc_id}/documents")
async def add_location_document(loc_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        INSERT INTO legal_location_documents (id, location_id, doc_type, sharepoint_url, created_by, created_at)
        VALUES (gen_random_uuid(), CAST(:lid AS UUID), :doc_type, :sharepoint_url, :created_by, NOW())
        RETURNING id::text
    """), {"lid": loc_id, "doc_type": data.get("doc_type", ""), "sharepoint_url": data.get("sharepoint_url", ""), "created_by": data.get("created_by", "")})
    await db.commit()
    return {"id": r.fetchone()[0], "status": "created"}


@router.put("/locations/{loc_id}/documents/{doc_id}")
async def update_location_document(loc_id: str, doc_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("UPDATE legal_location_documents SET doc_type=:doc_type, sharepoint_url=:sharepoint_url WHERE id=CAST(:id AS UUID) AND location_id=CAST(:lid AS UUID)"),
        {"id": doc_id, "lid": loc_id, "doc_type": data.get("doc_type",""), "sharepoint_url": data.get("sharepoint_url","")})
    await db.commit(); return {"status": "updated"}


@router.delete("/locations/{loc_id}/documents/{doc_id}")
async def delete_location_document(loc_id: str, doc_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM legal_location_documents WHERE id = CAST(:id AS UUID) AND location_id = CAST(:lid AS UUID)"), {"id": doc_id, "lid": loc_id})
    await db.commit()
    return {"status": "deleted"}


@router.post("/locations/{loc_id}/websites")
async def add_location_website(loc_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        INSERT INTO legal_location_websites (id, location_id, label, url, created_by, created_at)
        VALUES (gen_random_uuid(), CAST(:lid AS UUID), :label, :url, :created_by, NOW())
        RETURNING id::text
    """), {"lid": loc_id, "label": data.get("label", ""), "url": data.get("url", ""), "created_by": data.get("created_by", "")})
    await db.commit()
    return {"id": r.fetchone()[0], "status": "created"}


@router.put("/locations/{loc_id}/websites/{web_id}")
async def update_location_website(loc_id: str, web_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("UPDATE legal_location_websites SET label=:label, url=:url WHERE id=CAST(:id AS UUID) AND location_id=CAST(:lid AS UUID)"),
        {"id": web_id, "lid": loc_id, "label": data.get("label",""), "url": data.get("url","")})
    await db.commit(); return {"status": "updated"}


@router.delete("/locations/{loc_id}/websites/{web_id}")
async def delete_location_website(loc_id: str, web_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM legal_location_websites WHERE id = CAST(:id AS UUID) AND location_id = CAST(:lid AS UUID)"), {"id": web_id, "lid": loc_id})
    await db.commit()
    return {"status": "deleted"}


# ─── Legal Templates ─────────────────────────────────────────────────────────

@router.get("/templates")
async def list_templates(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT lt.id::text, lt.title, lt.description, lt.doc_type,
               lt.all_entities, lt.entity_ids, lt.entity_names,
               lt.sharepoint_url, lt.sort_order, lt.created_at
        FROM legal_templates lt
        ORDER BY lt.title
    """))
    return {"templates": [dict(row._mapping) for row in r.fetchall()]}


@router.post("/templates")
async def create_template(data: dict, db: AsyncSession = Depends(get_db)):
    all_entities = data.get("all_entities")
    if all_entities is None:
        all_entities = not data.get("entity_ids")
    r = await db.execute(text("""
        INSERT INTO legal_templates (id, title, description, doc_type, all_entities, entity_ids, entity_names,
                                      sharepoint_url, sort_order, created_by, created_at, updated_at)
        VALUES (gen_random_uuid(), :title, :description, :doc_type, :all_entities,
                CAST(:entity_ids AS JSONB), CAST(:entity_names AS JSONB), :sharepoint_url, :sort_order, :created_by, NOW(), NOW())
        RETURNING id::text
    """), {
        "title": data.get("title", ""), "description": data.get("description", ""),
        "doc_type": data.get("doc_type", ""),
        "all_entities": bool(all_entities),
        "entity_ids": json.dumps(data.get("entity_ids") or []),
        "entity_names": json.dumps(data.get("entity_names") or []),
        "sharepoint_url": data.get("sharepoint_url", ""), "sort_order": data.get("sort_order", 0),
        "created_by": data.get("created_by", ""),
    })
    await db.commit()
    return {"id": r.fetchone()[0], "status": "created"}


@router.put("/templates/{tmpl_id}")
async def update_template(tmpl_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    all_entities = data.get("all_entities")
    if all_entities is None:
        all_entities = not data.get("entity_ids")
    await db.execute(text("""
        UPDATE legal_templates SET
            title = :title, description = :description, doc_type = :doc_type,
            all_entities = :all_entities,
            entity_ids = CAST(:entity_ids AS JSONB),
            entity_names = CAST(:entity_names AS JSONB),
            sharepoint_url = :sharepoint_url,
            sort_order = :sort_order, updated_by = :updated_by, updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": tmpl_id, "title": data.get("title", ""), "description": data.get("description", ""),
        "doc_type": data.get("doc_type", ""),
        "all_entities": bool(all_entities),
        "entity_ids": json.dumps(data.get("entity_ids") or []),
        "entity_names": json.dumps(data.get("entity_names") or []),
        "sharepoint_url": data.get("sharepoint_url", ""), "sort_order": data.get("sort_order", 0),
        "updated_by": data.get("updated_by", ""),
    })
    await db.commit()
    return {"status": "updated"}


@router.delete("/templates/{tmpl_id}")
async def delete_template(tmpl_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM legal_templates WHERE id = CAST(:id AS UUID)"), {"id": tmpl_id})
    await db.commit()
    return {"status": "deleted"}
