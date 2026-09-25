# backend/app/services/portal_auth.py
# Token verification for the external Customer/Partner portal.
#
# Unlike the rest of WHUBBI (see app/authz.py — a client-asserted X-User-Email header,
# no signature check, acceptable only because the app itself is only reachable by
# SSO-gated employees), the portal is reachable by any Microsoft or Google account
# holder on the public internet. So here we actually verify the Cognito-issued ID
# token's signature, issuer, audience and expiry against the portal user pool's JWKS
# before trusting the email inside it.
import os
import time

import httpx
from fastapi import Depends, Header, HTTPException
from jose import jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

PORTAL_COGNITO_REGION        = os.getenv("PORTAL_COGNITO_REGION", "eu-west-1")
PORTAL_COGNITO_USER_POOL_ID  = os.getenv("PORTAL_COGNITO_USER_POOL_ID", "")
PORTAL_COGNITO_CLIENT_ID     = os.getenv("PORTAL_COGNITO_CLIENT_ID", "")

_ISSUER = f"https://cognito-idp.{PORTAL_COGNITO_REGION}.amazonaws.com/{PORTAL_COGNITO_USER_POOL_ID}"
_JWKS_URL = f"{_ISSUER}/.well-known/jwks.json"

_jwks_cache: dict = {"keys": None, "fetched_at": 0.0}
_JWKS_TTL_SECONDS = 3600


async def _get_jwks() -> dict:
    now = time.time()
    if _jwks_cache["keys"] is None or (now - _jwks_cache["fetched_at"]) > _JWKS_TTL_SECONDS:
        async with httpx.AsyncClient() as client:
            resp = await client.get(_JWKS_URL, timeout=10)
            resp.raise_for_status()
            _jwks_cache["keys"] = resp.json()["keys"]
            _jwks_cache["fetched_at"] = now
    return _jwks_cache["keys"]


async def verify_portal_id_token(token: str) -> dict:
    """Verify a Cognito ID token from the external portal pool and return its claims
    ({email, sub, ...}). Raises HTTPException(401) on any verification failure."""
    if not PORTAL_COGNITO_USER_POOL_ID or not PORTAL_COGNITO_CLIENT_ID:
        raise HTTPException(500, "Portal authentication is not configured")

    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception:
        raise HTTPException(401, "Invalid token")

    kid = unverified_header.get("kid")
    keys = await _get_jwks()
    key = next((k for k in keys if k.get("kid") == kid), None)
    if key is None:
        # Key rotated since our cache was last filled — force one refresh before giving up.
        _jwks_cache["keys"] = None
        keys = await _get_jwks()
        key = next((k for k in keys if k.get("kid") == kid), None)
        if key is None:
            raise HTTPException(401, "Invalid token (unknown signing key)")

    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=PORTAL_COGNITO_CLIENT_ID,
            issuer=_ISSUER,
        )
    except Exception:
        raise HTTPException(401, "Invalid or expired token")

    if not claims.get("email"):
        raise HTTPException(401, "Token has no email claim")
    return claims


def _bearer_token(authorization: str) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    return authorization.split(" ", 1)[1].strip()


async def get_verified_portal_email(
    authorization: str = Header(default=""),
) -> str:
    token = _bearer_token(authorization)
    claims = await verify_portal_id_token(token)
    return claims["email"].strip().lower()


async def require_portal_user(
    portal_type: str,
    email: str = Depends(get_verified_portal_email),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """FastAPI dependency: verifies the bearer ID token, then requires an active
    portal_users row for (email, portal_type). `portal_type` is taken from the route's
    own `{portal_type}` path segment. Returns that row (dict) — callers use
    row['contact_id'] to scope reads/writes to the invited Contact."""
    if portal_type not in ("customer", "partner"):
        raise HTTPException(404, "Unknown portal")
    r = await db.execute(
        text("""
            SELECT * FROM portal_users
            WHERE email = :email AND portal_type = :portal_type AND status = 'active'
        """),
        {"email": email, "portal_type": portal_type},
    )
    row = r.fetchone()
    if not row:
        raise HTTPException(403, "No active portal access for this account")
    return dict(row._mapping)
