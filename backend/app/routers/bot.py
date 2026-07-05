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
TOOLS = [
    {
        "name": "hr_dashboard",
        "description": "Get HR overview: total freelancers, candidates by status and country, recent activity.",
        "input_schema": {"type":"object","properties":{}},
    },
    {
        "name": "get_freelancers",
        "description": "List freelancers. Filter by country (france/portugal/czech_republic/romania/spain) and/or search by name or skill keyword.",
        "input_schema": {
            "type":"object",
            "properties": {
                "country": {"type":"string"},
                "search":  {"type":"string"},
            },
        },
    },
    {
        "name": "get_freelancer",
        "description": "Full profile for one freelancer: contact, skills, projects, recent comments, documents.",
        "input_schema": {
            "type":"object",
            "properties": {"profile_id": {"type":"string"}},
            "required": ["profile_id"],
        },
    },
    {
        "name": "get_recruitment_pipeline",
        "description": "List internal recruitment candidates. Filter by status and/or country.",
        "input_schema": {
            "type":"object",
            "properties": {
                "status":  {"type":"string"},
                "country": {"type":"string"},
            },
        },
    },
    {
        "name": "get_job_positions",
        "description": "List all job positions with open/closed status.",
        "input_schema": {"type":"object","properties":{}},
    },
    {
        "name": "search_profiles",
        "description": "Search for a person by name across both freelancers and internal candidates.",
        "input_schema": {
            "type":"object",
            "properties": {"name": {"type":"string"}},
            "required": ["name"],
        },
    },
    {
        "name": "add_comment",
        "description": "Add a comment or note to a profile. Always confirm with the user before calling this.",
        "input_schema": {
            "type":"object",
            "properties": {
                "profile_id":   {"type":"string"},
                "profile_type": {"type":"string","enum":["freelancer","internal"]},
                "content":      {"type":"string"},
                "comment_type": {"type":"string","enum":["note","call","email","interview"]},
            },
            "required": ["profile_id","profile_type","content","comment_type"],
        },
    },
    {
        "name": "update_recruitment_status",
        "description": "Move a candidate to a new recruitment stage. Always confirm with the user before calling this.",
        "input_schema": {
            "type":"object",
            "properties": {
                "profile_id": {"type":"string"},
                "status": {
                    "type":"string",
                    "enum":["new","screening","interview_1","technical_test","offer","hired","rejected","on_hold"],
                },
            },
            "required": ["profile_id","status"],
        },
    },
    {
        "name": "check_legal_access",
        "description": "Check what legal module permissions the current user has (entities, templates, admin). Call this before get_legal_entities or get_legal_templates.",
        "input_schema": {"type":"object","properties":{}},
    },
    {
        "name": "get_legal_entities",
        "description": "List WCOMPLY legal entities with registration info and document links. Requires legal.entities permission.",
        "input_schema": {
            "type":"object",
            "properties": {
                "country": {"type":"string","description":"Filter by country (France, Portugal, etc.)"},
            },
        },
    },
    {
        "name": "get_legal_templates",
        "description": "List legal template documents available on SharePoint. Requires legal.templates permission.",
        "input_schema": {
            "type":"object",
            "properties": {
                "country": {"type":"string","description":"Filter by country or 'global' for all"},
            },
        },
    },
]

