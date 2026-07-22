# backend/app/routers/payfit.py
# PayFit integration — Customer API Key auth (single company, not the OAuth2 partner flow).
# Real write support per PayFit's docs is narrower than a generic two-way sync:
#   - Collaborators: read (list/by-id) + create only — no update endpoint.
#   - Contracts:     read + create (FR only); PATCH exists only for health-insurance/provident-fund.
#   - Absences:      genuinely two-way — create + cancel, plus read.
# So collaborators/contracts flow mostly one-way (PayFit -> WHUBBI) after their initial creation;
# absences are the resource this module treats as a real two-way sync.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import httpx
import os
import asyncio
import json
from datetime import date

router = APIRouter()

BASE_URL = "https://partner-api.payfit.com"
INTROSPECT_URL = "https://oauth.payfit.com/introspect"
API_KEY = os.getenv("PAYFIT_API_KEY", "")
COMPANY_ID = os.getenv("PAYFIT_COMPANY_ID", "")


async def _payfit_request(method: str, path: str, **kwargs) -> httpx.Response:
    """Bearer-authenticated request against the PayFit partner API. Retries once on a
    429 (rate limit: 50 req/s read, 20 req/s write per PayFit's docs) after a short pause —
    a single retry is enough at this call volume; anything busier would need real backoff."""
    if not API_KEY:
        raise HTTPException(status_code=503, detail="PayFit is not configured (PAYFIT_API_KEY missing)")
    headers = kwargs.pop("headers", {})
    headers["Authorization"] = f"Bearer {API_KEY}"
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.request(method, f"{BASE_URL}{path}", headers=headers, **kwargs)
        if resp.status_code == 429:
            await asyncio.sleep(1.5)
            resp = await client.request(method, f"{BASE_URL}{path}", headers=headers, **kwargs)
        return resp


def _company_path(suffix: str) -> str:
    """Collaborators/contracts/absences all live under /companies/{companyId}/... —
    confirmed against PayFit's actual reference pages, not just the summarized doc index."""
    if not COMPANY_ID:
        raise HTTPException(status_code=503, detail="PayFit is not configured (PAYFIT_COMPANY_ID missing)")
    return f"/companies/{COMPANY_ID}{suffix}"


async def _fetch_all_pages(path: str, items_key: str, max_pages: int = 50) -> list:
    """PayFit paginates list endpoints (10/page observed) via meta.nextPageToken — follow
    it until exhausted so sync isn't silently limited to the first page. max_pages is a
    backstop against an unexpected infinite loop, not an expected real limit."""
    items = []
    page_token = None
    for _ in range(max_pages):
        params = {"pageToken": page_token} if page_token else None
        resp = await _payfit_request("GET", path, params=params)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"PayFit returned {resp.status_code}: {resp.text[:300]}")
        body = resp.json()
        page_items = body.get(items_key, []) if isinstance(body, dict) else body
        items.extend(page_items)
        page_token = (body.get("meta") or {}).get("nextPageToken") if isinstance(body, dict) else None
        if not page_token:
            break
    return items


def _extract_date(value):
    """PayFit dates come back as {date, moment}, not a flat string — and asyncpg needs
    an actual date object for a DATE column, not the ISO string, or it fails with
    "'str' object has no attribute 'toordinal'"."""
    raw = value.get("date") if isinstance(value, dict) else value
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except (TypeError, ValueError):
        return None


def _extract_email(collaborator: dict) -> str:
    """PayFit nests email under emails: [{email, type}], not a flat `email` field —
    prefer the professional address, falling back to whatever's first."""
    emails = collaborator.get("emails") or []
    if not emails:
        return collaborator.get("email", "") or ""
    professional = next((e.get("email", "") for e in emails if e.get("type") == "professional"), None)
    return professional or emails[0].get("email", "") or ""


async def _log_sync(db: AsyncSession, sync_type: str, status: str, items_synced: int, detail: str, triggered_by: str):
    await db.execute(text("""
        INSERT INTO payfit_sync_log (id, sync_type, status, items_synced, detail, triggered_by, started_at, finished_at)
        VALUES (gen_random_uuid(), :sync_type, :status, :items_synced, :detail, :triggered_by, NOW(), NOW())
    """), {"sync_type": sync_type, "status": status, "items_synced": items_synced,
           "detail": detail, "triggered_by": triggered_by})
    await db.commit()


