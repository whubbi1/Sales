'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { OperationsLayout, useOperationsPerm } from '@/components/OperationsLayout'
import { projectsAPI, taskManagerAPI, contactsAPI, legalAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { PropertyRow, SidebarSection, SidebarCard, TabNav } from '@/components/shared/RecordLayout'
import { TaskModal } from '@/components/tasks/TaskModal'
import { ProjectStaffingSheet } from '@/components/projects/ProjectStaffingSheet'

const API = 'https://api.whubbi.wcomply.com'
const TASK_DONE_STATUSES = ['resolved', 'closed']
const STATUS_OPTIONS = ['New', 'Planned', 'In Progress', 'Finished']
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  New: { bg: '#F1F5F9', color: '#475569' }, Planned: { bg: '#EFF6FF', color: '#156082' },
  'In Progress': { bg: '#FFF7ED', color: '#D97706' }, Finished: { bg: '#ECFDF5', color: '#059669' },
}
const HEALTH_COLORS = ['red', 'orange', 'green']
const HEALTH_HEX: Record<string, string> = { red: '#DC2626', orange: '#D97706', green: '#059669' }

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined
const fmtDateTime = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

// Every 1st-of-month between two dates (inclusive) — Basic staffing's grid columns, same
// helper as the Opportunity detail page's own Staffing tab.
function monthsBetween(start?: string, end?: string): { key: string; label: string }[] {
  if (!start || !end) return []
  const s = new Date(start), e = new Date(end)
  const months: { key: string; label: string }[] = []
  let cur = new Date(s.getFullYear(), s.getMonth(), 1)
  const last = new Date(e.getFullYear(), e.getMonth(), 1)
  while (cur <= last) {
    months.push({ key: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-01`, label: cur.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) })
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }
  return months
}

function EditableCell({ display, editing, onStartEdit, children }: any) {
  return editing ? children : (
    <div onClick={onStartEdit} title="Click to edit"
      style={{ fontSize: '13px', color: '#3F3F3F', cursor: 'pointer', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {display || <span style={{ color: '#94A3B8' }}>—</span>}
    </div>
  )
}

// Own internal title/url state, since Sales and Project Documentation now render together
// on one Documentation tab — sharing page-level state between them would leak keystrokes
// from one section's inputs into the other's.
function DocumentsSection({ docs, onAdd, onDelete }: { docs: any[]; onAdd: (title: string, url: string) => void; onDelete: (doc: any) => void }) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const submit = () => {
    if (!title.trim() || !url.trim()) return
    onAdd(title.trim(), url.trim())
    setTitle(''); setUrl('')
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <input className="form-input" style={{ flex: 1 }} placeholder="Title…" value={title} onChange={e => setTitle(e.target.value)} />
        <input className="form-input" style={{ flex: 2 }} placeholder="Link (SharePoint, etc.)…" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
        <button className="btn-primary" onClick={submit}>+ Add</button>
      </div>
      {docs.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No documents listed yet.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {docs.map((d: any) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', color: '#144766', fontSize: '13px' }}>{d.title}</div>
                <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6', fontSize: '11px' }}>🔗 Open</a>
              </div>
              <button onClick={() => onDelete(d)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectDetailContent() {
  const { id } = useParams()
  const router = useRouter()
  const { level } = useOperationsPerm('projects')

  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')
  const [users, setUsers] = useState<any[]>([])
  const [operationalTeams, setOperationalTeams] = useState<any[]>([])
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')

  const [editingNameField, setEditingNameField] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)

  const [activityLog, setActivityLog] = useState<any[]>([])
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [salesDocs, setSalesDocs] = useState<any[]>([])
  const [projectDocs, setProjectDocs] = useState<any[]>([])

  const [tasks, setTasks] = useState<any[]>([])
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<any>(null)

  const [expenses, setExpenses] = useState<any[]>([])
  const [expenseDate, setExpenseDate] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseDescription, setExpenseDescription] = useState('')

  const [deliverables, setDeliverables] = useState<any[]>([])
  const [currentRoles, setCurrentRoles] = useState<any[]>([])
  const [currentTasks, setCurrentTasks] = useState<any[]>([])
  const [staffingBasic, setStaffingBasic] = useState<any[]>([])
  const [addStaffEmail, setAddStaffEmail] = useState('')
  const [addStaffRole, setAddStaffRole] = useState('')
  const [editingRateId, setEditingRateId] = useState<string | null>(null)
  const [delivTitle, setDelivTitle] = useState('')
  const [delivDueDate, setDelivDueDate] = useState('')
  const [delivAmountType, setDelivAmountType] = useState('fixed')
  const [delivAmount, setDelivAmount] = useState('')
  const [delivPercentage, setDelivPercentage] = useState('')

  const [contacts, setContacts] = useState<any[]>([])
  const [allContacts, setAllContacts] = useState<any[]>([])
  const [addContactId, setAddContactId] = useState('')

  const load = async () => {
    try {
      const p = await projectsAPI.get(id as string)
      setProject(p)
      const [log, cmts, sales, proj, tks, exps, cts, delivs, roles, stasks, basic] = await Promise.all([
        projectsAPI.getActivityLog(id as string),
        projectsAPI.getComments(id as string),
        projectsAPI.getDocuments(id as string, 'sales'),
        projectsAPI.getDocuments(id as string, 'project'),
        taskManagerAPI.list({ entity_type: 'project', entity_id: id, source: 'operations' }),
        projectsAPI.getExpenses(id as string),
        projectsAPI.getContacts(id as string),
        projectsAPI.getDeliverables(id as string),
        projectsAPI.getStaffingRoles(id as string, 'current'),
        projectsAPI.getStaffing(id as string, 'current'),
        projectsAPI.getStaffingBasic(id as string),
      ])
      setActivityLog(log)
      setComments(cmts)
      setSalesDocs(sales)
      setProjectDocs(proj)
      setTasks(tks.tasks || tks || [])
      setExpenses(exps)
      setContacts(cts)
      setDeliverables(delivs)
      setCurrentRoles(roles)
      setCurrentTasks(stasks)
      setStaffingBasic(basic)
    } catch {
      router.push('/operations/projects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    fetch(`${API}/settings/users`).then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
    contactsAPI.list({}).then(setAllContacts).catch(() => {})
    legalAPI.getOrgEntities('operational_team').then(d => setOperationalTeams(d.org_entities || [])).catch(() => {})
    const u = getStoredUser()
    if (u) { setUserEmail(u.email); setUserName(u.name) }
  }, [])

  const patchProject = async (fields: any) => {
    const updated = await projectsAPI.update(project.id, { ...fields, changed_by_email: userEmail, changed_by_name: userName })
    setProject(updated)
  }

  const saveName = async (name: string) => {
    setEditingNameField(false)
    if (!name.trim() || name === project.project_name) return
    await patchProject({ project_name: name.trim() })
  }

  const addComment = async () => {
    if (!newComment.trim()) return
    await projectsAPI.addComment(project.id, { author_email: userEmail, author_name: userName, comment: newComment.trim() })
    setNewComment('')
    setComments(await projectsAPI.getComments(project.id))
  }
  const deleteComment = async (c: any) => {
    if (!confirm('Delete this comment?')) return
    await projectsAPI.deleteComment(project.id, c.id)
    setComments(await projectsAPI.getComments(project.id))
  }

  const addDoc = async (category: 'sales' | 'project', title: string, url: string) => {
    await projectsAPI.addDocument(project.id, { category, title, url, created_by: userEmail })
    if (category === 'sales') setSalesDocs(await projectsAPI.getDocuments(project.id, 'sales'))
    else setProjectDocs(await projectsAPI.getDocuments(project.id, 'project'))
  }
  const deleteDoc = async (category: 'sales' | 'project', doc: any) => {
    if (!confirm(`Delete "${doc.title}"?`)) return
    await projectsAPI.deleteDocument(project.id, doc.id)
    if (category === 'sales') setSalesDocs(await projectsAPI.getDocuments(project.id, 'sales'))
    else setProjectDocs(await projectsAPI.getDocuments(project.id, 'project'))
  }

  const updateRoleRate = async (roleId: string, rate: number | null) => {
    const updated = await projectsAPI.updateStaffingRole(project.id, roleId, { daily_rate: rate })
    setCurrentRoles(prev => prev.map((r: any) => r.id === roleId ? updated : r))
  }
  const totalDaysForRole = (roleId: string) =>
    currentTasks.filter((t: any) => t.role_id === roleId).reduce((sum: number, t: any) => sum + (t.allocations || []).reduce((s: number, a: any) => s + a.days, 0), 0)

  // Basic-mode equivalent of updateRoleRate/totalDaysForRole above — most projects use Basic
  // staffing (no RFP), so the Invoicing tab's resource-rate table needs to read from whichever
  // staffing_mode actually applies, not just the Extended roles.
  const updateBasicRate = async (staffingId: string, rate: number | null) => {
    const updated = await projectsAPI.updateStaffingBasic(project.id, staffingId, { daily_rate: rate })
    setStaffingBasic(prev => prev.map((s: any) => s.id === staffingId ? updated : s))
  }
  const totalDaysForBasic = (s: any) => (s.months || []).reduce((sum: number, m: any) => sum + (m.days || 0), 0)

  const addDeliverable = async () => {
    if (!delivTitle.trim()) return
    const payload: any = { title: delivTitle.trim(), due_date: delivDueDate || null, amount_type: delivAmountType, created_by: userEmail }
    if (delivAmountType === 'fixed') payload.fixed_amount = delivAmount ? parseFloat(delivAmount) : null
    else payload.percentage = delivPercentage ? parseFloat(delivPercentage) : null
    await projectsAPI.addDeliverable(project.id, payload)
    setDelivTitle(''); setDelivDueDate(''); setDelivAmount(''); setDelivPercentage('')
    setDeliverables(await projectsAPI.getDeliverables(project.id))
  }
  const deleteDeliverable = async (d: any) => {
    if (!confirm(`Delete deliverable "${d.title}"?`)) return
    await projectsAPI.deleteDeliverable(project.id, d.id)
    setDeliverables(await projectsAPI.getDeliverables(project.id))
  }

  const addStaffingBasicEntry = async () => {
    if (!addStaffEmail) return
    const u = users.find((uu: any) => uu.email === addStaffEmail)
    await projectsAPI.addStaffingBasic(project.id, { user_email: addStaffEmail, user_name: u?.display_name || `${u?.first_name} ${u?.last_name}`, role: addStaffRole })
    setAddStaffEmail(''); setAddStaffRole('')
    setStaffingBasic(await projectsAPI.getStaffingBasic(project.id))
  }
  const removeStaffingBasicEntry = async (sid: string) => {
    try { await projectsAPI.removeStaffingBasic(project.id, sid) } catch (e: any) { alert(e.message); return }
    setStaffingBasic(await projectsAPI.getStaffingBasic(project.id))
  }
  const saveStaffingBasicMonth = async (staffingRow: any, monthKey: string, days: number) => {
    const months = (staffingRow.months || []).filter((m: any) => m.month.slice(0, 10) !== monthKey)
    if (days > 0) months.push({ month: monthKey, days })
    setStaffingBasic(prev => prev.map((s: any) => s.id === staffingRow.id ? { ...s, months } : s))
    await projectsAPI.setStaffingBasicMonths(project.id, staffingRow.id, months)
  }

  const addExpense = async () => {
    if (!expenseDate || !expenseAmount) return
    await projectsAPI.addExpense(project.id, { expense_date: expenseDate, amount: parseFloat(expenseAmount), description: expenseDescription.trim() || null, created_by: userEmail })
    setExpenseDate(''); setExpenseAmount(''); setExpenseDescription('')
    setExpenses(await projectsAPI.getExpenses(project.id))
  }
  const deleteExpense = async (e: any) => {
    if (!confirm('Delete this expense?')) return
    await projectsAPI.deleteExpense(project.id, e.id)
    setExpenses(await projectsAPI.getExpenses(project.id))
  }

  const linkContact = async () => {
    if (!addContactId) return
    await projectsAPI.linkContact(project.id, addContactId)
    setAddContactId('')
    setContacts(await projectsAPI.getContacts(project.id))
  }
  const unlinkContact = async (c: any) => {
    await projectsAPI.unlinkContact(project.id, c.id)
    setContacts(await projectsAPI.getContacts(project.id))
  }

  const reloadTasks = async () => setTasks((await taskManagerAPI.list({ entity_type: 'project', entity_id: id, source: 'operations' })).tasks || [])
  const toggleTaskDone = async (task: any) => {
    const done = TASK_DONE_STATUSES.includes(task.status)
    try { await taskManagerAPI.setStatus(task.id, { acting_email: userEmail, status: done ? 'new' : 'resolved' }) }
    catch (e: any) { alert(e.message) }
    reloadTasks()
  }
  const deleteTask = async (task: any) => {
    if (!confirm(`Delete task "${task.title}"?`)) return
    try { await taskManagerAPI.delete(task.id, userEmail) } catch (e: any) { alert(e.message); return }
    reloadTasks()
  }

  if (loading || level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )
  if (!project) return null

  const startDate = project.is_internal ? project.start_date : project.opportunity?.contract_start_date
  const endDate = project.is_internal ? project.end_date : project.opportunity?.contract_end_date
  const clientName = project.company?.name
  const isLicenseProject = project.opportunity?.project_status === 'Software Licenses'
  const revisedStartField = isLicenseProject ? 'revised_license_start_date' : 'revised_start_date'
  const revisedEndField = isLicenseProject ? 'revised_license_end_date' : 'revised_end_date'
  const actualStartField = isLicenseProject ? 'actual_license_start_date' : 'actual_start_date'
  const actualEndField = isLicenseProject ? 'actual_license_end_date' : 'actual_end_date'
  const toDateInput = (d?: string) => d ? d.slice(0, 10) : ''

  // Invoicing tab — invoicing_type drives which sub-form shows, independently of the
  // Opportunity's (frozen) project_status. Expected Revenue is carried from the Opportunity's
  // deal_amount (see expected_revenue on Project) and independently editable from here on —
  // it no longer derives from the sub-form data below; the resource-rate and deliverable
  // amounts are still shown as their own breakdown/checksum, just not fed into the header figure.
  const totalProjectAmount = project.opportunity?.deal_amount ?? null
  const deliverableAmount = (d: any) => d.amount_type === 'fixed' ? (d.fixed_amount || 0) : ((d.percentage || 0) / 100) * (totalProjectAmount || 0)
  const deliverablesTotal = deliverables.reduce((sum: number, d: any) => sum + deliverableAmount(d), 0)
  const fmtMoney = (v: number) => `€${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  const headlineValueStyle: React.CSSProperties = { fontSize: '20px', fontWeight: '800', color: '#144766' }

  // Daily Invoicing's resource-rate table reads from whichever staffing functionality this
  // project actually uses — Extended (RFP-only) or Basic (everyone else) — normalized to one
  // shape so the table itself doesn't need to care which.
  const invoicingResources = project.staffing_mode === 'extended'
    ? currentRoles.map((r: any) => ({ kind: 'extended', id: r.id, name: r.resource_name || r.resource_email, role: r.name, days: totalDaysForRole(r.id), daily_rate: r.daily_rate }))
    : staffingBasic.map((s: any) => ({ kind: 'basic', id: s.id, name: s.user_name || s.user_email, role: s.role, days: totalDaysForBasic(s), daily_rate: s.daily_rate }))
  const updateResourceRate = (item: any, rate: number | null) => item.kind === 'extended' ? updateRoleRate(item.id, rate) : updateBasicRate(item.id, rate)

  const dateTableCell = (field: string | null, fixedValue?: string) => (
    <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', textAlign: 'center' }}>
      {field ? (
        <EditableCell display={fmt(project[field])} editing={editingField === field} onStartEdit={() => setEditingField(field)}>
          <input autoFocus type="date" className="form-input" style={{ fontSize: '13px', padding: '4px 6px', textAlign: 'center' }} defaultValue={toDateInput(project[field])}
            onBlur={e => { setEditingField(null); patchProject({ [field]: e.target.value || null }) }} />
        </EditableCell>
      ) : (fmt(fixedValue) || '—')}
    </td>
  )

  const textRow = (label: string, field: string, placeholder?: string) => (
    <PropertyRow label={label} value={
      <EditableCell display={project[field]} editing={editingField === field} onStartEdit={() => setEditingField(field)}>
        <input autoFocus className="form-input" style={{ fontSize: '13px' }} defaultValue={project[field] || ''} placeholder={placeholder}
          onBlur={e => { setEditingField(null); patchProject({ [field]: e.target.value || null }) }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
      </EditableCell>
    } />
  )
  const numberRow = (label: string, field: string) => (
    <PropertyRow label={label} value={
      <EditableCell display={project[field] != null ? project[field].toLocaleString('en-US') : null} editing={editingField === field} onStartEdit={() => setEditingField(field)}>
        <input autoFocus type="number" className="form-input" style={{ fontSize: '13px' }} defaultValue={project[field] ?? ''}
          onBlur={e => { setEditingField(null); patchProject({ [field]: e.target.value ? parseFloat(e.target.value) : null }) }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
      </EditableCell>
    } />
  )
  const projectManagerRow = (
    <PropertyRow label="Project Manager" value={
      <EditableCell display={project.project_manager_name || project.project_manager_email} editing={editingField === 'project_manager'} onStartEdit={() => setEditingField('project_manager')}>
        <select autoFocus className="form-input" style={{ fontSize: '13px' }} defaultValue={project.project_manager_email || ''}
          onChange={e => {
            const u = users.find((uu: any) => uu.email === e.target.value)
            setEditingField(null)
            patchProject({ project_manager_email: e.target.value || null, project_manager_name: u ? (u.display_name || `${u.first_name} ${u.last_name}`) : null })
          }}
          onBlur={() => setEditingField(null)}>
          <option value="">Unassigned</option>
          {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
        </select>
      </EditableCell>
    } />
  )
  const operationalTeamRow = (
    <PropertyRow label="Responsable Opérationnel Team" value={
      <EditableCell display={project.main_operational_team?.title} editing={editingField === 'main_operational_team'} onStartEdit={() => setEditingField('main_operational_team')}>
        <select autoFocus className="form-input" style={{ fontSize: '13px' }} defaultValue={project.main_operational_team_id || ''}
          onChange={e => { setEditingField(null); patchProject({ main_operational_team_id: e.target.value || null }) }}
          onBlur={() => setEditingField(null)}>
          <option value="">None</option>
          {operationalTeams.map((t: any) => <option key={t.id} value={t.id}>{t.code} — {t.title}</option>)}
        </select>
      </EditableCell>
    } />
  )
  const selectRow = (label: string, field: string, options: string[]) => (
    <PropertyRow label={label} value={
      <EditableCell display={project[field]} editing={editingField === field} onStartEdit={() => setEditingField(field)}>
        <select autoFocus className="form-input" style={{ fontSize: '13px' }} defaultValue={project[field] || ''}
          onChange={e => { setEditingField(null); patchProject({ [field]: e.target.value || null }) }} onBlur={() => setEditingField(null)}>
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </EditableCell>
    } />
  )


  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '11px', color: '#9B9B9B' }}>
        <button onClick={() => router.push('/operations/projects')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontWeight: '600', fontSize: '11px', padding: 0 }}>Projects</button>
        <span>/</span><span style={{ color: '#3F3F3F', fontWeight: '600' }}>{project.project_name}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'start' }}>
        <div>
          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: project.is_internal ? '#7C3AED' : '#144766', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '800', flexShrink: 0 }}>
                {project.is_internal ? '🏠' : '📁'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  {editingNameField ? (
                    <input autoFocus className="form-input" style={{ fontSize: '16px', fontWeight: '800', maxWidth: '360px' }} defaultValue={project.project_name}
                      onBlur={e => saveName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                  ) : (
                    <h1 onClick={() => setEditingNameField(true)} title="Click to rename" style={{ fontSize: '18px', fontWeight: '800', color: '#144766', margin: 0, cursor: 'pointer' }}>{project.project_name}</h1>
                  )}
                  <span style={{ background: '#F1F5F9', color: '#64748B', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{project.project_number}</span>
                  {project.is_internal && <span style={{ background: '#F5F3FF', color: '#7C3AED', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>INTERNAL</span>}
                  {project.status && <span style={{ background: STATUS_COLOR[project.status]?.bg, color: STATUS_COLOR[project.status]?.color, padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{project.status}</span>}
                  {project.status_color && <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: HEALTH_HEX[project.status_color] }} title={project.status_color} />}
                </div>
                <p style={{ color: '#9B9B9B', fontSize: '12px', margin: 0 }}>
                  {clientName ? `Client: ${clientName}` : project.is_internal ? 'Internal project' : 'No client'}
                  {project.partner?.name && ` · Partner: ${project.partner.name}`}
                </p>
              </div>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '0 20px', background: '#FAFBFC', borderBottom: '2px solid #E2E8F0' }}>
              <TabNav tabs={['Overview', 'Notes', 'Tasks', 'Documentation', 'Invoicing', 'Staffing', 'Expenses']} active={tab} onChange={setTab} />
            </div>
            <div style={{ padding: '20px' }}>
              {tab === 'Overview' && (
                <div>
                  {!project.is_internal && (
                    <div style={{ marginBottom: '18px' }}>
                      <PropertyRow label="Linked Opportunity" value={project.opportunity ? <a href={`/opportunities/${project.opportunity_id}`} style={{ color: '#219BD6', fontWeight: '600' }}>{project.opportunity.deal_name} ↗</a> : null} />
                    </div>
                  )}
                  {project.is_internal && <PropertyRow label="Description" value={project.description} />}

                  <p className="section-label" style={{ marginTop: '10px', marginBottom: '8px' }}>{isLicenseProject ? 'License Dates' : 'Dates'}</p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '18px' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0' }}></th>
                        {['Initial', 'Revised', 'Actual'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'center', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '13px', fontWeight: '700', color: '#144766' }}>Start Date</td>
                        {dateTableCell(null, startDate)}
                        {dateTableCell(revisedStartField)}
                        {dateTableCell(actualStartField)}
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '13px', fontWeight: '700', color: '#144766' }}>End Date</td>
                        {dateTableCell(null, endDate)}
                        {dateTableCell(revisedEndField)}
                        {dateTableCell(actualEndField)}
                      </tr>
                    </tbody>
                  </table>

                  <p className="section-label" style={{ marginTop: '18px', marginBottom: '8px' }}>Status</p>
                  {selectRow('Status', 'status', STATUS_OPTIONS)}
                  <PropertyRow label="Health" value={
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {HEALTH_COLORS.map(c => (
                        <div key={c} onClick={() => patchProject({ status_color: c })} title={c}
                          style={{ width: '18px', height: '18px', borderRadius: '50%', background: HEALTH_HEX[c], cursor: 'pointer', border: project.status_color === c ? '2px solid #144766' : '2px solid transparent', boxSizing: 'border-box' as const }} />
                      ))}
                    </div>
                  } />
                  <PropertyRow label="Progress" value={
                    <div>
                      <EditableCell display={project.progress != null ? `${project.progress}%` : null} editing={editingField === 'progress'} onStartEdit={() => setEditingField('progress')}>
                        <input autoFocus type="number" min={0} max={100} className="form-input" style={{ fontSize: '13px', width: '80px' }} defaultValue={project.progress ?? ''}
                          onBlur={e => { setEditingField(null); const v = e.target.value ? Math.max(0, Math.min(100, parseInt(e.target.value, 10))) : null; patchProject({ progress: v }) }}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                      </EditableCell>
                      {project.progress != null && (
                        <div style={{ marginTop: '4px', width: '160px', height: '6px', borderRadius: '4px', background: '#F1F5F9', overflow: 'hidden' }}>
                          <div style={{ width: `${project.progress}%`, height: '100%', background: '#156082' }} />
                        </div>
                      )}
                    </div>
                  } />

                  <p className="section-label" style={{ marginTop: '18px', marginBottom: '8px' }}>Management</p>
                  {projectManagerRow}
                  {operationalTeamRow}
                  {textRow('Karanext Reference', 'karanext_reference', 'e.g. KX-00123')}

                  <p className="section-label" style={{ marginTop: '20px', marginBottom: '8px' }}>Change History</p>
                  {activityLog.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No changes logged yet.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {activityLog.map((a: any) => (
                        <div key={a.id} style={{ fontSize: '12px', padding: '8px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                          <span style={{ fontWeight: '700', color: '#144766' }}>{a.field_name}</span>
                          <span style={{ color: '#9B9B9B' }}> changed from </span>
                          <span style={{ color: '#DC2626' }}>{a.old_value || '—'}</span>
                          <span style={{ color: '#9B9B9B' }}> to </span>
                          <span style={{ color: '#059669' }}>{a.new_value || '—'}</span>
                          <div style={{ color: '#9B9B9B', fontSize: '10px', marginTop: '2px' }}>{a.changed_by_name || a.changed_by_email} · {fmtDateTime(a.changed_at)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'Tasks' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                    <button className="btn-primary" onClick={() => { setEditingTask(null); setShowTaskModal(true) }}>+ New Task</button>
                  </div>
                  {tasks.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No tasks yet.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {tasks.map((t: any) => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                          <input type="checkbox" checked={TASK_DONE_STATUSES.includes(t.status)} onChange={() => toggleTaskDone(t)} style={{ accentColor: '#219BD6', width: '15px', height: '15px', cursor: 'pointer' }} />
                          <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { setEditingTask(t); setShowTaskModal(true) }}>
                            <div style={{ fontWeight: '700', color: TASK_DONE_STATUSES.includes(t.status) ? '#9B9B9B' : '#144766', fontSize: '13px', textDecoration: TASK_DONE_STATUSES.includes(t.status) ? 'line-through' : 'none' }}>{t.title}</div>
                            <div style={{ fontSize: '11px', color: '#9B9B9B' }}>{t.owner_name || t.owner_email || 'Unassigned'}{t.due_date && ` · Due ${fmt(t.due_date)}`}</div>
                          </div>
                          <button onClick={() => deleteTask(t)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'Documentation' && (
                <div>
                  <p className="section-label" style={{ marginBottom: '10px' }}>Sales Documentation</p>
                  <DocumentsSection docs={salesDocs} onAdd={(t, u) => addDoc('sales', t, u)} onDelete={d => deleteDoc('sales', d)} />
                  <p className="section-label" style={{ marginTop: '28px', marginBottom: '10px' }}>Project Documentation</p>
                  <DocumentsSection docs={projectDocs} onAdd={(t, u) => addDoc('project', t, u)} onDelete={d => deleteDoc('project', d)} />
                </div>
              )}

              {tab === 'Notes' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <input className="form-input" style={{ flex: 1 }} placeholder="Add a note…" value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} />
                    <button className="btn-primary" onClick={addComment}>+ Add</button>
                  </div>
                  {comments.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No notes yet.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {comments.map((c: any) => (
                        <div key={c.id} style={{ padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: '700', color: '#144766', fontSize: '12px' }}>{c.author_name || c.author_email}</span>
                            <button onClick={() => deleteComment(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                          </div>
                          <p style={{ fontSize: '13px', color: '#3F3F3F', margin: '4px 0' }}>{c.comment}</p>
                          <div style={{ fontSize: '10px', color: '#9B9B9B' }}>{fmtDateTime(c.created_at)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'Expenses' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'flex-end' }}>
                    <div>
                      <label className="form-label">Date</label>
                      <input type="date" className="form-input" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Amount</label>
                      <input type="number" className="form-input" style={{ width: '120px' }} placeholder="0.00" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Description</label>
                      <input className="form-input" style={{ width: '100%' }} placeholder="Description…" value={expenseDescription} onChange={e => setExpenseDescription(e.target.value)} onKeyDown={e => e.key === 'Enter' && addExpense()} />
                    </div>
                    <button className="btn-primary" onClick={addExpense}>+ Add</button>
                  </div>
                  {expenses.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No expenses yet.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {expenses.map((e: any) => (
                        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#9B9B9B', width: '90px', flexShrink: 0 }}>{fmt(e.expense_date)}</div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#144766', width: '100px', flexShrink: 0 }}>€{e.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                          <div style={{ flex: 1, fontSize: '13px', color: '#3F3F3F' }}>{e.description || '—'}</div>
                          <button onClick={() => deleteExpense(e)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '13px', fontWeight: '700', color: '#144766', padding: '8px 14px' }}>
                        Total: €{expenses.reduce((sum: number, e: any) => sum + e.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'Invoicing' && (
                <div>
                  <div style={{ display: 'flex', gap: '32px', marginBottom: '22px', flexWrap: 'wrap' }}>
                    <div>
                      <div className="section-label" style={{ marginBottom: '6px' }}>Type of Project</div>
                      <EditableCell display={<span style={headlineValueStyle}>{project.invoicing_type || '—'}</span>} editing={editingField === 'invoicing_type'} onStartEdit={() => setEditingField('invoicing_type')}>
                        <select autoFocus className="form-input" style={{ fontSize: '13px' }} defaultValue={project.invoicing_type || ''}
                          onChange={e => { setEditingField(null); patchProject({ invoicing_type: e.target.value || null }) }} onBlur={() => setEditingField(null)}>
                          <option value="">Select type…</option>
                          <option value="Daily Invoicing">Daily Invoicing</option>
                          <option value="Project">Project</option>
                          <option value="License">License</option>
                        </select>
                      </EditableCell>
                    </div>
                    <div>
                      <div className="section-label" style={{ marginBottom: '6px' }}>Expected Revenue</div>
                      <EditableCell display={<span style={headlineValueStyle}>{project.expected_revenue != null ? fmtMoney(project.expected_revenue) : '—'}</span>} editing={editingField === 'expected_revenue'} onStartEdit={() => setEditingField('expected_revenue')}>
                        <input autoFocus type="number" className="form-input" style={{ fontSize: '13px', width: '160px' }} defaultValue={project.expected_revenue ?? ''}
                          onBlur={e => { setEditingField(null); patchProject({ expected_revenue: e.target.value ? parseFloat(e.target.value) : null }) }}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                      </EditableCell>
                    </div>
                  </div>

                  {!project.invoicing_type && <p style={{ color: '#9B9B9B', fontSize: '13px' }}>Select a project type above to configure invoicing.</p>}

                  {project.invoicing_type === 'Daily Invoicing' && (
                    <div>
                      <p className="section-label" style={{ marginBottom: '8px' }}>Resource Daily Rates</p>
                      {invoicingResources.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No resources in the staffing plan yet — add them from the Staffing tab.</p> : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              {['Resource', 'Role', 'Total Days', 'Daily Rate', 'Revenue'].map((h, i) => (
                                <th key={h} style={{ padding: '8px 12px', textAlign: i >= 2 ? 'right' : 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {invoicingResources.map((item: any) => (
                              <tr key={item.id}>
                                <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '13px', color: '#3F3F3F' }}>{item.name || '—'}</td>
                                <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '13px', color: '#3F3F3F' }}>{item.role || '—'}</td>
                                <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '13px', color: '#3F3F3F', textAlign: 'right' }}>{item.days.toLocaleString('en-US')}</td>
                                <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', textAlign: 'right' }}>
                                  <EditableCell display={item.daily_rate != null ? fmtMoney(item.daily_rate) : null} editing={editingRateId === item.id} onStartEdit={() => setEditingRateId(item.id)}>
                                    <input autoFocus type="number" className="form-input" style={{ fontSize: '13px', width: '110px', textAlign: 'right' }} defaultValue={item.daily_rate ?? ''}
                                      onBlur={e => { setEditingRateId(null); updateResourceRate(item, e.target.value ? parseFloat(e.target.value) : null) }}
                                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                                  </EditableCell>
                                </td>
                                <td style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '13px', fontWeight: '700', color: '#144766', textAlign: 'right' }}>{fmtMoney((item.daily_rate || 0) * item.days)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {project.invoicing_type === 'Project' && (
                    <div>
                      <p className="section-label" style={{ marginBottom: '8px' }}>Deliverables{totalProjectAmount != null && ` (Total Project Amount: ${fmtMoney(totalProjectAmount)})`}</p>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div>
                          <label className="form-label">Title</label>
                          <input className="form-input" placeholder="e.g. Design Sign-off" value={delivTitle} onChange={e => setDelivTitle(e.target.value)} />
                        </div>
                        <div>
                          <label className="form-label">Due Date</label>
                          <input type="date" className="form-input" value={delivDueDate} onChange={e => setDelivDueDate(e.target.value)} />
                        </div>
                        <div>
                          <label className="form-label">Amount Type</label>
                          <select className="form-input" value={delivAmountType} onChange={e => setDelivAmountType(e.target.value)}>
                            <option value="fixed">Fixed Amount</option>
                            <option value="percentage">% of Total Project Amount</option>
                          </select>
                        </div>
                        {delivAmountType === 'fixed' ? (
                          <div>
                            <label className="form-label">Amount</label>
                            <input type="number" className="form-input" style={{ width: '120px' }} placeholder="0.00" value={delivAmount} onChange={e => setDelivAmount(e.target.value)} />
                          </div>
                        ) : (
                          <div>
                            <label className="form-label">Percentage</label>
                            <input type="number" className="form-input" style={{ width: '90px' }} placeholder="0" value={delivPercentage} onChange={e => setDelivPercentage(e.target.value)} />
                          </div>
                        )}
                        <button className="btn-primary" onClick={addDeliverable}>+ Add</button>
                      </div>
                      {deliverables.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No deliverables yet.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {deliverables.map((d: any) => (
                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                              <div style={{ fontSize: '12px', color: '#9B9B9B', width: '90px', flexShrink: 0 }}>{fmt(d.due_date) || '—'}</div>
                              <div style={{ flex: 1, fontSize: '13px', color: '#3F3F3F' }}>{d.title}</div>
                              <div style={{ fontSize: '12px', color: '#9B9B9B', width: '90px', flexShrink: 0 }}>{d.amount_type === 'fixed' ? 'Fixed' : `${d.percentage}%`}</div>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: '#144766', width: '120px', textAlign: 'right', flexShrink: 0 }}>{fmtMoney(deliverableAmount(d))}</div>
                              <button onClick={() => deleteDeliverable(d)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '13px', fontWeight: '700', color: '#144766', padding: '8px 14px' }}>
                            Deliverables Total: {fmtMoney(deliverablesTotal)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {project.invoicing_type === 'License' && (
                    <div>
                      <p className="section-label" style={{ marginBottom: '8px' }}>License Invoicing</p>
                      {selectRow('Invoicing Frequency', 'invoicing_frequency', ['Monthly', 'Yearly'])}
                      {numberRow('Total Contract Value', 'total_contract_value')}
                      {selectRow('Invoicing Start', 'invoicing_start', ['Upfront', 'Other'])}
                      {numberRow('Invoicing Amount per Unit', 'invoicing_amount_per_unit')}
                    </div>
                  )}
                </div>
              )}

              {tab === 'Staffing' && project.staffing_mode === 'extended' && (
                <ProjectStaffingSheet projectId={project.id} startDate={startDate} endDate={endDate} users={users} />
              )}

              {tab === 'Staffing' && project.staffing_mode === 'basic' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <select className="form-input" style={{ width: '220px' }} value={addStaffEmail} onChange={e => setAddStaffEmail(e.target.value)}>
                      <option value="">Select employee…</option>
                      {[...users].sort((a: any, b: any) => (a.display_name || `${a.first_name} ${a.last_name}`).localeCompare(b.display_name || `${b.first_name} ${b.last_name}`)).map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
                    </select>
                    <input className="form-input" style={{ width: '180px' }} placeholder="Role (optional)" value={addStaffRole} onChange={e => setAddStaffRole(e.target.value)} />
                    <button className="btn-primary" onClick={addStaffingBasicEntry} disabled={!addStaffEmail}>+ Add</button>
                  </div>
                  {staffingBasic.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No one staffed on this project yet.</p> : !startDate || !endDate ? (
                    <div>
                      <p style={{ color: '#D97706', fontSize: '12px', marginBottom: '14px' }}>Set a Start Date and End Date to allocate days per month.</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[...staffingBasic].sort((a: any, b: any) => (a.user_name || a.user_email).localeCompare(b.user_name || b.user_email)).map((s: any) => (
                          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                            <div>
                              <div style={{ fontWeight: '700', color: '#144766', fontSize: '13px' }}>{s.user_name || s.user_email}</div>
                              {s.role && <div style={{ fontSize: '11px', color: '#9B9B9B' }}>{s.role}</div>}
                            </div>
                            <button onClick={() => removeStaffingBasicEntry(s.id)} style={{ padding: '5px 10px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#DC2626', fontWeight: '700' }}>Remove</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (() => {
                    const months = monthsBetween(startDate, endDate)
                    const sorted = [...staffingBasic].sort((a: any, b: any) => (a.user_name || a.user_email).localeCompare(b.user_name || b.user_email))
                    return (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', fontSize: '12px', width: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>Resource</th>
                              {months.map(m => <th key={m.key} style={{ textAlign: 'center', padding: '8px 8px', fontSize: '10px', fontWeight: '700', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{m.label}</th>)}
                              <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: '10px', fontWeight: '700', color: '#144766', borderBottom: '1px solid #E2E8F0' }}>Total</th>
                              <th style={{ borderBottom: '1px solid #E2E8F0' }} />
                            </tr>
                          </thead>
                          <tbody>
                            {sorted.map((s: any) => {
                              const dayFor = (key: string) => (s.months || []).find((m: any) => m.month.slice(0, 10) === key)?.days || ''
                              const total = (s.months || []).reduce((sum: number, m: any) => sum + (m.days || 0), 0)
                              return (
                                <tr key={s.id}>
                                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap' }}>
                                    <div style={{ fontWeight: '700', color: '#144766' }}>{s.user_name || s.user_email}</div>
                                    {s.role && <div style={{ fontSize: '10px', color: '#9B9B9B' }}>{s.role}</div>}
                                  </td>
                                  {months.map(m => (
                                    <td key={m.key} style={{ padding: '4px', borderBottom: '1px solid #F1F5F9', textAlign: 'center' }}>
                                      <input type="number" min={0} step={0.5} defaultValue={dayFor(m.key)} placeholder="0"
                                        onBlur={e => saveStaffingBasicMonth(s, m.key, Number(e.target.value) || 0)}
                                        style={{ width: '52px', textAlign: 'center', fontSize: '12px', padding: '4px', border: '1px solid #E2E8F0', borderRadius: '5px' }} />
                                    </td>
                                  ))}
                                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #F1F5F9', textAlign: 'center', fontWeight: '700', color: '#144766' }}>{total || '—'}</td>
                                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #F1F5F9' }}>
                                    <button onClick={() => removeStaffingBasicEntry(s.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <SidebarSection title="Client">
            {project.company ? (
              <SidebarCard title={project.company.name} subtitle="Client" href={`/companies/${project.company.id}`} color="#144766" />
            ) : <p style={{ fontSize: '12px', color: '#9B9B9B' }}>{project.is_internal ? 'Internal project — no client.' : 'No client.'}</p>}
          </SidebarSection>
          <SidebarSection title={`Contacts (${contacts.length})`}>
            {allContacts.filter((c: any) => !contacts.some((lc: any) => lc.id === c.id)).length > 0 && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                <select className="form-input" style={{ flex: 1, fontSize: '12px' }} value={addContactId} onChange={e => setAddContactId(e.target.value)}>
                  <option value="">Select a contact…</option>
                  {allContacts.filter((c: any) => !contacts.some((lc: any) => lc.id === c.id)).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                  ))}
                </select>
                <button className="btn-primary" style={{ fontSize: '12px', padding: '6px 10px' }} onClick={linkContact} disabled={!addContactId}>+ Link</button>
              </div>
            )}
            {contacts.length === 0 ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No contacts linked.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {contacts.map((c: any) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', border: '1px solid #EDF2F7', borderRadius: '7px' }}>
                    <a href={`/contacts/${c.id}`} style={{ fontSize: '12px', fontWeight: '600', color: '#144766', textDecoration: 'none' }}>{c.first_name} {c.last_name}</a>
                    <button onClick={() => unlinkContact(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </SidebarSection>
          {project.partner && (
            <SidebarSection title="Partner">
              <SidebarCard title={project.partner.name} subtitle="Partner" href={`/partners/${project.partner.id}`} color="#7C3AED" />
            </SidebarSection>
          )}
          {!project.is_internal && project.opportunity && (
            <SidebarSection title="Opportunity">
              <SidebarCard title={project.opportunity.deal_name} subtitle={project.opportunity.deal_status} href={`/opportunities/${project.opportunity_id}`} color="#219BD6" />
            </SidebarSection>
          )}
          <SidebarSection title="Timeline">
            <PropertyRow label="Start" value={fmt(startDate)} />
            <PropertyRow label="End" value={fmt(endDate)} />
          </SidebarSection>
        </div>
      </div>

      {showTaskModal && (
        <TaskModal
          task={editingTask}
          entityType="project"
          entityId={project.id}
          entityLabel={project.project_name}
          source="operations"
          onClose={() => setShowTaskModal(false)}
          onSave={() => { setShowTaskModal(false); reloadTasks() }}
        />
      )}
    </div>
  )
}

export default function OperationsProjectDetailPage() {
  return <OperationsLayout><ProjectDetailContent /></OperationsLayout>
}
