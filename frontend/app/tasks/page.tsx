'use client'
// app/tasks/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { tasksAPI, companiesAPI, contactsAPI, opportunitiesAPI } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/shared/RecordLayout'
import { TaskModal } from '@/components/tasks/TaskModal'

const STATUS_LABEL: Record<string, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  todo: { bg: '#F1F5F9', color: '#475569' },
  in_progress: { bg: '#FFF7ED', color: '#D97706' },
  done: { bg: '#ECFDF5', color: '#059669' },
}
const ENTITY_LABEL: Record<string, string> = { company: 'Customer', contact: 'Contact', opportunity: 'Opportunity' }
const ENTITY_HREF: Record<string, string> = { company: '/companies', contact: '/contacts', opportunity: '/opportunities' }

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [t, c, ct, o] = await Promise.all([
        tasksAPI.list({ status_filter: statusFilter || undefined }),
        companiesAPI.list({}), contactsAPI.list({}), opportunitiesAPI.list({}),
      ])
      setTasks(t); setCompanies(c); setContacts(ct); setOpportunities(o)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [statusFilter])

  const entityInfo = (task: any) => {
    const list = task.entity_type === 'company' ? companies : task.entity_type === 'contact' ? contacts : opportunities
    const e = list.find((x: any) => x.id === task.entity_id)
    if (!e) return { name: '—', href: '' }
    const name = task.entity_type === 'company' ? e.name : task.entity_type === 'contact' ? `${e.first_name} ${e.last_name}` : e.deal_name
    return { name, href: `${ENTITY_HREF[task.entity_type]}/${e.id}` }
  }

  const toggleDone = async (task: any) => {
    await tasksAPI.update(task.id, { status: task.status === 'done' ? 'todo' : 'done' })
    load()
  }

  const deleteTask = async (task: any) => {
    if (!confirm(`Delete task "${task.title}"?`)) return
    await tasksAPI.delete(task.id)
    load()
  }

  const overdue = (task: any) => task.status !== 'done' && task.due_date && new Date(task.due_date) < new Date()

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '24px 28px' }}>
          <PageHeader
            title="Tasks"
            count={tasks.length}
            action={
              <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Task
              </button>
            }
          />

          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
            <select className="form-input" style={{ width: '200px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#FAFBFC' }}>
                <tr>
                  {['', 'Title', 'Linked To', 'Due Date', 'Owner', 'Status', 'Outlook', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Loading...</td></tr>
                ) : tasks.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState icon="✅" title="No tasks yet" description="Create your first task by clicking New Task" /></td></tr>
                ) : tasks.map(task => {
                  const info = entityInfo(task)
                  return (
                    <tr key={task.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '11px 16px' }}>
                        <input type="checkbox" checked={task.status === 'done'} onChange={() => toggleDone(task)} style={{ accentColor: '#219BD6', width: '15px', height: '15px', cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ fontWeight: '700', color: task.status === 'done' ? '#9B9B9B' : '#144766', fontSize: '12px', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</div>
                        {task.description && <div style={{ fontSize: '11px', color: '#9B9B9B', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.description}</div>}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: '12px' }}>
                        {info.href ? (
                          <span onClick={() => router.push(info.href)} style={{ color: '#219BD6', fontWeight: '600', cursor: 'pointer' }}>{info.name}</span>
                        ) : <span style={{ color: '#CBD5E0' }}>—</span>}
                        <div style={{ fontSize: '10px', color: '#9B9B9B' }}>{ENTITY_LABEL[task.entity_type]}</div>
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: '11px', color: overdue(task) ? '#DC2626' : '#9B9B9B', fontWeight: overdue(task) ? '700' : '400' }}>
                        {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: '12px', color: '#3F3F3F' }}>{task.owner_name || task.owner_email || '—'}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ background: STATUS_COLOR[task.status]?.bg, color: STATUS_COLOR[task.status]?.color, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{STATUS_LABEL[task.status]}</span>
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: '14px' }}>{task.outlook_task_id ? '✓' : task.sync_to_outlook ? '⏳' : '—'}</td>
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
          </div>
        </div>
      </main>
      {showModal && <TaskModal task={editing} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />}
    </div>
  )
}
