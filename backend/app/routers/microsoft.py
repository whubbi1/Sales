# backend/app/routers/microsoft.py
from fastapi import APIRouter
import httpx
import os
from datetime import datetime, timedelta

router = APIRouter()

TENANT_ID     = os.getenv("MS_TENANT_ID", "f4e85ba0-6103-4a2b-a0d3-9bb3bb43b9ca")
CLIENT_ID     = os.getenv("MS_CLIENT_ID", "fa03d40b-fa3c-4a66-9902-22128558fd78")
CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET", "")

async def get_ms_token() -> str:
    url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, data={
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "scope": "https://graph.microsoft.com/.default"
        })
        resp.raise_for_status()
        return resp.json()["access_token"]

async def graph_get(path: str) -> dict:
    token = await get_ms_token()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://graph.microsoft.com/v1.0{path}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15
        )
        resp.raise_for_status()
        return resp.json()

# ─── Service Health ───────────────────────────────────────────────────────────
@router.get("/health")
async def get_ms_health():
    services = []
    try:
        data = await graph_get("/admin/serviceAnnouncement/healthOverviews")
        key_services = ["Microsoft Teams", "Exchange Online", "SharePoint Online",
                        "Microsoft 365 suite", "Azure Active Directory", "OneDrive for Business"]
        for svc in data.get("value", []):
            if svc["service"] in key_services:
                status = svc["status"]
                services.append({
                    "name": svc["service"],
                    "status": "healthy" if status == "serviceOperational" else "degraded" if "Degraded" in status or "Incident" in status else "warning",
                    "ms_status": status,
                    "id": svc["id"]
                })
    except Exception as e:
        return {"services": [], "error": str(e), "timestamp": datetime.utcnow().isoformat()}

    healthy = sum(1 for s in services if s["status"] == "healthy")
    return {
        "services": services,
        "summary": {"total": len(services), "healthy": healthy, "degraded": len(services) - healthy},
        "timestamp": datetime.utcnow().isoformat()
    }

# ─── Active Incidents ─────────────────────────────────────────────────────────
@router.get("/incidents")
async def get_ms_incidents():
    try:
        data = await graph_get("/admin/serviceAnnouncement/issues?$filter=isResolved eq false")
        incidents = []
        for issue in data.get("value", [])[:20]:
            incidents.append({
                "id": issue["id"],
                "title": issue["title"],
                "service": issue["service"],
                "status": issue["status"],
                "classification": issue.get("classification", ""),
                "start": issue.get("startDateTime", ""),
                "last_update": issue.get("lastModifiedDateTime", ""),
                "impact_description": issue.get("impactDescription", "")[:200] if issue.get("impactDescription") else ""
            })
        return {"incidents": incidents, "total": len(incidents), "timestamp": datetime.utcnow().isoformat()}
    except Exception as e:
        return {"incidents": [], "total": 0, "error": str(e)}

# ─── Microsoft 365 Users & Licenses ──────────────────────────────────────────
@router.get("/licenses")
async def get_ms_licenses():
    try:
        data = await graph_get("/subscribedSkus")
        licenses = []
        for sku in data.get("value", []):
            consumed = sku.get("consumedUnits", 0)
            enabled = sku["prepaidUnits"].get("enabled", 0)
            licenses.append({
                "name": sku.get("skuPartNumber", "Unknown"),
                "consumed": consumed,
                "total": enabled,
                "available": enabled - consumed,
                "status": "ok" if consumed < enabled else "full"
            })
        return {"licenses": licenses, "timestamp": datetime.utcnow().isoformat()}
    except Exception as e:
        return {"licenses": [], "error": str(e)}

# ─── Azure Costs (via Azure Cost Management) ──────────────────────────────────
@router.get("/costs")
async def get_azure_costs():
    """Get Azure subscription costs via Azure Cost Management API."""
    try:
        # Get Azure token (different scope)
        url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, data={
                "grant_type": "client_credentials",
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "scope": "https://management.azure.com/.default"
            })
            if resp.status_code != 200:
                return {"costs": [], "error": "Could not get Azure token — no Azure subscription access", "total": 0}
            token = resp.json()["access_token"]

            # Get subscriptions
            subs_resp = await client.get(
                "https://management.azure.com/subscriptions?api-version=2020-01-01",
                headers={"Authorization": f"Bearer {token}"}
            )
            if subs_resp.status_code != 200:
                return {"costs": [], "error": "No Azure subscriptions found", "total": 0}

            subs = subs_resp.json().get("value", [])
            if not subs:
                return {"costs": [], "error": "No Azure subscriptions", "total": 0}

            sub_id = subs[0]["subscriptionId"]
            end = datetime.utcnow().date()
            start = datetime.utcnow().replace(day=1).date()

            cost_resp = await client.post(
                f"https://management.azure.com/subscriptions/{sub_id}/providers/Microsoft.CostManagement/query?api-version=2023-11-01",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "type": "ActualCost",
                    "timeframe": "Custom",
                    "timePeriod": {"from": str(start) + "T00:00:00Z", "to": str(end) + "T23:59:59Z"},
                    "dataset": {
                        "granularity": "None",
                        "grouping": [{"type": "Dimension", "name": "ServiceName"}],
                        "aggregation": {"totalCost": {"name": "Cost", "function": "Sum"}}
                    }
                }
            )
            costs = []
            total = 0
            if cost_resp.status_code == 200:
                rows = cost_resp.json().get("properties", {}).get("rows", [])
                for row in rows:
                    cost = float(row[0]) if row else 0
                    service = row[1] if len(row) > 1 else "Unknown"
                    if cost > 0.01:
                        costs.append({"service": service, "cost": round(cost, 2), "currency": row[2] if len(row) > 2 else "USD"})
                        total += cost
                costs.sort(key=lambda x: x["cost"], reverse=True)

            return {"costs": costs, "total": round(total, 2), "period": {"start": str(start), "end": str(end)}, "subscription": subs[0].get("displayName", sub_id)}
    except Exception as e:
        return {"costs": [], "total": 0, "error": str(e)}
