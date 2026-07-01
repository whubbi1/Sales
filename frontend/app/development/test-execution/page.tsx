'use client'
import { useState, useEffect } from 'react'
import DevelopmentLayout, { useDevPerm } from '@/components/DevelopmentLayout'
import { getStoredUser } from '@/lib/auth'
import { API, EXECUTION_STATUSES, getExecutionStatus } from '../constants'

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

function TestExecutionContent() {
  const { canEdit } = useDevPerm()
  const [executions, setExecutions] = useState<any[]>([])
  const [scripts, setScripts]       = useState<any[]>([])
  const [pipelines, setPipelines]   = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [editExec, setEditExec]     = useState<any>(null)
  const [saving, setSaving]         = useState(false)
  const [statusFilter, setStatus]   = useState('')
  const [form, setForm] = useState({ script_id: '', pipeline_id: '', status: 'not_started', result: '', executed_by: '', notes: '' })
  const user = getStoredUser()

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const [re, rs, rp] = await Promise.all([
      fetch(`${API}/development/test-executions`).then(r => r.json()).catch(() => ({ executions: [] })),
      fetch(`${API}/development/test-scripts`).then(r => r.json()).catch(() => ({ scripts: [] })),
      fetch(`${API}/development/pipelines`).then(r => r.json()).catch(() => ({ pipelines: [] })),
    ])
    setExecutions(re.executions || [])
    setScripts(rs.scripts || [])
    setPipelines(rp.pipelines || [])
    setLoading(false)
  }

  const filtered = executions.filter(e => !statusFilter || e.status === statusFilter)

  const openNew = () => {
    setForm({ script_id: '', pipeline_id: '', status: 'not_started', result: '', executed_by: user?.email || '', notes: '' })
    setEditExec(null)
    setShowModal(true)
  }

  const openEdit = (e: any) => {
    setForm({ script_id: e.script_id || '', pipeline_id: e.pipeline_id || '', status: e.status, result: e.result || '', executed_by: e.executed_by || '', notes: e.notes || '' })
    setEditExec(e)
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    if (editExec) {
      await fetch(`${API}/development/test-executions/${editExec.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: form.status, result: form.result, executed_by: form.executed_by, notes: form.notes }),
      })
    } else {
      await fetch(`${API}/development/test-executions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, script_id: form.script_id || null, pipeline_id: form.pipeline_id || null }),
      })
    }
    setSaving(false)
    setShowModal(false)
    loadAll()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this execution record?')) return
    await fetch(`${API}/development/test-executions/${id}`, { method: 'DELETE' })
    loadAll()
  }

  const byStatus = EXECUTION_STATUSES.reduce((acc, s) => ({
    ...acc, [s.value]: executions.filter(e => e.status === s.value).length
  }), {} as Record<string, number>)

  const passRate = executions.length > 0
    ? Math.round((executions.filter(e => e.status === 'passed').length / executions.length) * 100)
    : 0

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>▶️ Test Execution</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{filtered.length} execution{filtered.length !== 1 ? 's' : ''}{executions.length > 0 && ` · ${passRate}% pass rate`}</p>
        </div>
        {canEdit && (
          <button onClick={openNew} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
            + Run Test
          </button>
        )}
      </div>

      {/* Status KPIs */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${EXECUTION_STATUSES.length}, 1fr)`, gap: '10px', marginBottom: '20px' }}>
          {EXECUTION_STATUSES.map(s => (
            <div key={s.value} onClick={() => setStatus(statusFilter === s.value ? '' : s.value)}
              style={{ background: statusFilter === s.value ? s.bg : 'white', borderRadius: '10px', border: `1.5px solid ${statusFilter === s.value ? s.color : '#EDF2F7'}`, padding: '12px 14px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: s.color, marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: s.color }}>{byStatus[s.value] || 0}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <select style={inp} value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {EXECUTION_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {statusFilter && (
          <button onClick={() => setStatus('')} style={{ ...inp, background: '#F1F5F9', color: '#64748B', cursor: 'pointer' }}>× Clear</button>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {['Test Script', 'Application', 'Pipeline', 'Status', 'Executed By', 'Notes', 'Date', ''].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No test executions found.</td></tr>
            ) : filtered.map(e => {
              const st = getExecutionStatus(e.status)
              return (
                <tr key={e.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '600', color: '#156082' }}>{e.script_title || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#64748B', fontSize: '11px' }}>{e.application || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: '11px' }}>
                    {e.pipeline_code ? (
                      <span style={{ background: '#EFF6FF', color: '#3B82F6', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{e.pipeline_code}</span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: st.bg, color: st.color, padding: '2px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: '700' }}>{st.label}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#3F3F3F', fontSize: '11px' }}>{e.executed_by || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#64748B', fontSize: '11px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.notes || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => openEdit(e)} style={{ padding: '4px 10px', background: '#EFF6FF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', color: '#3B82F6', fontFamily: 'Montserrat, sans-serif', fontWeight: '600' }}>Edit</button>
                        <button onClick={() => handleDelete(e.id)} style={{ padding: '4px 10px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', color: '#EF4444', fontFamily: 'Montserrat, sans-serif', fontWeight: '600' }}>Del</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '480px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>{editExec ? 'Update Execution' : 'Run Test'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {!editExec && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={lbl}>Test Script</label>
                    <select style={{ ...inp, width: '100%' }} value={form.script_id} onChange={e => setForm(f => ({ ...f, script_id: e.target.value }))}>
                      <option value="">Select script…</option>
                      {scripts.map((s: any) => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Pipeline</label>
                    <select style={{ ...inp, width: '100%' }} value={form.pipeline_id} onChange={e => setForm(f => ({ ...f, pipeline_id: e.target.value }))}>
                      <option value="">None</option>
                      {pipelines.map((p: any) => <option key={p.id} value={p.id}>{p.pipeline_code}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={lbl}>Status</label>
                  <select style={{ ...inp, width: '100%' }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {EXECUTION_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Executed By</label>
                  <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder="Email or name" value={form.executed_by} onChange={e => setForm(f => ({ ...f, executed_by: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={lbl}>Result</label>
                <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '60px', resize: 'vertical' }} placeholder="Actual result observed…" value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Notes</label>
                <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '60px', resize: 'vertical' }} placeholder="Additional notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  style={{ padding: '9px 18px', background: saving ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
                  {saving ? 'Saving…' : editExec ? 'Update' : 'Save Execution'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DevTestExecutionPage() {
  return <DevelopmentLayout><TestExecutionContent /></DevelopmentLayout>
}
