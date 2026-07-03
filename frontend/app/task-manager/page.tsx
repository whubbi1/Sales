'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TasksLayout, { useTasksPerm } from '@/components/TasksLayout'
import { taskManagerAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { TaskModal } from '@/components/tasks/TaskModal'

const STATUS_LABEL: Record<string, string> = { new: 'New', open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' }
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  new: { bg: '#F1F5F9', color: '#475569' }, open: { bg: '#EFF6FF', color: '#156082' },
  in_progress: { bg: '#FFF7ED', color: '#D97706' }, resolved: { bg: '#ECFDF5', color: '#059669' }, closed: { bg: '#F1F5F9', color: '#64748B' },
}

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}

function fmtDate(d: string) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

function TaskManagerContent() {
  const router = useRouter()
  const { canEdit, dataScope } = useTasksPerm()
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [scope, setScope] = useState<'own' | 'company'>(dataScope === 'company' ? 'company' : 'own')
  const [showNew, setShowNew] = useState(false)
  const userEmail = getStoredUser()?.email || ''

  const load = async () => {
    setLoading(true)
    try {
      const d = await taskManagerAPI.list({ email: userEmail, scope, status: statusFilter || undefined })
      setTasks(d.tasks || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [scope, statusFilter])

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>✅ My Tasks</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowNew(true)} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
            + New Task
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
        <select style={inp} value={scope} onChange={e => setScope(e.target.value as any)}>
          <option value="own">My Tasks (owner, assignee or watcher)</option>
          <option value="company">All Company Tasks</option>
        </select>
        <select style={inp} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {['Title', 'Source', 'Owner', 'Assignee', 'Due Date', 'Status', 'Subtasks'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : tasks.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No tasks found.</td></tr>
            ) : tasks.map(t => (
              <tr key={t.id} onClick={() => router.push(`/task-manager/${t.id}`)} style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '10px 12px', minWidth: '200px', fontWeight: '700', color: '#156082' }}>{t.title}</td>
                <td style={{ padding: '10px 12px' }}><span style={{ background: '#F1F5F9', color: '#3F3F3F', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', textTransform: 'capitalize' }}>{t.source}</span></td>
                <td style={{ padding: '10px 12px', color: '#3F3F3F' }}>{t.owner_name || t.owner_email || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#3F3F3F' }}>{t.assignee_name || t.assignee_email || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#64748B' }}>{fmtDate(t.due_date)}</td>
                <td style={{ padding: '10px 12px' }}><span style={{ background: STATUS_COLOR[t.status]?.bg, color: STATUS_COLOR[t.status]?.color, padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{STATUS_LABEL[t.status]}</span></td>
                <td style={{ padding: '10px 12px', color: '#64748B' }}>{t.subtask_count > 0 ? t.subtask_count : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <TaskModal hideEntity source="manual" onClose={() => setShowNew(false)} onSave={() => { setShowNew(false); load() }} />
      )}
    </div>
  )
}

export default function TaskManagerPage() {
  return <TasksLayout><TaskManagerContent /></TasksLayout>
}
