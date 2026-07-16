'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TasksLayout, { useTasksPerm } from '@/components/TasksLayout'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, SortArrow, Pagination } from '@/components/it/ReportBuilder'
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

const COLUMNS: ReportColumn[] = [
  { key: 'task_number', label: 'Task #', filterable: 'text' },
  { key: 'title', label: 'Title', filterable: 'text' },
  { key: 'source', label: 'Source', filterable: 'text' },
  { key: 'owner_display', label: 'Owner', filterable: 'text' },
  { key: 'assignee_display', label: 'Assignee', filterable: 'text' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'status', label: 'Status', filterable: 'select', options: Object.keys(STATUS_LABEL) },
  { key: 'subtask_count', label: 'Subtasks' },
]

function fmtDate(d: string) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

function TaskManagerContent() {
  const router = useRouter()
  const { canEdit, dataScope } = useTasksPerm()
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<'own' | 'company'>(dataScope === 'company' ? 'company' : 'own')
  const [showNew, setShowNew] = useState(false)
  const [groupBySubject, setGroupBySubject] = useState(false)
  const userEmail = getStoredUser()?.email || ''

  const rb = useReportBuilder('task_manager_list', COLUMNS, userEmail)

  const load = async () => {
    setLoading(true)
    try {
      const d = await taskManagerAPI.list({ email: userEmail, scope })
      setTasks(d.tasks || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [scope])

  const withDisplay = tasks.map(t => ({ ...t, owner_display: t.owner_name || t.owner_email, assignee_display: t.assignee_name || t.assignee_email }))
  const searched = withDisplay.filter(t => !search || `${t.title} ${t.task_number || ''}`.toLowerCase().includes(search.toLowerCase()))
  const reported = applyReport(searched, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const pageRows = reported.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  const groups = groupBySubject
    ? reported.reduce((acc: Record<string, any[]>, t) => {
        const key = t.subject || 'No Subject'
        acc[key] = acc[key] || []
        acc[key].push(t)
        return acc
      }, {})
    : null
  const groupNames = groups ? Object.keys(groups).sort((a, b) => a === 'No Subject' ? 1 : b === 'No Subject' ? -1 : a.localeCompare(b)) : []

  const Row = (t: any) => (
    <tr key={t.id} onClick={() => router.push(`/task-manager/${t.id}`)} style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {isVisible('task_number') && <td style={{ padding: '10px 12px', color: '#94A3B8', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'nowrap' }}>{t.task_number || '—'}</td>}
      {isVisible('title') && <td style={{ padding: '10px 12px', minWidth: '200px', fontWeight: '700', color: '#156082' }}>{t.title}</td>}
      {isVisible('source') && <td style={{ padding: '10px 12px' }}><span style={{ background: '#F1F5F9', color: '#3F3F3F', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', textTransform: 'capitalize' }}>{t.source}</span></td>}
      {isVisible('owner_display') && <td style={{ padding: '10px 12px', color: '#3F3F3F' }}>{t.owner_display || '—'}</td>}
      {isVisible('assignee_display') && <td style={{ padding: '10px 12px', color: '#3F3F3F' }}>{t.assignee_display || '—'}</td>}
      {isVisible('due_date') && <td style={{ padding: '10px 12px', color: '#64748B' }}>{fmtDate(t.due_date)}</td>}
      {isVisible('status') && <td style={{ padding: '10px 12px' }}><span style={{ background: STATUS_COLOR[t.status]?.bg, color: STATUS_COLOR[t.status]?.color, padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{STATUS_LABEL[t.status]}</span></td>}
      {isVisible('subtask_count') && <td style={{ padding: '10px 12px', color: '#64748B' }}>{t.subtask_count > 0 ? t.subtask_count : '—'}</td>}
    </tr>
  )
  const headerRow = (
    <tr>
      {COLUMNS.filter(c => isVisible(c.key)).map(c => (
        <th key={c.key} onClick={() => rb.toggleSort(c.key)} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>{c.label}<SortArrow active={rb.sortField === c.key} dir={rb.sortDir} /></th>
      ))}
    </tr>
  )

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>✅ My Tasks</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{reported.length} task{reported.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ReportPanel columns={COLUMNS} rb={rb} />
          {canEdit && (
            <button onClick={() => setShowNew(true)} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              + New Task
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input style={{ ...inp, width: '220px' }} placeholder="Search title or task #…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={inp} value={scope} onChange={e => setScope(e.target.value as any)}>
          <option value="own">My Tasks (owner, assignee or watcher)</option>
          <option value="company">All Company Tasks</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#3F3F3F', cursor: 'pointer', padding: '0 4px' }}>
          <input type="checkbox" checked={groupBySubject} onChange={e => setGroupBySubject(e.target.checked)} />
          Group by Subject
        </label>
      </div>

      {loading ? (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '48px', textAlign: 'center', color: '#45B6E4', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>Loading…</div>
      ) : reported.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '48px', textAlign: 'center', color: '#94A3B8', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>No tasks found.</div>
      ) : groups ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {groupNames.map(name => (
            <div key={name}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>📁 {name} ({groups[name].length})</div>
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflowX: 'auto', overflowY: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', maxWidth: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ background: '#FAFBFC' }}>{headerRow}</thead>
                  <tbody>{groups[name].map(Row)}</tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflowX: 'auto', overflowY: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', maxWidth: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ background: '#FAFBFC' }}>{headerRow}</thead>
            <tbody>{pageRows.map(Row)}</tbody>
          </table>
          <Pagination page={rb.page} setPage={rb.setPage} total={reported.length} />
        </div>
      )}

      {showNew && (
        <TaskModal quick source="manual" onClose={() => setShowNew(false)} onSave={id => { setShowNew(false); if (id) router.push(`/task-manager/${id}`); else load() }} />
      )}
    </div>
  )
}

export default function TaskManagerPage() {
  return <TasksLayout><TaskManagerContent /></TasksLayout>
}