# ─── Tool execution ────────────────────────────────────────────────────────────
async def _run_tool(name: str, inp: dict, user_email: str, user_name: str) -> str:
    async with httpx.AsyncClient(timeout=20) as c:
        if name == "hr_dashboard":
            r = await c.get(f"{WHUBBI_API}/hr/dashboard")
            return json.dumps(r.json())

        elif name == "get_freelancers":
            r = await c.get(f"{WHUBBI_API}/hr/freelancers")
            rows = r.json().get("freelancers", [])
            if inp.get("country"):
                rows = [f for f in rows if (f.get("country") or "").lower() == inp["country"].lower()]
            if inp.get("search"):
                q = inp["search"].lower()
                rows = [f for f in rows if
                    q in f"{f.get('first_name','')} {f.get('last_name','')}".lower() or
                    any(q in s.lower() for s in (f.get("skills") or []))]
            return json.dumps([{
                "id": f["id"],
                "name": f"{f.get('first_name','')} {f.get('last_name','')}".strip(),
                "title": f.get("current_title",""),
                "country": f.get("country",""),
                "daily_rate": f.get("daily_rate"),
                "availability_date": str(f.get("availability_date",""))[:10] or None,
                "skills": (f.get("skills") or [])[:6],
                "years_experience": f.get("years_experience"),
            } for f in rows[:20]])

        elif name == "get_freelancer":
            r = await c.get(f"{WHUBBI_API}/hr/freelancers/{inp['profile_id']}")
            d = r.json()
            return json.dumps({
                "name": f"{d.get('first_name','')} {d.get('last_name','')}".strip(),
                "title": d.get("current_title"), "email": d.get("email"),
                "phone": d.get("phone"), "linkedin": d.get("linkedin_url"),
                "country": d.get("country"), "daily_rate": d.get("daily_rate"),
                "availability": str(d.get("availability_date",""))[:10] or None,
                "skills": d.get("skills",[]),
                "years_experience": d.get("years_experience"),
                "projects": [
                    {"title":p.get("title"),"company":p.get("company"),
                     "from":p.get("start_date"),"to":p.get("end_date"),
                     "tech":(p.get("technologies") or [])[:5]}
                    for p in (d.get("projects") or [])[:6]
                ],
                "recent_comments": [
                    {"by":cc.get("author_name"),"type":cc.get("comment_type"),
                     "text":(cc.get("content") or "")[:300],
                     "date":str(cc.get("created_at",""))[:10]}
                    for cc in (d.get("comments") or [])[:4]
                ],
                "documents": len(d.get("documents") or []),
                "has_cv": bool(d.get("cv_sharepoint_url")),
            })

        elif name == "get_recruitment_pipeline":
            params = {}
            if inp.get("status"): params["status"] = inp["status"]
            r = await c.get(f"{WHUBBI_API}/hr/recruitment", params=params)
            rows = r.json().get("candidates", [])
            if inp.get("country"):
                rows = [cc for cc in rows if (cc.get("country") or "").lower() == inp["country"].lower()]
            return json.dumps([{
                "id": cc["id"],
                "name": f"{cc.get('first_name','')} {cc.get('last_name','')}".strip(),
                "status": cc.get("recruitment_status"),
                "country": cc.get("country"),
                "title": cc.get("current_title"),
                "position": cc.get("job_position_title",""),
            } for cc in rows[:25]])

        elif name == "get_job_positions":
            r = await c.get(f"{WHUBBI_API}/hr/positions")
            return json.dumps(r.json().get("positions", []))

        elif name == "search_profiles":
            q = inp["name"].lower()
            fr = await c.get(f"{WHUBBI_API}/hr/freelancers")
            rc = await c.get(f"{WHUBBI_API}/hr/recruitment")
            results = []
            for f in fr.json().get("freelancers", []):
                full = f"{f.get('first_name','')} {f.get('last_name','')}".lower()
                if q in full:
                    results.append({"id":f["id"],"name":full.title(),"type":"freelancer",
                                    "country":f.get("country"),"title":f.get("current_title")})
            for cc in rc.json().get("candidates", []):
                full = f"{cc.get('first_name','')} {cc.get('last_name','')}".lower()
                if q in full:
                    results.append({"id":cc["id"],"name":full.title(),"type":"internal",
                                    "status":cc.get("recruitment_status"),"country":cc.get("country")})
            return json.dumps(results)

        elif name == "add_comment":
            endpoint = "freelancers" if inp["profile_type"] == "freelancer" else "recruitment"
            r = await c.post(
                f"{WHUBBI_API}/hr/{endpoint}/{inp['profile_id']}/comments",
                json={
                    "content": inp["content"],
                    "comment_type": inp.get("comment_type","note"),
                    "author_email": user_email,
                    "author_name": user_name,
                },
            )
            return json.dumps(r.json())

        elif name == "update_recruitment_status":
            r = await c.put(
                f"{WHUBBI_API}/hr/recruitment/{inp['profile_id']}/status",
                json={"status": inp["status"]},
            )
            return json.dumps(r.json())

        elif name == "check_legal_access":
            if not user_email:
                return json.dumps({"entities": "none", "templates": "none", "admin": "none"})
            try:
                pr = await c.get(f"{WHUBBI_API}/settings/permissions/{user_email}")
                perms = pr.json().get("permissions", {})
                legal = perms.get("legal", {})
                return json.dumps({
                    "entities":  legal.get("entities",  {}).get("access_mode", "none"),
                    "templates": legal.get("templates", {}).get("access_mode", "none"),
                    "admin":     legal.get("admin",     {}).get("access_mode", "none"),
                })
            except Exception:
                return json.dumps({"entities": "none", "templates": "none", "admin": "none"})

        elif name == "get_legal_entities":
            if user_email:
                try:
                    pr = await c.get(f"{WHUBBI_API}/settings/permissions/{user_email}")
                    perm = pr.json().get("permissions", {}).get("legal", {}).get("entities", {})
                    if perm.get("access_mode", "none") == "none":
                        return json.dumps({"error": "You don't have permission to access Legal Entities. Ask your HR administrator to grant you access via the HR Permissions page."})
                except Exception:
                    pass
            r = await c.get(f"{WHUBBI_API}/legal/entities")
            entities = r.json().get("entities", [])
            if inp.get("country"):
                entities = [e for e in entities if (e.get("country") or "").lower() == inp["country"].lower()]
            return json.dumps([{
                "id": e["id"],
                "name": e["legal_name"],
                "address": e.get("legal_address"),
                "country": e.get("country"),
                "registration": f"{e.get('registration_description','')} {e.get('registration_value','')}".strip(),
                "document_count": len(e.get("documents") or []),
            } for e in entities])

        elif name == "get_legal_templates":
            if user_email:
                try:
                    pr = await c.get(f"{WHUBBI_API}/settings/permissions/{user_email}")
                    perm = pr.json().get("permissions", {}).get("legal", {}).get("templates", {})
                    if perm.get("access_mode", "none") == "none":
                        return json.dumps({"error": "You don't have permission to access Legal Templates. Ask your HR administrator to grant you access via the HR Permissions page."})
                except Exception:
                    pass
            params = {}
            if inp.get("country"):
                params["country"] = inp["country"]
            r = await c.get(f"{WHUBBI_API}/legal/templates", params=params)
            templates = r.json().get("templates", [])
            return json.dumps([{
                "id": t["id"],
                "title": t["title"],
                "description": t.get("description"),
                "doc_type": t.get("doc_type"),
                "country": t.get("country"),
                "has_link": bool(t.get("sharepoint_url")),
            } for t in templates])

    return json.dumps({"error": f"Unknown tool: {name}"})

