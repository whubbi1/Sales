# backend/app/routers/portal.py
# Portal (customer and partner contacts share the same portal.wcomply.com entry
# point): invitation issuance (internal, existing X-User-Email model) plus the
# public-facing invitation-acceptance/session/self-profile endpoints (real JWT
# verification via app/services/portal_auth.py — see that module's docstring for why).
# `portal_type` is kept as a field throughout (DB columns, request/response bodies)
# even though "partner" is the only value PORTAL_TYPES allows — it's a leftover name
# from when customer/partner were separate portals, kept because renaming it end to
# end (DB column, API field, stored rows) isn't worth it for a value that's purely
# internal bookkeeping now; eligibility itself already covers both audiences.
import json
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.authz import require_permission, get_current_user_email
from app.services.portal_auth import verify_portal_id_token, require_portal_user
from app.services.portal_mail import send_portal_invitation_email

router = APIRouter()

PORTAL_TYPES = ("partner",)
INVITE_VALIDITY_DAYS = 7


def _row(r):
    return dict(r._mapping) if r else None


async def _get_contact_with_company(db: AsyncSession, contact_id: str):
    r = await db.execute(
        text("""
            SELECT c.*, co.status AS company_status, co.name AS company_name
            FROM contacts c LEFT JOIN companies co ON co.id = c.company_id
            WHERE c.id = CAST(:id AS UUID)
        """),
        {"id": contact_id},
    )
    return _row(r.fetchone())


def _check_eligibility(contact: dict, portal_type: str) -> None:
    eligible = contact.get("company_status") in ("partner", "client") or bool(contact.get("partner_id"))
    if not eligible:
        raise HTTPException(400, f"This contact is not eligible for the {portal_type} portal")


# ─── Internal: create & manage invitations ──────────────────────────────────────
@router.post("/invitations")
async def create_invitation(
    data: dict,
    db: AsyncSession = Depends(get_db),
    caller: str = Depends(get_current_user_email),
    _: str = Depends(require_permission("sales", "contacts", "edit")),
):
    contact_id = data.get("contact_id")
    portal_type = data.get("portal_type")
    if portal_type not in PORTAL_TYPES:
        raise HTTPException(400, "portal_type must be 'partner'")
    if not contact_id:
        raise HTTPException(400, "contact_id is required")

    contact = await _get_contact_with_company(db, contact_id)
    if not contact:
        raise HTTPException(404, "Contact not found")
    if not contact.get("email"):
        raise HTTPException(400, "This contact has no email address on file")
    _check_eligibility(contact, portal_type)

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=INVITE_VALIDITY_DAYS)
    r = await db.execute(
        text("""
            INSERT INTO portal_invitations (contact_id, portal_type, token, invited_by, expires_at)
            VALUES (CAST(:contact_id AS UUID), :portal_type, :token, :invited_by, :expires_at)
            RETURNING id, token, expires_at
        """),
        {"contact_id": contact_id, "portal_type": portal_type, "token": token,
         "invited_by": caller, "expires_at": expires_at},
    )
    invitation = _row(r.fetchone())
    await db.commit()

    try:
        await send_portal_invitation_email(
            to_email=contact["email"],
            contact_first_name=contact.get("first_name") or "",
            portal_type=portal_type,
            token=token,
            invited_by=caller,
        )
    except Exception as e:
        # The invitation row above is already committed and its token is valid —
        # only the email delivery failed. Surface that distinction instead of a
        # bare 500, so the caller isn't left unsure whether anything happened.
        raise HTTPException(
            502,
            f"Invitation was created but the email to {contact['email']} could not be sent "
            f"({e}). Once mail delivery is fixed, click Invite to Portal again — a new invite "
            f"email will go out (the earlier invitation record still exists but was never "
            f"delivered, so it's safe to retry).",
        )

    return {
        "id": str(invitation["id"]),
        "portal_type": portal_type,
        "expires_at": invitation["expires_at"].isoformat(),
        "sent_to": contact["email"],
    }


