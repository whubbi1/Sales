'use client'
// app/tasks/page.tsx — Sales' own view of the Task Manager, scoped to source='sales'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { taskManagerAPI, companiesAPI, contactsAPI, opportunitiesAPI, leadsAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { PageHeader, EmptyState } from '@/components/shared/RecordLayout'
import { TaskModal } from '@/components/tasks/TaskModal'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, ColumnResizeHandle, REPORT_CELL_STYLE, SortArrow, Pagination } from '@/components/it/ReportBuilder'

const STATUS_LABEL: Record<string, string> = { new: 'New', open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' }
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  new: { bg: '#F1F5F9', color: '#475569' },
  open: { bg: '#EFF6FF', color: '#219BD6' },
  in_progress: { bg: '#FFF7ED', color: '#D97706' },
  resolved: { bg: '#ECFDF5', color: '#059669' },
  closed: { bg: '#F1F5F9', color: '#64748B' },
}
const DONE_STATUSES = ['resolved', 'closed']
const ENTITY_LABEL: Record<string, string> = { company: 'Customer', contact: 'Contact', opportunity: 'Opportunity', lead: 'Lead' }
const ENTITY_HREF: Record<string, string> = { company: '/companies', contact: '/contacts', opportunity: '/opportunities', lead: '/leads' }

