# backend/scripts/backfill_permissions.py
#
# One-off, additive-only migration to run BEFORE the permission-enforcement code
# (app/authz.py + the Depends(require_permission(...)) wiring across routers) is
# deployed. Without this, most users have zero whubbi_permissions rows today
# (nothing has ever enforced them), so switching to default-deny would lock the
# whole company out of every module at once.
#
# What it does:
#   1. For every member of the Azure AD "WHUBBI" security group (the actual
#      source of truth for "who is a WHUBBI user" — user_profiles is NOT this:
#      it's only lazily populated for whoever happens to trigger a profile-write
#      elsewhere, so it can badly undercount real users) who isn't marked
#      excluded, insert access_mode='edit' for every (module, submodule) pair in
#      MODULES ONLY if no row exists yet (ON CONFLICT DO NOTHING) — this
#      preserves today's de-facto "everyone can do everything" behavior. It
#      never touches an existing row, so a deliberately-set 'none' (like
#      Lou-Ann Calentier's) is left exactly as is — which is what makes it
#      finally start being honored once enforcement ships.
#   2. Force-grants edit on (hr, permissions) and (admin, permissions) to the
#      designated permissions administrator(s), so they can manage the
#      now-locked-down Permissions page. This one IS an upsert (not additive),
#      since it's a deliberate designation, not "preserve the status quo".
#      Only william.delcour@wcomply.com holds this — deliberately not shared
#      with other accounts, including cyril.martin@wcomply.com.
#
# Usage:
#   cd backend && python -m scripts.backfill_permissions
#
# Safe to re-run (idempotent) — e.g. after onboarding a new employee into the
# WHUBBI AD group, re-run this to give them the same baseline access everyone
# else already has.
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.routers.settings import MODULES
from app.routers.settings import get_whubbi_group_members

PERMISSIONS_ADMINS = [
    "william.delcour@wcomply.com",
]

ADMIN_GRANTS = [("hr", "permissions"), ("admin", "permissions")]


def _email(member: dict) -> str:
    return (member.get("mail") or member.get("userPrincipalName") or "").lower()


async def main():
    members = await get_whubbi_group_members()
    if members is None:
        print("ERROR: could not reach Microsoft Graph to list WHUBBI group members — aborting.")
        return
    emails = sorted({_email(m) for m in members if _email(m)})
    print(f"Found {len(emails)} WHUBBI AD group members.")

    async with AsyncSessionLocal() as db:
        excluded_rows = await db.execute(text("SELECT email FROM user_profiles WHERE is_excluded = true"))
        excluded = {(r[0] or "").lower() for r in excluded_rows.fetchall()}
        eligible = [e for e in emails if e not in excluded]
        print(f"Backfilling baseline permissions for {len(eligible)} non-excluded users...")

        inserted = 0
        for email in eligible:
            for module, submodules in MODULES.items():
                for submodule in submodules:
                    result = await db.execute(text("""
                        INSERT INTO whubbi_permissions
                            (id, user_email, module, submodule, data_scope, access_mode, legal_entities, granted_by, created_at, updated_at)
                        VALUES
                            (gen_random_uuid(), :email, :module, :submodule, 'company', 'edit', '["all"]', 'baseline_migration', NOW(), NOW())
                        ON CONFLICT (user_email, module, submodule) DO NOTHING
                    """), {"email": email, "module": module, "submodule": submodule})
                    inserted += result.rowcount or 0
        await db.commit()
        print(f"Inserted {inserted} new baseline permission rows (existing rows were left untouched).")

        print(f"Seeding permissions-admin access for {PERMISSIONS_ADMINS}...")
        for email in PERMISSIONS_ADMINS:
            for module, submodule in ADMIN_GRANTS:
                await db.execute(text("""
                    INSERT INTO whubbi_permissions
                        (id, user_email, module, submodule, data_scope, access_mode, legal_entities, granted_by, created_at, updated_at)
                    VALUES
                        (gen_random_uuid(), :email, :module, :submodule, 'company', 'edit', '["all"]', 'baseline_migration', NOW(), NOW())
                    ON CONFLICT (user_email, module, submodule) DO UPDATE SET
                        access_mode = 'edit', data_scope = 'company', updated_at = NOW()
                """), {"email": email, "module": module, "submodule": submodule})
        await db.commit()
        print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