@router.get("/invitations")
async def list_invitations(
    contact_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_permission("sales", "contacts", "view")),
):
    where = ""
    params = {}
    if contact_id:
        where = "WHERE pi.contact_id = CAST(:contact_id AS UUID)"
        params["contact_id"] = contact_id
    r = await db.execute(
        text(f"""
            SELECT pi.*, c.first_name AS contact_first_name, c.last_name AS contact_last_name,
                   c.email AS contact_email, co.name AS company_name
            FROM portal_invitations pi
            JOIN contacts c ON c.id = pi.contact_id
            LEFT JOIN companies co ON co.id = c.company_id
            {where}
            ORDER BY pi.created_at DESC
        """),
        params,
    )
    return {"invitations": [_row(row) for row in r.fetchall()]}


@router.get("/users")
async def list_portal_users(
    contact_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_permission("sales", "contacts", "view")),
):
    where = ""
    params = {}
    if contact_id:
        where = "WHERE pu.contact_id = CAST(:contact_id AS UUID)"
        params["contact_id"] = contact_id
    r = await db.execute(
        text(f"""
            SELECT pu.*, c.first_name AS contact_first_name, c.last_name AS contact_last_name,
                   co.name AS company_name
            FROM portal_users pu
            JOIN contacts c ON c.id = pu.contact_id
            LEFT JOIN companies co ON co.id = c.company_id
            {where}
            ORDER BY pu.created_at DESC
        """),
        params,
    )
    return {"users": [_row(row) for row in r.fetchall()]}


@router.post("/invitations/{invitation_id}/revoke")
async def revoke_invitation(
    invitation_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_permission("sales", "contacts", "edit")),
):
    await db.execute(
        text("UPDATE portal_invitations SET status = 'revoked' WHERE id = CAST(:id AS UUID) AND status = 'pending'"),
        {"id": invitation_id},
    )
    await db.commit()
    return {"ok": True}


@router.post("/users/{portal_user_id}/revoke")
async def revoke_portal_user(
    portal_user_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_permission("sales", "contacts", "edit")),
):
    await db.execute(
        text("UPDATE portal_users SET status = 'revoked' WHERE id = CAST(:id AS UUID)"),
        {"id": portal_user_id},
    )
    await db.commit()
    return {"ok": True}


# ─── Public: invitation lookup, session exchange ────────────────────────────────
@router.get("/invitations/check-email")
async def check_invitation_by_email(email: str, portal_type: str, db: AsyncSession = Depends(get_db)):
    # Lets the Create Account form reject an ineligible email immediately, before the
    # person invests in confirming an email code and enrolling MFA only to be rejected
    # by /portal/session at the very last step. Same public exposure level as the
    # by-token lookup below (an email address is the only thing revealed, no contact
    # details), just keyed by email instead of a token for the no-token entry point.
    email = email.strip().lower()
    if portal_type not in PORTAL_TYPES:
        raise HTTPException(400, "portal_type must be 'partner'")

    r = await db.execute(
        text("SELECT 1 FROM portal_users WHERE email = :email AND portal_type = :portal_type AND status = 'active'"),
        {"email": email, "portal_type": portal_type},
    )
    if r.fetchone():
        return {"status": "already_active"}

    r = await db.execute(
        text("""
            SELECT 1 FROM portal_invitations pi JOIN contacts c ON c.id = pi.contact_id
            WHERE pi.portal_type = :portal_type AND pi.status = 'pending' AND pi.expires_at > NOW()
              AND LOWER(c.email) = :email
        """),
        {"portal_type": portal_type, "email": email},
    )
    if r.fetchone():
        return {"status": "invited"}

    return {"status": "not_invited"}


@router.get("/invitations/by-token/{token}")
async def get_invitation_by_token(token: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        text("""
            SELECT pi.*, c.first_name AS contact_first_name
            FROM portal_invitations pi JOIN contacts c ON c.id = pi.contact_id
            WHERE pi.token = :token
        """),
        {"token": token},
    )
    row = _row(r.fetchone())
    if not row:
        return {"valid": False, "expired": False, "already_accepted": False}

    expired = row["status"] == "pending" and datetime.utcnow() > row["expires_at"]
    return {
        "valid": row["status"] == "pending" and not expired,
        "expired": expired,
        "already_accepted": row["status"] == "accepted",
        "revoked": row["status"] == "revoked",
        "portal_type": row["portal_type"],
        "contact_first_name": row["contact_first_name"],
    }


