# backend/app/routers/outlook.py
# Per-user Microsoft 365 mailbox connection (delegated OAuth, authorization-code flow) — link
# existing emails to Leads/Opportunities/Contacts, and send-and-log emails (optionally from a
# Template Email) to a Contact. Reuses the existing Azure AD app registration (see
# app/routers/microsoft.py, which uses the same MS_TENANT_ID/MS_CLIENT_ID/MS_CLIENT_SECRET for
# its own app-only/client-credentials calls) plus the delegated Graph primitives already
# written in app/services/outlook.py.
import os
import uuid
import json
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import get_db
from app.services.outlook import get_access_token, DELEGATED_SCOPES, MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET
from app.services.token_crypto import encrypt, decrypt, encrypt_state, decrypt_state

router = APIRouter()

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
AUTHORIZE_URL = f"https://login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/authorize"
TOKEN_URL = f"https://login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/token"
REDIRECT_URI = os.getenv("OUTLOOK_REDIRECT_URI", "https://api.whubbi.wcomply.com/outlook/callback")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "https://master.da3cm8ewfvjqw.amplifyapp.com")

ENTITY_TYPES = {"lead", "opportunity", "contact"}


def _row(d: dict) -> dict:
    for k, v in d.items():
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
    return d


def _require_entity_type(entity_type: str):
    if entity_type not in ENTITY_TYPES:
        raise HTTPException(status_code=400, detail=f"entity_type must be one of {sorted(ENTITY_TYPES)}")


def _parse_dt(value: str | None):
    # asyncpg binds TIMESTAMP params as native datetimes — Graph's receivedDateTime (and any
    # other ISO string the frontend sends) has to be parsed before it reaches the query. The
    # linked_emails.sent_at column is TIMESTAMP WITHOUT TIME ZONE, so the tz-aware datetime
    # fromisoformat produces from a "Z"/offset suffix has to be normalized to naive UTC first —
    # asyncpg rejects binding a tz-aware value to a naive timestamp column.
    if not value:
        return None
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


async def _get_connection(db: AsyncSession, user_email: str) -> dict | None:
    r = await db.execute(text("SELECT * FROM outlook_connections WHERE user_email = :e"), {"e": user_email})
    row = r.fetchone()
    return _row(dict(row._mapping)) if row else None


async def _store_tokens(db: AsyncSession, user_email: str, mailbox_email: str, access_token: str, refresh_token: str, expires_in: int):
    expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
    await db.execute(text("""
        INSERT INTO outlook_connections (user_email, mailbox_email, access_token_encrypted, refresh_token_encrypted, token_expires_at, connected_at)
        VALUES (:email, :mailbox, :at, :rt, :exp, NOW())
        ON CONFLICT (user_email) DO UPDATE SET
            mailbox_email = :mailbox, access_token_encrypted = :at, refresh_token_encrypted = :rt, token_expires_at = :exp
    """), {
        "email": user_email, "mailbox": mailbox_email,
        "at": encrypt(access_token), "rt": encrypt(refresh_token), "exp": expires_at,
    })
    await db.commit()


async def _get_valid_access_token(db: AsyncSession, user_email: str) -> str:
    conn = await _get_connection(db, user_email)
    if not conn:
        raise HTTPException(status_code=404, detail="Mailbox not connected")
    try:
        refreshed = await get_access_token(decrypt(conn["refresh_token_encrypted"]))
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=401, detail="Your mailbox connection has expired or was revoked — please reconnect it in Settings > Integrations.")
    await _store_tokens(db, user_email, conn["mailbox_email"], refreshed["access_token"], refreshed["refresh_token"], refreshed["expires_in"])
    return refreshed["access_token"]


# ─── Connection lifecycle ────────────────────────────────────────────────────────
@router.get("/status")
async def outlook_status(email: str, db: AsyncSession = Depends(get_db)):
    conn = await _get_connection(db, email)
    return {"connected": bool(conn), "mailbox_email": conn["mailbox_email"] if conn else None}


@router.get("/connect")
async def outlook_connect(email: str):
    state = encrypt_state({"email": email, "nonce": str(uuid.uuid4())})
    params = {
        "client_id": MS_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": REDIRECT_URI,
        "response_mode": "query",
        "scope": DELEGATED_SCOPES,
        "state": state,
    }
    auth_url = f"{AUTHORIZE_URL}?{httpx.QueryParams(params)}"
    return {"auth_url": auth_url}


