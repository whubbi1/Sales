# backend/app/routers/settings.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import httpx
import os
import base64
import json
from datetime import datetime

router = APIRouter()

TENANT_ID     = os.getenv("MS_TENANT_ID", "")
CLIENT_ID     = os.getenv("MS_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET", "")

# Modules & submodules definition
MODULES = {
    "sales":     ["companies", "contacts", "opportunities", "tasks", "cv_database"],
    "finance":   ["invoices", "budgets", "reports"],
    "hr":        ["freelancers", "recrutement", "positions", "jobs", "permissions", "chat", "admin", "onboarding", "offboarding"],
    "grc":       ["compliance", "risks", "audits", "certifications", "access_review", "tprm", "whistleblowing"],
    "it":        ["assets", "incidents", "access", "infrastructure"],
    "helpdesk":     ["tickets", "knowledge", "sla", "admin_cockpit"],
    "admin":        ["users", "permissions", "monitoring", "costs"],
    "legal":        ["entities", "templates", "admin"],
    "development":  ["general"],
    "training":     ["manager"],
    "tasks":        ["manager"],
}

LEGAL_ENTITIES = ["all", "france", "portugal", "czech_republic", "romania", "spain"]

async def get_ms_token() -> str:
    url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, data={
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "scope": "https://graph.microsoft.com/.default"
        })
        resp.raise_for_status()
        return resp.json()["access_token"]

async def graph_get(path: str, token: str = None) -> dict:
    if not token:
        token = await get_ms_token()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://graph.microsoft.com/v1.0{path}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15
        )
        if resp.status_code == 404:
            return {}
        resp.raise_for_status()
        return resp.json()


# ─── Sync user from Microsoft Graph ──────────────────────────────────────────
async def sync_user_from_ms(email: str, db: AsyncSession) -> dict:
    try:
        token = await get_ms_token()

        # Get user info
        user_data = await graph_get(f"/users/{email}?$select=id,displayName,givenName,surname,jobTitle,department,mobilePhone,businessPhones,mail", token)
        if not user_data:
            return {"error": f"User {email} not found in Microsoft"}

        # Get manager
        manager = {}
        try:
            mgr = await graph_get(f"/users/{email}/manager?$select=displayName,mail", token)
            manager = {"name": mgr.get("displayName", ""), "email": mgr.get("mail", "")}
        except Exception:
            pass

        # Get photo (base64)
        photo_b64 = None
        try:
            async with httpx.AsyncClient() as client:
                photo_resp = await client.get(
                    f"https://graph.microsoft.com/v1.0/users/{email}/photo/$value",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=10
                )
                if photo_resp.status_code == 200:
                    photo_b64 = "data:image/jpeg;base64," + base64.b64encode(photo_resp.content).decode()
        except Exception:
            pass

        # Get licenses
        licenses_data = await graph_get(f"/users/{email}/licenseDetails?$select=skuPartNumber", token)
        licenses = [l.get("skuPartNumber", "") for l in licenses_data.get("value", [])]

        # Get groups
        groups_data = await graph_get(f"/users/{email}/memberOf?$select=displayName,id", token)
        groups = [g.get("displayName", "") for g in groups_data.get("value", []) if g.get("@odata.type") in ["#microsoft.graph.group", None]]
        roles = [g.get("displayName", "") for g in groups_data.get("value", []) if g.get("@odata.type") == "#microsoft.graph.directoryRole"]

        profile = {
            "email": email,
            "first_name": user_data.get("givenName", ""),
            "last_name": user_data.get("surname", ""),
            "display_name": user_data.get("displayName", ""),
            "job_title": user_data.get("jobTitle", ""),
            "department": user_data.get("department", ""),
            "mobile_phone": user_data.get("mobilePhone", ""),
            "office_phone": (user_data.get("businessPhones") or [""])[0],
            "manager_email": manager.get("email", ""),
            "manager_name": manager.get("name", ""),
            "photo_url": photo_b64,
            "ms_user_id": user_data.get("id", ""),
            "ms_licenses": licenses,
            "ms_groups": groups,
            "ms_roles": roles,
            "last_sync": datetime.utcnow(),
        }

        # Upsert to DB
        await db.execute(text("""
            INSERT INTO user_profiles (id, email, first_name, last_name, display_name, job_title, department,
                mobile_phone, office_phone, manager_email, manager_name, photo_url, ms_user_id,
                ms_licenses, ms_groups, ms_roles, last_sync, created_at, updated_at)
            VALUES (gen_random_uuid(), :email, :first_name, :last_name, :display_name, :job_title, :department,
                :mobile_phone, :office_phone, :manager_email, :manager_name, :photo_url, :ms_user_id,
                CAST(:ms_licenses AS JSONB), CAST(:ms_groups AS JSONB), CAST(:ms_roles AS JSONB), :last_sync, NOW(), NOW())
            ON CONFLICT (email) DO UPDATE SET
                first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
                display_name = EXCLUDED.display_name, job_title = EXCLUDED.job_title,
                department = EXCLUDED.department, mobile_phone = EXCLUDED.mobile_phone,
                office_phone = EXCLUDED.office_phone, manager_email = EXCLUDED.manager_email,
                manager_name = EXCLUDED.manager_name, photo_url = EXCLUDED.photo_url,
                ms_user_id = EXCLUDED.ms_user_id, ms_licenses = EXCLUDED.ms_licenses,
                ms_groups = EXCLUDED.ms_groups, ms_roles = EXCLUDED.ms_roles,
                last_sync = EXCLUDED.last_sync, updated_at = NOW()
        """), {**profile, "ms_licenses": json.dumps(licenses),
               "ms_groups": json.dumps(groups),
               "ms_roles": json.dumps(roles)})
        await db.commit()
        return profile

    except Exception as e:
        return {"error": str(e)}


