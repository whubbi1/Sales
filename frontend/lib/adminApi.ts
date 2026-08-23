import { getIdToken } from '@/lib/auth'

const API_URL = 'https://api.whubbi.wcomply.com'

// /admin/* and /microsoft/* are protected by require_whubbi_access same as everything
// else (see app/main.py's _include), so every call here needs the Bearer token too.
function authHeaders(): Record<string, string> {
  const token = getIdToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function fetchAPI(path: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export const adminAPI = {
  getHealth:  () => fetchAPI('/admin/health'),
  getCosts:   () => fetchAPI('/admin/costs'),
  getLogs:    (limit = 50) => fetchAPI(`/admin/logs?limit=${limit}`),
  createLog:  (data: any) => fetch(`${API_URL}/admin/logs`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data) }),
  getURLs:    () => fetchAPI('/admin/urls'),
  runChecks:  () => fetch(`${API_URL}/admin/urls/check`, { method: 'POST', headers: authHeaders() }).then(r => r.json()),
  addURL:     (data: { name: string; url: string }) => fetch(`${API_URL}/admin/urls`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data) }).then(r => r.json()),
  deleteURL:  (id: string) => fetch(`${API_URL}/admin/urls/${id}`, { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),
}

export const microsoftAPI = {
  getHealth:    () => fetchAPI('/microsoft/health'),
  getIncidents: () => fetchAPI('/microsoft/incidents'),
  getCosts:     () => fetchAPI('/microsoft/costs'),
  getLicenses:  () => fetchAPI('/microsoft/licenses'),
}