# ─── Status / connection health ───────────────────────────────────────────────

@router.get("/status")
async def get_status(db: AsyncSession = Depends(get_db)):
    configured = bool(API_KEY)
    company = None
    error = None
    if configured and COMPANY_ID:
        try:
            resp = await _payfit_request("GET", f"/companies/{COMPANY_ID}")
            if resp.status_code == 200:
                company = resp.json()
            else:
                error = f"PayFit returned {resp.status_code}: {resp.text[:200]}"
        except Exception as e:
            error = str(e)

    r = await db.execute(text("""
        SELECT sync_type, status, items_synced, detail, started_at, finished_at
        FROM payfit_sync_log ORDER BY started_at DESC LIMIT 10
    """))
    recent_syncs = [dict(row._mapping) for row in r.fetchall()]

    return {
        "configured": configured,
        "company_id": COMPANY_ID or None,
        "company": company,
        "error": error,
        "recent_syncs": recent_syncs,
    }


# ─── Per-resource connectivity tests ──────────────────────────────────────────
# Read-only, scope-by-scope checks used by the "PayFit Integration" test panel — unlike
# the /sync endpoints these never write to our DB, so they're safe to click repeatedly
# without side effects while verifying the API key's granted scopes.

TEST_RESOURCES = {"company", "collaborators", "collaborator_detail", "contracts", "absences", "payslips"}


async def _test_call(method: str, path: str, label: str) -> dict:
    started = asyncio.get_event_loop().time()
    try:
        resp = await _payfit_request(method, path)
        elapsed_ms = round((asyncio.get_event_loop().time() - started) * 1000)
        if resp.status_code >= 400:
            return {"resource": label, "success": False, "status_code": resp.status_code,
                    "elapsed_ms": elapsed_ms, "error": resp.text[:400], "sample": None}
        body = resp.json()
        items = body.get(list(body.keys())[0]) if isinstance(body, dict) and len(body) == 1 and isinstance(list(body.values())[0], list) else body
        sample = items[:3] if isinstance(items, list) else items
        count = len(items) if isinstance(items, list) else None
        return {"resource": label, "success": True, "status_code": resp.status_code,
                "elapsed_ms": elapsed_ms, "error": None, "count": count, "sample": sample}
    except Exception as e:
        elapsed_ms = round((asyncio.get_event_loop().time() - started) * 1000)
        return {"resource": label, "success": False, "status_code": None,
                "elapsed_ms": elapsed_ms, "error": str(e), "sample": None}


@router.get("/test/{resource}")
async def test_resource(resource: str, collaborator_id: str = None, db: AsyncSession = Depends(get_db)):
    if resource not in TEST_RESOURCES:
        raise HTTPException(status_code=400, detail=f"resource must be one of {sorted(TEST_RESOURCES)}")
    if not API_KEY:
        return {"resource": resource, "success": False, "status_code": None,
                "elapsed_ms": 0, "error": "PAYFIT_API_KEY is not configured", "sample": None}

    if resource == "company":
        if not COMPANY_ID:
            return {"resource": "company", "success": False, "status_code": None,
                    "elapsed_ms": 0, "error": "PAYFIT_COMPANY_ID is not configured", "sample": None}
        return await _test_call("GET", f"/companies/{COMPANY_ID}", "company")

    if resource == "collaborators":
        return await _test_call("GET", _company_path("/collaborators"), "collaborators")

    if resource == "collaborator_detail":
        if not collaborator_id:
            r = await db.execute(text("SELECT payfit_id FROM payfit_collaborators WHERE matricule IS NOT NULL ORDER BY synced_at DESC LIMIT 1"))
            row = r.fetchone()
            collaborator_id = row[0] if row else None
        if not collaborator_id:
            return {"resource": "collaborator_detail", "success": False, "status_code": None, "elapsed_ms": 0,
                    "error": "No collaborator available to test with — sync collaborators first", "sample": None}
        return await _test_call("GET", _company_path(f"/collaborators/{collaborator_id}"), "collaborator_detail")

    if resource == "contracts":
        return await _test_call("GET", _company_path("/contracts"), "contracts")

    if resource == "absences":
        return await _test_call("GET", _company_path("/absences"), "absences")

    if resource == "payslips":
        if not collaborator_id:
            r = await db.execute(text("SELECT payfit_id FROM payfit_collaborators ORDER BY synced_at DESC LIMIT 1"))
            row = r.fetchone()
            collaborator_id = row[0] if row else None
        if not collaborator_id:
            return {"resource": "payslips", "success": False, "status_code": None, "elapsed_ms": 0,
                    "error": "No collaborator available to test with — sync collaborators first", "sample": None}
        return await _test_call("GET", _company_path(f"/collaborators/{collaborator_id}/payslips"), "payslips")