# ─── Get or sync profile ──────────────────────────────────────────────────────
@router.get("/profile/{email}")
async def get_profile(email: str, sync: bool = False, db: AsyncSession = Depends(get_db)):
    if not sync:
        result = await db.execute(text("SELECT * FROM user_profiles WHERE email = :email"), {"email": email})
        row = result.fetchone()
        if row:
            return dict(row._mapping)

    # Sync from Microsoft
    return await sync_user_from_ms(email, db)


@router.post("/profile/{email}/sync")
async def sync_profile(email: str, db: AsyncSession = Depends(get_db)):
    return await sync_user_from_ms(email, db)


# ─── Permissions ─────────────────────────────────────────────────────────────
@router.get("/permissions/{email}")
async def get_permissions(email: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT * FROM whubbi_permissions WHERE user_email = :email ORDER BY module, submodule"),
        {"email": email}
    )
    rows = result.fetchall()
    perms = [dict(r._mapping) for r in rows]

    # Build complete permission matrix with defaults
    matrix = {}
    for module, submodules in MODULES.items():
        matrix[module] = {}
        for sub in submodules:
            existing = next((p for p in perms if p["module"] == module and p["submodule"] == sub), None)
            legal_entities = existing.get("legal_entities") if existing else None
            if isinstance(legal_entities, str):
                import json as _json
                try: legal_entities = _json.loads(legal_entities)
                except: legal_entities = ["all"]
            matrix[module][sub] = {
                "data_scope": existing["data_scope"] if existing else "none",
                "access_mode": existing["access_mode"] if existing else "none",
                "legal_entities": legal_entities or ["all"],
                "id": str(existing["id"]) if existing else None,
            }
    return {"email": email, "permissions": matrix, "modules": MODULES}


@router.put("/permissions/{email}")
async def update_permissions(email: str, data: dict, db: AsyncSession = Depends(get_db)):
    """Update permissions for a user. Admin only."""
    import json as _json
    granted_by = data.get("granted_by", "admin")
    permissions = data.get("permissions", {})

    for module, submodules in permissions.items():
        for submodule, perm in submodules.items():
            legal_entities = perm.get("legal_entities", ["all"])
            await db.execute(text("""
                INSERT INTO whubbi_permissions (id, user_email, module, submodule, data_scope, access_mode, legal_entities, granted_by, created_at, updated_at)
                VALUES (gen_random_uuid(), :email, :module, :submodule, :data_scope, :access_mode, CAST(:legal_entities AS JSONB), :granted_by, NOW(), NOW())
                ON CONFLICT (user_email, module, submodule) DO UPDATE SET
                    data_scope = EXCLUDED.data_scope,
                    access_mode = EXCLUDED.access_mode,
                    legal_entities = EXCLUDED.legal_entities,
                    granted_by = EXCLUDED.granted_by,
                    updated_at = NOW()
            """), {
                "email": email, "module": module, "submodule": submodule,
                "data_scope": perm.get("data_scope", "none"),
                "access_mode": perm.get("access_mode", "none"),
                "legal_entities": _json.dumps(legal_entities),
                "granted_by": granted_by
            })
    await db.commit()
    return {"status": "ok", "updated": sum(len(v) for v in permissions.values())}


async def _main_location_by_email(db: AsyncSession) -> dict:
    r = await db.execute(text("SELECT email, main_location_id, main_location_name, is_excluded FROM user_profiles"))
    return {
        row.email: {
            "main_location_id": str(row.main_location_id) if row.main_location_id else None,
            "main_location_name": row.main_location_name or "All",
            "is_excluded": bool(row.is_excluded),
        }
        for row in r.fetchall()
    }