@router.post("/session")
async def create_portal_session(data: dict, db: AsyncSession = Depends(get_db)):
    id_token = data.get("id_token")
    portal_type = data.get("portal_type")
    invite_token = data.get("invite_token")
    if portal_type not in PORTAL_TYPES:
        raise HTTPException(400, "portal_type must be 'partner'")
    if not id_token:
        raise HTTPException(400, "id_token is required")

    claims = await verify_portal_id_token(id_token)
    email = claims["email"].strip().lower()
    identities = claims.get("identities") or []
    auth_provider = identities[0].get("providerName") if identities else "Cognito"

    if invite_token:
        r = await db.execute(text("SELECT * FROM portal_invitations WHERE token = :t"), {"t": invite_token})
        invitation = _row(r.fetchone())
        if not invitation:
            raise HTTPException(404, "Invitation not found")
        if invitation["status"] != "pending":
            raise HTTPException(400, f"This invitation has already been {invitation['status']}")
        if datetime.utcnow() > invitation["expires_at"]:
            raise HTTPException(400, "This invitation has expired")
        if invitation["portal_type"] != portal_type:
            raise HTTPException(400, "Invitation/portal mismatch")

        contact = await _get_contact_with_company(db, str(invitation["contact_id"]))
        if not contact or (contact.get("email") or "").strip().lower() != email:
            raise HTTPException(403, "This invitation was sent to a different email address")

        await db.execute(
            text("UPDATE portal_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = :id"),
            {"id": invitation["id"]},
        )
        await db.execute(
            text("""
                INSERT INTO portal_users (contact_id, email, portal_type, auth_provider, first_login_at, last_login_at)
                VALUES (CAST(:contact_id AS UUID), :email, :portal_type, :auth_provider, NOW(), NOW())
                ON CONFLICT (email, portal_type) DO UPDATE
                SET status = 'active', auth_provider = EXCLUDED.auth_provider, last_login_at = NOW()
            """),
            {"contact_id": invitation["contact_id"], "email": email,
             "portal_type": portal_type, "auth_provider": auth_provider},
        )
        await db.commit()
        contact_id = invitation["contact_id"]
    else:
        r = await db.execute(
            text("SELECT * FROM portal_users WHERE email = :email AND portal_type = :portal_type AND status = 'active'"),
            {"email": email, "portal_type": portal_type},
        )
        portal_user = _row(r.fetchone())
        if not portal_user:
            raise HTTPException(403, "This account has not been invited to this portal")
        await db.execute(
            text("UPDATE portal_users SET last_login_at = NOW() WHERE id = :id"),
            {"id": portal_user["id"]},
        )
        await db.commit()
        contact_id = portal_user["contact_id"]

    contact = await _get_contact_with_company(db, str(contact_id))
    terms_row = (await db.execute(
        text("SELECT terms_accepted_at FROM portal_users WHERE email = :email AND portal_type = :portal_type"),
        {"email": email, "portal_type": portal_type},
    )).fetchone()
    return {
        "email": email,
        "name": f"{contact.get('first_name','')} {contact.get('last_name','')}".strip(),
        "portal_type": portal_type,
        "company_name": contact.get("company_name"),
        "terms_accepted_at": terms_row[0].isoformat() if terms_row and terms_row[0] else None,
    }


# ─── Portal user: self profile ("MyWHUBBI") ─────────────────────────────────────
# job_name is "Job Title" in the portal's own wording — job_type (a separate, internal
# CRM segmentation enum) is deliberately not exposed here.
PORTAL_SELF_FIELDS = {"first_name", "last_name", "mobile_phone", "job_name", "preferred_language", "subscriptions", "number_format", "currency"}
VALID_SUBSCRIPTIONS = {"Marketing Information", "Customer Service Communication", "One to One", "Operations", "Opted Out"}


