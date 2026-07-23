# backend/app/services/outlook.py
# Intégration Microsoft Outlook via Microsoft Graph API

import httpx
import os
from typing import Optional
from datetime import datetime

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
MS_TENANT_ID     = os.getenv("MS_TENANT_ID")
MS_CLIENT_ID     = os.getenv("MS_CLIENT_ID")
MS_CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET")

# Delegated scopes for the per-user mailbox connection (Outlook router) — distinct from the
# app-only ".default" scope used by microsoft.py's client-credentials flow for org-wide data.
DELEGATED_SCOPES = "Mail.Read Mail.Send offline_access User.Read"

async def get_access_token(user_refresh_token: str) -> dict:
    """Échanger un refresh token contre un nouvel access token Microsoft Graph.

    Azure AD may rotate the refresh token on every use — the caller must persist the
    returned refresh_token, not keep reusing the one it started with, or the connection
    will eventually stop refreshing.
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/token",
            data={
                "grant_type":    "refresh_token",
                "client_id":     MS_CLIENT_ID,
                "client_secret": MS_CLIENT_SECRET,
                "refresh_token": user_refresh_token,
                "scope":         DELEGATED_SCOPES,
            },
        )
        response.raise_for_status()
        data = response.json()
        return {
            "access_token": data["access_token"],
            "refresh_token": data.get("refresh_token", user_refresh_token),
            "expires_in": data.get("expires_in", 3600),
        }

async def get_recent_emails(access_token: str, top: int = 20) -> list[dict]:
    """Récupérer les emails récents de l'utilisateur."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GRAPH_BASE}/me/messages",
            headers={"Authorization": f"Bearer {access_token}"},
            params={
                "$top":     top,
                "$orderby": "receivedDateTime desc",
                "$select":  "id,subject,from,receivedDateTime,bodyPreview,isRead",
            },
        )
        response.raise_for_status()
        return response.json().get("value", [])

async def get_calendar_events(
    access_token: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> list[dict]:
    """Récupérer les événements du calendrier Outlook."""
    params = {
        "$orderby": "start/dateTime",
        "$select":  "id,subject,start,end,attendees,location,bodyPreview",
    }
    if start_date and end_date:
        params["startDateTime"] = start_date.isoformat()
        params["endDateTime"]   = end_date.isoformat()

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GRAPH_BASE}/me/calendarView" if (start_date and end_date) else f"{GRAPH_BASE}/me/events",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Prefer":        'outlook.timezone="Europe/Paris"',
            },
            params=params,
        )
        response.raise_for_status()
        return response.json().get("value", [])

async def send_email(
    access_token: str,
    to: list[str],
    subject: str,
    body_html: str,
    cc: Optional[list[str]] = None,
) -> bool:
    """Envoyer un email via Outlook."""
    message = {
        "subject": subject,
        "body": {"contentType": "HTML", "content": body_html},
        "toRecipients": [{"emailAddress": {"address": addr}} for addr in to],
    }
    if cc:
        message["ccRecipients"] = [{"emailAddress": {"address": addr}} for addr in cc]

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{GRAPH_BASE}/me/sendMail",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type":  "application/json",
            },
            json={"message": message},
        )
        return response.status_code == 202

async def create_calendar_event(
    access_token: str,
    subject: str,
    start: datetime,
    end: datetime,
    attendees: list[str],
    body: str = "",
    location: str = "",
) -> dict:
    """Créer un événement dans le calendrier Outlook."""
    event = {
        "subject": subject,
        "body":    {"contentType": "HTML", "content": body},
        "start":   {"dateTime": start.isoformat(), "timeZone": "Europe/Paris"},
        "end":     {"dateTime": end.isoformat(),   "timeZone": "Europe/Paris"},
        "attendees": [
            {"emailAddress": {"address": addr}, "type": "required"}
            for addr in attendees
        ],
    }
    if location:
        event["location"] = {"displayName": location}

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{GRAPH_BASE}/me/events",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type":  "application/json",
            },
            json=event,
        )
        response.raise_for_status()
        return response.json()
