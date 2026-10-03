# backend/app/authz.py
#
# Permission enforcement for whubbi_permissions. The backend has no real
# authentication (no signed session/JWT) — "current user" is a client-asserted
# email, same trust model the rest of the app already uses. This module just
# makes that identity consistent (one header, checked everywhere) instead of
# absent, and makes whubbi_permissions actually govern access instead of only
# being written to and never read.
from fastapi import Depends, Header, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

CURRENT_USER_HEADER = "X-User-Email"


async def get_current_user_email(
    x_user_email: str | None = Header(default=None, alias=CURRENT_USER_HEADER),
) -> str:
    if not x_user_email:
        raise HTTPException(401, f"Missing {CURRENT_USER_HEADER} header")
    return x_user_email.strip().lower()


async def is_excluded(email: str, db: AsyncSession) -> bool:
    r = await db.execute(
        text("SELECT is_excluded FROM user_profiles WHERE lower(email) = lower(:email)"),
        {"email": email},
    )
    row = r.fetchone()
    return bool(row and row.is_excluded)


async def access_mode(email: str, module: str, submodule: str, db: AsyncSession) -> str:
    r = await db.execute(
        text("""
            SELECT access_mode FROM whubbi_permissions
            WHERE lower(user_email) = lower(:email) AND module = :module AND submodule = :submodule
        """),
        {"email": email, "module": module, "submodule": submodule},
    )
    row = r.fetchone()
    return row.access_mode if row else "none"


_LEVELS = {"none": 0, "view": 1, "edit": 2}


async def has_any_permission(
    email: str, options: list[tuple[str, str]], db: AsyncSession, min_mode: str = "edit"
) -> bool:
    if await is_excluded(email, db):
        return False
    for module, submodule in options:
        mode = await access_mode(email, module, submodule, db)
        if _LEVELS.get(mode, 0) >= _LEVELS[min_mode]:
            return True
    return False


PERMISSIONS_ADMIN_GRANTS: list[tuple[str, str]] = [("hr", "permissions"), ("admin", "permissions")]


async def require_permissions_admin(
    email: str = Depends(get_current_user_email),
    db: AsyncSession = Depends(get_db),
) -> str:
    """Dependency for routes that manage OTHER users' permissions/org data
    (writes only — reading your own record is handled separately with a
    self-or-admin check since it needs the path `email`, not just the caller)."""
    if not await has_any_permission(email, PERMISSIONS_ADMIN_GRANTS, db, "edit"):
        raise HTTPException(403, "No access to manage permissions")
    return email


async def require_self_or_permission(
    path_email: str,
    caller_email: str,
    module: str,
    submodule: str,
    db: AsyncSession,
    min_mode: str = "view",
) -> None:
    """For routes returning/acting on data scoped to a specific user (e.g. 'my
    own PayFit record') that a self-service caller must always be able to read
    about themselves, regardless of module permissions: allow when the caller
    is asking about themself, otherwise require the normal module permission."""
    if path_email.strip().lower() == caller_email.strip().lower():
        if await is_excluded(caller_email, db):
            raise HTTPException(403, "Access excluded")
        return
    mode = await access_mode(caller_email, module, submodule, db)
    if _LEVELS.get(mode, 0) < _LEVELS[min_mode]:
        raise HTTPException(403, f"No {min_mode} access to {module}.{submodule}")


async def require_self_or_permissions_admin(
    path_email: str,
    caller_email: str,
    db: AsyncSession,
) -> None:
    """For GET routes returning another user's permissions/org-assignment/
    main-location record: allow when the caller is looking at their own data
    (a page must be able to fetch its own permissions to render its own
    gating), otherwise require permissions-admin edit access."""
    if path_email.strip().lower() == caller_email.strip().lower():
        return
    if not await has_any_permission(caller_email, PERMISSIONS_ADMIN_GRANTS, db, "edit"):
        raise HTTPException(403, "No access to view this user's permissions")


async def require_authenticated(
    email: str = Depends(get_current_user_email),
    db: AsyncSession = Depends(get_db),
) -> str:
    """Lightest gate: any logged-in, non-excluded WHUBBI user — no specific
    module/submodule grant required. For genuinely company-wide self-service
    surfaces (e.g. browsing the training catalog) that aren't tied to a
    particular module's business-data permission."""
    if await is_excluded(email, db):
        raise HTTPException(403, "Access excluded")
    return email


def require_permission(module: str, submodule: str, min_mode: str = "view"):
    """FastAPI dependency: 403 unless the calling user (X-User-Email) has at
    least `min_mode` access on (module, submodule). Default-deny: an excluded
    user, or a user with no permission row at all, is denied — not granted
    full access as the old frontend-only checks used to do."""

    async def _dep(
        email: str = Depends(get_current_user_email),
        db: AsyncSession = Depends(get_db),
    ) -> str:
        if await is_excluded(email, db):
            raise HTTPException(403, "Access excluded")
        mode = await access_mode(email, module, submodule, db)
        if _LEVELS.get(mode, 0) < _LEVELS[min_mode]:
            raise HTTPException(403, f"No {min_mode} access to {module}.{submodule}")
        return mode

    return _dep


def require_any_permission(options: list[tuple[str, str]], min_mode: str = "edit"):
    """Like require_permission, but passes if the caller has at least
    `min_mode` on ANY of the listed (module, submodule) pairs. Used to gate
    permissions-management itself, which historically lives under both HR and
    Admin in the MODULES map."""

    async def _dep(
        email: str = Depends(get_current_user_email),
        db: AsyncSession = Depends(get_db),
    ) -> str:
        if await is_excluded(email, db):
            raise HTTPException(403, "Access excluded")
        best = "none"
        for module, submodule in options:
            mode = await access_mode(email, module, submodule, db)
            if _LEVELS.get(mode, 0) > _LEVELS[best]:
                best = mode
        if _LEVELS[best] < _LEVELS[min_mode]:
            raise HTTPException(403, "No access to manage permissions")
        return best

    return _dep