@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db)):
    """List all wcomply users — tries MS AD first, falls back to DB cache."""
    locations = await _main_location_by_email(db)
    try:
        token = await get_ms_token()
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://graph.microsoft.com/v1.0/users"
                "?$select=id,displayName,givenName,surname,mail,jobTitle,department"
                "&$filter=accountEnabled eq true"
                "&$top=100",
                headers={"Authorization": f"Bearer {token}"}
            )
            if resp.status_code == 200:
                ms_users = resp.json().get("value", [])
                users = [
                    {
                        "email": u.get("mail", ""),
                        "first_name": u.get("givenName", ""),
                        "last_name": u.get("surname", ""),
                        "display_name": u.get("displayName", ""),
                        "job_title": u.get("jobTitle", ""),
                        "department": u.get("department", ""),
                        **locations.get(u.get("mail", ""), {"main_location_id": None, "main_location_name": "All", "is_excluded": False}),
                    }
                    for u in ms_users if u.get("mail")
                ]
                return {"users": users, "source": "ms_ad"}
    except Exception:
        pass

    # Fallback: return cached DB users
    result = await db.execute(text("""
        SELECT email, first_name, last_name, display_name, job_title, department, last_sync,
               main_location_id, main_location_name, is_excluded
        FROM user_profiles ORDER BY last_name, first_name
    """))
    rows = result.fetchall()
    users = []
    for r in rows:
        d = dict(r._mapping)
        if d.get("main_location_id"): d["main_location_id"] = str(d["main_location_id"])
        users.append(d)
    return {"users": users, "source": "db_cache"}


# ─── Company Links (shown on the home page, managed from the IT module) ───────
@router.get("/company-links")
async def get_company_links(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(text("""
            SELECT id, label, url, icon, sort_order, location_id, location_name
            FROM company_links WHERE active = true
            ORDER BY sort_order ASC, label ASC
        """))
        links = [dict(r._mapping) for r in result.fetchall()]
        for l in links:
            l["id"] = str(l["id"])
            if l.get("location_id"): l["location_id"] = str(l["location_id"])
        return {"links": links}
    except Exception:
        return {"links": []}

@router.get("/company-links/all")
async def get_all_company_links(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT id, label, url, icon, active, sort_order, location_id, location_name
        FROM company_links ORDER BY sort_order ASC, label ASC
    """))
    links = [dict(r._mapping) for r in result.fetchall()]
    for l in links:
        l["id"] = str(l["id"])
        if l.get("location_id"): l["location_id"] = str(l["location_id"])
    return {"links": links}

@router.post("/company-links")
async def create_company_link(data: dict, db: AsyncSession = Depends(get_db)):
    import uuid
    link_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO company_links (id, label, url, icon, active, sort_order, location_id, location_name, created_at)
        VALUES (CAST(:id AS UUID), :label, :url, :icon, :active, :sort_order, CAST(NULLIF(:location_id,'') AS UUID), :location_name, NOW())
    """), {"id": link_id, "label": data.get("label",""), "url": data.get("url",""),
           "icon": data.get("icon","🔗"), "active": data.get("active", True),
           "sort_order": data.get("sort_order", 0),
           "location_id": data.get("location_id",""), "location_name": data.get("location_name") or "All"})
    await db.commit()
    return {"status": "ok", "id": link_id}

@router.put("/company-links/{link_id}")
async def update_company_link(link_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE company_links SET
            label = COALESCE(:label, label), url = COALESCE(:url, url),
            icon = COALESCE(:icon, icon), active = COALESCE(:active, active),
            sort_order = COALESCE(:sort_order, sort_order),
            location_id = CAST(NULLIF(:location_id,'') AS UUID),
            location_name = COALESCE(NULLIF(:location_name,''), location_name)
        WHERE id = CAST(:id AS UUID)
    """), {
        "label": data.get("label"), "url": data.get("url"), "icon": data.get("icon"),
        "active": data.get("active"), "sort_order": data.get("sort_order"),
        "location_id": data.get("location_id",""), "location_name": data.get("location_name",""),
        "id": link_id,
    })
    await db.commit()
    return {"status": "ok"}

@router.delete("/company-links/{link_id}")
async def delete_company_link(link_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM company_links WHERE id = CAST(:id AS UUID)"), {"id": link_id})
    await db.commit()
    return {"status": "ok"}

# ─── Per-user main location (drives which company links appear on the home page) ─
@router.get("/main-location/{email}")
async def get_main_location(email: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT main_location_id, main_location_name, is_excluded FROM user_profiles WHERE email = :email"), {"email": email})
    row = r.fetchone()
    if not row:
        return {"main_location_id": None, "main_location_name": "All", "is_excluded": False}
    return {
        "main_location_id": str(row.main_location_id) if row.main_location_id else None,
        "main_location_name": row.main_location_name or "All",
        "is_excluded": bool(row.is_excluded),
    }

@router.put("/main-location/{email}")
async def set_main_location(email: str, data: dict, db: AsyncSession = Depends(get_db)):
    location_id = data.get("main_location_id") or ""
    location_name = data.get("main_location_name") or "All"
    is_excluded = bool(data.get("is_excluded", False))
    await db.execute(text("""
        INSERT INTO user_profiles (id, email, main_location_id, main_location_name, is_excluded, created_at, updated_at)
        VALUES (gen_random_uuid(), :email, CAST(NULLIF(:location_id,'') AS UUID), :location_name, :is_excluded, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET
            main_location_id = CAST(NULLIF(:location_id,'') AS UUID),
            main_location_name = :location_name,
            is_excluded = :is_excluded,
            updated_at = NOW()
    """), {"email": email, "location_id": location_id, "location_name": location_name, "is_excluded": is_excluded})
    await db.commit()
    return {"status": "ok"}
