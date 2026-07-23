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
  get:    (id: string) => fetchAPI(`/companies/${id}`),
  create: (d: any) => fetchAPI('/companies/', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/companies/${id}`, { method: 'DELETE' }),

  uploadLogo: async (id: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API_URL}/companies/${id}/logo`, { method: 'POST', body: fd })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Upload failed') }
    return res.json()
  },

  getContacts:     (id: string) => fetchAPI(`/companies/${id}/contacts`),
  getOpportunities:(id: string) => fetchAPI(`/companies/${id}/opportunities`),
  getLeads:        (id: string) => fetchAPI(`/companies/${id}/leads`),
  dashboardStats:  () => fetchAPI(`/companies/dashboard-stats`),
  research:        (prompt: string) => fetchAPI(`/companies/research`, { method: 'POST', body: JSON.stringify({ prompt }) }),
  linkedinEnrich:  (linkedin_url: string, company_id?: string) => fetchAPI(`/companies/linkedin-enrich`, { method: 'POST', body: JSON.stringify({ linkedin_url, company_id }) }),

  searchLinkedInPeople: (companyId: string, jobFunctions: string[]) => fetchAPI(`/companies/${companyId}/linkedin-people-search`, { method: 'POST', body: JSON.stringify({ job_functions: jobFunctions }) }),

  getNotes:    (id: string) => fetchAPI(`/companies/${id}/notes`),
  createNote:  (id: string, d: any) => fetchAPI(`/companies/${id}/notes`, { method: 'POST', body: JSON.stringify(d) }),
  deleteNote:  (cid: string, nid: string) => fetchAPI(`/companies/${cid}/notes/${nid}`, { method: 'DELETE' }),

  getArticles:   (id: string) => fetchAPI(`/companies/${id}/articles`),
  createArticle: (id: string, d: any) => fetchAPI(`/companies/${id}/articles`, { method: 'POST', body: JSON.stringify(d) }),
  deleteArticle: (cid: string, aid: string) => fetchAPI(`/companies/${cid}/articles/${aid}`, { method: 'DELETE' }),

  getArticleLinks:     (aid: string) => fetchAPI(`/companies/articles/${aid}/links`),
  linkArticleCompany:  (aid: string, cid: string) => fetchAPI(`/companies/articles/${aid}/companies/${cid}`, { method: 'POST' }),
  unlinkArticleCompany:(aid: string, cid: string) => fetchAPI(`/companies/articles/${aid}/companies/${cid}`, { method: 'DELETE' }),
  linkArticleContact:  (aid: string, cid: string) => fetchAPI(`/companies/articles/${aid}/contacts/${cid}`, { method: 'POST' }),
  unlinkArticleContact:(aid: string, cid: string) => fetchAPI(`/companies/articles/${aid}/contacts/${cid}`, { method: 'DELETE' }),
  linkArticlePartner:  (aid: string, pid: string) => fetchAPI(`/companies/articles/${aid}/partners/${pid}`, { method: 'POST' }),
  unlinkArticlePartner:(aid: string, pid: string) => fetchAPI(`/companies/articles/${aid}/partners/${pid}`, { method: 'DELETE' }),
}

