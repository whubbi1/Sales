// Tracks the portal user's own recently-visited portal pages, client-side only (per
// portal-user localStorage, same pattern as the employee home page's own
// home_module_order_${email} key) — there's no server-side page-view logging anywhere
// in the app to hook into, and this doesn't need to survive a device change.
//
// PORTAL_PAGES is the trackable-page registry: only pages listed here are ever recorded
// or shown, and isModuleMain marks a tile's own landing page (a page whose job is just
// to link further, not real content) for exclusion — the equivalent of excluding
// /contacts or /companies while still tracking /contacts/[id] in the internal app.
// /portal/home itself is excluded separately, always, since it's the page this list
// lives on.
interface PortalPageDef {
  href: string
  label: string
  isModuleMain?: boolean
}

const PORTAL_PAGES: PortalPageDef[] = [
  { href: '/portal/profile', label: 'Personal Profile' },
  { href: '/portal/operations/project-management', label: 'Operations', isModuleMain: true },
  { href: '/portal/helpdesk', label: 'Helpdesk', isModuleMain: true },
]

interface RecentEntry {
  href: string
  label: string
  visitedAt: number
}

function storageKey(email: string): string {
  return `whubbi_portal_recent_${email}`
}

export function recordPortalPageVisit(email: string, href: string, label?: string): void {
  if (typeof window === 'undefined' || !email) return
  // Dynamic routes (e.g. a specific project's Operations detail page) aren't in the
  // static registry — an explicit label records them anyway; otherwise fall back to it.
  const def = PORTAL_PAGES.find(p => p.href === href)
  if (!label && (!def || def.isModuleMain)) return
  if (href === '/portal/home') return
  const resolvedLabel = label || def!.label

  try {
    const raw = window.localStorage.getItem(storageKey(email))
    const existing: RecentEntry[] = raw ? JSON.parse(raw) : []
    const withoutThis = existing.filter(e => e.href !== href)
    const updated = [{ href, label: resolvedLabel, visitedAt: Date.now() }, ...withoutThis].slice(0, 20)
    window.localStorage.setItem(storageKey(email), JSON.stringify(updated))
  } catch {
    // Best-effort only — a full/blocked localStorage just means no history this session.
  }
}

export function getRecentPortalPages(email: string, limit = 5): RecentEntry[] {
  if (typeof window === 'undefined' || !email) return []
  try {
    const raw = window.localStorage.getItem(storageKey(email))
    if (!raw) return []
    const entries: RecentEntry[] = JSON.parse(raw)
    return entries.slice(0, limit)
  } catch {
    return []
  }
}
