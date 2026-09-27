# backend/app/services/portal_mail.py
# Sends Portal invitation emails (customer and partner contacts alike) via Microsoft
# Graph, app-only (client_credentials — same token pattern as app/routers/microsoft.py's
# org-wide Graph calls), from a dedicated service mailbox. Requires that mailbox to
# exist and the app registration to have been granted admin-consented Mail.Send
# (application) permission.
import os
import httpx

MS_TENANT_ID     = os.getenv("MS_TENANT_ID")
MS_CLIENT_ID     = os.getenv("MS_CLIENT_ID")
MS_CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET")
PORTAL_SERVICE_MAILBOX = os.getenv("PORTAL_SERVICE_MAILBOX", "noreply@wcomply.com")

PORTAL_LABELS = {"partner": "Portal"}
PORTAL_HOSTS  = {"partner": "portal.wcomply.com"}


async def _get_app_only_token() -> str:
    url = f"https://login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/token"
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, data={
            "grant_type": "client_credentials",
            "client_id": MS_CLIENT_ID,
            "client_secret": MS_CLIENT_SECRET,
            "scope": "https://graph.microsoft.com/.default",
        })
        resp.raise_for_status()
        return resp.json()["access_token"]


async def send_portal_invitation_email(
    to_email: str,
    contact_first_name: str,
    portal_type: str,
    token: str,
    invited_by: str,
) -> None:
    label = PORTAL_LABELS.get(portal_type, "Portal")
    host  = PORTAL_HOSTS.get(portal_type, "wcomply.com")
    link  = f"https://{host}/invite/{token}"

    body_html = f"""
    <p>Hi {contact_first_name or ''},</p>
    <p>{invited_by or 'A member of the WCOMPLY team'} has invited you to the WHUBBI {label}.</p>
    <p>Use the link below to connect with your Microsoft or Google account:</p>
    <p><a href="{link}">{link}</a></p>
    <p>This link expires in 7 days. If you weren't expecting this invitation, you can ignore this email.</p>
    """

    message = {
        "message": {
            "subject": f"You've been invited to the WHUBBI {label}",
            "body": {"contentType": "HTML", "content": body_html},
            "toRecipients": [{"emailAddress": {"address": to_email}}],
        },
        "saveToSentItems": "true",
    }

    access_token = await _get_app_only_token()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://graph.microsoft.com/v1.0/users/{PORTAL_SERVICE_MAILBOX}/sendMail",
            headers={"Authorization": f"Bearer {access_token}"},
            json=message,
            timeout=15,
        )
        resp.raise_for_status()