// ─── Partners ─────────────────────────────────────────────────────────────────
export const partnersAPI = {
  list:   (p?: any) => fetchAPI(`/partners/${qs(p)}`),
  get:    (id: string) => fetchAPI(`/partners/${id}`),
  create: (d: any) => fetchAPI('/partners/', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/partners/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/partners/${id}`, { method: 'DELETE' }),

  getContacts:      (id: string) => fetchAPI(`/partners/${id}/contacts`),
  getOpportunities: (id: string) => fetchAPI(`/partners/${id}/opportunities`),
  getLeads: (id: string) => fetchAPI(`/partners/${id}/leads`),

  getActionItems:   (id: string) => fetchAPI(`/partners/${id}/action-items`),
  createActionItem: (id: string, d: any) => fetchAPI(`/partners/${id}/action-items`, { method: 'POST', body: JSON.stringify(d) }),
  updateActionItem: (id: string, itemId: string, d: any) => fetchAPI(`/partners/${id}/action-items/${itemId}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteActionItem: (id: string, itemId: string) => fetchAPI(`/partners/${id}/action-items/${itemId}`, { method: 'DELETE' }),

  getComments:   (id: string) => fetchAPI(`/partners/${id}/comments`),
  addComment:    (id: string, d: any) => fetchAPI(`/partners/${id}/comments`, { method: 'POST', body: JSON.stringify(d) }),
  deleteComment: (id: string, cid: string) => fetchAPI(`/partners/${id}/comments/${cid}`, { method: 'DELETE' }),

  getLinks:   (id: string) => fetchAPI(`/partners/${id}/links`),
  addLink:    (id: string, d: any) => fetchAPI(`/partners/${id}/links`, { method: 'POST', body: JSON.stringify(d) }),
  deleteLink: (id: string, lid: string) => fetchAPI(`/partners/${id}/links/${lid}`, { method: 'DELETE' }),

  getArticles:   (id: string) => fetchAPI(`/partners/${id}/articles`),
  createArticle: (id: string, d: any) => fetchAPI(`/partners/${id}/articles`, { method: 'POST', body: JSON.stringify(d) }),
  deleteArticle: (pid: string, aid: string) => fetchAPI(`/partners/${pid}/articles/${aid}`, { method: 'DELETE' }),

  getEvents:    (id: string) => fetchAPI(`/partners/${id}/events`),
  getCustomers: (id: string) => fetchAPI(`/partners/${id}/customers`),

  linkedinEnrich: (linkedin_url: string, partner_id?: string) => fetchAPI(`/partners/linkedin-enrich`, { method: 'POST', body: JSON.stringify({ linkedin_url, partner_id }) }),
  uploadLogo: async (id: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API_URL}/partners/${id}/logo`, { method: 'POST', body: fd })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Upload failed') }
    return res.json()
  },
}

// ─── Marketing ────────────────────────────────────────────────────────────────
export const marketingAPI = {
  listEvents:  (p?: any) => fetchAPI(`/marketing/events${qs(p)}`),
  getEventKPIs: () => fetchAPI(`/marketing/events/kpis`),
  getEvent:    (id: string) => fetchAPI(`/marketing/events/${id}`),
  createEvent: (d: any) => fetchAPI('/marketing/events', { method: 'POST', body: JSON.stringify(d) }),
  updateEvent: (id: string, d: any) => fetchAPI(`/marketing/events/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteEvent: (id: string) => fetchAPI(`/marketing/events/${id}`, { method: 'DELETE' }),

  uploadEventLogo: async (id: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API_URL}/marketing/events/${id}/logo`, { method: 'POST', body: fd })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Upload failed') }
    return res.json()
  },

  addContributor:    (id: string, d: any) => fetchAPI(`/marketing/events/${id}/contributors`, { method: 'POST', body: JSON.stringify(d) }),
  removeContributor: (id: string, cid: string) => fetchAPI(`/marketing/events/${id}/contributors/${cid}`, { method: 'DELETE' }),

  addUrl:    (id: string, d: any) => fetchAPI(`/marketing/events/${id}/urls`, { method: 'POST', body: JSON.stringify(d) }),
  removeUrl: (id: string, uid: string) => fetchAPI(`/marketing/events/${id}/urls/${uid}`, { method: 'DELETE' }),

  linkPartner:   (id: string, partnerId: string) => fetchAPI(`/marketing/events/${id}/partners/${partnerId}`, { method: 'POST' }),
  unlinkPartner: (id: string, partnerId: string) => fetchAPI(`/marketing/events/${id}/partners/${partnerId}`, { method: 'DELETE' }),
  linkContact:   (id: string, contactId: string) => fetchAPI(`/marketing/events/${id}/contacts/${contactId}`, { method: 'POST' }),
  unlinkContact: (id: string, contactId: string) => fetchAPI(`/marketing/events/${id}/contacts/${contactId}`, { method: 'DELETE' }),
}

// ─── Contacts ─────────────────────────────────────────────────────────────────
export const contactsAPI = {
  list:   (p?: any) => fetchAPI(`/contacts/${qs(p)}`),
  get:    (id: string) => fetchAPI(`/contacts/${id}`),
  create: (d: any) => fetchAPI('/contacts/', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/contacts/${id}`, { method: 'DELETE' }),
  getOpportunities: (id: string) => fetchAPI(`/contacts/${id}/opportunities`),
  linkedinEnrich: (linkedin_url: string) => fetchAPI(`/contacts/linkedin-enrich`, { method: 'POST', body: JSON.stringify({ linkedin_url }) }),

  getNotes:    (id: string) => fetchAPI(`/contacts/${id}/notes`),
  createNote:  (id: string, d: any) => fetchAPI(`/contacts/${id}/notes`, { method: 'POST', body: JSON.stringify(d) }),
  deleteNote:  (cid: string, nid: string) => fetchAPI(`/contacts/${cid}/notes/${nid}`, { method: 'DELETE' }),

  getArticles:   (id: string) => fetchAPI(`/contacts/${id}/articles`),
  createArticle: (id: string, d: any) => fetchAPI(`/contacts/${id}/articles`, { method: 'POST', body: JSON.stringify(d) }),
  deleteArticle: (cid: string, aid: string) => fetchAPI(`/contacts/${cid}/articles/${aid}`, { method: 'DELETE' }),

  getLeads: (id: string) => fetchAPI(`/contacts/${id}/leads`),
}

