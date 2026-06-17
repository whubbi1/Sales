// lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function fetchAPI(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Network error' }))
    throw new Error(err.detail || 'API error')
  }
  if (res.status === 204) return null
  return res.json()
}

const qs = (params?: Record<string, any>) => {
  if (!params) return ''
  const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))).toString()
  return q ? `?${q}` : ''
}

// ─── Companies ────────────────────────────────────────────────────────────────
export const companiesAPI = {
  list:   (p?: any) => fetchAPI(`/companies${qs(p)}`),
  get:    (id: string) => fetchAPI(`/companies/${id}`),
  create: (d: any) => fetchAPI('/companies', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/companies/${id}`, { method: 'DELETE' }),

  getContacts:     (id: string) => fetchAPI(`/companies/${id}/contacts`),
  getOpportunities:(id: string) => fetchAPI(`/companies/${id}/opportunities`),

  getNotes:    (id: string) => fetchAPI(`/companies/${id}/notes`),
  createNote:  (id: string, d: any) => fetchAPI(`/companies/${id}/notes`, { method: 'POST', body: JSON.stringify(d) }),
  deleteNote:  (cid: string, nid: string) => fetchAPI(`/companies/${cid}/notes/${nid}`, { method: 'DELETE' }),

  getArticles:   (id: string) => fetchAPI(`/companies/${id}/articles`),
  createArticle: (id: string, d: any) => fetchAPI(`/companies/${id}/articles`, { method: 'POST', body: JSON.stringify(d) }),
  deleteArticle: (cid: string, aid: string) => fetchAPI(`/companies/${cid}/articles/${aid}`, { method: 'DELETE' }),

  getTasks:   (id: string) => fetchAPI(`/companies/${id}/tasks`),
  createTask: (id: string, d: any) => fetchAPI(`/companies/${id}/tasks`, { method: 'POST', body: JSON.stringify(d) }),
  updateTask: (cid: string, tid: string, d: any) => fetchAPI(`/companies/${cid}/tasks/${tid}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteTask: (cid: string, tid: string) => fetchAPI(`/companies/${cid}/tasks/${tid}`, { method: 'DELETE' }),
}

// ─── Contacts ─────────────────────────────────────────────────────────────────
export const contactsAPI = {
  list:   (p?: any) => fetchAPI(`/contacts${qs(p)}`),
  get:    (id: string) => fetchAPI(`/contacts/${id}`),
  create: (d: any) => fetchAPI('/contacts', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/contacts/${id}`, { method: 'DELETE' }),
  getOpportunities: (id: string) => fetchAPI(`/contacts/${id}/opportunities`),
}

// ─── Opportunities ────────────────────────────────────────────────────────────
export const opportunitiesAPI = {
  list:   (p?: any) => fetchAPI(`/opportunities${qs(p)}`),
  get:    (id: string) => fetchAPI(`/opportunities/${id}`),
  create: (d: any) => fetchAPI('/opportunities', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/opportunities/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/opportunities/${id}`, { method: 'DELETE' }),
}
