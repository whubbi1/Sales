"""
WHUBBI Teams Bot
────────────────
Direct Bot Framework implementation (no botbuilder dependency) using httpx.
Receives activities from Teams, calls Claude, replies via Bot Connector API.

Endpoint: POST /bot/messages
"""

import os, json, time
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response
import httpx

router = APIRouter()

# ─── Config ────────────────────────────────────────────────────────────────────
BOT_APP_ID    = os.getenv("BOT_APP_ID", "")
BOT_APP_PASS  = os.getenv("BOT_APP_PASSWORD", "")
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")
WHUBBI_API    = os.getenv("WHUBBI_API_URL", "https://api.whubbi.wcomply.com")
MS_TENANT     = os.getenv("MS_TENANT_ID", "")
MS_CLIENT     = os.getenv("MS_CLIENT_ID", "")
MS_SECRET     = os.getenv("MS_CLIENT_SECRET", "")

# ─── Bot Framework token cache ─────────────────────────────────────────────────
_bf_token: str = ""
_bf_token_exp: float = 0.0

async def _get_bf_token() -> str:
    global _bf_token, _bf_token_exp
    if _bf_token and time.time() < _bf_token_exp - 60:
        return _bf_token

    # Try tenant-specific endpoint first (single-tenant bot), then botframework.com (multi-tenant)
    endpoints = [
        f"https://login.microsoftonline.com/{MS_TENANT}/oauth2/v2.0/token",
        "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
    ]
    async with httpx.AsyncClient(timeout=10) as c:
        for endpoint in endpoints:
            r = await c.post(endpoint, data={
                "grant_type":    "client_credentials",
                "client_id":     BOT_APP_ID,
                "client_secret": BOT_APP_PASS,
                "scope":         "https://api.botframework.com/.default",
            })
            data = r.json()
            token = data.get("access_token", "")
            if token:
                print(f"[Bot] Got BF token via {endpoint}")
                _bf_token     = token
                _bf_token_exp = time.time() + data.get("expires_in", 3600)
                return _bf_token
            else:
                print(f"[Bot] Token failed ({endpoint}): {data.get('error')} — {data.get('error_description','')[:150]}")

    print("[Bot] All token endpoints failed")
    return ""

async def _reply(service_url: str, conv_id: str, reply_to_id: str, text: str, bot_from: dict | None = None):
    token = await _get_bf_token()
    if not token:
        print("[Bot] Cannot reply — no token")
        return
    url = f"{service_url.rstrip('/')}/v3/conversations/{conv_id}/activities/{reply_to_id}"
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(url,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"type": "message", "text": text, "from": bot_from or {"id": BOT_APP_ID}},
        )
        if r.status_code >= 400:
            print(f"[Bot] Reply failed {r.status_code}: {r.text[:300]}")

async def _send_typing(service_url: str, conv_id: str):
    try:
        token = await _get_bf_token()
        url   = f"{service_url.rstrip('/')}/v3/conversations/{conv_id}/activities"
        async with httpx.AsyncClient(timeout=10) as c:
            await c.post(url,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"type": "typing"},
            )
    except Exception:
        pass

# ─── Conversation history ──────────────────────────────────────────────────────
_history: dict[str, list] = {}
_history_ts: dict[str, float] = {}
HISTORY_TTL = 3600
MAX_TURNS   = 20

def _get_history(conv_id: str) -> list:
    if conv_id in _history_ts and time.time() - _history_ts[conv_id] > HISTORY_TTL:
        _history.pop(conv_id, None)
        _history_ts.pop(conv_id, None)
    return _history.setdefault(conv_id, [])

def _push(conv_id: str, role: str, content):
    h = _get_history(conv_id)
    h.append({"role": role, "content": content})
    _history_ts[conv_id] = time.time()
    if len(h) > MAX_TURNS:
        _history[conv_id] = h[-MAX_TURNS:]

