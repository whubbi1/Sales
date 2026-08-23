// Shared auth utilities — session stored in localStorage after OAuth token exchange

export interface StoredUser {
  email:   string
  name:    string
  exp:     number // JWT expiry as Unix timestamp (seconds)
  idToken: string // raw Cognito ID token, sent as `Authorization: Bearer` on API calls
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

// Convenience accessor for the small set of API clients that only need the token
// (not the rest of the stored user) to attach an Authorization header.
export function getIdToken(): string | null {
  return getStoredUser()?.idToken ?? null
}

const API = 'https://api.whubbi.wcomply.com'

export interface WhubbiAccess {
  has_access: boolean
  is_group_member: boolean | null // null when the group check itself was unavailable
  is_excluded: boolean
  check_available: boolean
}

const ACCESS_DENIED: WhubbiAccess = { has_access: false, is_group_member: null, is_excluded: false, check_available: false }

// Checked at login and on every navigation — access requires membership in the Microsoft
// "WHUBBI" security group and not being manually excluded. If the group check itself is
// unavailable (Graph outage, permission not yet granted), the backend fails open on that
// half so a transient issue doesn't lock out the whole company; is_excluded is always enforced.
//
// The backend now derives the email from the verified token itself (see
// get_verified_email in settings.py), so this takes the raw ID token, not an email —
// there is no longer any way to ask about someone else's access. Any failure here
// (network error, expired/invalid token, backend unreachable) fails closed.
export async function checkWhubbiAccess(idToken: string): Promise<WhubbiAccess> {
  try {
    const r = await fetch(`${API}/settings/whubbi-access`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
    if (!r.ok) return ACCESS_DENIED
    return await r.json()
  } catch {
    return ACCESS_DENIED
  }
}
