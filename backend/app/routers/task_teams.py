# backend/app/routers/task_teams.py
# Teams group chat per task + inbound webhook — generalizes the pattern already
# proven for helpdesk tickets in helpdesk_teams.py, kept fully independent of it.
from fastapi import APIRouter, Request, Response, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import httpx, os, re, json
from datetime import datetime, timedelta

router = APIRouter()

MS_TENANT_ID     = os.getenv("MS_TENANT_ID", "")
MS_CLIENT_ID     = os.getenv("MS_CLIENT_ID", "")
MS_CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET", "")
WHUBBI_API_URL   = os.getenv("WHUBBI_API_URL", "https://api.whubbi.wcomply.com")
ANTHROPIC_KEY    = os.getenv("ANTHROPIC_API_KEY", "")


async def get_ms_token() -> str:
    url = f"https://login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/token"
    async with httpx.AsyncClient() as client:
        r = await client.post(url, data={
            "grant_type": "client_credentials", "client_id": MS_CLIENT_ID,
            "client_secret": MS_CLIENT_SECRET, "scope": "https://graph.microsoft.com/.default",
        })
        return r.json().get("access_token", "")


async def get_user_ms_id(email: str, token: str) -> str:
    async with httpx.AsyncClient() as client:
        r = await client.get(f"https://graph.microsoft.com/v1.0/users/{email}",
                              headers={"Authorization": f"Bearer {token}"}, timeout=5)
        if r.status_code == 200:
            return r.json().get("id", "")
    return ""


async def _post_chat_message(chat_id: str, token: str, html: str):
    async with httpx.AsyncClient() as client:
        await client.post(
            f"https://graph.microsoft.com/v1.0/chats/{chat_id}/messages",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"body": {"contentType": "html", "content": html.replace("\n", "<br>")}},
            timeout=10,
        )


# ─── Create Teams chat for a task ──────────────────────────────────────────────
async def create_task_teams_chat(task_id: str, title: str, description: str,
                                  owner_email: str, assignee_email: str, db: AsyncSession) -> dict:
    """Create (or reuse) a group chat between the task owner and assignee."""
    try:
        token = await get_ms_token()
        if not token:
            return {"status": "error", "message": "Could not get Microsoft token"}

        owner_id = await get_user_ms_id(owner_email, token)
        assignee_id = await get_user_ms_id(assignee_email, token)
        if not owner_id or not assignee_id:
            return {"status": "error", "message": f"Could not find Teams users: {owner_email}, {assignee_email}"}

        existing = await db.execute(text("SELECT teams_chat_id FROM tasks WHERE id = CAST(:id AS UUID)"), {"id": task_id})
        row = existing.fetchone()
        if row and row.teams_chat_id:
            return {"status": "existing", "chat_id": row.teams_chat_id}

        # owner == assignee (self-assigned task) — a 1-member "group" chat isn't valid in Graph, skip.
        if owner_id == assignee_id:
            return {"status": "skipped", "message": "Owner and assignee are the same person"}

        async with httpx.AsyncClient() as client:
            chat_resp = await client.post(
                "https://graph.microsoft.com/v1.0/chats",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "chatType": "group",
                    "topic": f"[Task] {title[:60]}",
                    "members": [
                        {"@odata.type": "#microsoft.graph.aadUserConversationMember", "roles": ["owner"],
                         "user@odata.bind": f"https://graph.microsoft.com/v1.0/users/{owner_id}"},
                        {"@odata.type": "#microsoft.graph.aadUserConversationMember", "roles": ["owner"],
                         "user@odata.bind": f"https://graph.microsoft.com/v1.0/users/{assignee_id}"},
                    ],
                },
                timeout=15,
            )
            if chat_resp.status_code not in (200, 201):
                return {"status": "error", "message": f"Teams API error: {chat_resp.text[:200]}"}

            chat_id = chat_resp.json().get("id", "")
            if not chat_id:
                return {"status": "error", "message": "No chat ID returned"}

            await db.execute(text("UPDATE tasks SET teams_chat_id = :chat_id WHERE id = CAST(:id AS UUID)"),
                              {"chat_id": chat_id, "id": task_id})
            await db.commit()

            intro = (
                f"✅ **WHUBBI Task Manager**\n\n"
                f"**Task:** {title}\n"
                f"**Description:** {description or 'No description provided'}\n\n"
                f"---\n"
                f"This chat tracks progress on this task. Replies here are logged against it, "
                f"and messages like \"mark this resolved\" or \"reassign to jane@wcomply.com\" "
                f"will update it directly."
            )
            await _post_chat_message(chat_id, token, intro)
            await register_task_teams_webhook(chat_id, task_id, token, db)
            return {"status": "created", "chat_id": chat_id}

    except Exception as e:
        return {"status": "error", "message": str(e)}