# ─── MS Graph: resolve Teams AAD ID → email ───────────────────────────────────
async def _resolve_email(aad_object_id: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            tr = await c.post(
                f"https://login.microsoftonline.com/{MS_TENANT}/oauth2/v2.0/token",
                data={"grant_type":"client_credentials","client_id":MS_CLIENT,
                      "client_secret":MS_SECRET,"scope":"https://graph.microsoft.com/.default"},
            )
            token = tr.json().get("access_token", "")
            ur = await c.get(
                f"https://graph.microsoft.com/v1.0/users/{aad_object_id}?$select=mail,userPrincipalName",
                headers={"Authorization": f"Bearer {token}"},
            )
            u = ur.json()
            return u.get("mail") or u.get("userPrincipalName", "")
    except Exception as e:
        print(f"[Bot] Graph lookup failed: {e}")
        return ""

# ─── Claude tools ─────────────────────────────────────────────────────────────
# Tool catalog, permission enforcement, and dispatch all live in bot_tools.py —
# see that module for the full list and the module/submodule/level each one requires.
from app.routers.bot_tools import fetch_perms, available_tools, run_tool, ToolCtx

# ─── Claude conversation loop ──────────────────────────────────────────────────
SYSTEM = """You are the WHUBBI assistant — an AI for the WHUBBI platform used by WCOMPLY.

Depending on the current user's permissions, you may be able to help with:
- Sales: companies, contacts, opportunities
- HR: freelancer profiles, internal recruitment pipeline, job positions
- Legal: WCOMPLY legal entities and templates
- GRC: risk register, audits, access reviews
- IT: equipment, software, applications
- Helpdesk: tickets, knowledge base
- Development: feature/bug requests
- Training: course catalog and assignments
- Task Manager: tasks across all modules
- Admin: users, AWS costs, system health

You only see the tools this specific user is authorized to use — the tool list you're given already
reflects their WHUBBI permissions, so if a tool isn't offered to you, don't claim it doesn't exist;
just don't attempt that kind of request. If a tool result contains "permission_denied", tell the user
plainly they don't have access to that data or action, and point them to WHUBBI Permissions
(/settings/permissions or /rh/permissions) to request it — do not try another tool to work around it,
and do not fabricate an answer.

Rules:
- Be concise. Use bullet points for lists, bold for names.
- For lists show: the most identifying field (name/title) plus the most relevant metric or status.
- When the user refers to a person by name, call search_profiles first to find their ID.
- For any write/create/update/delete operation, always confirm first: state exactly what you are
  about to do and ask "Shall I proceed?" — then act only once confirmed.
- For legal data, call check_legal_access first if you are unsure whether the user has access.
- Format dates as DD/MM/YYYY. Monetary amounts in €.
- If you don't have enough data to answer, call the appropriate tool — don't guess.
"""

async def _chat(conv_id: str, user_msg: str, user_email: str, user_name: str) -> str:
    _push(conv_id, "user", user_msg)
    system = f"{SYSTEM}\nCurrent user: {user_name} ({user_email})"

    async with httpx.AsyncClient(timeout=20) as tool_http:
        perms = await fetch_perms(tool_http, WHUBBI_API, user_email)
        tools = available_tools(perms)
        ctx = ToolCtx(email=user_email, name=user_name, perms=perms, api=WHUBBI_API, http=tool_http)

        for _ in range(6):
            async with httpx.AsyncClient(timeout=60) as c:
                r = await c.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": ANTHROPIC_KEY,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": "claude-haiku-4-5-20251001",
                        "max_tokens": 1500,
                        "system": system,
                        "tools": tools,
                        "messages": _get_history(conv_id),
                    },
                )

            if r.status_code != 200:
                err = r.json().get("error", {}).get("message", "Unknown AI error")
                return f"Sorry, AI error: {err}"

            resp    = r.json()
            content = resp.get("content", [])
            stop    = resp.get("stop_reason")

            _push(conv_id, "assistant", content)

            if stop == "end_turn":
                return next((b["text"] for b in content if b["type"] == "text"), "")

            if stop == "tool_use":
                tool_results = []
                for block in content:
                    if block["type"] == "tool_use":
                        result = await run_tool(block["name"], block["input"], ctx)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block["id"],
                            "content": result,
                        })
                _push(conv_id, "user", tool_results)

    return "Sorry, I couldn't complete your request. Please try again."

# ─── FastAPI endpoint ──────────────────────────────────────────────────────────
@router.post("/messages")
async def messages(request: Request):
    try:
        body = await request.json()
    except Exception:
        return Response(status_code=400)

    activity_type = body.get("type", "")
    conv_id       = (body.get("conversation") or {}).get("id", "")
    service_url   = body.get("serviceUrl", "")
    activity_id   = body.get("id", "")
    from_obj      = body.get("from") or {}
    user_name     = from_obj.get("name", "Unknown") or "Unknown"
    aad_id        = from_obj.get("aadObjectId")
    recipient     = body.get("recipient") or {}

    # Welcome message when bot is added
    if activity_type == "conversationUpdate":
        members = body.get("membersAdded", [])
        bot_id  = recipient.get("id", "")
        for m in members:
            if m.get("id") != bot_id:
                await _reply(service_url, conv_id, activity_id,
                    "Hi! I'm the WHUBBI assistant.\n\n"
                    "I can help you with HR data — freelancers, recruitment pipeline, job positions and more.\n\n"
                    "Try: 'Show me available freelancers in France' or 'What's the recruitment pipeline?'",
                    bot_from=recipient)
        return Response(status_code=200)

    if activity_type != "message":
        return Response(status_code=200)

    text = (body.get("text") or "").strip()
    if not text:
        return Response(status_code=200)

    # Resolve user email
    user_email = ""
    if aad_id and MS_TENANT:
        user_email = await _resolve_email(aad_id)
    if not user_email:
        user_email = user_name.lower().replace(" ", ".") + "@wcomply.com"

    # Send typing indicator
    await _send_typing(service_url, conv_id)

    # Get Claude response
    try:
        reply_text = await _chat(conv_id, text, user_email, user_name)
    except Exception as e:
        print(f"[Bot] Chat error: {e}")
        reply_text = "Sorry, something went wrong. Please try again."

    await _reply(service_url, conv_id, activity_id, reply_text, bot_from=recipient)
    return Response(status_code=200)

@router.get("/status")
async def status():
    return {
        "status": "running",
        "bot_configured": bool(BOT_APP_ID and BOT_APP_PASS),
        "app_id": (BOT_APP_ID[:8] + "...") if BOT_APP_ID else "not set",
    }
