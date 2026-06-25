# backend/app/routers/helpdesk_teams.py
# Teams private chat creation + webhook receiver
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import httpx, os, json, hmac, hashlib
from datetime import datetime

router = APIRouter()

MS_TENANT_ID     = os.getenv("MS_TENANT_ID", "")
MS_CLIENT_ID     = os.getenv("MS_CLIENT_ID", "")
MS_CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET", "")
WHUBBI_API_URL   = os.getenv("WHUBBI_API_URL", "https://api.whubbi.wcomply.com")


async def get_ms_token(scope: str = "https://graph.microsoft.com/.default") -> str:
    url = f"https://login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/token"
    async with httpx.AsyncClient() as client:
        r = await client.post(url, data={
            "grant_type": "client_credentials",
            "client_id": MS_CLIENT_ID,
            "client_secret": MS_CLIENT_SECRET,
            "scope": scope
        })
        return r.json().get("access_token", "")


async def get_user_ms_id(email: str, token: str) -> str:
    """Get Microsoft user ID from email."""
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"https://graph.microsoft.com/v1.0/users/{email}",
            headers={"Authorization": f"Bearer {token}"}, timeout=5
        )
        if r.status_code == 200:
            return r.json().get("id", "")
    return ""


async def get_ai_questions(ticket_title: str, ticket_description: str, category: str) -> str:
    """Generate contextual questions using Claude API."""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"Content-Type": "application/json", "x-api-key": os.getenv("ANTHROPIC_API_KEY", "")},
                json={
                    "model": "claude-sonnet-4-6",
                    "max_tokens": 300,
                    "messages": [{
                        "role": "user",
                        "content": f"""You are WHUBBI AI, a helpful IT helpdesk assistant at WCOMPLY.
A new ticket has been created:
Title: {ticket_title}
Category: {category}
Description: {ticket_description or 'No description provided'}

Generate 3-4 short, specific questions to gather more information to resolve this ticket faster.
Format: numbered list, concise, technical when appropriate.
Language: respond in the same language as the ticket description (French or English)."""
                    }]
                },
                timeout=15
            )
            if r.status_code == 200:
                content = r.json().get("content", [{}])
                return content[0].get("text", "") if content else ""
    except Exception as e:
        print(f"AI questions error: {e}")
    return "Could you please provide more details about the issue?\n1. When did this issue start?\n2. What steps have you already tried?\n3. Does this affect other users?"