async def add_member_to_task_chat(chat_id: str, email: str):
    """Best-effort: add a newly-reassigned person to the task's existing Teams chat."""
    token = await get_ms_token()
    if not token:
        return
    user_id = await get_user_ms_id(email, token)
    if not user_id:
        return
    async with httpx.AsyncClient() as client:
        await client.post(
            f"https://graph.microsoft.com/v1.0/chats/{chat_id}/members",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"@odata.type": "#microsoft.graph.aadUserConversationMember", "roles": ["member"],
                  "user@odata.bind": f"https://graph.microsoft.com/v1.0/users/{user_id}"},
            timeout=10,
        )


async def register_task_teams_webhook(chat_id: str, task_id: str, token: str, db: AsyncSession):
    try:
        expiry_str = (datetime.utcnow() + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        async with httpx.AsyncClient() as client:
            sub_resp = await client.post(
                "https://graph.microsoft.com/v1.0/subscriptions",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "changeType": "created",
                    "notificationUrl": f"{WHUBBI_API_URL}/task-manager/webhook/teams",
                    "resource": f"/chats/{chat_id}/messages",
                    "expirationDateTime": expiry_str,
                    "clientState": task_id,
                },
                timeout=10,
            )
            if sub_resp.status_code in (200, 201):
                sub_id = sub_resp.json().get("id", "")
                await db.execute(text("""
                    INSERT INTO task_teams_subscriptions (id, task_id, chat_id, subscription_id, expires_at, created_at)
                    VALUES (gen_random_uuid(), CAST(:tid AS UUID), :chat_id, :sub_id, :expires, NOW())
                    ON CONFLICT (chat_id) DO UPDATE SET subscription_id = EXCLUDED.subscription_id, expires_at = EXCLUDED.expires_at
                """), {"tid": task_id, "chat_id": chat_id, "sub_id": sub_id, "expires": expiry_str})
                await db.commit()
    except Exception as e:
        print(f"Task Teams webhook registration failed: {e}")


# ─── Natural-language command parsing — reuses the tool-use pattern from bot.py ─
COMMAND_TOOLS = [
    {
        "name": "update_task_status",
        "description": "Change the task's status. Only call this if the message clearly asks for a status change.",
        "input_schema": {
            "type": "object",
            "properties": {"status": {"type": "string", "enum": sorted({"new", "open", "in_progress", "resolved", "closed"})}},
            "required": ["status"],
        },
    },
    {
        "name": "reassign_task",
        "description": "Reassign the task to someone else by email. Only call this if the message clearly names a new assignee.",
        "input_schema": {
            "type": "object",
            "properties": {"assignee_email": {"type": "string"}, "assignee_name": {"type": "string"}},
            "required": ["assignee_email"],
        },
    },
]


async def _parse_command(message: str) -> dict | None:
    if not ANTHROPIC_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 300,
                    "system": "You read one Teams chat message about a WHUBBI task. If it clearly asks to "
                              "change status or reassign the task, call the matching tool. Otherwise don't call any tool.",
                    "tools": COMMAND_TOOLS,
                    "messages": [{"role": "user", "content": message}],
                },
            )
            if r.status_code != 200:
                return None
            resp = r.json()
            for block in resp.get("content", []):
                if block.get("type") == "tool_use":
                    return {"name": block["name"], "input": block.get("input", {})}
    except Exception as e:
        print(f"Task command parse error: {e}")
    return None


