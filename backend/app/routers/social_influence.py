# backend/app/routers/social_influence.py
# Social Media Influence — external information sources (files, websites, blogs, LinkedIn
# pages) monitored over time, used as grounding for Claude-generated social posts. Mirrors
# existing patterns rather than inventing new ones:
#   - claude_web_search() (app/routers/companies.py) does the actual "fetch a URL and read it"
#     work via Claude's web_search tool — reused as-is for source checking.
#   - S3 upload mirrors app/routers/hr.py's upload_to_s3/s3_ref_to_presigned, same as
#     marketing.py already does for event logos/files.
#
# STAGE 1 (this file): source monitoring + draft generation. A generated post's "posted"
# status is set manually by a person after they copy it to LinkedIn/X themselves.
# STAGE 2 (not yet built): LinkedIn/X OAuth connections and one-click auto-publish.
import os
import uuid
import json
import base64
import asyncio
import hashlib
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import get_db
from app.routers.hr import upload_to_s3, s3_ref_to_presigned
from app.routers.companies import claude_web_search
from app.routers.outlook import FRONTEND_BASE_URL
from app.services.token_crypto import encrypt, decrypt, encrypt_state, decrypt_state

router = APIRouter()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
GENERATION_MODEL = "claude-sonnet-5"

SUBTYPES = {"website", "blog", "linkedin", "study", "mailing", "other"}  # the "Source" field — applies to url and file sources alike
CATEGORIES = {"Competitor", "Solution Provider", "Partner", "Other"}
CHECK_FREQUENCIES = {"manual", "daily", "weekly"}
FREQUENCY_INTERVALS = {"daily": timedelta(days=1), "weekly": timedelta(days=7)}
PLATFORMS = {"linkedin", "twitter"}
POST_STATUSES = {"draft", "approved", "posted"}

# ─── Mailings Inbox — dedicated shared mailbox, separate Azure AD OAuth app registration
# usage from the general per-user Outlook integration (app/routers/outlook.py) ────────────
MS_TENANT_ID     = os.getenv("MS_TENANT_ID", "")
MS_CLIENT_ID     = os.getenv("MS_CLIENT_ID", "")
MS_CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET", "")
GRAPH_BASE = "https://graph.microsoft.com/v1.0"
MS_AUTHORIZE_URL = f"https://login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/authorize"
MS_TOKEN_URL = f"https://login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/token"
MAILBOX_REDIRECT_URI = os.getenv("SOCIAL_INFLUENCE_MAILBOX_REDIRECT_URI", "https://api.whubbi.wcomply.com/marketing/social-influence-mailbox/callback")
MAILBOX_SCOPES = "openid profile Mail.ReadWrite.Shared offline_access User.Read"  # ReadWrite (not just Read) so Reject can delete the source message
MAILBOX_SYNC_INTERVAL = 20 * 60       # wake ~every 20 minutes
MAILBOX_SYNC_MAX_MESSAGES = 25        # bounded batch per cycle, same cost-cap philosophy as MAX_SOURCES_PER_CYCLE below


def _row(d: dict) -> dict:
    for k, v in d.items():
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
    return d


async def _presign_source(d: dict) -> dict:
    if (d.get("file_url") or "").startswith("s3://"):
        d["file_url"] = await s3_ref_to_presigned(d["file_url"])
    return d


def _validate_category(category: str):
    if category and category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"category must be one of {sorted(CATEGORIES)}")


def _validate_subtype(subtype: str):
    if subtype and subtype not in SUBTYPES:
        raise HTTPException(status_code=400, detail=f"subtype must be one of {sorted(SUBTYPES)}")


async def _get_source(db: AsyncSession, source_id: str) -> dict | None:
    r = await db.execute(text("SELECT * FROM influence_sources WHERE id = CAST(:id AS UUID)"), {"id": source_id})
    row = r.fetchone()
    return await _presign_source(_row(dict(row._mapping))) if row else None


# ─── Sources ─────────────────────────────────────────────────────────────────────
@router.get("/influence-sources")
async def list_influence_sources(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT * FROM influence_sources ORDER BY category NULLS LAST, subtype NULLS LAST, created_at DESC
    """))
    return {"sources": [await _presign_source(_row(dict(row._mapping))) for row in r.fetchall()]}


@router.post("/influence-sources")
async def create_influence_source(data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("name") or not data.get("url"):
        raise HTTPException(status_code=400, detail="name and url are required")
    subtype = data.get("subtype") or "other"
    _validate_subtype(subtype)
    category = data.get("category") or "Other"
    _validate_category(category)
    frequency = data.get("check_frequency") or "manual"
    if frequency not in CHECK_FREQUENCIES:
        raise HTTPException(status_code=400, detail=f"check_frequency must be one of {sorted(CHECK_FREQUENCIES)}")
    source_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO influence_sources (id, name, description, language, category, source_type, subtype, url, check_frequency, active, created_by_email, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :name, :description, :language, :category, 'url', :subtype, :url, :frequency, TRUE, :created_by_email, NOW(), NOW())
    """), {
        "id": source_id, "name": data["name"], "description": data.get("description") or None,
        "language": data.get("language") or None, "category": category, "subtype": subtype, "url": data["url"],
        "frequency": frequency, "created_by_email": data.get("created_by_email", ""),
    })
    await db.commit()
    return await _get_source(db, source_id)


