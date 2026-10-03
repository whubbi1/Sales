import { apiFetch } from './apiClient'
import { getStoredUser } from './auth'

const API_URL = 'https://api.whubbi.wcomply.com'

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const user = getStoredUser()
  return { ...(user?.email ? { 'X-User-Email': user.email } : {}), ...extra }
}

async function fetchAPI(path: string) {
  const res = await apiFetch(`${API_URL}${path}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export const adminAPI = {
  getHealth:  () => fetchAPI('/admin/health'),
  getCosts:   () => fetchAPI('/admin/costs'),
  getLogs:    (limit = 50) => fetchAPI(`/admin/logs?limit=${limit}`),
  createLog:  (data: any) => apiFetch(`${API_URL}/admin/logs`, { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(data) }),
  getURLs:    () => fetchAPI('/admin/urls'),
  runChecks:  () => apiFetch(`${API_URL}/admin/urls/check`, { method: 'POST', headers: authHeaders() }).then(r => r.json()),
  addURL:     (data: { name: string; url: string }) => apiFetch(`${API_URL}/admin/urls`, { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(data) }).then(r => r.json()),
  deleteURL:  (id: string) => apiFetch(`${API_URL}/admin/urls/${id}`, { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),
}

export const microsoftAPI = {
  getHealth:    () => fetchAPI('/microsoft/health'),
  getIncidents: () => fetchAPI('/microsoft/incidents'),
  getCosts:     () => fetchAPI('/microsoft/costs'),
  getLicenses:  () => fetchAPI('/microsoft/licenses'),
}