# ─── Create Teams chat for ticket ─────────────────────────────────────────────
async def create_teams_chat(
    ticket_id: str, ticket_number: str, ticket_title: str,
    ticket_description: str, category_name: str,
    requester_email: str, assignee_email: str,
    db: AsyncSession
) -> dict:
    """Create or find existing Teams private chat for a ticket."""
    try:
        token = await get_ms_token()
        if not token:
            return {"status": "error", "message": "Could not get Microsoft token"}

        # Get user IDs
        req_id  = await get_user_ms_id(requester_email, token)
        asgn_id = await get_user_ms_id(assignee_email, token)

        if not req_id or not asgn_id:
            return {"status": "error", "message": f"Could not find Teams users: {requester_email}, {assignee_email}"}

        # Check if chat already exists for this ticket
        existing = await db.execute(text(
            "SELECT teams_chat_id FROM tickets WHERE id = :id::uuid"
        ), {"id": ticket_id})
        existing_row = existing.fetchone()

        if existing_row and existing_row.teams_chat_id:
            chat_id = existing_row.teams_chat_id
            # Add requester if not already in chat
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"https://graph.microsoft.com/v1.0/chats/{chat_id}/members",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json={"@odata.type": "#microsoft.graph.aadUserConversationMember",
                          "roles": ["member"],
                          "user@odata.bind": f"https://graph.microsoft.com/v1.0/users/{req_id}"},
                    timeout=10
                )
            return {"status": "existing", "chat_id": chat_id}

        # Create new group chat
        async with httpx.AsyncClient() as client:
            chat_resp = await client.post(
                "https://graph.microsoft.com/v1.0/chats",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "chatType": "group",
                    "topic": f"[{ticket_number}] {ticket_title[:50]}",
                    "members": [
                        {"@odata.type": "#microsoft.graph.aadUserConversationMember",
                         "roles": ["owner"],
                         "user@odata.bind": f"https://graph.microsoft.com/v1.0/users/{req_id}"},
                        {"@odata.type": "#microsoft.graph.aadUserConversationMember",
                         "roles": ["owner"],
                         "user@odata.bind": f"https://graph.microsoft.com/v1.0/users/{asgn_id}"},
                    ]
                },
                timeout=15
            )

            if chat_resp.status_code not in (200, 201):
                return {"status": "error", "message": f"Teams API error: {chat_resp.text[:200]}"}

            chat_id = chat_resp.json().get("id", "")
            if not chat_id:
                return {"status": "error", "message": "No chat ID returned"}

            # Save chat_id to ticket
            await db.execute(text(
                "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS teams_chat_id TEXT"
            ))
            await db.execute(text(
                "UPDATE tickets SET teams_chat_id = :chat_id WHERE id = :id::uuid"
            ), {"chat_id": chat_id, "id": ticket_id})
            await db.commit()

            # Post initial message with ticket info
            intro_msg = (
                f"🎫 **WHUBBI Helpdesk — Ticket {ticket_number}**\n\n"
                f"**Title:** {ticket_title}\n"
                f"**Category:** {category_name or 'General'}\n"
                f"**Description:** {ticket_description or 'No description provided'}\n\n"
                f"---\n"
                f"This chat has been created to resolve your support ticket.\n"
                f"All messages here will be synchronized with WHUBBI."
            )

            await client.post(
                f"https://graph.microsoft.com/v1.0/chats/{chat_id}/messages",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"body": {"contentType": "html", "content": intro_msg.replace('\n', '<br>')}},
                timeout=10
            )

            # Post AI questions
            ai_questions = await get_ai_questions(ticket_title, ticket_description, category_name or "")
            if ai_questions:
                ai_msg = (
                    f"🤖 **WHUBBI AI Assistant**\n\n"
                    f"To help resolve your ticket faster, could you please answer the following questions?\n\n"
                    f"{ai_questions}"
                )
                await client.post(
                    f"https://graph.microsoft.com/v1.0/chats/{chat_id}/messages",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json={"body": {"contentType": "html", "content": ai_msg.replace('\n', '<br>')}},
                    timeout=10
                )

            # Register webhook for this chat
            await register_teams_webhook(chat_id, ticket_id, token, db)

            return {"status": "created", "chat_id": chat_id}

    except Exception as e:
        return {"status": "error", "message": str(e)}


async def register_teams_webhook(chat_id: str, ticket_id: str, token: str, db: AsyncSession):
    """Register a Teams change notification subscription for this chat."""
    try:
        expiry = (datetime.utcnow().replace(microsecond=0).isoformat() + "Z").replace("2026", "2026")
        # Subscriptions expire after 60 min for chat messages — use max allowed
        from datetime import timedelta
        expiry_dt = datetime.utcnow() + timedelta(hours=1)
        expiry_str = expiry_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")

        async with httpx.AsyncClient() as client:
            sub_resp = await client.post(
                "https://graph.microsoft.com/v1.0/subscriptions",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "changeType": "created",
                    "notificationUrl": f"{WHUBBI_API_URL}/helpdesk/webhook/teams",
                    "resource": f"/chats/{chat_id}/messages",
                    "expirationDateTime": expiry_str,
                    "clientState": ticket_id,  # We'll use this to identify the ticket
                },
                timeout=10
            )
            if sub_resp.status_code in (200, 201):
                sub_id = sub_resp.json().get("id", "")
                # Store subscription ID
                await db.execute(text("""
                    INSERT INTO teams_subscriptions (id, ticket_id, chat_id, subscription_id, expires_at, created_at)
                    VALUES (gen_random_uuid(), :ticket_id::uuid, :chat_id, :sub_id, :expires, NOW())
                    ON CONFLICT (chat_id) DO UPDATE SET subscription_id = EXCLUDED.subscription_id, expires_at = EXCLUDED.expires_at
                """), {"ticket_id": ticket_id, "chat_id": chat_id, "sub_id": sub_id, "expires": expiry_str})
                await db.commit()
    except Exception as e:
        print(f"Webhook registration failed: {e}")


