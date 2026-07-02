'use client'
import { useState, useEffect, Fragment } from 'react'
import TrainingLayout from '@/components/TrainingLayout'

const API = 'https://api.whubbi.wcomply.com'

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}

function ByEmployee() {
  const [overview, setOverview] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null)
  const [expandedTrainings, setExpandedTrainings] = useState<any[]>([])

  useEffect(() => {
    fetch(`${API}/training/overview`).then(r => r.json()).then(d => { setOverview(d.users || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const toggleExpand = async (email: string) => {
    if (expandedEmail === email) { setExpandedEmail(null); return }
    setExpandedEmail(email)
    const d = await fetch(`${API}/training/trainings/${encodeURIComponent(email)}`).then(r => r.json()).catch(() => ({ trainings: [] }))
    setExpandedTrainings(d.trainings || [])
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '32px', color: '#45B6E4' }}>Loading…</div>

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
      <thead style={{ background: '#FAFBFC' }}>
        <tr>
          {['Employee', 'Department', 'Trainings', 'Certifications', 'Active Assignments', ''].map(h => (
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
                {u.active_assignments_count > 0 ? <span style={{ background: '#FFF7ED', color: '#D97706', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{u.active_assignments_count}</span> : '—'}
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
  )
}

function ByTraining() {
  const [catalog, setCatalog] = useState<any[]>([])
  const [selected, setSelected] = useState('')
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`${API}/training/catalog`).then(r => r.json()).then(d => setCatalog(d.catalog || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selected) { setAssignments([]); return }
    setLoading(true)
    fetch(`${API}/training/overview/training/${selected}`).then(r => r.json()).then(d => { setAssignments(d.assignments || []); setLoading(false) }).catch(() => setLoading(false))
  }, [selected])

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <select style={{ ...inp, width: '320px' }} value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">Select a training…</option>
          {catalog.map(c => <option key={c.id} value={c.id}>{c.title} · {c.company}</option>)}
        </select>
      </div>
      {!selected ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>Pick a training to see who it's assigned to.</div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#45B6E4' }}>Loading…</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {['Employee', 'Due Date', 'Status', 'Assigned By'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>No one has been assigned this training yet.</td></tr>
            ) : assignments.map((a: any) => {
              const overdue = a.status === 'assigned' && a.due_date && new Date(a.due_date) < new Date()
              return (
                <tr key={a.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 16px', color: '#3F3F3F' }}>{a.user_email}</td>
                  <td style={{ padding: '10px 16px', color: overdue ? '#DC2626' : '#94A3B8' }}>{a.due_date ? new Date(a.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ background: a.status === 'completed' ? '#ECFDF5' : overdue ? '#FEF2F2' : '#FFF7ED', color: a.status === 'completed' ? '#059669' : overdue ? '#DC2626' : '#D97706', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>
                      {a.status === 'completed' ? 'Completed' : overdue ? 'Overdue' : 'Assigned'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#64748B' }}>{a.assigned_by_name || a.assigned_by_email || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
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
