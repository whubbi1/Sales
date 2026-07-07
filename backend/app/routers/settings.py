# backend/app/routers/settings.py
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import httpx
import os
import base64
import json
from datetime import datetime
import secrets
import hashlib
import time

router = APIRouter()

TENANT_ID     = os.getenv("MS_TENANT_ID", "")
CLIENT_ID     = os.getenv("MS_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET", "")

# Access to WHUBBI is restricted to members of this Azure AD security group. The group is
# looked up by name (cached) unless MS_WHUBBI_GROUP_ID is set, which skips the lookup entirely.
WHUBBI_GROUP_NAME = os.getenv("MS_WHUBBI_GROUP_NAME", "WHUBBI")
WHUBBI_GROUP_ID_ENV = os.getenv("MS_WHUBBI_GROUP_ID", "").strip()
_whubbi_group_cache = {"id": None, "members": None, "fetched_at": 0.0}
WHUBBI_GROUP_CACHE_TTL = 300  # seconds

# Modules & submodules definition
MODULES = {
    "sales":     ["companies", "contacts", "opportunities", "tasks", "cv_database", "partners"],
    "finance":   ["suppliers", "contracts", "purchasing", "invoices"],
    "hr":        ["freelancers", "recrutement", "positions", "jobs", "permissions", "chat", "admin", "onboarding", "offboarding"],
    "grc":       ["compliance", "risks", "audits", "certifications", "access_review", "tprm", "whistleblowing"],
    "it":        ["assets", "incidents", "access", "infrastructure"],
    "helpdesk":     ["tickets", "knowledge", "sla", "admin_cockpit"],
    "admin":        ["users", "permissions", "monitoring", "costs"],
    "legal":        ["entities", "templates", "admin"],
    "development":  ["general", "test_plans", "test_campaigns", "remediation"],
    "training":     ["manager"],
    "tasks":        ["manager"],
    "marketing":    ["events", "company_website", "competitor_analysis", "social_marketing", "marketing_plan", "marketing_material"],
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


async def _get_whubbi_group_id(token: str) -> str | None:
    if WHUBBI_GROUP_ID_ENV:
        return WHUBBI_GROUP_ID_ENV
    if _whubbi_group_cache["id"]:
        return _whubbi_group_cache["id"]
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            "https://graph.microsoft.com/v1.0/groups",
            params={"$filter": f"displayName eq '{WHUBBI_GROUP_NAME}'", "$select": "id"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        groups = resp.json().get("value", [])
        if not groups:
            return None
        _whubbi_group_cache["id"] = groups[0]["id"]
        return _whubbi_group_cache["id"]


async def get_whubbi_group_members() -> list | None:
    """Members of the WHUBBI Azure AD security group, cached briefly to avoid a
    round-trip to Graph on every request. Returns None if the check couldn't be
    completed (Graph unreachable, permission not granted, group not found) —
    callers must treat None as "check unavailable" and fail open, not "empty
    group", or a Graph outage / an incomplete Azure AD setup would lock out
    the whole company."""
    now = time.time()
    if _whubbi_group_cache["members"] is not None and now - _whubbi_group_cache["fetched_at"] < WHUBBI_GROUP_CACHE_TTL:
        return _whubbi_group_cache["members"]
    try:
        token = await get_ms_token()
        group_id = await _get_whubbi_group_id(token)
        if not group_id:
            return None
        members = []
        url = f"https://graph.microsoft.com/v1.0/groups/{group_id}/transitiveMembers/microsoft.graph.user"
        params = {"$select": "id,displayName,givenName,surname,mail,jobTitle,department", "$top": 999}
        async with httpx.AsyncClient(timeout=20) as client:
            while url:
                resp = await client.get(url, params=params, headers={"Authorization": f"Bearer {token}"})
                resp.raise_for_status()
                data = resp.json()
                members.extend(data.get("value", []))
                url = data.get("@odata.nextLink")
                params = None  # nextLink already carries the query string
        _whubbi_group_cache["members"] = members
        _whubbi_group_cache["fetched_at"] = now
        return members
    except Exception as e:
        print(f"WHUBBI group membership check failed, failing open: {e}")
        return None


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


# ─── MCP personal access tokens ────────────────────────────────────────────────
@router.post("/mcp-tokens")
async def create_mcp_token(data: dict, db: AsyncSession = Depends(get_db)):
    email = data.get("email")
    if not email:
        raise HTTPException(400, "email is required")
    raw_token = "whmcp_" + secrets.token_urlsafe(24)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    row = await db.execute(text("""
        INSERT INTO mcp_tokens (id, user_email, user_name, label, token_hash, token_prefix, created_at)
        VALUES (gen_random_uuid(), :email, :name, :label, :hash, :prefix, NOW())
        RETURNING id, created_at
    """), {
        "email": email, "name": data.get("name", ""), "label": data.get("label", "My token"),
        "hash": token_hash, "prefix": raw_token[:14],
    })
    await db.commit()
    r = row.fetchone()
    return {"id": str(r.id), "token": raw_token, "token_prefix": raw_token[:14],
            "label": data.get("label", "My token"), "created_at": str(r.created_at)}


@router.get("/mcp-tokens/{email}")
async def list_mcp_tokens(email: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT id, label, token_prefix, created_at, last_used_at, revoked_at
        FROM mcp_tokens WHERE user_email = :email ORDER BY created_at DESC
    """), {"email": email})
    return {"tokens": [{
        "id": str(r.id), "label": r.label, "token_prefix": r.token_prefix,
        "created_at": str(r.created_at), "last_used_at": str(r.last_used_at) if r.last_used_at else None,
        "revoked": r.revoked_at is not None,
    } for r in result.fetchall()]}


@router.delete("/mcp-tokens/{token_id}")
async def revoke_mcp_token(token_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("UPDATE mcp_tokens SET revoked_at = NOW() WHERE id = CAST(:id AS UUID)"), {"id": token_id})
    await db.commit()
    return {"status": "ok"}


@router.get("/mcp-whoami")
async def mcp_whoami(authorization: str = Header(default=""), db: AsyncSession = Depends(get_db)):
    token = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not token:
        raise HTTPException(401, "Missing bearer token")
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    row = await db.execute(text("""
        SELECT id, user_email, user_name FROM mcp_tokens
        WHERE token_hash = :hash AND revoked_at IS NULL
    """), {"hash": token_hash})
    r = row.fetchone()
    if not r:
        raise HTTPException(401, "Invalid or revoked token")
    await db.execute(text("UPDATE mcp_tokens SET last_used_at = NOW() WHERE id = :id"), {"id": r.id})
    await db.commit()
    return {"email": r.user_email, "name": r.user_name or r.user_email}


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
    """List WHUBBI security-group members — tries the MS AD group first, falls back to DB cache."""
    locations = await _main_location_by_email(db)
    members = await get_whubbi_group_members()
    if members is not None:
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
            for u in members if u.get("mail")
        ]
        return {"users": users, "source": "ms_ad_group"}

    # Fallback: return cached DB users (predates group-scoping, so unfiltered by
    # group membership — acceptable as a degraded fallback when Graph is unreachable)
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


@router.get("/whubbi-access/{email}")
async def check_whubbi_access(email: str, db: AsyncSession = Depends(get_db)):
    """Login gate: access requires membership in the WHUBBI Azure AD security group
    and not being manually excluded. If the group check itself is unavailable (Graph
    unreachable, permission not granted, group not found), that half fails open so a
    transient issue or an incomplete Azure AD setup doesn't lock out the whole
    company — is_excluded is still enforced either way."""
    r = await db.execute(text("SELECT is_excluded FROM user_profiles WHERE email = :email"), {"email": email})
    row = r.fetchone()
    is_excluded = bool(row.is_excluded) if row else False

    members = await get_whubbi_group_members()
    if members is None:
        return {"has_access": not is_excluded, "is_group_member": None, "is_excluded": is_excluded, "check_available": False}

    member_emails = {u.get("mail", "").lower() for u in members if u.get("mail")}
    is_member = email.lower() in member_emails
    return {"has_access": is_member and not is_excluded, "is_group_member": is_member, "is_excluded": is_excluded, "check_available": True}


# ─── Company Links (shown on the home page, managed from the IT module) ───────
COMPANY_LINK_CATEGORIES = ["WCOMPLY Internal Tools", "Partner Portals"]

@router.get("/company-links")
async def get_company_links(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(text("""
            SELECT id, label, url, icon, sort_order, location_id, location_name, category
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
        SELECT id, label, url, icon, active, sort_order, location_id, location_name, category
        FROM company_links ORDER BY sort_order ASC, label ASC
    """))
    links = [dict(r._mapping) for r in result.fetchall()]
    for l in links:
        l["id"] = str(l["id"])
        if l.get("location_id"): l["location_id"] = str(l["location_id"])
    return {"links": links}

@router.get("/company-links/meta")
async def get_company_links_meta():
    return {"categories": COMPANY_LINK_CATEGORIES}

@router.post("/company-links")
async def create_company_link(data: dict, db: AsyncSession = Depends(get_db)):
    import uuid
    link_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO company_links (id, label, url, icon, active, sort_order, location_id, location_name, category, created_at)
        VALUES (CAST(:id AS UUID), :label, :url, :icon, :active, :sort_order, CAST(NULLIF(:location_id,'') AS UUID), :location_name, :category, NOW())
    """), {"id": link_id, "label": data.get("label",""), "url": data.get("url",""),
           "icon": data.get("icon","🔗"), "active": data.get("active", True),
           "sort_order": data.get("sort_order", 0),
           "location_id": data.get("location_id",""), "location_name": data.get("location_name") or "All",
           "category": data.get("category") or None})
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
            location_name = COALESCE(NULLIF(:location_name,''), location_name),
            category = :category
        WHERE id = CAST(:id AS UUID)
    """), {
        "label": data.get("label"), "url": data.get("url"), "icon": data.get("icon"),
        "active": data.get("active"), "sort_order": data.get("sort_order"),
        "location_id": data.get("location_id",""), "location_name": data.get("location_name",""),
        "category": data.get("category") or None,
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
