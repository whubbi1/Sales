'use client'
import { useState, useEffect, Fragment } from 'react'
import TrainingLayout from '@/components/TrainingLayout'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, ColumnResizeHandle, SortArrow, Pagination } from '@/components/it/ReportBuilder'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}

const EMPLOYEE_COLUMNS: ReportColumn[] = [
  { key: 'employee_display', label: 'Employee', filterable: 'text' },
  { key: 'department', label: 'Department', filterable: 'text' },
  { key: 'trainings_count', label: 'Trainings' },
  { key: 'certifications_count', label: 'Certifications' },
  { key: 'active_assignments_count', label: 'Active Assignments' },
  { key: 'late_assignments_count', label: 'Overdue' },
]

const EMPLOYEE_DEFAULT_WIDTHS: Record<string, number> = {
  employee_display: 200, department: 160, trainings_count: 120,
  certifications_count: 140, active_assignments_count: 160, late_assignments_count: 110,
}

function ByEmployee() {
  const [overview, setOverview] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null)
  const [expandedTrainings, setExpandedTrainings] = useState<any[]>([])
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    fetch(`${API}/training/overview`).then(r => r.json()).then(d => { setOverview(d.users || []); setLoading(false) }).catch(() => setLoading(false))
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  const rb = useReportBuilder('training_execution_by_employee', EMPLOYEE_COLUMNS, userEmail)

  const toggleExpand = async (email: string) => {
    if (expandedEmail === email) { setExpandedEmail(null); return }
    setExpandedEmail(email)
    const d = await fetch(`${API}/training/trainings/${encodeURIComponent(email)}`).then(r => r.json()).catch(() => ({ trainings: [] }))
    setExpandedTrainings(d.trainings || [])
  }

  const withDisplay = overview.map((u: any) => ({ ...u, employee_display: u.display_name || `${u.first_name} ${u.last_name}` }))
  const searched = withDisplay.filter((u: any) => {
    if (!search) return true
    const name = `${u.display_name || ''} ${u.first_name || ''} ${u.last_name || ''} ${u.email || ''}`.toLowerCase()
    return name.includes(search.toLowerCase())
  })
  const filtered = applyReport(searched, EMPLOYEE_COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const pageRows = filtered.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  if (loading) return <div style={{ textAlign: 'center', padding: '32px', color: '#45B6E4' }}>Loading…</div>

  return (
    <div>
      <div style={{ padding: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <input style={{ ...inp, width: '280px' }} placeholder="Search employee…" value={search} onChange={e => setSearch(e.target.value)} />
        <ReportPanel columns={EMPLOYEE_COLUMNS} rb={rb} />
      </div>
      <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
        <thead style={{ background: '#FAFBFC' }}>
          <tr>
            {EMPLOYEE_COLUMNS.filter(c => isVisible(c.key)).map(c => (
              <th key={c.key} onClick={() => rb.toggleSort(c.key)} style={{ position: 'relative', padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: `${rb.columnWidths[c.key] || EMPLOYEE_DEFAULT_WIDTHS[c.key] || 150}px`, cursor: 'pointer', userSelect: 'none' }}>
                {c.label}<SortArrow active={rb.sortField === c.key} dir={rb.sortDir} />
                <ColumnResizeHandle colKey={c.key} rb={rb} />
              </th>
            ))}
            <th style={{ padding: '10px 16px', borderBottom: '1px solid #EDF2F7', width: '90px' }} />
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={EMPLOYEE_COLUMNS.filter(c => isVisible(c.key)).length + 1} style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>No employees match your search.</td></tr>
          ) : pageRows.map((u: any) => (
            <Fragment key={u.email}>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                {isVisible('employee_display') && <td style={{ padding: '10px 16px', fontWeight: '700', color: '#156082' }}>{u.display_name || `${u.first_name} ${u.last_name}`}</td>}
                {isVisible('department') && <td style={{ padding: '10px 16px', color: '#64748B' }}>{u.department || '—'}</td>}
                {isVisible('trainings_count') && <td style={{ padding: '10px 16px' }}>{u.trainings_count}</td>}
                {isVisible('certifications_count') && <td style={{ padding: '10px 16px' }}>{u.certifications_count}</td>}
                {isVisible('active_assignments_count') && (
                <td style={{ padding: '10px 16px' }}>
                  {u.active_assignments_count > 0 ? <span style={{ background: '#FFF7ED', color: '#D97706', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{u.active_assignments_count}</span> : '—'}
                </td>
                )}
                {isVisible('late_assignments_count') && (
                <td style={{ padding: '10px 16px' }}>
                  {u.late_assignments_count > 0 ? <span style={{ background: '#FEF2F2', color: '#DC2626', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{u.late_assignments_count}</span> : '—'}
                </td>
                )}
                <td style={{ padding: '10px 16px' }}>
                  <button onClick={() => toggleExpand(u.email)} style={{ padding: '4px 10px', background: '#F1F5F9', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#64748B', fontWeight: '600', fontFamily: 'Montserrat, sans-serif' }}>
                    {expandedEmail === u.email ? '▲ Hide' : '▼ View'}
                  </button>
                </td>
              </tr>
              {expandedEmail === u.email && (
                <tr>
                  <td colSpan={EMPLOYEE_COLUMNS.filter(c => isVisible(c.key)).length + 1} style={{ padding: '0', background: '#F8FAFC' }}>
                    <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#DC2626', marginBottom: '6px' }}>Overdue Trainings</div>
                        {(u.late_trainings || []).length === 0 ? (
                          <span style={{ fontSize: '12px', color: '#94A3B8' }}>No overdue trainings.</span>
                        ) : (
                          (u.late_trainings || []).map((t: any, i: number) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12px', borderBottom: '1px solid #EDF2F7' }}>
                              <span style={{ fontWeight: '600', color: '#DC2626' }}>⚠️ {t.name}</span>
                              <span style={{ color: '#DC2626' }}>Due {new Date(t.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            </div>
                          ))
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '6px' }}>Performed Trainings</div>
                        {expandedTrainings.length === 0 ? (
                          <span style={{ fontSize: '12px', color: '#94A3B8' }}>No trainings performed yet.</span>
                        ) : (
                          expandedTrainings.map((t: any) => (
                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12px', borderBottom: '1px solid #EDF2F7' }}>
                              <span style={{ fontWeight: '600', color: '#3F3F3F' }}>{t.name}</span>
                              <span style={{ color: '#94A3B8' }}>{t.training_date}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      </div>
      <Pagination page={rb.page} setPage={rb.setPage} total={filtered.length} />
    </div>
  )
}

const BY_TRAINING_COLUMNS: ReportColumn[] = [
  { key: 'employee_display', label: 'Employee', filterable: 'text' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'status', label: 'Status', filterable: 'select', options: ['assigned', 'completed'] },
  { key: 'assigned_by_name', label: 'Assigned By', filterable: 'text' },
]

const BY_TRAINING_DEFAULT_WIDTHS: Record<string, number> = {
  employee_display: 220, due_date: 150, status: 140, assigned_by_name: 180,
}

function ByTraining() {
  const [catalog, setCatalog] = useState<any[]>([])
  const [selected, setSelected] = useState('')
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    fetch(`${API}/training/catalog`).then(r => r.json()).then(d => setCatalog(d.catalog || [])).catch(() => {})
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  const rb = useReportBuilder('training_execution_by_training', BY_TRAINING_COLUMNS, userEmail)

  useEffect(() => {
    if (!selected) { setAssignments([]); return }
    setLoading(true)
    fetch(`${API}/training/overview/training/${selected}`).then(r => r.json()).then(d => { setAssignments(d.assignments || []); setLoading(false) }).catch(() => setLoading(false))
  }, [selected])

  const withDisplay = assignments.map((a: any) => ({ ...a, employee_display: (a.first_name || a.last_name) ? `${a.first_name} ${a.last_name}`.trim() : a.user_email, assigned_by_name: a.assigned_by_name || a.assigned_by_email || '' }))
  const filtered = applyReport(withDisplay, BY_TRAINING_COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const pageRows = filtered.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div>
      <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <select style={{ ...inp, width: '320px' }} value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">Select a training…</option>
          {catalog.map(c => <option key={c.id} value={c.id}>{c.title} · {c.company}</option>)}
        </select>
        {selected && <ReportPanel columns={BY_TRAINING_COLUMNS} rb={rb} />}
      </div>
      {!selected ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>Pick a training to see who it's assigned to.</div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#45B6E4' }}>Loading…</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {BY_TRAINING_COLUMNS.filter(c => isVisible(c.key)).map(c => (
                <th key={c.key} onClick={() => rb.toggleSort(c.key)} style={{ position: 'relative', padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: `${rb.columnWidths[c.key] || BY_TRAINING_DEFAULT_WIDTHS[c.key] || 150}px`, cursor: 'pointer', userSelect: 'none' }}>
                  {c.label}<SortArrow active={rb.sortField === c.key} dir={rb.sortDir} />
                  <ColumnResizeHandle colKey={c.key} rb={rb} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={BY_TRAINING_COLUMNS.filter(c => isVisible(c.key)).length} style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>No one has been assigned this training yet.</td></tr>
            ) : pageRows.map((a: any) => {
              const overdue = a.status === 'assigned' && a.due_date && new Date(a.due_date) < new Date()
              return (
                <tr key={a.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  {isVisible('employee_display') && <td style={{ padding: '10px 16px', color: '#3F3F3F' }}>{a.employee_display}</td>}
                  {isVisible('due_date') && <td style={{ padding: '10px 16px', color: overdue ? '#DC2626' : '#94A3B8' }}>{a.due_date ? new Date(a.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>}
                  {isVisible('status') && (
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ background: a.status === 'completed' ? '#ECFDF5' : overdue ? '#FEF2F2' : '#FFF7ED', color: a.status === 'completed' ? '#059669' : overdue ? '#DC2626' : '#D97706', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>
                        {a.status === 'completed' ? 'Completed' : overdue ? 'Overdue' : 'Assigned'}
                      </span>
                    </td>
                  )}
                  {isVisible('assigned_by_name') && <td style={{ padding: '10px 16px', color: '#64748B' }}>{a.assigned_by_name}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
        <Pagination page={rb.page} setPage={rb.setPage} total={filtered.length} />
        </div>
      )}
    </div>
  )
}

function ExecutionContent() {
  const [tab, setTab] = useState<'employee' | 'training'>('employee')

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>✅ Training Execution</h1>
        <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>Follow-up on training completion</p>
      </div>

      <div style={{ display: 'flex', gap: '3px', marginBottom: '16px', background: 'white', padding: '4px', borderRadius: '10px', border: '1px solid #EDF2F7', width: 'fit-content' }}>
        {[{ id: 'employee', label: 'By Employee' }, { id: 'training', label: 'By Training' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', background: tab === t.id ? '#156082' : 'transparent', color: tab === t.id ? 'white' : '#45B6E4', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: tab === 'training' ? '20px' : 0 }}>
        {tab === 'employee' ? <ByEmployee /> : <ByTraining />}
      </div>
    </div>
  )
}

export default function TrainingExecutionPage() {
  return <TrainingLayout><ExecutionContent /></TrainingLayout>
}
