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
import httpx
import mcp.types as types
from mcp.server.fastmcp import FastMCP

from app.routers.bot_tools import fetch_perms, available_tools, run_tool, ToolCtx

WHUBBI_API = os.getenv("WHUBBI_API_URL", "https://api.whubbi.wcomply.com")

# streamable_http_path="/" because this app gets mounted at /mcp on the main FastAPI app —
# leaving the default "/mcp" here would double the prefix to /mcp/mcp.
mcp_app = FastMCP("whubbi", streamable_http_path="/")
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
