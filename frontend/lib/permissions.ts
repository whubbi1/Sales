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
export type PermLevel = 'loading' | 'none' | 'view' | 'edit'

export type ModulePerms = Record<string, { access_mode?: string; id?: string | null }> | null

export function lookupPerm(perms: ModulePerms, submodule: string): { level: PermLevel; canEdit: boolean } {
  if (perms === null) return { level: 'loading', canEdit: false }
  const p = perms[submodule]
  if (!p || p.id == null) return { level: 'none', canEdit: false }
  const level = (p.access_mode as PermLevel) || 'none'
  return { level, canEdit: level === 'edit' }
}
