// Shared fetch wrapper that attaches the caller's identity so the backend's
// permission checks (app/authz.py, X-User-Email header) have something to
// check against. Centralizing this in one place replaces the previous mix of
// some pages passing an `email` query/path param and most pages passing none
// at all. Same trust model as before — this is still a client-asserted email,
// not a verified session — just applied consistently everywhere instead of
// being absent almost everywhere.
import { getStoredUser } from './auth'

export const API_BASE = 'https://api.whubbi.wcomply.com'

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const user = getStoredUser()
  const headers = new Headers(options.headers || {})
  if (user?.email) headers.set('X-User-Email', user.email)
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  return fetch(url, { ...options, headers })
}

export async function apiJson<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const r = await apiFetch(path, options)
  return r.json()
}
