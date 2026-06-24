const API_URL = 'https://api.whubbi.wcomply.com'

async function fetchAdmin(path: string) {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export const adminAPI = {
  getHealth:  () => fetchAdmin('/admin/health'),
  getCosts:   () => fetchAdmin('/admin/costs'),
  getLogs:    (limit = 50) => fetchAdmin(`/admin/logs?limit=${limit}`),
  createLog:  (data: any) => fetch(`${API_URL}/admin/logs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  getURLs:    () => fetchAdmin('/admin/urls'),
  runChecks:  () => fetch(`${API_URL}/admin/urls/check`, { method: 'POST' }).then(r => r.json()),
  addURL:     (data: { name: string; url: string }) => fetch(`${API_URL}/admin/urls`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  deleteURL:  (id: string) => fetch(`${API_URL}/admin/urls/${id}`, { method: 'DELETE' }).then(r => r.json()),
}