# ─── Webhook endpoint ───────────────────────────────────────────────────────────
@router.post("/webhook/teams")
async def teams_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    params = dict(request.query_params)
    if "validationToken" in params:
        return Response(content=params["validationToken"], media_type="text/plain")

    try:
        body = await request.json()
        for notification in body.get("value", []):
            task_id = notification.get("clientState", "")
            resource = notification.get("resource", "")
            if not task_id or not resource:
                continue

            token = await get_ms_token()
            if not token:
                continue

            async with httpx.AsyncClient() as client:
                msg_resp = await client.get(f"https://graph.microsoft.com/v1.0/{resource}",
                                             headers={"Authorization": f"Bearer {token}"}, timeout=10)
                if msg_resp.status_code != 200:
                    continue
                msg = msg_resp.json()

            sender = msg.get("from", {}).get("user", {}) or {}
            author_name = sender.get("displayName", "Teams User")
            author_email = sender.get("id", "unknown@teams")
            if "WHUBBI" in author_name:
                continue

            clean = re.sub(r"<[^>]+>", "", msg.get("body", {}).get("content", "")).strip()
            if not clean or clean == "null":
                continue

            await db.execute(text("""
                INSERT INTO task_comments (id, task_id, author_email, author_name, content, source, created_at)
                VALUES (gen_random_uuid(), CAST(:tid AS UUID), :email, :name, :content, 'teams', NOW())
            """), {"tid": task_id, "email": author_email, "name": f"[Teams] {author_name}", "content": clean})
            await db.execute(text("UPDATE tasks SET updated_at = NOW() WHERE id = CAST(:id AS UUID)"), {"id": task_id})
            await db.commit()

            # Resolve the Teams sender's real email (AAD object id -> mail) before acting on their behalf.
            acting_email = author_email
            try:
                async with httpx.AsyncClient() as client:
                    ur = await client.get(f"https://graph.microsoft.com/v1.0/users/{author_email}?$select=mail,userPrincipalName",
                                           headers={"Authorization": f"Bearer {token}"}, timeout=5)
                    if ur.status_code == 200:
                        u = ur.json()
                        acting_email = u.get("mail") or u.get("userPrincipalName") or author_email
            except Exception:
                pass

            command = await _parse_command(clean)
            if not command:
                continue

            from app.routers.task_manager import set_task_status_internal, reassign_task_internal
            try:
                if command["name"] == "update_task_status":
                    await set_task_status_internal(db, task_id, acting_email, command["input"].get("status", ""))
                    confirm = f"✅ Status updated to **{command['input'].get('status')}**, per {author_name}'s message."
                elif command["name"] == "reassign_task":
                    await reassign_task_internal(db, task_id, acting_email,
                                                  command["input"].get("assignee_email", ""),
                                                  command["input"].get("assignee_name", ""))
                    confirm = f"✅ Reassigned to **{command['input'].get('assignee_email')}**, per {author_name}'s message."
                else:
                    confirm = None
                if confirm:
                    task = await db.execute(text("SELECT teams_chat_id FROM tasks WHERE id = CAST(:id AS UUID)"), {"id": task_id})
                    row = task.fetchone()
                    if row and row.teams_chat_id:
                        await _post_chat_message(row.teams_chat_id, token, confirm)
            except Exception as e:
                # The action was rejected (e.g. permission rule) or failed — leave the raw comment logged, no crash.
                print(f"Task Teams command execution failed: {e}")

    except Exception as e:
        print(f"Task Teams webhook error: {e}")

    return Response(content="OK", media_type="text/plain")


# ─── Manual sync + chat link ────────────────────────────────────────────────────
@router.post("/tasks/{task_id}/teams/sync")
async def sync_teams_messages(task_id: str, db: AsyncSession = Depends(get_db)):
    t = await db.execute(text("SELECT teams_chat_id FROM tasks WHERE id = CAST(:id AS UUID)"), {"id": task_id})
    row = t.fetchone()
    if not row or not row.teams_chat_id:
        return {"status": "error", "message": "No Teams chat linked to this task"}

    chat_id = row.teams_chat_id
    token = await get_ms_token()
    async with httpx.AsyncClient() as client:
        msgs_resp = await client.get(f"https://graph.microsoft.com/v1.0/chats/{chat_id}/messages?$top=50",
                                      headers={"Authorization": f"Bearer {token}"}, timeout=10)
        if msgs_resp.status_code != 200:
            return {"status": "error", "message": f"Graph API error: {msgs_resp.status_code}"}

        synced = 0
        for msg in msgs_resp.json().get("value", []):
            sender = msg.get("from", {}).get("user", {}) or {}
            author_name = sender.get("displayName", "Teams User")
            if "WHUBBI" in author_name:
                continue
            content = re.sub(r"<[^>]+>", "", msg.get("body", {}).get("content", "")).strip()
            if not content or content == "null":
                continue
            msg_time = msg.get("createdDateTime", datetime.utcnow().isoformat())

            exists = await db.execute(text("""
                SELECT id FROM task_comments WHERE task_id = CAST(:tid AS UUID) AND content = :content AND author_name LIKE '[Teams]%'
            """), {"tid": task_id, "content": content})
            if not exists.fetchone():
                await db.execute(text("""
                    INSERT INTO task_comments (id, task_id, author_email, author_name, content, source, created_at)
                    VALUES (gen_random_uuid(), CAST(:tid AS UUID), 'teams@sync', :name, :content, 'teams', :ts)
                """), {"tid": task_id, "name": f"[Teams] {author_name}", "content": content, "ts": msg_time})
                synced += 1
        await db.commit()
        return {"status": "ok", "synced": synced}


@router.get("/tasks/{task_id}/teams")
async def get_teams_info(task_id: str, db: AsyncSession = Depends(get_db)):
    t = await db.execute(text("SELECT teams_chat_id FROM tasks WHERE id = CAST(:id AS UUID)"), {"id": task_id})
    row = t.fetchone()
    if not row or not row.teams_chat_id:
        return {"has_chat": False}
    return {"has_chat": True, "chat_id": row.teams_chat_id, "chat_url": f"https://teams.microsoft.com/l/chat/{row.teams_chat_id}/0"}
