// lib/api.ts
const API_URL = 'https://api.whubbi.wcomply.com'

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
  list:   (p?: any) => fetchAPI(`/companies/${qs(p)}`),
  get:    (id: string) => fetchAPI(`/companies/${id}/`),
  create: (d: any) => fetchAPI('/companies/', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/companies/${id}/`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/companies/${id}/`, { method: 'DELETE' }),

  getContacts:     (id: string) => fetchAPI(`/companies/${id}/contacts/`),
  getOpportunities:(id: string) => fetchAPI(`/companies/${id}/opportunities/`),

  getNotes:    (id: string) => fetchAPI(`/companies/${id}/notes/`),
  createNote:  (id: string, d: any) => fetchAPI(`/companies/${id}/notes/`, { method: 'POST', body: JSON.stringify(d) }),
  deleteNote:  (cid: string, nid: string) => fetchAPI(`/companies/${cid}/notes/${nid}/`, { method: 'DELETE' }),

  getArticles:   (id: string) => fetchAPI(`/companies/${id}/articles/`),
  createArticle: (id: string, d: any) => fetchAPI(`/companies/${id}/articles/`, { method: 'POST', body: JSON.stringify(d) }),
  deleteArticle: (cid: string, aid: string) => fetchAPI(`/companies/${cid}/articles/${aid}/`, { method: 'DELETE' }),

  getTasks:   (id: string) => fetchAPI(`/companies/${id}/tasks/`),
  createTask: (id: string, d: any) => fetchAPI(`/companies/${id}/tasks/`, { method: 'POST', body: JSON.stringify(d) }),
  updateTask: (cid: string, tid: string, d: any) => fetchAPI(`/companies/${cid}/tasks/${tid}/`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteTask: (cid: string, tid: string) => fetchAPI(`/companies/${cid}/tasks/${tid}/`, { method: 'DELETE' }),
}

// ─── Contacts ─────────────────────────────────────────────────────────────────
export const contactsAPI = {
  list:   (p?: any) => fetchAPI(`/contacts/${qs(p)}`),
  get:    (id: string) => fetchAPI(`/contacts/${id}/`),
  create: (d: any) => fetchAPI('/contacts/', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/contacts/${id}/`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/contacts/${id}/`, { method: 'DELETE' }),
  getOpportunities: (id: string) => fetchAPI(`/contacts/${id}/opportunities/`),
}

