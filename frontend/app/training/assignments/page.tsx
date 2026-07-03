'use client'
import { useState, useEffect } from 'react'
import TrainingLayout, { useTrainingPerm } from '@/components/TrainingLayout'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn } from '@/components/it/ReportBuilder'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

function NewAssignmentModal({ catalog, plans, users, onClose, onSave }: any) {
  const [sourceType, setSourceType] = useState<'catalog' | 'plan'>('catalog')
  const [catalogId, setCatalogId] = useState('')
  const [planId, setPlanId] = useState('')
  const [target, setTarget] = useState<'select' | 'all'>('select')
  const [emails, setEmails] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [saving, setSaving] = useState(false)

  const filteredUsers = users.filter((u: any) => !search || (u.display_name || `${u.first_name} ${u.last_name}`).toLowerCase().includes(search.toLowerCase()))
  const toggle = (email: string) => setEmails(e => e.includes(email) ? e.filter(x => x !== email) : [...e, email])
  const valid = (sourceType === 'catalog' ? !!catalogId : !!planId) && (target === 'all' || emails.length > 0)

  const submit = async () => {
    if (!valid) return
    setSaving(true)
    const user = getStoredUser()
    await onSave({
      catalog_id: sourceType === 'catalog' ? catalogId : undefined,
      plan_id: sourceType === 'plan' ? planId : undefined,
      user_emails: target === 'all' ? users.map((u: any) => u.email) : emails,
      due_date: dueDate,
      recurrence: recurring ? 'yearly' : null,
      assigned_by_email: user?.email || '',
      assigned_by_name: user?.name || user?.email || '',
    })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '580px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>New Assignment</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>What to Assign</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <button onClick={() => setSourceType('catalog')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1.5px solid ${sourceType === 'catalog' ? '#156082' : '#E2E8F0'}`, background: sourceType === 'catalog' ? '#EFF6FF' : 'white', color: sourceType === 'catalog' ? '#156082' : '#64748B', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Single Training</button>
              <button onClick={() => setSourceType('plan')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1.5px solid ${sourceType === 'plan' ? '#156082' : '#E2E8F0'}`, background: sourceType === 'plan' ? '#EFF6FF' : 'white', color: sourceType === 'plan' ? '#156082' : '#64748B', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Training Plan</button>
            </div>
            {sourceType === 'catalog' ? (
              <select style={{ ...inp, width: '100%' }} value={catalogId} onChange={e => setCatalogId(e.target.value)}>
                <option value="">Select a training…</option>
                {catalog.map((c: any) => <option key={c.id} value={c.id}>{c.title} · {c.company}</option>)}
              </select>
            ) : (
              <select style={{ ...inp, width: '100%' }} value={planId} onChange={e => setPlanId(e.target.value)}>
                <option value="">Select a plan…</option>
                {plans.map((p: any) => <option key={p.id} value={p.id}>{p.training_function} ({(p.trainings || []).length} trainings)</option>)}
              </select>
            )}
          </div>

          <div>
            <label style={lbl}>Assign To</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <button onClick={() => setTarget('select')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1.5px solid ${target === 'select' ? '#156082' : '#E2E8F0'}`, background: target === 'select' ? '#EFF6FF' : 'white', color: target === 'select' ? '#156082' : '#64748B', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Select Employees</button>
              <button onClick={() => setTarget('all')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1.5px solid ${target === 'all' ? '#156082' : '#E2E8F0'}`, background: target === 'all' ? '#EFF6FF' : 'white', color: target === 'all' ? '#156082' : '#64748B', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>All Employees ({users.length})</button>
            </div>
            {target === 'select' && (
              <>
                <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, marginBottom: '8px' }} placeholder="Search employees…" value={search} onChange={e => setSearch(e.target.value)} />
                <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                  {filteredUsers.map((u: any) => (
                    <label key={u.email} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={emails.includes(u.email)} onChange={() => toggle(u.email)} />
                      {u.display_name || `${u.first_name} ${u.last_name}`}
                      <span style={{ color: '#94A3B8', fontSize: '11px' }}>{u.email}</span>
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>{emails.length} selected</div>
              </>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={lbl}>Due Date</label>
              <input type="date" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '600', color: '#3F3F3F', paddingBottom: '9px', cursor: 'pointer' }}>
              <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} />
              Recurring (yearly)
            </label>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
            <button onClick={submit} disabled={saving || !valid}
              style={{ padding: '9px 18px', background: saving || !valid ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              {saving ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const COLUMNS: ReportColumn[] = [
  { key: 'user_email', label: 'Employee', filterable: 'text' },
  { key: 'training_name', label: 'Training', filterable: 'text' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'recurrence_display', label: 'Recurring', filterable: 'select', options: ['Yearly', '—'] },
  { key: 'status', label: 'Status', filterable: 'select', options: ['assigned', 'completed'] },
  { key: 'assigned_by_name', label: 'Assigned By', filterable: 'text' },
]

function AssignmentsContent() {
  const { canEdit } = useTrainingPerm()
  const [assignments, setAssignments] = useState<any[]>([])
  const [catalog, setCatalog] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    load()
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  const rb = useReportBuilder('training_assignments', COLUMNS, userEmail)

  const load = async () => {
    setLoading(true)
    const [ar, cr, pr, ur] = await Promise.all([
      fetch(`${API}/training/assignments`).then(r => r.json()).catch(() => ({ assignments: [] })),
      fetch(`${API}/training/catalog`).then(r => r.json()).catch(() => ({ catalog: [] })),
      fetch(`${API}/training/plans`).then(r => r.json()).catch(() => ({ plans: [] })),
      fetch(`${API}/settings/users`).then(r => r.json()).catch(() => ({ users: [] })),
    ])
    setAssignments(ar.assignments || [])
    setCatalog(cr.catalog || [])
    setPlans(pr.plans || [])
    setUsers(ur.users || [])
    setLoading(false)
  }

  const createAssignment = async (payload: any) => {
    await fetch(`${API}/training/assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setShowNew(false)
    load()
  }

  const cancelAssignment = async (a: any) => {
    if (!confirm(`Cancel this assignment for ${a.user_email}?`)) return
    await fetch(`${API}/training/assignments/${a.id}`, { method: 'DELETE' })
    load()
  }

  const withDisplay = assignments.map(a => ({ ...a, recurrence_display: a.recurrence ? 'Yearly' : '—', assigned_by_name: a.assigned_by_name || a.assigned_by_email || '' }))
  const filtered = applyReport(withDisplay, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>📋 Training Assignments</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{filtered.length} assignment{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ReportPanel columns={COLUMNS} rb={rb} />
          {canEdit && (
            <button onClick={() => setShowNew(true)} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>+ New Assignment</button>
          )}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflowX: 'auto', overflowY: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', maxWidth: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {COLUMNS.filter(c => isVisible(c.key)).map(c => (
                <th key={c.key} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7' }}>{c.label}</th>
              ))}
              {canEdit && <th style={{ padding: '10px 16px', borderBottom: '1px solid #EDF2F7' }} />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLUMNS.filter(c => isVisible(c.key)).length + (canEdit ? 1 : 0)} style={{ textAlign: 'center', padding: '32px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={COLUMNS.filter(c => isVisible(c.key)).length + (canEdit ? 1 : 0)} style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>No assignments found.</td></tr>
            ) : filtered.map(a => {
              const overdue = a.status === 'assigned' && a.due_date && new Date(a.due_date) < new Date()
              return (
                <tr key={a.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  {isVisible('user_email') && <td style={{ padding: '10px 16px', color: '#3F3F3F' }}>{a.user_email}</td>}
                  {isVisible('training_name') && <td style={{ padding: '10px 16px', fontWeight: '700', color: '#156082' }}>{a.training_name}</td>}
                  {isVisible('due_date') && <td style={{ padding: '10px 16px', color: overdue ? '#DC2626' : '#94A3B8', fontWeight: overdue ? '700' : '400' }}>{a.due_date ? new Date(a.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>}
                  {isVisible('recurrence_display') && <td style={{ padding: '10px 16px' }}>{a.recurrence ? <span style={{ background: '#F5F3FF', color: '#7C3AED', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>🔁 Yearly</span> : '—'}</td>}
                  {isVisible('status') && (
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ background: a.status === 'completed' ? '#ECFDF5' : overdue ? '#FEF2F2' : '#FFF7ED', color: a.status === 'completed' ? '#059669' : overdue ? '#DC2626' : '#D97706', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>
                        {a.status === 'completed' ? 'Completed' : overdue ? 'Overdue' : 'Assigned'}
                      </span>
                    </td>
                  )}
                  {isVisible('assigned_by_name') && <td style={{ padding: '10px 16px', color: '#64748B' }}>{a.assigned_by_name || a.assigned_by_email || '—'}</td>}
                  {canEdit && (
                    <td style={{ padding: '10px 16px' }}>
                      {a.status !== 'completed' && (
                        <button onClick={() => cancelAssignment(a)} style={{ padding: '5px 10px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#EF4444', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showNew && <NewAssignmentModal catalog={catalog} plans={plans} users={users} onClose={() => setShowNew(false)} onSave={createAssignment} />}
    </div>
  )
}

export default function TrainingAssignmentsPage() {
  return <TrainingLayout><AssignmentsContent /></TrainingLayout>
}