@router.get("/{portal_type}/me")
async def get_my_profile(
    portal_type: str,
    db: AsyncSession = Depends(get_db),
    portal_user: dict = Depends(require_portal_user),
):
    contact = await _get_contact_with_company(db, str(portal_user["contact_id"]))
    if not contact:
        raise HTTPException(404, "Profile not found")
    return {
        "email": contact.get("email"),
        "first_name": contact.get("first_name"),
        "last_name": contact.get("last_name"),
        "mobile_phone": contact.get("mobile_phone"),
        "job_name": contact.get("job_name"),
        "preferred_language": contact.get("preferred_language"),
        "subscriptions": contact.get("subscriptions") or [],
        "number_format": contact.get("number_format"),
        "currency": contact.get("currency"),
        "company_name": contact.get("company_name"),
        "portal_type": portal_type,
        "terms_accepted_at": portal_user["terms_accepted_at"].isoformat() if portal_user.get("terms_accepted_at") else None,
    }


@router.put("/{portal_type}/me")
async def update_my_profile(
    portal_type: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    portal_user: dict = Depends(require_portal_user),
):
    updates = {k: v for k, v in data.items() if k in PORTAL_SELF_FIELDS}
    if not updates:
        raise HTTPException(400, "No editable fields supplied")

    # subscriptions is a JSONB column — asyncpg can't adapt a raw Python list, so it
    # needs an explicit JSON-string + cast, unlike the plain text columns alongside it.
    if "subscriptions" in updates:
        subs = updates["subscriptions"]
        if not isinstance(subs, list) or not all(s in VALID_SUBSCRIPTIONS for s in subs):
            raise HTTPException(400, f"subscriptions must be a list of: {sorted(VALID_SUBSCRIPTIONS)}")
        updates["subscriptions"] = json.dumps(subs)

    set_clause = ", ".join(
        f"{k} = CAST(:{k} AS JSONB)" if k == "subscriptions" else f"{k} = :{k}"
        for k in updates
    )
    updates["id"] = portal_user["contact_id"]
    await db.execute(text(f"UPDATE contacts SET {set_clause}, updated_at = NOW() WHERE id = :id"), updates)
    await db.commit()
    return await get_my_profile(portal_type, db, portal_user)


# ─── Terms & Conditions ──────────────────────────────────────────────────────
# Content is a placeholder for now (title only) — a new portal user is required to
# accept before reaching the rest of the portal; MyWHUBBI also links here so it can be
# reviewed (and the PDF downloaded) any time afterwards.
@router.post("/{portal_type}/accept-terms")
async def accept_terms(
    portal_type: str,
    db: AsyncSession = Depends(get_db),
    portal_user: dict = Depends(require_portal_user),
):
    await db.execute(text("UPDATE portal_users SET terms_accepted_at = NOW() WHERE id = :id"), {"id": portal_user["id"]})
    await db.commit()
    return {"terms_accepted_at": datetime.utcnow().isoformat()}


def _generate_terms_pdf() -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, HRFlowable, Table, TableStyle
    from io import BytesIO
    buf = BytesIO()
    pw = A4[0] - 5 * cm
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2*cm, bottomMargin=2.5*cm, leftMargin=2.5*cm, rightMargin=2.5*cm)
    s_title = ParagraphStyle('t', fontName='Helvetica-Bold', fontSize=22, textColor=colors.HexColor('#156082'), spaceAfter=8)
    s_body = ParagraphStyle('b', fontName='Helvetica', fontSize=10, textColor=colors.HexColor('#3F3F3F'), leading=16)
    story = [
        Table([['']], colWidths=[pw], rowHeights=[0.8*cm], style=TableStyle([('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#156082'))])),
        Paragraph('Terms and Conditions of Use', s_title),
        HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#45B6E4'), spaceAfter=12),
        Paragraph('This document is being prepared.', s_body),
    ]
    doc.build(story)
    return buf.getvalue()


@router.get("/{portal_type}/terms/pdf")
async def download_terms_pdf(portal_type: str, portal_user: dict = Depends(require_portal_user)):
    from fastapi.responses import StreamingResponse
    from io import BytesIO
    content = _generate_terms_pdf()
    return StreamingResponse(BytesIO(content), media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="WCOMPLY_Portal_Terms_and_Conditions.pdf"'})