# ─── Webhook endpoint ──────────────────────────────────────────────────────────
@router.post("/webhook/teams")
async def teams_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Receive Teams change notifications and sync messages to ticket comments."""
    # Teams validation challenge
    params = dict(request.query_params)
    if "validationToken" in params:
        return Response(content=params["validationToken"], media_type="text/plain")

    try:
        body = await request.json()
        for notification in body.get("value", []):
            resource_data = notification.get("resourceData", {})
            ticket_id = notification.get("clientState", "")
            if not ticket_id:
                continue

            # Get message details from Graph
            resource = notification.get("resource", "")
            token = await get_ms_token()
            if not token or not resource:
                continue

            async with httpx.AsyncClient() as client:
                msg_resp = await client.get(
                    f"https://graph.microsoft.com/v1.0/{resource}",
                    headers={"Authorization": f"Bearer {token}"}, timeout=10
                )
                if msg_resp.status_code != 200:
                    continue

                msg = msg_resp.json()
                sender = msg.get("from", {})
                author_name = sender.get("user", {}).get("displayName", "Teams User")
                author_email = sender.get("user", {}).get("id", "unknown@teams")
                content = msg.get("body", {}).get("content", "")

                # Strip HTML
                import re
                clean = re.sub(r'<[^>]+>', '', content).strip()
                if not clean or clean == "null":
                    continue

                # Skip our own bot messages
                if "WHUBBI" in author_name or "WHUBBI AI" in author_name:
                    continue

                # Add as ticket comment
                await db.execute(text("""
                    INSERT INTO ticket_comments (id, ticket_id, author_email, author_name, content, is_internal, created_at)
                    VALUES (gen_random_uuid(), :tid::uuid, :email, :name, :content, false, NOW())
                """), {
                    "tid": ticket_id,
                    "email": author_email,
                    "name": f"[Teams] {author_name}",
                    "content": clean
                })
                await db.execute(text("UPDATE tickets SET updated_at = NOW() WHERE id = :id::uuid"), {"id": ticket_id})
                await db.commit()

    except Exception as e:
        print(f"Teams webhook error: {e}")

    return Response(content="OK", media_type="text/plain")


# ─── Sync Teams messages manually ─────────────────────────────────────────────
@router.post("/tickets/{tid}/teams/sync")
async def sync_teams_messages(tid: str, db: AsyncSession = Depends(get_db)):
    """Manually sync Teams chat messages to ticket comments."""
    try:
        t = await db.execute(text("SELECT teams_chat_id, ticket_number FROM tickets WHERE id = :id::uuid"), {"id": tid})
        row = t.fetchone()
        if not row or not row.teams_chat_id:
            return {"status": "error", "message": "No Teams chat linked to this ticket"}

        chat_id = row.teams_chat_id
        token = await get_ms_token()

        async with httpx.AsyncClient() as client:
            msgs_resp = await client.get(
                f"https://graph.microsoft.com/v1.0/chats/{chat_id}/messages?$top=50",
                headers={"Authorization": f"Bearer {token}"}, timeout=10
            )
            if msgs_resp.status_code != 200:
                return {"status": "error", "message": f"Graph API error: {msgs_resp.status_code}"}

            synced = 0
            import re
            for msg in msgs_resp.json().get("value", []):
                sender = msg.get("from", {})
                author_name = sender.get("user", {}).get("displayName", "Teams User")
                if "WHUBBI" in author_name:
                    continue
                content = re.sub(r'<[^>]+>', '', msg.get("body", {}).get("content", "")).strip()
                if not content or content == "null":
                    continue
                msg_time = msg.get("createdDateTime", datetime.utcnow().isoformat())

                # Check not already synced
                exists = await db.execute(text("""
                    SELECT id FROM ticket_comments
                    WHERE ticket_id = :tid::uuid AND content = :content AND author_name LIKE '[Teams]%'
                """), {"tid": tid, "content": content})
                if not exists.fetchone():
                    await db.execute(text("""
                        INSERT INTO ticket_comments (id, ticket_id, author_email, author_name, content, is_internal, created_at)
                        VALUES (gen_random_uuid(), :tid::uuid, :email, :name, :content, false, :ts)
                    """), {"tid": tid, "email": "teams@sync", "name": f"[Teams] {author_name}", "content": content, "ts": msg_time})
                    synced += 1

            await db.commit()
            return {"status": "ok", "synced": synced}

    except Exception as e:
        return {"status": "error", "message": str(e)}


# ─── Get Teams chat link ───────────────────────────────────────────────────────
@router.get("/tickets/{tid}/teams")
async def get_teams_info(tid: str, db: AsyncSession = Depends(get_db)):
    t = await db.execute(text("SELECT teams_chat_id, ticket_number, title FROM tickets WHERE id = :id::uuid"), {"id": tid})
    row = t.fetchone()
    if not row or not row.teams_chat_id:
        return {"has_chat": False}
    chat_url = f"https://teams.microsoft.com/l/chat/{row.teams_chat_id}/0"
    return {"has_chat": True, "chat_id": row.teams_chat_id, "chat_url": chat_url}
