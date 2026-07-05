"""
WHUBBI MCP Server
──────────────────
Exposes the exact same permission-gated tool catalog as the Teams bot (bot_tools.py) over the
Model Context Protocol, via Streamable HTTP transport mounted at /mcp. Not a reimplementation —
tools/list and tools/call both call straight into bot_tools.py, so any tool added for the Teams
bot is automatically available here too, with identical permission enforcement.

Identity: callers authenticate with a personal access token (Authorization: Bearer <token>,
issued via POST /settings/mcp-tokens, managed at /settings/mcp), resolved to a WHUBBI user email
via GET /settings/mcp-whoami on every request.
"""

import os
from urllib.parse import urlparse

import httpx
import mcp.types as types
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from app.routers.bot_tools import fetch_perms, available_tools, run_tool, ToolCtx

WHUBBI_API = os.getenv("WHUBBI_API_URL", "https://api.whubbi.wcomply.com")
_api_host = urlparse(WHUBBI_API).netloc

# Left at the SDK's default streamable_http_path ("/mcp") and mounted at "/" in main.py (rather
# than mounted at "/mcp" with this path overridden to "/") so the documented URL
# (https://api.whubbi.wcomply.com/mcp, no trailing slash) matches exactly with no redirect —
# some MCP clients don't replay a POST correctly across a 307.
#
# transport_security must explicitly allowlist our real host: the SDK's DNS-rebinding protection
# defaults to an empty allowed_hosts list, which rejects every real Host header (421) unless the
# app is only ever accessed as localhost.
mcp_app = FastMCP("whubbi", transport_security=TransportSecuritySettings(
    allowed_hosts=[_api_host, "localhost", "localhost:*", "127.0.0.1", "127.0.0.1:*"],
    allowed_origins=["https://claude.ai"],
))
_server = mcp_app._mcp_server


def _auth_header() -> str:
    req = _server.request_context.request
    return ((req.headers.get("authorization") if req is not None else "") or "")


async def _resolve_identity(http: httpx.AsyncClient) -> tuple[str, str] | tuple[None, None]:
    auth = _auth_header()
    if not auth:
        return None, None
    r = await http.get(f"{WHUBBI_API}/settings/mcp-whoami", headers={"Authorization": auth})
    if r.status_code != 200:
        return None, None
    d = r.json()
    return d["email"], d.get("name") or d["email"]


@_server.list_tools()
async def _list_tools() -> list[types.Tool]:
    async with httpx.AsyncClient(timeout=15) as http:
        email, _ = await _resolve_identity(http)
        if not email:
            return []
        perms = await fetch_perms(http, WHUBBI_API, email)
        tools = available_tools(perms)
    return [types.Tool(name=t["name"], description=t["description"], inputSchema=t["input_schema"])
            for t in tools]


@_server.call_tool()
async def _call_tool(name: str, arguments: dict) -> list[types.ContentBlock]:
    async with httpx.AsyncClient(timeout=20) as http:
        email, user_name = await _resolve_identity(http)
        if not email:
            return [types.TextContent(type="text",
                text='{"error": "Invalid or missing WHUBBI access token. Generate one at /settings/mcp."}')]
        perms = await fetch_perms(http, WHUBBI_API, email)
        ctx = ToolCtx(email=email, name=user_name, perms=perms, api=WHUBBI_API, http=http)
        result = await run_tool(name, arguments or {}, ctx)
    return [types.TextContent(type="text", text=result)]