const COLUMNS: ReportColumn[] = [
  { key: 'title', label: 'Title', filterable: 'text' },
  { key: 'linked_to_name', label: 'Linked To', filterable: 'text' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'owner_display', label: 'Owner', filterable: 'text' },
  { key: 'status', label: 'Status', filterable: 'select', options: Object.keys(STATUS_LABEL) },
  { key: 'outlook_display', label: 'Outlook' },
]

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  title: 260, linked_to_name: 180, due_date: 130, owner_display: 160, status: 130, outlook_display: 90,
}

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [nameSearch, setNameSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const actingEmail = getStoredUser()?.email || ''
  const rb = useReportBuilder('sales_tasks', COLUMNS, actingEmail)

  const load = async () => {
    setLoading(true)
    try {
      const [t, c, ct, o, l] = await Promise.all([
        taskManagerAPI.list({ source: 'sales', status_filter: statusFilter || undefined, email: actingEmail, scope: 'own' }),
        companiesAPI.list({}), contactsAPI.list({}), opportunitiesAPI.list({}), leadsAPI.list({}),
      ])
      setTasks(t.tasks || []); setCompanies(c); setContacts(ct); setOpportunities(o); setLeads(l)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [statusFilter])

  const entityInfo = (task: any) => {
    const list = task.entity_type === 'company' ? companies : task.entity_type === 'contact' ? contacts : task.entity_type === 'lead' ? leads : opportunities
    const e = list.find((x: any) => x.id === task.entity_id)
    if (!e) return { name: '—', href: '' }
    const name = task.entity_type === 'company' ? e.name : task.entity_type === 'contact' ? `${e.first_name} ${e.last_name}` : task.entity_type === 'lead' ? e.title : e.deal_name
    return { name, href: `${ENTITY_HREF[task.entity_type]}/${e.id}` }
  }

  const toggleDone = async (task: any) => {
    const done = DONE_STATUSES.includes(task.status)
    try { await taskManagerAPI.setStatus(task.id, { acting_email: actingEmail, status: done ? 'new' : 'resolved' }) }
    catch (e: any) { alert(e.message) }
    load()
  }

  const deleteTask = async (task: any) => {
    if (!confirm(`Delete task "${task.title}"?`)) return
    try { await taskManagerAPI.delete(task.id, actingEmail) }
    catch (e: any) { alert(e.message); return }
    load()
  }

  const overdue = (task: any) => !DONE_STATUSES.includes(task.status) && task.due_date && new Date(task.due_date) < new Date()

  const withDisplay = tasks.map(t => ({
    ...t,
    linked_to_name: entityInfo(t).name,
    owner_display: t.owner_name || t.owner_email || '',
    outlook_display: t.outlook_task_id ? 'Synced' : t.sync_to_outlook ? 'Pending' : '',
  }))
  const searched = withDisplay.filter(t => !nameSearch.trim() || t.title.toLowerCase().includes(nameSearch.trim().toLowerCase()))
  const reported = applyReport(searched, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const pageRows = reported.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '24px 28px' }}>
          <PageHeader
            title="Tasks"
            count={reported.length}
            search={{ value: nameSearch, onChange: setNameSearch }}
            action={
              <div style={{ display: 'flex', gap: '8px' }}>
                <ReportPanel columns={COLUMNS} rb={rb} />
                <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  New Task
                </button>
              </div>
            }
          />

          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
            <select className="form-input" style={{ width: '200px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead style={{ background: '#FAFBFC' }}>
                <tr>
                  <th style={{ padding: '10px 16px', borderBottom: '1px solid #E2E8F0', width: '40px' }} />
                  {COLUMNS.filter(c => isVisible(c.key)).map(c => (
                    <th key={c.key} onClick={() => rb.toggleSort(c.key)} style={{ position: 'relative', textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: `${rb.columnWidths[c.key] || DEFAULT_COLUMN_WIDTHS[c.key] || 150}px`, cursor: 'pointer', userSelect: 'none' }}>
                      {c.label}<SortArrow active={rb.sortField === c.key} dir={rb.sortDir} />
                      <ColumnResizeHandle colKey={c.key} rb={rb} />
                    </th>
                  ))}
                  <th style={{ padding: '10px 16px', borderBottom: '1px solid #E2E8F0', width: '140px' }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={COLUMNS.length + 2} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Loading...</td></tr>
                ) : reported.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length + 2}><EmptyState icon="✅" title="No tasks yet" description="Create your first task by clicking New Task" /></td></tr>
                ) : pageRows.map(task => {
                  const info = entityInfo(task)
                  return (
                    <tr key={task.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '11px 16px' }}>
                        <input type="checkbox" checked={DONE_STATUSES.includes(task.status)} onChange={() => toggleDone(task)} style={{ accentColor: '#219BD6', width: '15px', height: '15px', cursor: 'pointer' }} />
                      </td>
                      {isVisible('title') && (
                        <td style={{ padding: '11px 16px', ...REPORT_CELL_STYLE }}>
                          <div style={{ fontWeight: '700', color: DONE_STATUSES.includes(task.status) ? '#9B9B9B' : '#144766', fontSize: '12px', textDecoration: DONE_STATUSES.includes(task.status) ? 'line-through' : 'none' }}>{task.title}</div>
                          {task.description && <div style={{ fontSize: '11px', color: '#9B9B9B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.description}</div>}
                        </td>
                      )}
                      {isVisible('linked_to_name') && (
                        <td style={{ padding: '11px 16px', fontSize: '12px' }}>
                          {info.href ? (
                            <span onClick={() => router.push(info.href)} style={{ color: '#219BD6', fontWeight: '600', cursor: 'pointer' }}>{info.name}</span>
                          ) : <span style={{ color: '#CBD5E0' }}>—</span>}
                          <div style={{ fontSize: '10px', color: '#9B9B9B' }}>{ENTITY_LABEL[task.entity_type]}</div>
                        </td>
                      )}
                      {isVisible('due_date') && (
                        <td style={{ padding: '11px 16px', fontSize: '11px', color: overdue(task) ? '#DC2626' : '#9B9B9B', fontWeight: overdue(task) ? '700' : '400' }}>
                          {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </td>
                      )}
                      {isVisible('owner_display') && <td style={{ padding: '11px 16px', fontSize: '12px', color: '#3F3F3F' }}>{task.owner_display || '—'}</td>}
                      {isVisible('status') && (
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ background: STATUS_COLOR[task.status]?.bg, color: STATUS_COLOR[task.status]?.color, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{STATUS_LABEL[task.status]}</span>
                        </td>
                      )}
                      {isVisible('outlook_display') && <td style={{ padding: '11px 16px', fontSize: '14px' }}>{task.outlook_task_id ? '✓' : task.sync_to_outlook ? '⏳' : '—'}</td>}
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => { setEditing(task); setShowModal(true) }} style={{ padding: '5px 10px', background: '#EFF6FF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#219BD6', fontWeight: '700' }}>Edit</button>
                          <button onClick={() => deleteTask(task)} style={{ padding: '5px 10px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#DC2626', fontWeight: '700' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination page={rb.page} setPage={rb.setPage} total={reported.length} />
          </div>
        </div>
      </main>
      {showModal && <TaskModal task={editing} source="sales" onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />}
    </div>
  )
}