// ─── Legal module org entities (Operational Teams / Sales Entities) ───────────
export const legalAPI = {
  getOrgEntities: (category: 'operational_team' | 'sales_entity') => fetchAPI(`/legal/org-entities?category=${category}&active_only=true`),
}

// ─── Opportunities ────────────────────────────────────────────────────────────
export const leadsAPI = {
  list:   (p?: any) => fetchAPI(`/leads/${qs(p)}`),
  get:    (id: string) => fetchAPI(`/leads/${id}`),
  create: (d: any) => fetchAPI('/leads/', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/leads/${id}`, { method: 'DELETE' }),
  closeWithOpportunity: (id: string, opportunityId: string, changedByEmail?: string, changedByName?: string) =>
    fetchAPI(`/leads/${id}/close-with-opportunity`, { method: 'POST', body: JSON.stringify({ opportunity_id: opportunityId, changed_by_email: changedByEmail, changed_by_name: changedByName }) }),

  getActivityLog: (id: string) => fetchAPI(`/leads/${id}/activity-log`),

  getNotes:   (id: string) => fetchAPI(`/leads/${id}/notes/`),
  addNote:    (id: string, d: any) => fetchAPI(`/leads/${id}/notes/`, { method: 'POST', body: JSON.stringify(d) }),
  deleteNote: (id: string, noteId: string) => fetchAPI(`/leads/${id}/notes/${noteId}/`, { method: 'DELETE' }),

  getFiles:   (id: string) => fetchAPI(`/leads/${id}/files/`),
  addFile:    (id: string, d: any) => fetchAPI(`/leads/${id}/files/`, { method: 'POST', body: JSON.stringify(d) }),
  deleteFile: (id: string, fileId: string) => fetchAPI(`/leads/${id}/files/${fileId}/`, { method: 'DELETE' }),
}

export const opportunitiesAPI = {
  list:   (p?: any) => fetchAPI(`/opportunities/${qs(p)}`),
  get:    (id: string) => fetchAPI(`/opportunities/${id}`),
  create: (d: any) => fetchAPI('/opportunities/', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/opportunities/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/opportunities/${id}`, { method: 'DELETE' }),

  getStaffing:    (id: string) => fetchAPI(`/opportunities/${id}/staffing/`),
  addStaffing:    (id: string, d: any) => fetchAPI(`/opportunities/${id}/staffing/`, { method: 'POST', body: JSON.stringify(d) }),
  removeStaffing: (id: string, sid: string) => fetchAPI(`/opportunities/${id}/staffing/${sid}/`, { method: 'DELETE' }),
  setStaffingMonths: (id: string, sid: string, months: { month: string; days: number }[]) =>
    fetchAPI(`/opportunities/${id}/staffing/${sid}/months`, { method: 'PUT', body: JSON.stringify({ months }) }),
  getAllStaffing: () => fetchAPI(`/opportunities/staffing/all`),

  getChecklist:      (id: string) => fetchAPI(`/opportunities/${id}/checklist/`),
  addChecklistItem:  (id: string, d: any) => fetchAPI(`/opportunities/${id}/checklist/`, { method: 'POST', body: JSON.stringify(d) }),
  updateChecklistItem: (id: string, cid: string, d: any) => fetchAPI(`/opportunities/${id}/checklist/${cid}/`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteChecklistItem: (id: string, cid: string) => fetchAPI(`/opportunities/${id}/checklist/${cid}/`, { method: 'DELETE' }),

  getComments:   (id: string) => fetchAPI(`/opportunities/${id}/comments/`),
  addComment:    (id: string, d: any) => fetchAPI(`/opportunities/${id}/comments/`, { method: 'POST', body: JSON.stringify(d) }),
  deleteComment: (id: string, cid: string) => fetchAPI(`/opportunities/${id}/comments/${cid}/`, { method: 'DELETE' }),

  getSharepointFiles: (id: string) => fetchAPI(`/opportunities/${id}/sharepoint-files`),

  getLinks:   (id: string) => fetchAPI(`/opportunities/${id}/links`),
  addLink:    (id: string, d: any) => fetchAPI(`/opportunities/${id}/links`, { method: 'POST', body: JSON.stringify(d) }),
  updateLink: (id: string, lid: string, d: any) => fetchAPI(`/opportunities/${id}/links/${lid}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteLink: (id: string, lid: string) => fetchAPI(`/opportunities/${id}/links/${lid}`, { method: 'DELETE' }),
}

// ─── RFPs ─────────────────────────────────────────────────────────────────────
export const rfpAPI = {
  list:   (p?: any) => fetchAPI(`/rfps/${qs(p)}`),
  get:    (id: string) => fetchAPI(`/rfps/${id}`),
  create: (d: any) => fetchAPI('/rfps/', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/rfps/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/rfps/${id}`, { method: 'DELETE' }),

  linkOpportunity:   (id: string, opportunityId: string) => fetchAPI(`/rfps/${id}/opportunities/${opportunityId}`, { method: 'POST' }),
  unlinkOpportunity: (id: string, opportunityId: string) => fetchAPI(`/rfps/${id}/opportunities/${opportunityId}`, { method: 'DELETE' }),

  getComments:   (id: string) => fetchAPI(`/rfps/${id}/comments/`),
  addComment:    (id: string, d: any) => fetchAPI(`/rfps/${id}/comments/`, { method: 'POST', body: JSON.stringify(d) }),
  deleteComment: (id: string, cid: string) => fetchAPI(`/rfps/${id}/comments/${cid}/`, { method: 'DELETE' }),

  getActionItems:    (id: string) => fetchAPI(`/rfps/${id}/action-items`),
  addActionItem:     (id: string, d: any) => fetchAPI(`/rfps/${id}/action-items`, { method: 'POST', body: JSON.stringify(d) }),
  updateActionItem:  (id: string, itemId: string, d: any) => fetchAPI(`/rfps/${id}/action-items/${itemId}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteActionItem:  (id: string, itemId: string) => fetchAPI(`/rfps/${id}/action-items/${itemId}`, { method: 'DELETE' }),

  getDocumentChecklist:    (id: string) => fetchAPI(`/rfps/${id}/document-checklist`),
  addDocumentChecklist:    (id: string, d: any) => fetchAPI(`/rfps/${id}/document-checklist`, { method: 'POST', body: JSON.stringify(d) }),
  updateDocumentChecklist: (id: string, itemId: string, d: any) => fetchAPI(`/rfps/${id}/document-checklist/${itemId}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteDocumentChecklist: (id: string, itemId: string) => fetchAPI(`/rfps/${id}/document-checklist/${itemId}`, { method: 'DELETE' }),

  analyze: (id: string) => fetchAPI(`/rfps/${id}/analyze`, { method: 'POST' }),

  getStaffingRoles:   (id: string) => fetchAPI(`/rfps/${id}/staffing-roles`),
  addStaffingRole:    (id: string, d: any) => fetchAPI(`/rfps/${id}/staffing-roles`, { method: 'POST', body: JSON.stringify(d) }),
  updateStaffingRole: (id: string, roleId: string, d: any) => fetchAPI(`/rfps/${id}/staffing-roles/${roleId}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteStaffingRole: (id: string, roleId: string) => fetchAPI(`/rfps/${id}/staffing-roles/${roleId}`, { method: 'DELETE' }),

  getStaffingTasks:      (id: string) => fetchAPI(`/rfps/${id}/staffing-tasks`),
  addStaffingTask:       (id: string, d: any) => fetchAPI(`/rfps/${id}/staffing-tasks`, { method: 'POST', body: JSON.stringify(d) }),
  updateStaffingTask:    (id: string, taskId: string, d: any) => fetchAPI(`/rfps/${id}/staffing-tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteStaffingTask:    (id: string, taskId: string) => fetchAPI(`/rfps/${id}/staffing-tasks/${taskId}`, { method: 'DELETE' }),
  setStaffingAllocations: (id: string, taskId: string, allocations: { period_start: string; period_type: string; days: number }[]) =>
    fetchAPI(`/rfps/${id}/staffing-tasks/${taskId}/allocations`, { method: 'PUT', body: JSON.stringify({ allocations }) }),

  getStaffingRates: (id: string) => fetchAPI(`/rfps/${id}/staffing-rates`),
  setStaffingRate:  (id: string, d: any) => fetchAPI(`/rfps/${id}/staffing-rates`, { method: 'PUT', body: JSON.stringify(d) }),
}

// ─── Projects (Operations module — auto-created from Opportunities, or internal) ─
export const projectsAPI = {
  list:   (p?: any) => fetchAPI(`/projects/${qs(p)}`),
  get:    (id: string) => fetchAPI(`/projects/${id}`),
  createInternal: (d: any) => fetchAPI('/projects/internal', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/projects/${id}`, { method: 'DELETE' }),

  getActivityLog: (id: string) => fetchAPI(`/projects/${id}/activity-log`),

  getComments:   (id: string) => fetchAPI(`/projects/${id}/comments/`),
  addComment:    (id: string, d: any) => fetchAPI(`/projects/${id}/comments/`, { method: 'POST', body: JSON.stringify(d) }),
  deleteComment: (id: string, cid: string) => fetchAPI(`/projects/${id}/comments/${cid}/`, { method: 'DELETE' }),

  getDocuments:   (id: string, category?: string) => fetchAPI(`/projects/${id}/documents/${qs(category ? { category } : {})}`),
  addDocument:    (id: string, d: any) => fetchAPI(`/projects/${id}/documents/`, { method: 'POST', body: JSON.stringify(d) }),
  deleteDocument: (id: string, did: string) => fetchAPI(`/projects/${id}/documents/${did}/`, { method: 'DELETE' }),

  getExpenses:   (id: string) => fetchAPI(`/projects/${id}/expenses/`),
  addExpense:    (id: string, d: any) => fetchAPI(`/projects/${id}/expenses/`, { method: 'POST', body: JSON.stringify(d) }),
  deleteExpense: (id: string, eid: string) => fetchAPI(`/projects/${id}/expenses/${eid}/`, { method: 'DELETE' }),

  getDeliverables:    (id: string) => fetchAPI(`/projects/${id}/deliverables/`),
  addDeliverable:     (id: string, d: any) => fetchAPI(`/projects/${id}/deliverables/`, { method: 'POST', body: JSON.stringify(d) }),
  updateDeliverable:  (id: string, did: string, d: any) => fetchAPI(`/projects/${id}/deliverables/${did}/`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteDeliverable:  (id: string, did: string) => fetchAPI(`/projects/${id}/deliverables/${did}/`, { method: 'DELETE' }),

  getContacts:   (id: string) => fetchAPI(`/projects/${id}/contacts`),
  linkContact:   (id: string, contactId: string) => fetchAPI(`/projects/${id}/contacts/${contactId}`, { method: 'POST' }),
  unlinkContact: (id: string, contactId: string) => fetchAPI(`/projects/${id}/contacts/${contactId}`, { method: 'DELETE' }),

  getStaffingRoles:   (id: string, planType?: string) => fetchAPI(`/projects/${id}/staffing-roles${qs(planType ? { plan_type: planType } : {})}`),
  addStaffingRole:    (id: string, d: any) => fetchAPI(`/projects/${id}/staffing-roles`, { method: 'POST', body: JSON.stringify(d) }),
  updateStaffingRole: (id: string, roleId: string, d: any) => fetchAPI(`/projects/${id}/staffing-roles/${roleId}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteStaffingRole: (id: string, roleId: string) => fetchAPI(`/projects/${id}/staffing-roles/${roleId}`, { method: 'DELETE' }),

  getStaffing:    (id: string, planType?: string) => fetchAPI(`/projects/${id}/staffing${qs(planType ? { plan_type: planType } : {})}`),
  addStaffing:    (id: string, d: any) => fetchAPI(`/projects/${id}/staffing`, { method: 'POST', body: JSON.stringify(d) }),
  updateStaffing: (id: string, taskId: string, d: any) => fetchAPI(`/projects/${id}/staffing/${taskId}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteStaffing: (id: string, taskId: string) => fetchAPI(`/projects/${id}/staffing/${taskId}`, { method: 'DELETE' }),
  setStaffingAllocations: (id: string, taskId: string, allocations: { period_start: string; period_type: string; days: number }[]) =>
    fetchAPI(`/projects/${id}/staffing/${taskId}/allocations`, { method: 'PUT', body: JSON.stringify({ allocations }) }),
  getStaffingActuals: (id: string) => fetchAPI(`/projects/${id}/staffing/actuals`),
}

// ─── Reporting & Analytics ──────────────────────────────────────────────────────
export const reportingAPI = {
  getSchema: () => fetchAPI('/reporting/schema'),
  runAdHoc: (spec: any) => fetchAPI('/reporting/run', { method: 'POST', body: JSON.stringify(spec) }),
  aiDraft:  (prompt: string) => fetchAPI('/reporting/ai-draft', { method: 'POST', body: JSON.stringify({ prompt }) }),

  listReports:  (userEmail: string) => fetchAPI(`/reporting/reports${qs({ user_email: userEmail })}`),
  getReport:    (id: string) => fetchAPI(`/reporting/reports/${id}`),
  createReport: (d: any) => fetchAPI('/reporting/reports', { method: 'POST', body: JSON.stringify(d) }),
  updateReport: (id: string, d: any) => fetchAPI(`/reporting/reports/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteReport: (id: string) => fetchAPI(`/reporting/reports/${id}`, { method: 'DELETE' }),
  runReport:    (id: string) => fetchAPI(`/reporting/reports/${id}/run`, { method: 'POST' }),

  listDashboards:  (userEmail: string) => fetchAPI(`/reporting/dashboards${qs({ user_email: userEmail })}`),
  getDashboard:    (id: string) => fetchAPI(`/reporting/dashboards/${id}`),
  createDashboard: (d: any) => fetchAPI('/reporting/dashboards', { method: 'POST', body: JSON.stringify(d) }),
  updateDashboard: (id: string, d: any) => fetchAPI(`/reporting/dashboards/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteDashboard: (id: string) => fetchAPI(`/reporting/dashboards/${id}`, { method: 'DELETE' }),
}

// ─── Timesheets (Operations module) ────────────────────────────────────────────
export const timesheetsAPI = {
  list:   (p?: any) => fetchAPI(`/timesheets/${qs(p)}`),
  create: (d: any) => fetchAPI('/timesheets/', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/timesheets/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/timesheets/${id}`, { method: 'DELETE' }),
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

// ─── IT ─────────────────────────────────────────────────────────────────────────
export const itAPI = {
  listApplications: (search?: string) => fetchAPI(`/it/applications${qs({ search: search || undefined })}`),
  listSubmodules: (applicationId: string) => fetchAPI(`/it/applications/${applicationId}/submodules`),
}

// ─── GRC: Data & Privacy — ROPA ────────────────────────────────────────────────
export const ropaAPI = {
  list:   () => fetchAPI('/grc/ropa'),
  get:    (id: string) => fetchAPI(`/grc/ropa/${id}`),
  create: (d: any) => fetchAPI('/grc/ropa', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/grc/ropa/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/grc/ropa/${id}`, { method: 'DELETE' }),

  getComments:  (id: string) => fetchAPI(`/grc/ropa/${id}/comments/`),
  addComment:   (id: string, d: any) => fetchAPI(`/grc/ropa/${id}/comments/`, { method: 'POST', body: JSON.stringify(d) }),
  deleteComment:(id: string, commentId: string) => fetchAPI(`/grc/ropa/${id}/comments/${commentId}`, { method: 'DELETE' }),

  getFiles: (id: string) => fetchAPI(`/grc/ropa/${id}/files`),
  uploadFile: async (id: string, file: File, uploadedByEmail: string) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('uploaded_by_email', uploadedByEmail)
    const res = await fetch(`${API_URL}/grc/ropa/${id}/files`, { method: 'POST', body: fd })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Upload failed') }
    return res.json()
  },
  deleteFile: (id: string, fileId: string) => fetchAPI(`/grc/ropa/${id}/files/${fileId}`, { method: 'DELETE' }),

  getRevisions:  (id: string) => fetchAPI(`/grc/ropa/${id}/revisions/`),
  addRevision:   (id: string, d: any) => fetchAPI(`/grc/ropa/${id}/revisions/`, { method: 'POST', body: JSON.stringify(d) }),
  deleteRevision:(id: string, revisionId: string) => fetchAPI(`/grc/ropa/${id}/revisions/${revisionId}`, { method: 'DELETE' }),

  extractFromFile: async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API_URL}/grc/ropa/extract`, { method: 'POST', body: fd })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Extraction failed') }
    return res.json()
  },
}

// ─── MCP personal access tokens (connect Claude Code/Desktop to WHUBBI) ────────
export const mcpTokensAPI = {
  list:   (email: string) => fetchAPI(`/settings/mcp-tokens/${encodeURIComponent(email)}`),
  create: (d: any) => fetchAPI('/settings/mcp-tokens', { method: 'POST', body: JSON.stringify(d) }),
  revoke: (id: string) => fetchAPI(`/settings/mcp-tokens/${id}`, { method: 'DELETE' }),
}

// ─── HR Onboarding/Offboarding Checklists ──────────────────────────────────────
export const hrChecklistAPI = {
  listTasks:   (p?: any) => fetchAPI(`/hr/checklist-tasks${qs(p)}`),
  createTask:  (d: any) => fetchAPI('/hr/checklist-tasks', { method: 'POST', body: JSON.stringify(d) }),
  updateTask:  (id: string, d: any) => fetchAPI(`/hr/checklist-tasks/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteTask:  (id: string) => fetchAPI(`/hr/checklist-tasks/${id}`, { method: 'DELETE' }),

  listCases:  (p?: any) => fetchAPI(`/hr/checklist-cases${qs(p)}`),
  getCase:    (id: string) => fetchAPI(`/hr/checklist-cases/${id}`),
  startCase:  (d: any) => fetchAPI('/hr/checklist-cases', { method: 'POST', body: JSON.stringify(d) }),
  updateCase: (id: string, d: any) => fetchAPI(`/hr/checklist-cases/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  closeCase:  (id: string) => fetchAPI(`/hr/checklist-cases/${id}/close`, { method: 'PUT' }),

  getCaseEquipments:  (id: string) => fetchAPI(`/hr/checklist-cases/${id}/equipments`),
  assignEquipment:    (id: string, equipmentId: string) => fetchAPI(`/hr/checklist-cases/${id}/equipments/${equipmentId}`, { method: 'POST' }),
  unassignEquipment:  (id: string, equipmentId: string) => fetchAPI(`/hr/checklist-cases/${id}/equipments/${equipmentId}`, { method: 'DELETE' }),
}

// ─── Testing (part of the Development module) ────────────────────────────────────
export const testingAPI = {
  listPlans:  (p?: any) => fetchAPI(`/development/test-plans${qs(p)}`),
  getPlan:    (id: string) => fetchAPI(`/development/test-plans/${id}`),
  createPlan: (d: any) => fetchAPI('/development/test-plans', { method: 'POST', body: JSON.stringify(d) }),
  updatePlan: (id: string, d: any) => fetchAPI(`/development/test-plans/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deletePlan: (id: string) => fetchAPI(`/development/test-plans/${id}`, { method: 'DELETE' }),

  createScript: (planId: string, d: any) => fetchAPI(`/development/test-plans/${planId}/scripts`, { method: 'POST', body: JSON.stringify(d) }),
  updateScript: (planId: string, scriptId: string, d: any) => fetchAPI(`/development/test-plans/${planId}/scripts/${scriptId}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteScript: (planId: string, scriptId: string) => fetchAPI(`/development/test-plans/${planId}/scripts/${scriptId}`, { method: 'DELETE' }),

  listCampaigns:  (p?: any) => fetchAPI(`/development/test-campaigns${qs(p)}`),
  getCampaign:    (id: string) => fetchAPI(`/development/test-campaigns/${id}`),
  createCampaign: (d: any) => fetchAPI('/development/test-campaigns', { method: 'POST', body: JSON.stringify(d) }),
  updateCampaign: (id: string, d: any) => fetchAPI(`/development/test-campaigns/${id}`, { method: 'PUT', body: JSON.stringify(d) }),

  executeStep: (campaignId: string, stepId: string, d: any) => fetchAPI(`/development/test-campaigns/${campaignId}/steps/${stepId}/execute`, { method: 'PUT', body: JSON.stringify(d) }),
  reviewStep:  (campaignId: string, stepId: string, d: any) => fetchAPI(`/development/test-campaigns/${campaignId}/steps/${stepId}/review`, { method: 'PUT', body: JSON.stringify(d) }),
  completeReview: (campaignId: string, d: any) => fetchAPI(`/development/test-campaigns/${campaignId}/complete-review`, { method: 'POST', body: JSON.stringify(d) }),

  listRemediationPlans: (p?: any) => fetchAPI(`/development/remediation-plans${qs(p)}`),
  getRemediationPlan:   (id: string) => fetchAPI(`/development/remediation-plans/${id}`),
  updateRemediationPlan: (id: string, d: any) => fetchAPI(`/development/remediation-plans/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  updateRemediationAction: (id: string, d: any) => fetchAPI(`/development/remediation-actions/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
}

// ─── Finance: Suppliers ────────────────────────────────────────────────────────
export const financeSuppliersAPI = {
  list:   (p?: any) => fetchAPI(`/finance/suppliers${qs(p)}`),
  get:    (id: string) => fetchAPI(`/finance/suppliers/${id}`),
  create: (d: any) => fetchAPI('/finance/suppliers', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/finance/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/finance/suppliers/${id}`, { method: 'DELETE' }),
}

// ─── Finance: Contract Lifecycle Management ───────────────────────────────────
export const financeContractsAPI = {
  list:   (p?: any) => fetchAPI(`/finance/contracts${qs(p)}`),
  get:    (id: string) => fetchAPI(`/finance/contracts/${id}`),
  create: (d: any) => fetchAPI('/finance/contracts', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/finance/contracts/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/finance/contracts/${id}`, { method: 'DELETE' }),

  getDocuments: (id: string) => fetchAPI(`/finance/contracts/${id}/documents`),
  uploadDocument: async (id: string, file: File, uploadedByEmail: string) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('uploaded_by_email', uploadedByEmail)
    const res = await fetch(`${API_URL}/finance/contracts/${id}/documents`, { method: 'POST', body: fd })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Upload failed') }
    return res.json()
  },
  deleteDocument: (id: string, docId: string) => fetchAPI(`/finance/contracts/${id}/documents/${docId}`, { method: 'DELETE' }),
}

// ─── Finance: Customers > Contract Management (customer-side sales contracts) ──
export const financeCustomersAPI = {
  list:   (p?: any) => fetchAPI(`/finance/customer-contracts${qs(p)}`),
  get:    (id: string) => fetchAPI(`/finance/customer-contracts/${id}`),
  create: (d: any) => fetchAPI('/finance/customer-contracts', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/finance/customer-contracts/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/finance/customer-contracts/${id}`, { method: 'DELETE' }),

  linkContact:   (id: string, contactId: string) => fetchAPI(`/finance/customer-contracts/${id}/contacts/${contactId}`, { method: 'POST' }),
  unlinkContact: (id: string, contactId: string) => fetchAPI(`/finance/customer-contracts/${id}/contacts/${contactId}`, { method: 'DELETE' }),

  addLink:    (id: string, d: any) => fetchAPI(`/finance/customer-contracts/${id}/links`, { method: 'POST', body: JSON.stringify(d) }),
  removeLink: (id: string, linkId: string) => fetchAPI(`/finance/customer-contracts/${id}/links/${linkId}`, { method: 'DELETE' }),

  uploadSignedContract: async (id: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API_URL}/finance/customer-contracts/${id}/signed-contract`, { method: 'POST', body: fd })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Upload failed') }
    return res.json()
  },
  uploadInvoicingDocumentation: async (id: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API_URL}/finance/customer-contracts/${id}/invoicing-documentation`, { method: 'POST', body: fd })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Upload failed') }
    return res.json()
  },
}

// ─── Finance: Purchasing ───────────────────────────────────────────────────────
export const financePurchaseOrdersAPI = {
  list:   (p?: any) => fetchAPI(`/finance/purchase-orders${qs(p)}`),
  get:    (id: string) => fetchAPI(`/finance/purchase-orders/${id}`),
  create: (d: any) => fetchAPI('/finance/purchase-orders', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/finance/purchase-orders/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/finance/purchase-orders/${id}`, { method: 'DELETE' }),
}

// ─── Finance: Supplier Invoicing ───────────────────────────────────────────────
export const financeInvoicesAPI = {
  list:   (p?: any) => fetchAPI(`/finance/invoices${qs(p)}`),
  get:    (id: string) => fetchAPI(`/finance/invoices/${id}`),
  create: (d: any) => fetchAPI('/finance/invoices', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: any) => fetchAPI(`/finance/invoices/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  delete: (id: string) => fetchAPI(`/finance/invoices/${id}`, { method: 'DELETE' }),
  setApproval: (id: string, d: any) => fetchAPI(`/finance/invoices/${id}/approval`, { method: 'PUT', body: JSON.stringify(d) }),
}

// ─── Contact clean-up (LinkedIn check, email check) ────────────────────────────
export const cleanupAPI = {
  linkedinCheck: (contactId: string) => fetchAPI(`/contacts/cleanup/${contactId}/linkedin-check`, { method: 'POST' }),
  emailCheck:    (contactId: string) => fetchAPI(`/contacts/cleanup/${contactId}/email-check`),
  getSuggestions: (status: string = 'pending') => fetchAPI(`/contacts/cleanup/suggestions${qs({ status })}`),
  reviewSuggestion: (id: string, d: any) => fetchAPI(`/contacts/cleanup/suggestions/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  brokenLinks: () => fetchAPI(`/cleanup/broken-links`, { method: 'POST' }),
}
