# WHUBBI Teams App Package

## Before packaging

1. Replace `YOUR_BOT_APP_ID` in `manifest.json` with the actual App ID from Azure Bot resource.
2. Add two icon files:
   - `color.png` — 192×192 px, full-colour WHUBBI logo
   - `outline.png` — 32×32 px, white outline on transparent background

## Packaging

```bash
cd teams_app
zip -j whubbi_teams.zip manifest.json color.png outline.png
```

Then upload `whubbi_teams.zip` in **Teams Admin Center → Manage apps → Upload** or sideload via **Apps → Upload a custom app**.

## Environment variables needed in ECS task definition

| Variable | Where to get it |
|---|---|
| `BOT_APP_ID` | Azure Portal → Bot resource → Configuration → Microsoft App ID |
| `BOT_APP_PASSWORD` | Azure Portal → Azure AD → App registration → Certificates & secrets |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `MS_TENANT_ID` | Already set (`f4e85ba0-6103-4a2b-a0d3-9bb3bb43b9ca`) |
| `MS_CLIENT_ID` | Already set |
| `MS_CLIENT_SECRET` | Already set |

## Azure Portal setup steps

1. **Create an Azure Bot resource**
   - Portal → Create a resource → "Azure Bot"
   - Pricing tier: F0 (free) is sufficient for dev
   - After creation: **Configuration → Messaging endpoint** → `https://api.whubbi.wcomply.com/bot/messages`
   - Note the **Microsoft App ID** shown on that page

2. **Create a client secret**
   - Portal → Azure Active Directory → App registrations → find your bot app
   - Certificates & secrets → New client secret → copy the *Value* (not the ID)

3. **Enable Teams channel**
   - Azure Bot → Channels → Microsoft Teams → Save

4. **Add env vars to ECS task definition** (task-def-v9.json or via Console)
   - `BOT_APP_ID` and `BOT_APP_PASSWORD`

5. **Package and upload** the Teams app (see packaging above)

## Endpoint verification

```
GET https://api.whubbi.wcomply.com/bot/status
```
Should return `{"status": "running", "bot_configured": true, ...}`
