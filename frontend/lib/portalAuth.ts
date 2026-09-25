// Customer/Partner portal auth utilities — separate from lib/auth.ts on purpose.
// The internal app only ever sends a client-asserted email (X-User-Email); the portal
// is reachable by any Microsoft/Google account holder on the internet, so the backend
// actually verifies the Cognito ID token (see backend/app/services/portal_auth.py).
// That means, unlike the internal app, we must keep the raw id_token around and send
// it as a Bearer token on every API call.
import { API_BASE } from './apiClient'

export type PortalType = 'customer' | 'partner'

export interface StoredPortalUser {
  email: string
  name: string
  portal_type: PortalType
  id_token: string
  exp: number // JWT expiry, Unix seconds
}

function storageKey(portalType: PortalType): string {
  return `whubbi_portal_user_${portalType}`
}

export function getStoredPortalUser(portalType: PortalType): StoredPortalUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(portalType))
    if (!raw) return null
    const u: StoredPortalUser = JSON.parse(raw)
    if (!u.email || !u.id_token) return null
    if (u.exp && Date.now() / 1000 > u.exp) {
      window.localStorage.removeItem(storageKey(portalType))
      return null
    }
    return u
  } catch {
    return null
  }
}

export function setStoredPortalUser(u: StoredPortalUser): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey(u.portal_type), JSON.stringify(u))
  }
}

export function clearStoredPortalUser(portalType: PortalType): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(storageKey(portalType))
}

export async function portalApiFetch(
  portalType: PortalType,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const user = getStoredPortalUser(portalType)
  const headers = new Headers(options.headers || {})
  if (user?.id_token) headers.set('Authorization', `Bearer ${user.id_token}`)
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  return fetch(url, { ...options, headers })
}

export async function portalApiJson<T = any>(
  portalType: PortalType,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const r = await portalApiFetch(portalType, path, options)
  return r.json()
}

function decodeJwtPayload(token: string): Record<string, any> {
  const b64 = token.split('.')[1] ?? ''
  const padded = b64 + '=='.slice(0, (4 - (b64.length % 4)) % 4)
  return JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')))
}

// PKCE helpers, mirrored from app/auth/login/page.tsx — the portal has its own Cognito
// domain/app client (NEXT_PUBLIC_PORTAL_COGNITO_*), so it can't reuse that flow directly.
export async function buildPortalAuthUrl(
  portalType: PortalType,
  identityProvider: 'Microsoft' | 'Google',
  inviteToken?: string,
): Promise<string> {
  const domain = process.env.NEXT_PUBLIC_PORTAL_COGNITO_DOMAIN!
  const clientId = process.env.NEXT_PUBLIC_PORTAL_COGNITO_CLIENT_ID!
  const redirect = `${window.location.origin}/portal/${portalType}/auth/callback`

  const verifierBytes = crypto.getRandomValues(new Uint8Array(32))
  const verifier = btoa(String.fromCharCode(...verifierBytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hashBuf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  sessionStorage.setItem(`portal_pkce_verifier_${portalType}`, verifier)
  if (inviteToken) sessionStorage.setItem(`portal_invite_token_${portalType}`, inviteToken)

  const url = new URL(`${domain}/oauth2/authorize`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'email openid profile')
  url.searchParams.set('redirect_uri', redirect)
  url.searchParams.set('identity_provider', identityProvider)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

export interface PortalSessionResult {
  ok: boolean
  error?: string
  user?: StoredPortalUser
}

// Exchanges the OAuth `code` for tokens, then calls POST /portal/session so the
// backend can verify the token, check/accept the invitation, and confirm active access.
export async function completePortalSignIn(
  portalType: PortalType,
  code: string,
): Promise<PortalSessionResult> {
  const domain = process.env.NEXT_PUBLIC_PORTAL_COGNITO_DOMAIN!
  const clientId = process.env.NEXT_PUBLIC_PORTAL_COGNITO_CLIENT_ID!
  const redirectUri = `${window.location.origin}/portal/${portalType}/auth/callback`
  const verifier = sessionStorage.getItem(`portal_pkce_verifier_${portalType}`) || ''
  const inviteToken = sessionStorage.getItem(`portal_invite_token_${portalType}`) || undefined

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
  })
  if (verifier) body.set('code_verifier', verifier)

  const tokenRes = await fetch(`${domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const tokens = await tokenRes.json()
  if (!tokens.id_token) {
    return { ok: false, error: tokens.error_description || tokens.error || 'Sign-in failed' }
  }

  sessionStorage.removeItem(`portal_pkce_verifier_${portalType}`)
  sessionStorage.removeItem(`portal_invite_token_${portalType}`)

  const sessionRes = await fetch(`${API_BASE}/portal/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: tokens.id_token, portal_type: portalType, invite_token: inviteToken }),
  })
  const session = await sessionRes.json()
  if (!sessionRes.ok) {
    return { ok: false, error: session.detail || 'Access denied' }
  }

  const payload = decodeJwtPayload(tokens.id_token)
  const user: StoredPortalUser = {
    email: session.email,
    name: session.name || session.email,
    portal_type: portalType,
    id_token: tokens.id_token,
    exp: payload.exp,
  }
  setStoredPortalUser(user)
  return { ok: true, user }
}
