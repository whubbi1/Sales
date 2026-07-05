# Connecting Claude to WHUBBI via MCP

WHUBBI exposes the same permission-gated tools the Teams bot uses (freelancers, recruitment, sales, GRC, IT, helpdesk, tasks, MyWhubbi, etc.) as a remote MCP server at:

```
https://api.whubbi.wcomply.com/mcp
```

## 1. Get a token

Go to **[/settings/mcp](https://app.whubbi.wcomply.com/settings/mcp)** while logged in, click **New Token**, and copy the value shown — it's only displayed once.

## 2. Add it to your client

**Claude Code**:
```bash
claude mcp add --transport http whubbi https://api.whubbi.wcomply.com/mcp \
  --header "Authorization: Bearer <your token>"
```

**Claude Desktop / claude.ai** (remote MCP connector): add a connector with URL `https://api.whubbi.wcomply.com/mcp` and header `Authorization: Bearer <your token>`.

## How it works

Every request is resolved back to your WHUBBI identity via the token, then filtered through the exact same `whubbi_permissions` matrix as the Permissions page — you only ever see the tools your account is authorized to use, and writes are checked the same way. Revoke a token any time from `/settings/mcp`; it takes effect immediately.