# ─── Collaborators (read + create only — no update endpoint on PayFit's side) ─────

@router.post("/sync/collaborators")
async def sync_collaborators(triggered_by: str = "manual", db: AsyncSession = Depends(get_db)):
    try:
        collaborators = await _fetch_all_pages(_company_path("/collaborators"), "collaborators")
        count = 0
        for c in collaborators:
            payfit_id = c.get("id")
            if not payfit_id:
                continue
            await db.execute(text("""
                INSERT INTO payfit_collaborators (id, payfit_id, first_name, last_name, email,
                                                   matricule, birth_date, manager_payfit_id, team_name,
                                                   raw_data, synced_at)
                VALUES (gen_random_uuid(), :payfit_id, :first_name, :last_name, :email,
                        :matricule, :birth_date, :manager_payfit_id, :team_name,
                        CAST(:raw_data AS JSONB), NOW())
                ON CONFLICT (payfit_id) DO UPDATE SET
                    first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
                    email = EXCLUDED.email, matricule = EXCLUDED.matricule,
                    birth_date = EXCLUDED.birth_date, manager_payfit_id = EXCLUDED.manager_payfit_id,
                    team_name = EXCLUDED.team_name, raw_data = EXCLUDED.raw_data, synced_at = NOW()
            """), {
                "payfit_id": payfit_id,
                "first_name": c.get("firstName", ""),
                "last_name": c.get("lastName", ""),
                "email": _extract_email(c),
                "matricule": c.get("matricule"),
                "birth_date": _extract_date(c.get("birthDate")),
                "manager_payfit_id": c.get("managerId"),
                "team_name": c.get("teamName"),
                "raw_data": json.dumps(c),
            })
            count += 1
        await db.commit()
        await _log_sync(db, "collaborators", "success", count, f"{count} collaborators synced", triggered_by)
        return {"status": "ok", "synced": count}
    except HTTPException as e:
        await _log_sync(db, "collaborators", "error", 0, str(e.detail), triggered_by)
        raise
    except Exception as e:
        await _log_sync(db, "collaborators", "error", 0, str(e), triggered_by)
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/collaborators")
async def list_collaborators(search: str = None, db: AsyncSession = Depends(get_db)):
    where = "WHERE first_name ILIKE :q OR last_name ILIKE :q OR email ILIKE :q" if search else ""
    params = {"q": f"%{search}%"} if search else {}
    r = await db.execute(text(f"""
        SELECT id::text, payfit_id, first_name, last_name, email, whubbi_user_email, synced_at
        FROM payfit_collaborators {where} ORDER BY last_name, first_name
    """), params)
    return {"collaborators": [dict(row._mapping) for row in r.fetchall()]}


