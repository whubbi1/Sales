'use client'
import { useState, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { HRLayout } from '@/components/HRLayout'
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

const EMPTY_ASSIGN = { training_name: '', description: '', due_date: '', target: 'select', emails: [] as string[] }

function AssignModal({ users, onClose, onSave }: any) {
  const [form, setForm] = useState<any>(EMPTY_ASSIGN)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = users.filter((u: any) => !search || (u.display_name || `${u.first_name} ${u.last_name}`).toLowerCase().includes(search.toLowerCase()))
  const toggle = (email: string) => setForm((f: any) => ({ ...f, emails: f.emails.includes(email) ? f.emails.filter((e: string) => e !== email) : [...f.emails, email] }))

  const submit = async () => {
    if (!form.training_name.trim()) return
    const emails = form.target === 'all' ? users.map((u: any) => u.email) : form.emails
    if (emails.length === 0) return
    setSaving(true)
    await onSave({ training_name: form.training_name, description: form.description, due_date: form.due_date, user_emails: emails })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '560px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>Assign Training</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Training Name *</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.training_name} onChange={e => setForm((f: any) => ({ ...f, training_name: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '60px', resize: 'vertical' }} value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Due Date</label>
            <input type="date" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.due_date} onChange={e => setForm((f: any) => ({ ...f, due_date: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Assign To</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <button onClick={() => setForm((f: any) => ({ ...f, target: 'select' }))} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1.5px solid ${form.target === 'select' ? '#156082' : '#E2E8F0'}`, background: form.target === 'select' ? '#EFF6FF' : 'white', color: form.target === 'select' ? '#156082' : '#64748B', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Select Employees</button>
              <button onClick={() => setForm((f: any) => ({ ...f, target: 'all' }))} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1.5px solid ${form.target === 'all' ? '#156082' : '#E2E8F0'}`, background: form.target === 'all' ? '#EFF6FF' : 'white', color: form.target === 'all' ? '#156082' : '#64748B', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>All Employees ({users.length})</button>
            </div>
            {form.target === 'select' && (
              <>
                <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, marginBottom: '8px' }} placeholder="Search employees…" value={search} onChange={e => setSearch(e.target.value)} />
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                  {filtered.map((u: any) => (
                    <label key={u.email} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.emails.includes(u.email)} onChange={() => toggle(u.email)} />
                      {u.display_name || `${u.first_name} ${u.last_name}`}
                      <span style={{ color: '#94A3B8', fontSize: '11px' }}>{u.email}</span>
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>{form.emails.length} selected</div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
            <button onClick={submit} disabled={saving || !form.training_name.trim() || (form.target === 'select' && form.emails.length === 0)}
              style={{ padding: '9px 18px', background: saving ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              {saving ? 'Assigning…' : 'Assign Training'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TrainingPlanContent() {
  const router = useRouter()
  const [permLevel, setPermLevel] = useState<'loading' | 'none' | 'ok'>('loading')
  const [overview, setOverview] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [showAssign, setShowAssign] = useState(false)
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null)
  const [expandedTrainings, setExpandedTrainings] = useState<any[]>([])

  useEffect(() => {
    const user = getStoredUser()
    if (!user) { router.push('/auth/login'); return }
    fetch(`${API}/settings/permissions/${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(d => {
        const p = d.permissions?.hr?.training_plan
        setPermLevel(!!p && p.access_mode !== 'none' ? 'ok' : 'none')
      })
      .catch(() => setPermLevel('none'))
  }, [])

  useEffect(() => {
    if (permLevel === 'ok') loadAll()
  }, [permLevel])

  const loadAll = async () => {
    const [ov, pl, us] = await Promise.all([
      fetch(`${API}/training/overview`).then(r => r.json()).catch(() => ({ users: [] })),
      fetch(`${API}/training/plans`).then(r => r.json()).catch(() => ({ plans: [] })),
      fetch(`${API}/settings/users`).then(r => r.json()).catch(() => ({ users: [] })),
    ])
    setOverview(ov.users || [])
    setPlans(pl.plans || [])
    setUsers(us.users || [])
  }

  const assignTraining = async (payload: any) => {
    const user = getStoredUser()
    await fetch(`${API}/training/plans`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, assigned_by_email: user?.email || '', assigned_by_name: user?.name || user?.email || '' }),
    })
    setShowAssign(false)
    loadAll()
  }

  const cancelPlan = async (id: string) => {
    if (!confirm('Cancel this training assignment?')) return
    await fetch(`${API}/training/plans/${id}`, { method: 'DELETE' })
    loadAll()
  }

  const toggleExpand = async (email: string) => {
    if (expandedEmail === email) { setExpandedEmail(null); return }
    setExpandedEmail(email)
    const d = await fetch(`${API}/training/trainings/${encodeURIComponent(email)}`).then(r => r.json()).catch(() => ({ trainings: [] }))
    setExpandedTrainings(d.trainings || [])
  }

  const filteredPlans = plans.filter(p => !statusFilter || p.status === statusFilter)

  if (permLevel === 'loading') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  )

  if (permLevel === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
      <p style={{ fontSize: '13px' }}>You don't have permission to access the Training Plan module.</p>
    </div>
  )

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>🎓 Training Plan</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>Assign and track employee training company-wide</p>
        </div>
        <button onClick={() => setShowAssign(true)} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>+ Assign Training</button>
      </div>

      {/* Overview */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC' }}>
          <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', margin: 0 }}>Employee Overview</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {['Employee', 'Department', 'Trainings', 'Certifications', 'Active Plans', ''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {overview.map((u: any) => (
              <Fragment key={u.email}>
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 16px', fontWeight: '700', color: '#156082' }}>{u.display_name || `${u.first_name} ${u.last_name}`}</td>
                  <td style={{ padding: '10px 16px', color: '#64748B' }}>{u.department || '—'}</td>
                  <td style={{ padding: '10px 16px' }}>{u.trainings_count}</td>
                  <td style={{ padding: '10px 16px' }}>{u.certifications_count}</td>
                  <td style={{ padding: '10px 16px' }}>
                    {u.active_plans_count > 0 ? <span style={{ background: '#FFF7ED', color: '#D97706', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{u.active_plans_count}</span> : '—'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <button onClick={() => toggleExpand(u.email)} style={{ padding: '4px 10px', background: '#F1F5F9', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#64748B', fontWeight: '600', fontFamily: 'Montserrat, sans-serif' }}>
                      {expandedEmail === u.email ? '▲ Hide' : '▼ View'}
                    </button>
                  </td>
                </tr>
                {expandedEmail === u.email && (
                  <tr>
                    <td colSpan={6} style={{ padding: '0', background: '#F8FAFC' }}>
                      <div style={{ padding: '12px 20px' }}>
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
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Plans */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', margin: 0 }}>Assigned Trainings ({filteredPlans.length})</h3>
          <select style={inp} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="assigned">Assigned</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {['Employee', 'Training', 'Due Date', 'Status', 'Assigned By', ''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredPlans.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>No training assignments found.</td></tr>
            ) : filteredPlans.map((p: any) => {
              const overdue = p.status === 'assigned' && p.due_date && new Date(p.due_date) < new Date()
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 16px', color: '#3F3F3F' }}>{p.user_email}</td>
                  <td style={{ padding: '10px 16px', fontWeight: '700', color: '#156082' }}>{p.training_name}</td>
                  <td style={{ padding: '10px 16px', color: overdue ? '#DC2626' : '#94A3B8', fontWeight: overdue ? '700' : '400' }}>{p.due_date ? new Date(p.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ background: p.status === 'completed' ? '#ECFDF5' : overdue ? '#FEF2F2' : '#FFF7ED', color: p.status === 'completed' ? '#059669' : overdue ? '#DC2626' : '#D97706', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>
                      {p.status === 'completed' ? 'Completed' : overdue ? 'Overdue' : 'Assigned'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#64748B' }}>{p.assigned_by_name || p.assigned_by_email || '—'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    {p.status !== 'completed' && (
                      <button onClick={() => cancelPlan(p.id)} style={{ padding: '5px 10px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#EF4444', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showAssign && <AssignModal users={users} onClose={() => setShowAssign(false)} onSave={assignTraining} />}
    </div>
  )
}

export default function TrainingPlanPage() {
  return <HRLayout><TrainingPlanContent /></HRLayout>
}
