# backend/app/routers/settings.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import httpx
import os
import base64
from datetime import datetime

router = APIRouter()

TENANT_ID     = os.getenv("MS_TENANT_ID", "")
CLIENT_ID     = os.getenv("MS_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET", "")

# Modules & submodules definition
MODULES = {
    "sales":     ["companies", "contacts", "opportunities", "tasks"],
    "finance":   ["invoices", "budgets", "reports"],
    "hr":        ["employees", "cv", "recruitment", "payroll"],
    "grc":       ["compliance", "risks", "audits", "certifications"],
    "it":        ["assets", "incidents", "access", "infrastructure"],
    "helpdesk":  ["tickets", "knowledge", "sla"],
    "admin":     ["users", "permissions", "monitoring", "costs"],
}

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
            "last_sync": datetime.utcnow().isoformat(),
        }

        # Upsert to DB
        await db.execute(text("""
            INSERT INTO user_profiles (id, email, first_name, last_name, display_name, job_title, department,
                mobile_phone, office_phone, manager_email, manager_name, photo_url, ms_user_id,
                ms_licenses, ms_groups, ms_roles, last_sync, created_at, updated_at)
            VALUES (gen_random_uuid(), :email, :first_name, :last_name, :display_name, :job_title, :department,
                :mobile_phone, :office_phone, :manager_email, :manager_name, :photo_url, :ms_user_id,
                :ms_licenses::jsonb, :ms_groups::jsonb, :ms_roles::jsonb, :last_sync, NOW(), NOW())
            ON CONFLICT (email) DO UPDATE SET
                first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
                display_name = EXCLUDED.display_name, job_title = EXCLUDED.job_title,
                department = EXCLUDED.department, mobile_phone = EXCLUDED.mobile_phone,
                office_phone = EXCLUDED.office_phone, manager_email = EXCLUDED.manager_email,
                manager_name = EXCLUDED.manager_name, photo_url = EXCLUDED.photo_url,
                ms_user_id = EXCLUDED.ms_user_id, ms_licenses = EXCLUDED.ms_licenses,
                ms_groups = EXCLUDED.ms_groups, ms_roles = EXCLUDED.ms_roles,
                last_sync = EXCLUDED.last_sync, updated_at = NOW()
        """), {**profile, "ms_licenses": str(licenses).replace("'", '"'),
               "ms_groups": str(groups).replace("'", '"'),
               "ms_roles": str(roles).replace("'", '"')})
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
            matrix[module][sub] = {
                "data_scope": existing["data_scope"] if existing else "none",
                "access_mode": existing["access_mode"] if existing else "none",
                "id": str(existing["id"]) if existing else None,
            }
    return {"email": email, "permissions": matrix, "modules": MODULES}


@router.put("/permissions/{email}")
async def update_permissions(email: str, data: dict, db: AsyncSession = Depends(get_db)):
    """Update permissions for a user. Admin only."""
    granted_by = data.get("granted_by", "admin")
    permissions = data.get("permissions", {})

    for module, submodules in permissions.items():
        for submodule, perm in submodules.items():
            await db.execute(text("""
                INSERT INTO whubbi_permissions (id, user_email, module, submodule, data_scope, access_mode, granted_by, created_at, updated_at)
                VALUES (gen_random_uuid(), :email, :module, :submodule, :data_scope, :access_mode, :granted_by, NOW(), NOW())
                ON CONFLICT (user_email, module, submodule) DO UPDATE SET
                    data_scope = EXCLUDED.data_scope,
                    access_mode = EXCLUDED.access_mode,
                    granted_by = EXCLUDED.granted_by,
                    updated_at = NOW()
            """), {
                "email": email, "module": module, "submodule": submodule,
                "data_scope": perm.get("data_scope", "none"),
                "access_mode": perm.get("access_mode", "none"),
                "granted_by": granted_by
            })
    await db.commit()
    return {"status": "ok", "updated": sum(len(v) for v in permissions.values())}


@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db)):
    """List all users with profiles."""
    result = await db.execute(text("""
        SELECT email, first_name, last_name, display_name, job_title, department, last_sync
        FROM user_profiles ORDER BY last_name, first_name
    """))
    rows = result.fetchall()
    return {"users": [dict(r._mapping) for r in rows]}


# ─── Company Links (admin only) ────────────────────────────────────────────────
@router.get("/company-links")
async def get_company_links(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(text("""
            SELECT id, label, url, icon, sort_order
            FROM company_links WHERE active = true
            ORDER BY sort_order ASC, label ASC
        """))
        links = [dict(r._mapping) for r in result.fetchall()]
        for l in links: l["id"] = str(l["id"])
        return {"links": links}
    except Exception:
        return {"links": []}

@router.get("/company-links/all")
async def get_all_company_links(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT id, label, url, icon, active, sort_order
        FROM company_links ORDER BY sort_order ASC, label ASC
    """))
    links = [dict(r._mapping) for r in result.fetchall()]
    for l in links: l["id"] = str(l["id"])
    return {"links": links}

@router.post("/company-links")
async def create_company_link(data: dict, db: AsyncSession = Depends(get_db)):
    import uuid
    link_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO company_links (id, label, url, icon, active, sort_order, created_at)
        VALUES (:id::uuid, :label, :url, :icon, :active, :sort_order, NOW())
    """), {"id": link_id, "label": data.get("label",""), "url": data.get("url",""),
           "icon": data.get("icon","🔗"), "active": data.get("active", True),
           "sort_order": data.get("sort_order", 0)})
    await db.commit()
    return {"status": "ok", "id": link_id}

@router.put("/company-links/{link_id}")
async def update_company_link(link_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE company_links SET
            label = COALESCE(:label, label), url = COALESCE(:url, url),
            icon = COALESCE(:icon, icon), active = COALESCE(:active, active),
            sort_order = COALESCE(:sort_order, sort_order)
        WHERE id = :id::uuid
    """), {**data, "id": link_id})
    await db.commit()
    return {"status": "ok"}

@router.delete("/company-links/{link_id}")
async def delete_company_link(link_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM company_links WHERE id = :id::uuid"), {"id": link_id})
    await db.commit()
    return {"status": "ok"}