@router.put("/collaborators/{collaborator_id}/link")
async def link_collaborator(collaborator_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    """Manually associate a synced PayFit collaborator with a WHUBBI user email."""
    await db.execute(text("""
        UPDATE payfit_collaborators SET whubbi_user_email = :email WHERE id = CAST(:id AS UUID)
    """), {"id": collaborator_id, "email": data.get("whubbi_user_email", "")})
    await db.commit()
    return {"status": "updated"}


@router.get("/my/{email}")
async def get_my_payfit(email: str, db: AsyncSession = Depends(get_db)):
    """Used by the MyWhubbi personal profile PayFit tab. Matched by email — either the
    collaborator's own email as synced from PayFit, or a manually-set whubbi_user_email
    override (e.g. if the two systems use different addresses for the same person)."""
    r = await db.execute(text("""
        SELECT pc.id::text, pc.payfit_id, pc.first_name, pc.last_name, pc.email, pc.whubbi_user_email,
               pc.matricule, pc.birth_date, pc.team_name, pc.manager_payfit_id, pc.synced_at,
               mgr.first_name AS manager_first_name, mgr.last_name AS manager_last_name
        FROM payfit_collaborators pc
        LEFT JOIN payfit_collaborators mgr ON mgr.payfit_id = pc.manager_payfit_id
        WHERE LOWER(pc.whubbi_user_email) = LOWER(:email) OR LOWER(pc.email) = LOWER(:email)
        ORDER BY (pc.whubbi_user_email IS NOT NULL) DESC LIMIT 1
    """), {"email": email})
    row = r.fetchone()
    if not row:
        return {"linked": False, "collaborator": None, "absences": [], "contract": None}

    collaborator = dict(row._mapping)

    # Contract data is (supposedly) embedded on the collaborator-by-id response, gated by
    # the collaborators:contracts:read scope — separate from the top-level /contracts list
    # endpoint (gated by contracts:read, which 403s). Confirmed via /payfit/test/collaborator_detail
    # that neither scope is actually granted: the response is 200 (base access is fine) but
    # the `contracts` key is entirely absent, not an empty list — so this key genuinely can't
    # see contract data via either path yet, not "this person has no contracts."
    contract = {"available": False, "reason": "Not checked yet"}
    try:
        resp = await _payfit_request("GET", _company_path(f"/collaborators/{collaborator['payfit_id']}"))
        if resp.status_code == 200:
            body = resp.json()
            if "contracts" not in body:
                contract = {"available": False, "reason": "Contract data requires the collaborators:contracts:read scope on the PayFit API key, which hasn't been granted yet."}
            else:
                contracts = body.get("contracts") or []
                latest = contracts[-1] if contracts else None
                if latest:
                    contract = {
                        "available": True,
                        "start_date": latest.get("startDate"),
                        "end_date": latest.get("endDate"),
                        "status": latest.get("status"),
                    }
                else:
                    contract = {"available": False, "reason": "No contracts on file for this collaborator."}
        elif resp.status_code == 403:
            contract = {"available": False, "reason": "Contract data requires the collaborators:contracts:read scope on the PayFit API key, which hasn't been granted yet."}
        else:
            contract = {"available": False, "reason": f"PayFit returned {resp.status_code}"}
    except Exception as e:
        contract = {"available": False, "reason": str(e)}

    r2 = await db.execute(text("""
        SELECT id::text, payfit_id, absence_type, start_date, end_date, status, source, error_detail, created_at
        FROM payfit_absences WHERE collaborator_payfit_id = :pid ORDER BY start_date DESC
    """), {"pid": collaborator["payfit_id"]})
    absences = [dict(r._mapping) for r in r2.fetchall()]
    return {"linked": True, "collaborator": collaborator, "absences": absences, "contract": contract}


# ─── Absences — the genuinely two-way resource ────────────────────────────────

@router.post("/sync/absences")
async def sync_absences(triggered_by: str = "manual", db: AsyncSession = Depends(get_db)):
    try:
        absences = await _fetch_all_pages(_company_path("/absences"), "absences")
        count = 0
        for a in absences:
            payfit_id = a.get("id")
            if not payfit_id:
                continue
            # PayFit's absence objects only carry contractId, never a collaborator ID directly —
            # resolving contract -> collaborator needs contracts:read, which this key doesn't have
            # yet (see /payfit/test/contracts). collaborator_payfit_id stays NULL until that's added;
            # storing contractId there would look like a match and silently misattribute absences.
            await db.execute(text("""
                INSERT INTO payfit_absences (id, payfit_id, contract_payfit_id, absence_type,
                                              start_date, end_date, status, source, raw_data, created_at, updated_at)
                VALUES (gen_random_uuid(), :payfit_id, :contract_id, :absence_type,
                        :start_date, :end_date, 'synced', 'payfit', CAST(:raw_data AS JSONB), NOW(), NOW())
                ON CONFLICT (payfit_id) DO UPDATE SET
                    absence_type = EXCLUDED.absence_type, start_date = EXCLUDED.start_date,
                    end_date = EXCLUDED.end_date, status = 'synced', raw_data = EXCLUDED.raw_data, updated_at = NOW()
            """), {
                "payfit_id": payfit_id,
                "contract_id": a.get("contractId", ""),
                "absence_type": a.get("type", ""),
                "start_date": _extract_date(a.get("startDate")),
                "end_date": _extract_date(a.get("endDate")),
                "raw_data": json.dumps(a),
            })
            count += 1
        await db.commit()
        await _log_sync(db, "absences", "success", count, f"{count} absences synced", triggered_by)
        return {"status": "ok", "synced": count}
    except HTTPException as e:
        await _log_sync(db, "absences", "error", 0, str(e.detail), triggered_by)
        raise
    except Exception as e:
        await _log_sync(db, "absences", "error", 0, str(e), triggered_by)
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/absences")
async def list_absences(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT id::text, payfit_id, collaborator_payfit_id, absence_type, start_date, end_date,
               status, source, error_detail, created_by, created_at
        FROM payfit_absences ORDER BY start_date DESC
    """))
    return {"absences": [dict(row._mapping) for row in r.fetchall()]}


@router.post("/absences")
async def create_absence(data: dict, db: AsyncSession = Depends(get_db)):
    """Create an absence in WHUBBI and push it to PayFit. Recorded locally first so a
    push failure is visible (status='error') instead of silently lost."""
    collaborator_id = data.get("collaborator_payfit_id", "")
    if not collaborator_id:
        raise HTTPException(status_code=400, detail="collaborator_payfit_id is required")

    r = await db.execute(text("""
        INSERT INTO payfit_absences (id, collaborator_payfit_id, absence_type, start_date, end_date,
                                      status, source, created_by, created_at, updated_at)
        VALUES (gen_random_uuid(), :collaborator_id, :absence_type, :start_date, :end_date,
                'pending_push', 'whubbi', :created_by, NOW(), NOW())
        RETURNING id::text
    """), {
        "collaborator_id": collaborator_id,
        "absence_type": data.get("absence_type", ""),
        "start_date": data.get("start_date"),
        "end_date": data.get("end_date"),
        "created_by": data.get("created_by", ""),
    })
    local_id = r.fetchone()[0]
    await db.commit()

    try:
        resp = await _payfit_request("POST", _company_path("/absences"), json={
            "collaboratorId": collaborator_id,
            "type": data.get("absence_type", ""),
            "startDate": data.get("start_date"),
            "endDate": data.get("end_date"),
        })
        if resp.status_code not in (200, 201):
            detail = f"PayFit returned {resp.status_code}: {resp.text[:300]}"
            await db.execute(text("UPDATE payfit_absences SET status = 'error', error_detail = :d, updated_at = NOW() WHERE id = CAST(:id AS UUID)"),
                              {"id": local_id, "d": detail})
            await db.commit()
            raise HTTPException(status_code=502, detail=detail)

        payfit_id = resp.json().get("id", "")
        await db.execute(text("""
            UPDATE payfit_absences SET payfit_id = :payfit_id, status = 'synced', error_detail = NULL, updated_at = NOW()
            WHERE id = CAST(:id AS UUID)
        """), {"id": local_id, "payfit_id": payfit_id})
        await db.commit()
        return {"id": local_id, "payfit_id": payfit_id, "status": "synced"}
    except HTTPException:
        raise
    except Exception as e:
        await db.execute(text("UPDATE payfit_absences SET status = 'error', error_detail = :d, updated_at = NOW() WHERE id = CAST(:id AS UUID)"),
                          {"id": local_id, "d": str(e)})
        await db.commit()
        raise HTTPException(status_code=502, detail=str(e))


@router.delete("/absences/{absence_id}")
async def cancel_absence(absence_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT payfit_id FROM payfit_absences WHERE id = CAST(:id AS UUID)"), {"id": absence_id})
    row = r.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Absence not found")
    payfit_id = row[0]

    if payfit_id:
        resp = await _payfit_request("DELETE", _company_path(f"/absences/{payfit_id}"))
        if resp.status_code not in (200, 204, 404):
            raise HTTPException(status_code=502, detail=f"PayFit returned {resp.status_code}: {resp.text[:300]}")

    await db.execute(text("DELETE FROM payfit_absences WHERE id = CAST(:id AS UUID)"), {"id": absence_id})
    await db.commit()
    return {"status": "cancelled"}
