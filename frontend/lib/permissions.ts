// Shared implementation of the per-module permission lookup used by every
// module's Layout (HRLayout, GRCLayout, FinanceLayout, ...). Each module keeps
// its own React Context/Provider (module boundaries stay as-is, pages keep
// importing `use<Module>Perm` from their own module's Layout), but the lookup
// logic itself lives here once instead of being copy-pasted ~10 times.
//
// IMPORTANT default: no permission row for a submodule means NO ACCESS, not
// full edit access. The old per-module hooks defaulted to 'edit' when a row
// was missing, which is why access removed via the Permissions page never
// actually took effect anywhere — this flips that to fail-closed. It's safe
// to flip now because the baseline migration (backend/scripts/backfill_permissions.py)
// guarantees a real row exists for every non-excluded user on every submodule.
import { useEffect, useState } from 'react'
import { apiFetch } from './apiClient'
import { getStoredUser } from './auth'

export type PermLevel = 'loading' | 'none' | 'view' | 'edit'

export type ModulePerms = Record<string, { access_mode?: string; id?: string | null }> | null

export function lookupPerm(perms: ModulePerms, submodule: string): { level: PermLevel; canEdit: boolean } {
  if (perms === null) return { level: 'loading', canEdit: false }
  const p = perms[submodule]
  if (!p || p.id == null) return { level: 'none', canEdit: false }
  const level = (p.access_mode as PermLevel) || 'none'
  return { level, canEdit: level === 'edit' }
}

// Loads the current user's permissions for one module. Self-contained (no
// React Context) so it works in any component — including a page that calls
// use<Module>Perm in the same component that renders its <Module>Layout,
// which a Context can't serve (the page sits outside the Provider, so it only
// ever saw the default null and canEdit was stuck false).
// Concurrent callers (the Layout and the page inside it) share one request.
const inflight = new Map<string, Promise<Record<string, ModulePerms>>>()

function loadAllPerms(email: string): Promise<Record<string, ModulePerms>> {
  let p = inflight.get(email)
  if (!p) {
    p = apiFetch(`/settings/permissions/${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => d.permissions || {})
      .catch(() => ({}))
      .finally(() => inflight.delete(email))
    inflight.set(email, p)
  }
  return p
}

export function useModulePerms(module: string): ModulePerms {
  const [perms, setPerms] = useState<ModulePerms>(null)
  useEffect(() => {
    const user = getStoredUser()
    const all = user ? loadAllPerms(user.email) : Promise.resolve({} as Record<string, ModulePerms>)
    let active = true
    all.then(a => { if (active) setPerms(a[module] || {}) })
    return () => { active = false }
  }, [module])
  return perms
}