@router.post("/influence-sources/upload")
async def upload_influence_source(
    name: str = Form(...), subtype: str = Form("other"),
    description: str = Form(""), language: str = Form(""), category: str = Form("Other"),
    file: UploadFile = File(...), created_by_email: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    # No check_frequency here — files are static, there's nothing to periodically re-check
    # (see _check_source, which already no-ops for non-'url' sources); always stored 'manual'.
    _validate_subtype(subtype)
    _validate_category(category)
    content = await file.read()
    source_id = str(uuid.uuid4())
    key = f"marketing/social-influence/{source_id}/{file.filename.replace(' ', '_')}"
    file_ref = await upload_to_s3(key, content, file.content_type or "application/octet-stream")
    await db.execute(text("""
        INSERT INTO influence_sources (id, name, description, language, category, source_type, subtype, file_url, file_name, check_frequency, active, created_by_email, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :name, :description, :language, :category, 'file', :subtype, :file_url, :file_name, 'manual', TRUE, :created_by_email, NOW(), NOW())
    """), {
        "id": source_id, "name": name, "description": description or None, "language": language or None,
        "category": category or "Other", "subtype": subtype, "file_url": file_ref, "file_name": file.filename,
        "created_by_email": created_by_email,
    })
    await db.commit()
    return await _get_source(db, source_id)


@router.post("/influence-sources/{source_id}/file")
async def replace_influence_source_file(source_id: str, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    existing = await _get_source(db, source_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Source not found")
    if existing["source_type"] != "file":
        raise HTTPException(status_code=400, detail="Only file sources have a file to replace")
    content = await file.read()
    key = f"marketing/social-influence/{source_id}/{file.filename.replace(' ', '_')}"
    file_ref = await upload_to_s3(key, content, file.content_type or "application/octet-stream")
    await db.execute(text("""
        UPDATE influence_sources SET file_url = :file_url, file_name = :file_name, updated_at = NOW() WHERE id = CAST(:id AS UUID)
    """), {"id": source_id, "file_url": file_ref, "file_name": file.filename})
    await db.commit()
    return await _get_source(db, source_id)


@router.get("/influence-sources/{source_id}")
async def get_influence_source(source_id: str, db: AsyncSession = Depends(get_db)):
    source = await _get_source(db, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return source


@router.put("/influence-sources/{source_id}")
async def update_influence_source(source_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    existing = await _get_source(db, source_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Source not found")
    frequency = data.get("check_frequency", "")
    if frequency and frequency not in CHECK_FREQUENCIES:
        raise HTTPException(status_code=400, detail=f"check_frequency must be one of {sorted(CHECK_FREQUENCIES)}")
    subtype = data.get("subtype", "")
    if subtype:
        _validate_subtype(subtype)
    category = data.get("category", "")
    if category:
        _validate_category(category)
    await db.execute(text("""
        UPDATE influence_sources SET
            name = COALESCE(NULLIF(:name,''), name),
            description = COALESCE(:description, description),
            language = COALESCE(NULLIF(:language,''), language),
            category = COALESCE(NULLIF(:category,''), category),
            url = COALESCE(NULLIF(:url,''), url),
            subtype = COALESCE(NULLIF(:subtype,''), subtype),
            check_frequency = COALESCE(NULLIF(:frequency,''), check_frequency),
            active = COALESCE(:active, active),
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": source_id, "name": data.get("name", ""), "description": data.get("description"),
        "language": data.get("language", ""), "category": category, "url": data.get("url", ""), "subtype": subtype,
        "frequency": frequency, "active": data.get("active"),
    })
    await db.commit()
    return await _get_source(db, source_id)


@router.delete("/influence-sources/{source_id}")
async def delete_influence_source(source_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM influence_source_updates WHERE source_id = CAST(:id AS UUID)"), {"id": source_id})
    await db.execute(text("DELETE FROM influence_sources WHERE id = CAST(:id AS UUID)"), {"id": source_id})
    await db.commit()
    return {"status": "ok"}


@router.get("/influence-sources/{source_id}/updates")
async def list_source_updates(source_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT * FROM influence_source_updates WHERE source_id = CAST(:id AS UUID) ORDER BY checked_at DESC
    """), {"id": source_id})
    return {"updates": [_row(dict(row._mapping)) for row in r.fetchall()]}


# ─── Checking a source for new information ───────────────────────────────────────
def _summaries_differ(old: str | None, new: str) -> bool:
    if not old:
        return False  # first-ever check establishes a baseline, it isn't "new" yet
    norm = lambda s: hashlib.sha256(" ".join(s.split()).lower().encode()).hexdigest()
    return norm(old) != norm(new)


async def _check_source(source: dict) -> dict:
    """Runs the (slow, external) Claude web-search call with NO database session open —
    each DB touch below opens its own short-lived session. Sharing one session/transaction
    across a call that can take many seconds would hold a lock on influence_sources for that
    whole time, which can block an unrelated ALTER TABLE (e.g. the next deploy's migration)
    long enough to fail its health check — this is exactly what happened once already."""
    from app.database import AsyncSessionLocal
    if source["source_type"] != "url":
        return source  # file sources are static — nothing to re-check
    prompt = (
        f"Fetch the current content at this URL: {source['url']}\n"
        "Summarize what's currently there in under 150 words, focused on recent posts, "
        "news, announcements or updates a marketing team would want to know about. "
        "Plain prose, no markdown, no preamble."
    )
    try:
        summary = await claude_web_search(prompt)
        changed = _summaries_differ(source.get("last_summary"), summary)
        async with AsyncSessionLocal() as db:
            await db.execute(text("""
                UPDATE influence_sources SET last_summary = :summary, last_checked_at = NOW(), last_error = NULL, updated_at = NOW()
                WHERE id = CAST(:id AS UUID)
            """), {"id": source["id"], "summary": summary})
            if changed:
                await db.execute(text("""
                    INSERT INTO influence_source_updates (id, source_id, checked_at, summary)
                    VALUES (CAST(:id AS UUID), CAST(:sid AS UUID), NOW(), :summary)
                """), {"id": str(uuid.uuid4()), "sid": source["id"], "summary": summary})
            await db.commit()
    except Exception as e:
        async with AsyncSessionLocal() as db:
            await db.execute(text("""
                UPDATE influence_sources SET last_error = :err, last_checked_at = NOW(), updated_at = NOW() WHERE id = CAST(:id AS UUID)
            """), {"id": source["id"], "err": str(e)[:500]})
            await db.commit()
    async with AsyncSessionLocal() as db:
        return await _get_source(db, source["id"])


@router.post("/influence-sources/{source_id}/check")
async def check_influence_source(source_id: str, db: AsyncSession = Depends(get_db)):
    source = await _get_source(db, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return await _check_source(source)


# ─── Periodic monitor — in-process background loop, started once at app startup ──
# (same idiom as _hold_mcp_session_manager in main.py: a long-lived asyncio task inside this
# already-always-on ECS Fargate container, rather than new scheduling infrastructure).
CHECK_LOOP_INTERVAL = 60 * 60       # wake hourly...
MAX_SOURCES_PER_CYCLE = 10          # ...but only recheck a bounded batch per wake, to cap cost
CHECK_CONCURRENCY = 3


async def periodic_check_loop():
    from app.database import AsyncSessionLocal
    while True:
        try:
            # This SELECT's session closes here, before any of the slow external calls below —
            # see _check_source's docstring for why that matters.
            async with AsyncSessionLocal() as db:
                r = await db.execute(text("""
                    SELECT * FROM influence_sources
                    WHERE active = TRUE AND source_type = 'url' AND check_frequency != 'manual'
                    ORDER BY last_checked_at ASC NULLS FIRST
                """))
                due = []
                for row in r.fetchall():
                    s = _row(dict(row._mapping))
                    interval = FREQUENCY_INTERVALS.get(s["check_frequency"])
                    if not s["last_checked_at"] or datetime.utcnow() - s["last_checked_at"] >= interval:
                        due.append(s)
                    if len(due) >= MAX_SOURCES_PER_CYCLE:
                        break

            sem = asyncio.Semaphore(CHECK_CONCURRENCY)

            async def _bounded(s):
                async with sem:
                    await _check_source(s)

            if due:
                await asyncio.gather(*[_bounded(s) for s in due])
        except Exception as e:
            print(f"[SocialInfluence] periodic_check_loop error: {e}")
        await asyncio.sleep(CHECK_LOOP_INTERVAL)


# ─── Mailings Inbox — a dedicated shared mailbox, connected via delegated OAuth (mirrors
# app/routers/outlook.py's mechanics exactly), whose incoming mail is periodically pulled and
# turned into ordinary file-type influence_sources (body text + real attachments) — nothing
# downstream (generation, the Sources list, editing) needs to know these came from email. ────
async def _get_mailbox(db: AsyncSession) -> dict | None:
    r = await db.execute(text("SELECT * FROM social_influence_mailbox LIMIT 1"))
    row = r.fetchone()
    return _row(dict(row._mapping)) if row else None


async def _store_mailbox_tokens(db: AsyncSession, mailbox_address: str, access_token: str, refresh_token: str, expires_in: int, connected_by_email: str):
    expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
    await db.execute(text("DELETE FROM social_influence_mailbox"))
    await db.execute(text("""
        INSERT INTO social_influence_mailbox (id, mailbox_address, access_token_encrypted, refresh_token_encrypted, token_expires_at, connected_by_email, connected_at)
        VALUES (CAST(:id AS UUID), :mailbox, :at, :rt, :exp, :email, NOW())
    """), {
        "id": str(uuid.uuid4()), "mailbox": mailbox_address, "at": encrypt(access_token),
        "rt": encrypt(refresh_token), "exp": expires_at, "email": connected_by_email,
    })
    await db.commit()


async def _get_valid_mailbox_token(db: AsyncSession, mailbox: dict) -> str:
    if mailbox["token_expires_at"] and datetime.utcnow() < mailbox["token_expires_at"] - timedelta(minutes=2):
        return decrypt(mailbox["access_token_encrypted"])
    from app.services.outlook import get_access_token as ms_refresh_token
    try:
        refreshed = await ms_refresh_token(decrypt(mailbox["refresh_token_encrypted"]))
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=401, detail="The Mailings Inbox connection has expired or was revoked — please reconnect it.")
    await _store_mailbox_tokens(db, mailbox["mailbox_address"], refreshed["access_token"], refreshed["refresh_token"], refreshed["expires_in"], mailbox.get("connected_by_email", ""))
    return refreshed["access_token"]


@router.get("/social-influence-mailbox/status")
async def mailbox_status(db: AsyncSession = Depends(get_db)):
    mailbox = await _get_mailbox(db)
    if not mailbox:
        return {"connected": False}
    return {
        "connected": True, "mailbox_address": mailbox["mailbox_address"],
        "last_synced_at": mailbox["last_synced_at"], "last_error": mailbox["last_error"],
    }


@router.get("/social-influence-mailbox/connect")
async def mailbox_connect(mailbox: str, email: str):
    if not MS_CLIENT_ID:
        raise HTTPException(status_code=500, detail="MS_CLIENT_ID not configured")
    state = encrypt_state({"mailbox": mailbox, "email": email, "nonce": str(uuid.uuid4())})
    params = {
        "client_id": MS_CLIENT_ID, "response_type": "code", "redirect_uri": MAILBOX_REDIRECT_URI,
        "response_mode": "query", "scope": MAILBOX_SCOPES, "state": state,
    }
    return {"auth_url": f"{MS_AUTHORIZE_URL}?{httpx.QueryParams(params)}"}


@router.get("/social-influence-mailbox/callback")
async def mailbox_callback(code: str = None, state: str = None, error: str = None, db: AsyncSession = Depends(get_db)):
    from fastapi.responses import RedirectResponse
    return_url = f"{FRONTEND_BASE_URL}/marketing/social-media-influence?tab=Sources"
    if error or not code or not state:
        return RedirectResponse(f"{return_url}&mailbox_error={error or 'missing_code'}")
    payload = decrypt_state(state)
    if not payload or not payload.get("mailbox"):
        return RedirectResponse(f"{return_url}&mailbox_error=invalid_state")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(MS_TOKEN_URL, data={
            "grant_type": "authorization_code", "client_id": MS_CLIENT_ID, "client_secret": MS_CLIENT_SECRET,
            "code": code, "redirect_uri": MAILBOX_REDIRECT_URI, "scope": MAILBOX_SCOPES,
        })
        if token_resp.status_code != 200:
            return RedirectResponse(f"{return_url}&mailbox_error=token_exchange_failed")
        tokens = token_resp.json()

    await _store_mailbox_tokens(db, payload["mailbox"], tokens["access_token"], tokens["refresh_token"], tokens.get("expires_in", 3600), payload.get("email", ""))
    return RedirectResponse(f"{return_url}&mailbox_connected=1")


@router.delete("/social-influence-mailbox")
async def mailbox_disconnect(db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM social_influence_mailbox"))
    await db.commit()
    return {"status": "ok"}


@router.get("/social-influence-mailbox/diagnose")
async def diagnose_mailbox(address: str = None, db: AsyncSession = Depends(get_db)):
    """Looks the given (or currently connected) mailbox address up directly via Graph's
    app-only client-credentials token (same mechanism settings.py already uses for the WHUBBI
    group lookup) to tell apart 'this address doesn't exist as a Graph user object' from other
    failure modes, without needing the delegated mailbox connection to be healthy."""
    from app.routers.settings import get_ms_token
    if not address:
        mailbox = await _get_mailbox(db)
        if not mailbox:
            raise HTTPException(status_code=404, detail="No mailbox connected and no address given")
        address = mailbox["mailbox_address"]
    token = await get_ms_token()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{GRAPH_BASE}/users/{address}",
            headers={"Authorization": f"Bearer {token}"},
            params={"$select": "id,mail,userPrincipalName,displayName,proxyAddresses"},
        )
    return {
        "address_queried": address,
        "status_code": resp.status_code,
        "body": resp.json() if resp.content else None,
    }


def _safe_filename(name: str) -> str:
    return "".join(c if c.isalnum() or c in " ._-" else "_" for c in name)[:150] or "untitled"


def _parse_graph_datetime(value: str) -> datetime:
    return datetime.strptime(value.split(".")[0].rstrip("Z"), "%Y-%m-%dT%H:%M:%S")


async def _stage_pending_email(client: httpx.AsyncClient, headers: dict, mailbox_address: str, message: dict):
    """Anti-spam gate: a new message becomes a influence_pending_emails row for a human to
    Accept/Reject — it does NOT touch influence_sources or S3 yet. Attachments are recorded as
    metadata only (no bytes fetched here) so staging stays cheap even for spam with large
    attachments. No DB session held open across the Graph HTTP calls — see _check_source's
    docstring for why that matters."""
    from app.database import AsyncSessionLocal
    subject = message.get("subject") or "(no subject)"
    sender_field = (message.get("from") or {}).get("emailAddress") or {}
    received = message.get("receivedDateTime", "")
    body = message.get("body") or {}

    attachments = []
    if message.get("hasAttachments"):
        try:
            att_resp = await client.get(
                f"{GRAPH_BASE}/users/{mailbox_address}/messages/{message['id']}/attachments",
                headers=headers, params={"$select": "id,name,contentType,size,isInline,@odata.type"},
            )
            att_resp.raise_for_status()
            attachments = [
                {"id": a["id"], "name": a.get("name") or "attachment", "content_type": a.get("contentType") or "application/octet-stream", "size": a.get("size")}
                for a in att_resp.json().get("value", [])
                if not a.get("isInline") and a.get("@odata.type") == "#microsoft.graph.fileAttachment"
            ]
        except Exception as e:
            print(f"[SocialInfluence] failed to fetch attachment metadata for message {message['id']}: {e}")

    async with AsyncSessionLocal() as db:
        await db.execute(text("""
            INSERT INTO influence_pending_emails (id, mailbox_address, message_id, subject, sender_email, sender_name,
                received_at, body_content, body_content_type, attachments, status, created_at)
            VALUES (CAST(:id AS UUID), :mailbox, :message_id, :subject, :sender_email, :sender_name,
                :received_at, :body_content, :body_content_type, CAST(:attachments AS JSONB), 'pending', NOW())
        """), {
            "id": str(uuid.uuid4()), "mailbox": mailbox_address, "message_id": message["id"], "subject": subject[:500],
            "sender_email": sender_field.get("address", ""), "sender_name": sender_field.get("name", ""),
            "received_at": _parse_graph_datetime(received) if received else None,
            "body_content": body.get("content", ""), "body_content_type": body.get("contentType", "text"),
            "attachments": json.dumps(attachments),
        })
        await db.commit()


async def mailbox_sync_loop():
    from app.database import AsyncSessionLocal
    while True:
        try:
            async with AsyncSessionLocal() as db:
                mailbox = await _get_mailbox(db)
            if mailbox:
                access_token = None
                async with AsyncSessionLocal() as db:
                    try:
                        access_token = await _get_valid_mailbox_token(db, mailbox)
                    except HTTPException as e:
                        await db.execute(text("UPDATE social_influence_mailbox SET last_error = :err WHERE id = CAST(:id AS UUID)"),
                                          {"id": mailbox["id"], "err": str(e.detail)[:500]})
                        await db.commit()

                if access_token:
                    since = mailbox["last_synced_at"] or (datetime.utcnow() - timedelta(days=1))
                    headers = {"Authorization": f"Bearer {access_token}"}
                    async with httpx.AsyncClient(timeout=30) as client:
                        resp = await client.get(
                            f"{GRAPH_BASE}/users/{mailbox['mailbox_address']}/mailFolders/Inbox/messages",
                            headers=headers,
                            params={
                                "$filter": f"receivedDateTime gt {since.strftime('%Y-%m-%dT%H:%M:%SZ')}",
                                "$orderby": "receivedDateTime asc", "$top": MAILBOX_SYNC_MAX_MESSAGES,
                                "$select": "id,subject,body,from,receivedDateTime,hasAttachments",
                            },
                        )
                        resp.raise_for_status()
                        messages = resp.json().get("value", [])

                        latest = since
                        for m in messages:
                            await _stage_pending_email(client, headers, mailbox["mailbox_address"], m)
                            received = m.get("receivedDateTime")
                            if received:
                                latest = max(latest, _parse_graph_datetime(received))

                    async with AsyncSessionLocal() as db:
                        await db.execute(text("""
                            UPDATE social_influence_mailbox SET last_synced_at = :ts, last_error = NULL WHERE id = CAST(:id AS UUID)
                        """), {"id": mailbox["id"], "ts": latest})
                        await db.commit()
        except Exception as e:
            print(f"[SocialInfluence] mailbox_sync_loop error: {e}")
            try:
                async with AsyncSessionLocal() as db:
                    await db.execute(text("UPDATE social_influence_mailbox SET last_error = :err WHERE id IS NOT NULL"), {"err": str(e)[:500]})
                    await db.commit()
            except Exception:
                pass
        await asyncio.sleep(MAILBOX_SYNC_INTERVAL)


def _normalize_pending(d: dict) -> dict:
    # asyncpg can hand back a JSONB column as a raw string rather than an already-decoded
    # list/dict for a plain text() query (same gotcha settings.py works around for
    # legal_entities) — decode defensively rather than assume either shape.
    attachments = d.get("attachments")
    if isinstance(attachments, str):
        try:
            attachments = json.loads(attachments)
        except (TypeError, ValueError):
            attachments = []
    d["attachments"] = attachments or []
    return d


@router.get("/social-influence-mailbox/pending")
async def list_pending_emails(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT * FROM influence_pending_emails WHERE status = 'pending' ORDER BY received_at DESC NULLS LAST, created_at DESC
    """))
    return {"pending": [_normalize_pending(_row(dict(row._mapping))) for row in r.fetchall()]}


async def _get_pending_email(db: AsyncSession, pending_id: str) -> dict | None:
    r = await db.execute(text("SELECT * FROM influence_pending_emails WHERE id = CAST(:id AS UUID)"), {"id": pending_id})
    row = r.fetchone()
    return _normalize_pending(_row(dict(row._mapping))) if row else None


@router.post("/social-influence-mailbox/pending/{pending_id}/reject")
async def reject_pending_email(pending_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    """Rejecting also deletes the source message from the shared mailbox (Graph moves it to
    Deleted Items — recoverable, not a hard delete) so rejected spam doesn't pile up in the
    inbox and get re-staged. Same discipline as accept_pending_email: the slow Graph call runs
    with no DB session open, then one fresh short session does the final write."""
    pending = await _get_pending_email(db, pending_id)
    if not pending:
        raise HTTPException(status_code=404, detail="Pending email not found")
    if pending["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Already {pending['status']}")

    mailbox = await _get_mailbox(db)
    access_token = None
    if mailbox:
        try:
            access_token = await _get_valid_mailbox_token(db, mailbox)
        except HTTPException as e:
            print(f"[SocialInfluence] could not get a mailbox token to delete rejected message {pending['message_id']}: {e.detail}")
    await db.commit()

    if mailbox and access_token:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.delete(
                    f"{GRAPH_BASE}/users/{mailbox['mailbox_address']}/messages/{pending['message_id']}",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
            if resp.status_code not in (204, 404):
                resp.raise_for_status()
        except Exception as e:
            print(f"[SocialInfluence] failed to delete rejected message {pending['message_id']} from mailbox: {e}")

    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db2:
        await db2.execute(text("""
            UPDATE influence_pending_emails SET status = 'rejected', reviewed_by_email = :email, reviewed_at = NOW() WHERE id = CAST(:id AS UUID)
        """), {"id": pending_id, "email": data.get("reviewed_by_email", "")})
        await db2.commit()
    return {"status": "ok"}


@router.post("/social-influence-mailbox/pending/{pending_id}/accept")
async def accept_pending_email(pending_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    """Only on Accept do we touch S3/influence_sources — attachments are re-fetched fresh from
    Graph now (staging only kept metadata) so a rejected/never-reviewed email never costs a
    single byte of attachment storage.

    All the slow work (Graph fetches, S3 uploads) runs with NO database session open, then one
    fresh short session does every INSERT/UPDATE at the end — same discipline as _check_source,
    for the same reason: holding a session open across slow external calls can block an
    unrelated ALTER TABLE (e.g. the next deploy's migration) long enough to fail its health
    check, which happened once already."""
    pending = await _get_pending_email(db, pending_id)
    if not pending:
        raise HTTPException(status_code=404, detail="Pending email not found")
    if pending["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Already {pending['status']}")

    mailbox = await _get_mailbox(db)
    if not mailbox:
        raise HTTPException(status_code=400, detail="Mailings Inbox is not connected — cannot fetch attachments.")
    access_token = await _get_valid_mailbox_token(db, mailbox)
    # Done with the request-scoped session before the slow phase below — FastAPI's get_db()
    # dependency only closes it after this function returns, so without this commit its
    # transaction (from the SELECTs above) would otherwise stay open the whole time.
    await db.commit()
    headers = {"Authorization": f"Bearer {access_token}"}

    subject = pending["subject"] or "(no subject)"
    text_blob = (
        f"Subject: {subject}\nFrom: {pending['sender_name']} <{pending['sender_email']}>\n"
        f"Received: {pending['received_at']}\n\n{pending['body_content'] or ''}"
    )
    source_id = str(uuid.uuid4())
    key = f"marketing/social-influence/{source_id}/{_safe_filename(subject)}.txt"
    file_ref = await upload_to_s3(key, text_blob.encode("utf-8"), "text/plain")
    sources_to_insert = [{
        "id": source_id, "name": subject[:255], "description": f"Received {pending['received_at']} via {pending['mailbox_address']}",
        "file_url": file_ref, "file_name": f"{_safe_filename(subject)}.txt",
    }]

    async with httpx.AsyncClient(timeout=30) as client:
        for att in pending["attachments"]:
            try:
                att_resp = await client.get(
                    f"{GRAPH_BASE}/users/{pending['mailbox_address']}/messages/{pending['message_id']}/attachments/{att['id']}",
                    headers=headers,
                )
                att_resp.raise_for_status()
                content_bytes = base64.b64decode(att_resp.json()["contentBytes"])
            except Exception as e:
                print(f"[SocialInfluence] failed to fetch attachment {att.get('id')} for pending email {pending_id}: {e}")
                continue
            att_id = str(uuid.uuid4())
            att_name = att.get("name") or "attachment"
            att_key = f"marketing/social-influence/{att_id}/{_safe_filename(att_name)}"
            att_ref = await upload_to_s3(att_key, content_bytes, att.get("content_type") or "application/octet-stream")
            sources_to_insert.append({
                "id": att_id, "name": f"{att_name} ({subject[:200]})",
                "description": f"Attachment from \"{subject}\" received {pending['received_at']} via {pending['mailbox_address']}",
                "file_url": att_ref, "file_name": att_name,
            })

    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db2:
        for s in sources_to_insert:
            await db2.execute(text("""
                INSERT INTO influence_sources (id, name, description, category, source_type, subtype, file_url, file_name, check_frequency, active, created_by_email, created_at, updated_at)
                VALUES (CAST(:id AS UUID), :name, :description, 'Other', 'file', 'mailing', :file_url, :file_name, 'manual', TRUE, :created_by_email, NOW(), NOW())
            """), {**s, "created_by_email": pending["mailbox_address"]})
        await db2.execute(text("""
            UPDATE influence_pending_emails SET status = 'accepted', reviewed_by_email = :email, reviewed_at = NOW() WHERE id = CAST(:id AS UUID)
        """), {"id": pending_id, "email": data.get("reviewed_by_email", "")})
        await db2.commit()
    return {"status": "ok", "source_id": source_id}


# ─── Content generation ───────────────────────────────────────────────────────────
PLATFORM_GUIDANCE = {
    "linkedin": "LinkedIn: professional, informative tone; up to ~3000 characters; can use short paragraphs and up to 3-5 relevant hashtags at the end.",
    "twitter": "X/Twitter: punchy and concise; hard limit of 280 characters including any hashtags; at most 1-2 hashtags.",
}

# Files whose bytes Claude can read natively as a document/image content block. Anything else
# (docx/pptx/xlsx, ...) is referenced by name only — no bespoke text-extraction is built for
# those, matching the sources the user actually described (files, websites, blogs, LinkedIn).
DOCUMENT_MEDIA_TYPES = {"application/pdf"}
IMAGE_MEDIA_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
TEXT_MEDIA_TYPES = {"text/plain", "text/markdown", "text/csv"}


def _source_meta_line(source: dict) -> str:
    """Description/language/category the person added for this source, if any — passed to
    Claude so it knows how to read the material (e.g. a presentation's language, or that a
    source is a competitor vs. a partner) without re-detecting it."""
    parts = []
    if source.get("category"):
        parts.append(f"Relationship: {source['category']}")
    if source.get("description"):
        parts.append(f"Description: {source['description']}")
    if source.get("language"):
        parts.append(f"Language: {source['language']}")
    return ("\n" + "\n".join(parts)) if parts else ""


async def _source_content_blocks(source: dict) -> list[dict]:
    """Build the Claude content block(s) representing one source's material."""
    meta = _source_meta_line(source)
    if source["source_type"] == "url":
        text_part = f"Source \"{source['name']}\" ({source['url']}):{meta}\n{source.get('last_summary') or '(not yet checked — no summary available)'}"
        return [{"type": "text", "text": text_part}]

    # file source — fetch bytes via the existing presign helper rather than adding a new
    # boto3 get_object path just for this.
    presigned = await s3_ref_to_presigned(source["file_url"])
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(presigned)
        resp.raise_for_status()
        content = resp.content
    media_type = resp.headers.get("content-type", "application/octet-stream").split(";")[0]
    b64 = base64.b64encode(content).decode()

    header = f"File \"{source['file_name']}\" (source \"{source['name']}\"):{meta}"
    if media_type in DOCUMENT_MEDIA_TYPES:
        return [{"type": "text", "text": header}, {"type": "document", "source": {"type": "base64", "media_type": media_type, "data": b64}}]
    if media_type in IMAGE_MEDIA_TYPES:
        return [{"type": "text", "text": header}, {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}}]
    if media_type in TEXT_MEDIA_TYPES:
        try:
            return [{"type": "text", "text": f"{header}\n{content.decode('utf-8')}"}]
        except UnicodeDecodeError:
            pass
    return [{"type": "text", "text": f"(Additional file provided: \"{source['file_name']}\" — content type not directly readable, referenced by name only){meta}"}]


@router.post("/social-posts/generate")
async def generate_social_post(data: dict, db: AsyncSession = Depends(get_db)):
    platform = data.get("platform")
    if platform not in PLATFORMS:
        raise HTTPException(status_code=400, detail=f"platform must be one of {sorted(PLATFORMS)}")
    topic = data.get("topic") or ""
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    source_ids = data.get("source_ids")
    if source_ids:
        placeholders = ", ".join(f"CAST(:id{i} AS UUID)" for i in range(len(source_ids)))
        params = {f"id{i}": sid for i, sid in enumerate(source_ids)}
        r = await db.execute(text(f"SELECT * FROM influence_sources WHERE id IN ({placeholders})"), params)
    else:
        r = await db.execute(text("SELECT * FROM influence_sources WHERE active = TRUE"))
    sources = [await _presign_source(_row(dict(row._mapping))) for row in r.fetchall()]

    content_blocks: list[dict] = []
    for s in sources:
        content_blocks.extend(await _source_content_blocks(s))

    instruction = (
        f"Write one social media post for {platform.upper()} about: {topic or 'the material provided below'}.\n"
        f"Style guidance — {PLATFORM_GUIDANCE[platform]}\n"
        "Ground the post in the source material given above when it's relevant; don't invent facts "
        "that aren't supported by it. Return ONLY the post text, nothing else — no preamble, no quotes, no markdown fences."
    )
    content_blocks.append({"type": "text", "text": instruction})

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={
                "model": GENERATION_MODEL, "max_tokens": 1024,
                "system": "You are the social media copywriter for WHUBBI/WCOMPLY, a B2B business management platform. Write clear, on-brand, factual copy.",
                "messages": [{"role": "user", "content": content_blocks}],
            },
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Claude API error {resp.status_code}: {resp.text[:300]}")
        d = resp.json()
        content = "\n".join(b["text"] for b in d.get("content", []) if b.get("type") == "text").strip()

    post_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO social_posts (id, platform, topic, content, status, source_ids, created_by_email, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :platform, :topic, :content, 'draft', CAST(:source_ids AS JSONB), :created_by_email, NOW(), NOW())
    """), {
        "id": post_id, "platform": platform, "topic": topic, "content": content,
        "source_ids": json.dumps([s["id"] for s in sources]), "created_by_email": data.get("created_by_email", ""),
    })
    await db.commit()
    r2 = await db.execute(text("SELECT * FROM social_posts WHERE id = CAST(:id AS UUID)"), {"id": post_id})
    return _row(dict(r2.fetchone()._mapping))


@router.get("/social-posts")
async def list_social_posts(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM social_posts ORDER BY created_at DESC"))
    return {"posts": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.put("/social-posts/{post_id}")
async def update_social_post(post_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT id FROM social_posts WHERE id = CAST(:id AS UUID)"), {"id": post_id})
    if not r.first():
        raise HTTPException(status_code=404, detail="Post not found")
    status = data.get("status", "")
    if status and status not in POST_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(POST_STATUSES)}")
    await db.execute(text("""
        UPDATE social_posts SET content = COALESCE(NULLIF(:content,''), content), status = COALESCE(NULLIF(:status,''), status), updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {"id": post_id, "content": data.get("content", ""), "status": data.get("status", "")})
    await db.commit()
    r2 = await db.execute(text("SELECT * FROM social_posts WHERE id = CAST(:id AS UUID)"), {"id": post_id})
    return _row(dict(r2.fetchone()._mapping))


@router.delete("/social-posts/{post_id}")
async def delete_social_post(post_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM social_posts WHERE id = CAST(:id AS UUID)"), {"id": post_id})
    await db.commit()
    return {"status": "ok"}

# Stage 2 (not built yet): LinkedIn/X OAuth connections + one-click auto-publish. For now,
# PUT /social-posts/{id} with {"status": "posted"} lets a person mark a post as posted after
# copying it to the platform themselves.
