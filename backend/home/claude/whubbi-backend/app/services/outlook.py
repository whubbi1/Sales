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

async def get_access_token(user_refresh_token: str) -> str:
    """Obtenir un access token Microsoft Graph depuis un refresh token utilisateur."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/token",
            data={
                "grant_type":    "refresh_token",
                "client_id":     MS_CLIENT_ID,
                "client_secret": MS_CLIENT_SECRET,
                "refresh_token": user_refresh_token,
                "scope":         "https://graph.microsoft.com/.default",
            },
        )
        response.raise_for_status()
        return response.json()["access_token"]

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
