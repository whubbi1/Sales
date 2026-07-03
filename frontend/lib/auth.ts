// Shared auth utilities — session stored in localStorage after OAuth token exchange

export interface StoredUser {
  email: string
  name:  string
  exp:   number // JWT expiry as Unix timestamp (seconds)
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('whubbi_user')
    if (!raw) return null
    const u: StoredUser = JSON.parse(raw)
    if (!u.email) return null
    if (u.exp && Date.now() / 1000 > u.exp) {
      localStorage.removeItem('whubbi_user')
      return null
    }
    return u
  } catch {
    return null
  }
}

export function clearStoredUser(): void {
  if (typeof window !== 'undefined') localStorage.removeItem('whubbi_user')
}

const API = 'https://api.whubbi.wcomply.com'

// Checked at login and on every navigation — an excluded user must not reach any module or document.
export async function isAccessExcluded(email: string): Promise<boolean> {
  try {
    const r = await fetch(`${API}/settings/main-location/${encodeURIComponent(email)}`)
    const d = await r.json()
    return !!d.is_excluded
  } catch {
    return false
  }
}