# ─── Claude conversation loop ──────────────────────────────────────────────────
SYSTEM = """You are the WHUBBI assistant — an AI for the WHUBBI HR and CRM platform used by WCOMPLY.

You help HR and Legal teams with:
- HR: freelancer profiles (skills, availability, daily rate, projects)
- HR: internal recruitment pipeline and job positions
- HR: add comments/notes, move candidates through stages
- Legal: WCOMPLY legal entities with registration info and documents
- Legal: legal template documents stored on SharePoint

Rules:
- Be concise. Use bullet points for lists, bold for names.
- For lists of people show: name, title, country, and the most relevant metric.
- When the user refers to a person by name, call search_profiles first to find their ID.
- For write operations (add_comment, update_recruitment_status) always confirm:
  state what you are about to do and ask "Shall I proceed?" — then act only when confirmed.
- For legal data, call check_legal_access first if you are unsure whether the user has access.
  If they lack access, tell them to contact their HR administrator or visit /rh/permissions.
- Format dates as DD/MM/YYYY. Daily rates in €/day.
- If you don't have enough data to answer, call the appropriate tool — don't guess.
"""

async def _chat(conv_id: str, user_msg: str, user_email: str, user_name: str) -> str:
    _push(conv_id, "user", user_msg)
    system = f"{SYSTEM}\nCurrent user: {user_name} ({user_email})"

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
                    "tools": TOOLS,
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
                    result = await _run_tool(block["name"], block["input"], user_email, user_name)
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
