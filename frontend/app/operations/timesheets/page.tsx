'use client'
import { useState, useEffect } from 'react'
import { OperationsLayout, useOperationsPerm } from '@/components/OperationsLayout'
import { timesheetsAPI, projectsAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { PageHeader } from '@/components/shared/RecordLayout'

const todayStr = () => new Date().toISOString().split('T')[0]
const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '—'

function TimesheetsContent() {
  const { level } = useOperationsPerm('timesheets')
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [projects, setProjects] = useState<any[]>([])
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    entry_date: todayStr(), project_id: '', unit: 'days' as 'days' | 'hours', amount: '', description: '',
  })

  const load = async (email: string) => {
    const [p, e] = await Promise.all([
      projectsAPI.list({}),
      timesheetsAPI.list({ user_email: email }),
    ])
    setProjects(p)
    setEntries(e)
    setLoading(false)
  }

  useEffect(() => {
    const u = getStoredUser()
    if (u?.email) {
      setUserEmail(u.email); setUserName(u.name)
      load(u.email)
    }
  }, [])

  const resetForm = () => {
    setForm({ entry_date: todayStr(), project_id: '', unit: 'days', amount: '', description: '' })
    setEditingId(null)
  }

  const submit = async () => {
    if (!form.project_id || !form.amount) return
    const payload = {
      user_email: userEmail, user_name: userName,
      project_id: form.project_id, entry_date: form.entry_date,
      unit: form.unit, amount: Number(form.amount), description: form.description || null,
    }
    if (editingId) await timesheetsAPI.update(editingId, payload)
    else await timesheetsAPI.create(payload)
    resetForm()
    load(userEmail)
  }

  const editEntry = (e: any) => {
    setEditingId(e.id)
    setForm({ entry_date: e.entry_date.slice(0, 10), project_id: e.project_id, unit: e.unit, amount: String(e.amount), description: e.description || '' })
  }

  const deleteEntry = async (e: any) => {
    if (!confirm('Delete this timesheet entry?')) return
    await timesheetsAPI.delete(e.id)
    if (editingId === e.id) resetForm()
    load(userEmail)
  }

  if (level === 'loading' || loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )

  const projectName = (id: string) => projects.find(p => p.id === id)?.project_name || 'Unknown project'
  const sortedProjects = [...projects].sort((a, b) => a.project_name.localeCompare(b.project_name))
  const sortedEntries = [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date))
  const totalDays = entries.reduce((s, e) => s + (e.unit === 'days' ? e.amount : e.amount / 8), 0)

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="🕒 Timesheets" count={entries.length} />
      <p style={{ fontSize: '12px', color: '#94A3B8', margin: '-14px 0 16px' }}>{totalDays.toFixed(2)} total days logged</p>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '18px', marginBottom: '20px' }}>
        <p className="section-label" style={{ marginBottom: '10px' }}>{editingId ? 'Edit Entry' : 'Log Time'}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px 110px 1fr auto', gap: '10px', alignItems: 'end' }}>
          <div>
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={form.entry_date} onChange={e => setForm(p => ({ ...p, entry_date: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Project</label>
            <select className="form-input" value={form.project_id} onChange={e => setForm(p => ({ ...p, project_id: e.target.value }))}>
              <option value="">Select project…</option>
              {sortedProjects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.project_name}{p.is_internal ? ' (Internal)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Unit</label>
            <select className="form-input" value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value as 'days' | 'hours' }))}>
              <option value="days">Days</option>
              <option value="hours">Hours</option>
            </select>
          </div>
          <div>
            <label className="form-label">{form.unit === 'days' ? 'Days' : 'Hours'}</label>
            <input className="form-input" type="number" min={0} step={form.unit === 'days' ? 0.5 : 0.25} value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder={form.unit === 'days' ? '1' : '8'} />
          </div>
          <div>
            <label className="form-label">Description</label>
            <input className="form-input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What did you work on…" />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn-primary" onClick={submit} disabled={!form.project_id || !form.amount}>{editingId ? 'Save' : '+ Add'}</button>
            {editingId && <button className="btn-secondary" onClick={resetForm}>Cancel</button>}
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {['Date', 'Project', 'Amount', 'Description', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedEntries.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>No timesheet entries yet.</td></tr>
            ) : sortedEntries.map((e: any) => (
              <tr key={e.id}>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px' }}>{fmt(e.entry_date)}</td>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', fontWeight: 600, color: '#144766' }}>{projectName(e.project_id)}</td>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px' }}>{e.amount} {e.unit}</td>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#64748B' }}>{e.description || '—'}</td>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap' }}>
                  <button onClick={() => editEntry(e)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#156082', fontSize: '11px', fontWeight: '600', marginRight: '10px' }}>Edit</button>
                  <button onClick={() => deleteEntry(e)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function OperationsTimesheetsPage() {
  return <OperationsLayout><TimesheetsContent /></OperationsLayout>
}