// ─── Opportunities ────────────────────────────────────────────────────────────
export const opportunitiesAPI = {
  list:   (p?: any) => fetchAPI(`/opportunities/${qs(p)}`),
  get:    (id: string) => fetchAPI(`/opportunities/${id}/`),
  create: (d: any) => fetchAPI('/opportunities/', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/opportunities/${id}/`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/opportunities/${id}/`, { method: 'DELETE' }),

  getStaffing:    (id: string) => fetchAPI(`/opportunities/${id}/staffing/`),
  addStaffing:    (id: string, d: any) => fetchAPI(`/opportunities/${id}/staffing/`, { method: 'POST', body: JSON.stringify(d) }),
  removeStaffing: (id: string, sid: string) => fetchAPI(`/opportunities/${id}/staffing/${sid}/`, { method: 'DELETE' }),
  getAllStaffing: () => fetchAPI(`/opportunities/staffing/all`),

  getChecklist:      (id: string) => fetchAPI(`/opportunities/${id}/checklist/`),
  addChecklistItem:  (id: string, d: any) => fetchAPI(`/opportunities/${id}/checklist/`, { method: 'POST', body: JSON.stringify(d) }),
  updateChecklistItem: (id: string, cid: string, d: any) => fetchAPI(`/opportunities/${id}/checklist/${cid}/`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteChecklistItem: (id: string, cid: string) => fetchAPI(`/opportunities/${id}/checklist/${cid}/`, { method: 'DELETE' }),

  getComments:   (id: string) => fetchAPI(`/opportunities/${id}/comments/`),
  addComment:    (id: string, d: any) => fetchAPI(`/opportunities/${id}/comments/`, { method: 'POST', body: JSON.stringify(d) }),
  deleteComment: (id: string, cid: string) => fetchAPI(`/opportunities/${id}/comments/${cid}/`, { method: 'DELETE' }),

  getSharepointFiles: (id: string) => fetchAPI(`/opportunities/${id}/sharepoint-files`),
}

// ─── Sales Tasks (legacy — superseded by taskManagerAPI, kept for rollback safety) ─
export const tasksAPI = {
  list:   (p?: any) => fetchAPI(`/tasks/${qs(p)}`),
  get:    (id: string) => fetchAPI(`/tasks/${id}`),
  create: (d: any) => fetchAPI('/tasks/', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/tasks/${id}`, { method: 'DELETE' }),
}

// ─── Task Manager (unified cross-module tasks: workflows, subtasks, watchers, Teams) ─
export const taskManagerAPI = {
  list:   (p?: any) => fetchAPI(`/task-manager/tasks${qs(p)}`),
  get:    (id: string) => fetchAPI(`/task-manager/tasks/${id}`),
  create: (d: any) => fetchAPI('/task-manager/tasks', { method: 'POST', body: JSON.stringify(d) }),
  createSubtask: (parentId: string, d: any) => fetchAPI(`/task-manager/tasks/${parentId}/subtasks`, { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/task-manager/tasks/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  setStatus: (id: string, d: any) => fetchAPI(`/task-manager/tasks/${id}/status`, { method: 'PUT', body: JSON.stringify(d) }),
  reassign: (id: string, d: any) => fetchAPI(`/task-manager/tasks/${id}/reassign`, { method: 'POST', body: JSON.stringify(d) }),
  transferOwner: (id: string, d: any) => fetchAPI(`/task-manager/tasks/${id}/transfer-owner`, { method: 'POST', body: JSON.stringify(d) }),
  delete: (id: string, actingEmail: string) => fetchAPI(`/task-manager/tasks/${id}${qs({ acting_email: actingEmail })}`, { method: 'DELETE' }),

  addWatcher:    (id: string, d: any) => fetchAPI(`/task-manager/tasks/${id}/watchers`, { method: 'POST', body: JSON.stringify(d) }),
  removeWatcher: (id: string, email: string, actingEmail: string) => fetchAPI(`/task-manager/tasks/${id}/watchers/${encodeURIComponent(email)}${qs({ acting_email: actingEmail })}`, { method: 'DELETE' }),

  getComments: (id: string) => fetchAPI(`/task-manager/tasks/${id}/comments`),
  addComment:  (id: string, d: any) => fetchAPI(`/task-manager/tasks/${id}/comments`, { method: 'POST', body: JSON.stringify(d) }),

  getTeamsInfo: (id: string) => fetchAPI(`/task-manager/tasks/${id}/teams`),
  syncTeams:    (id: string) => fetchAPI(`/task-manager/tasks/${id}/teams/sync`, { method: 'POST' }),

  getLinks:   (id: string) => fetchAPI(`/task-manager/tasks/${id}/links`),
  addLink:    (id: string, d: any) => fetchAPI(`/task-manager/tasks/${id}/links`, { method: 'POST', body: JSON.stringify(d) }),
  removeLink: (id: string, linkId: string) => fetchAPI(`/task-manager/tasks/${id}/links/${linkId}`, { method: 'DELETE' }),
}

// ─── GRC Access Review ──────────────────────────────────────────────────────────
export const grcAccessReviewAPI = {
  list:   () => fetchAPI('/grc/access-review'),
  get:    (id: string) => fetchAPI(`/grc/access-review/${id}`),
  create: (d: any) => fetchAPI('/grc/access-review', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/grc/access-review/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/grc/access-review/${id}`, { method: 'DELETE' }),
  setStatus: (id: string, d: any) => fetchAPI(`/grc/access-review/${id}/status`, { method: 'PUT', body: JSON.stringify(d) }),
  setScope:  (id: string, d: any) => fetchAPI(`/grc/access-review/${id}/scope`, { method: 'PUT', body: JSON.stringify(d) }),

  getLinks:   (id: string) => fetchAPI(`/grc/access-review/${id}/links`),
  addLink:    (id: string, d: any) => fetchAPI(`/grc/access-review/${id}/links`, { method: 'POST', body: JSON.stringify(d) }),
  removeLink: (id: string, linkId: string) => fetchAPI(`/grc/access-review/${id}/links/${linkId}`, { method: 'DELETE' }),

  requirements: (showAll?: boolean) => fetchAPI(`/grc/access-review/requirements${qs({ show_all: showAll || undefined })}`),
  setRequirementCategory: (reqId: string, category: string) => fetchAPI(`/grc/requirements/${reqId}/category`, { method: 'PUT', body: JSON.stringify({ category }) }),

  overview: () => fetchAPI('/grc/overview'),
}

// ─── HR Onboarding/Offboarding Checklists ──────────────────────────────────────
export const hrChecklistAPI = {
  listTasks:   (p?: any) => fetchAPI(`/hr/checklist-tasks${qs(p)}`),
  createTask:  (d: any) => fetchAPI('/hr/checklist-tasks', { method: 'POST', body: JSON.stringify(d) }),
  updateTask:  (id: string, d: any) => fetchAPI(`/hr/checklist-tasks/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteTask:  (id: string) => fetchAPI(`/hr/checklist-tasks/${id}`, { method: 'DELETE' }),

  listCases: (p?: any) => fetchAPI(`/hr/checklist-cases${qs(p)}`),
  getCase:   (id: string) => fetchAPI(`/hr/checklist-cases/${id}`),
  startCase: (d: any) => fetchAPI('/hr/checklist-cases', { method: 'POST', body: JSON.stringify(d) }),
}