@router.get("/callback")
async def outlook_callback(code: str = None, state: str = None, error: str = None, error_description: str = None, db: AsyncSession = Depends(get_db)):
    from fastapi.responses import RedirectResponse
    settings_url = f"{FRONTEND_BASE_URL}/settings/integrations"
    if error or not code or not state:
        return RedirectResponse(f"{settings_url}?outlook_error={error or 'missing_code'}")
    payload = decrypt_state(state)
    if not payload or not payload.get("email"):
        return RedirectResponse(f"{settings_url}?outlook_error=invalid_state")
    user_email = payload["email"]

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(TOKEN_URL, data={
            "grant_type": "authorization_code",
            "client_id": MS_CLIENT_ID,
            "client_secret": MS_CLIENT_SECRET,
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "scope": DELEGATED_SCOPES,
        })
        if token_resp.status_code != 200:
            return RedirectResponse(f"{settings_url}?outlook_error=token_exchange_failed")
        tokens = token_resp.json()

        me_resp = await client.get(f"{GRAPH_BASE}/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
        me_resp.raise_for_status()
        mailbox_email = me_resp.json().get("mail") or me_resp.json().get("userPrincipalName")

    await _store_tokens(db, user_email, mailbox_email, tokens["access_token"], tokens["refresh_token"], tokens.get("expires_in", 3600))
    return RedirectResponse(f"{settings_url}?outlook_connected=1")


@router.delete("/connection")
async def outlook_disconnect(email: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM outlook_connections WHERE user_email = :e"), {"e": email})
    await db.commit()
    return {"status": "ok"}


# ─── Search the connected mailbox (for linking an existing email) ───────────────
@router.get("/emails/search")
async def search_emails(email: str, q: str, db: AsyncSession = Depends(get_db)):
    access_token = await _get_valid_access_token(db, email)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GRAPH_BASE}/me/messages",
            headers={"Authorization": f"Bearer {access_token}", "ConsistencyLevel": "eventual"},
            params={"$search": f'"{q}"', "$top": 15, "$select": "id,subject,from,toRecipients,receivedDateTime,bodyPreview"},
        )
        resp.raise_for_status()
        messages = resp.json().get("value", [])
    return {"messages": [
        {
            "id": m["id"], "subject": m.get("subject"),
            "from_address": (m.get("from") or {}).get("emailAddress", {}).get("address"),
            "to_addresses": [r["emailAddress"]["address"] for r in m.get("toRecipients", [])],
            "received_at": m.get("receivedDateTime"), "body_preview": m.get("bodyPreview"),
        } for m in messages
    ]}


# ─── Linked emails (per Lead/Opportunity/Contact) ────────────────────────────────
@router.get("/emails/linked")
async def list_linked_emails(entity_type: str, entity_id: str, db: AsyncSession = Depends(get_db)):
    _require_entity_type(entity_type)
    r = await db.execute(text("""
        SELECT le.*, t.short_title AS template_short_title FROM linked_emails le
        LEFT JOIN marketing_email_templates t ON t.id = le.template_id
        WHERE le.entity_type = :et AND le.entity_id = CAST(:eid AS UUID) ORDER BY le.sent_at DESC NULLS LAST, le.created_at DESC
    """), {"et": entity_type, "eid": entity_id})
    return {"emails": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.post("/emails/link")
async def link_email(data: dict, db: AsyncSession = Depends(get_db)):
    _require_entity_type(data.get("entity_type"))
    if not data.get("entity_id"):
        raise HTTPException(status_code=400, detail="entity_id is required")
    email_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO linked_emails (id, entity_type, entity_id, direction, provider_message_id, subject, from_address, to_addresses, sent_at, body_preview, created_by_email, created_at)
        VALUES (CAST(:id AS UUID), :et, CAST(:eid AS UUID), 'linked', :mid, :subject, :from_addr, CAST(:to_addrs AS JSONB), :sent_at, :preview, :created_by, NOW())
    """), {
        "id": email_id, "et": data["entity_type"], "eid": data["entity_id"], "mid": data.get("provider_message_id"),
        "subject": data.get("subject"), "from_addr": data.get("from_address"),
        "to_addrs": json.dumps(data.get("to_addresses") or []), "sent_at": _parse_dt(data.get("received_at") or data.get("sent_at")),
        "preview": data.get("body_preview"), "created_by": data.get("created_by", ""),
    })
    await db.commit()
    return {"status": "ok", "id": email_id}


@router.delete("/emails/linked/{email_id}")
async def unlink_email(email_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM linked_emails WHERE id = CAST(:id AS UUID)"), {"id": email_id})
    await db.commit()
    return {"status": "ok"}


# ─── Send + log an email (optionally from a Template Email) ─────────────────────
@router.post("/emails/send")
async def send_and_log_email(data: dict, db: AsyncSession = Depends(get_db)):
    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="email (the sender's WHUBBI account) is required")
    _require_entity_type(data.get("entity_type"))
    to_address = data.get("to_address")
    if not to_address:
        raise HTTPException(status_code=400, detail="to_address is required")
    subject = data.get("subject") or ""
    content = data.get("content") or ""

    access_token = await _get_valid_access_token(db, email)
    async with httpx.AsyncClient() as client:
        # Create-draft-then-send (two Graph calls) instead of the fire-and-forget /me/sendMail
        # shortcut, specifically so we get back a real message ID to keep in linked_emails.
        draft_resp = await client.post(
            f"{GRAPH_BASE}/me/messages",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json={
                "subject": subject,
                "body": {"contentType": "HTML", "content": content},
                "toRecipients": [{"emailAddress": {"address": to_address}}],
            },
        )
        if draft_resp.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"Microsoft Graph refused to create the draft: {draft_resp.text}")
        message_id = draft_resp.json()["id"]

        send_resp = await client.post(
            f"{GRAPH_BASE}/me/messages/{message_id}/send",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if send_resp.status_code not in (200, 202):
            raise HTTPException(status_code=502, detail=f"Microsoft Graph refused to send the message: {send_resp.text}")

    conn = await _get_connection(db, email)
    email_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO linked_emails (id, entity_type, entity_id, direction, provider_message_id, subject, from_address, to_addresses, sent_at, body_preview, body_html, template_id, created_by_email, created_at)
        VALUES (CAST(:id AS UUID), :et, CAST(:eid AS UUID), 'sent', :mid, :subject, :from_addr, CAST(:to_addrs AS JSONB), NOW(), :preview, :content, CAST(:template_id AS UUID), :created_by, NOW())
    """), {
        "id": email_id, "et": data["entity_type"], "eid": data["entity_id"], "mid": message_id,
        "subject": subject, "from_addr": conn["mailbox_email"] if conn else email,
        "to_addrs": json.dumps([to_address]), "preview": content[:280], "content": content,
        "template_id": data.get("template_id"), "created_by": email,
    })
    await db.commit()
    return {"status": "ok", "id": email_id, "message_id": message_id}
