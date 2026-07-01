'use client'
import { useState, useEffect } from 'react'
import DevelopmentLayout, { useDevPerm } from '@/components/DevelopmentLayout'
import { getStoredUser } from '@/lib/auth'
import { API, APPLICATIONS, PIPELINE_STATUSES, getPipelineStatus } from '../constants'

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

const EMPTY_FORM = { pipeline_code: '', name: '', description: '', application: '', status: 'to_be_planned', release_number: '' }

function PipelineContent() {
  const { canEdit } = useDevPerm()
  const [pipelines, setPipelines] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<any>(null)
  const [form, setForm]           = useState<any>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [appFilter, setAppFilter] = useState('')
  const [statusFilter, setStatus] = useState('')
  const [expandedId, setExpanded] = useState<string | null>(null)
  const [expandedReqs, setExpandedReqs] = useState<any[]>([])

  useEffect(() => { loadPipelines() }, [])

  const loadPipelines = async () => {
    setLoading(true)
    const d = await fetch(`${API}/development/pipelines`).then(r => r.json()).catch(() => ({ pipelines: [] }))
    setPipelines(d.pipelines || [])
    setLoading(false)
  }

  const filtered = pipelines.filter(p => {
    if (appFilter && p.application !== appFilter) return false
    if (statusFilter && p.status !== statusFilter) return false
    return true
  })

  const openCreate = () => { setForm(EMPTY_FORM); setEditing(null); setShowModal(true) }
  const openEdit   = (pl: any) => {
    setForm({ pipeline_code: pl.pipeline_code, name: pl.name, description: pl.description || '', application: pl.application || '', status: pl.status, release_number: pl.release_number || '' })
    setEditing(pl)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    if (editing) {
      await fetch(`${API}/development/pipelines/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
    } else {
      await fetch(`${API}/development/pipelines`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
    }
    setSaving(false)
    setShowModal(false)
    loadPipelines()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this pipeline? Linked requests will be unassigned.')) return
    await fetch(`${API}/development/pipelines/${id}`, { method: 'DELETE' })
    loadPipelines()
  }

  const toggleExpand = async (pl: any) => {
    if (expandedId === pl.id) { setExpanded(null); setExpandedReqs([]); return }
    setExpanded(pl.id)
    const d = await fetch(`${API}/development/pipelines/${pl.id}`).then(r => r.json()).catch(() => null)
    setExpandedReqs(d?.requests || [])
  }

  const byStatus = PIPELINE_STATUSES.reduce((acc, s) => ({
    ...acc, [s.value]: pipelines.filter(p => p.status === s.value).length
  }), {} as Record<string, number>)

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>🔄 Development Pipeline</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{filtered.length} pipeline{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <button onClick={openCreate} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
            + New Pipeline
          </button>
        )}
      </div>

      {/* Status KPIs */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${PIPELINE_STATUSES.length}, 1fr)`, gap: '10px', marginBottom: '20px' }}>
          {PIPELINE_STATUSES.map(s => (
            <div key={s.value} onClick={() => setStatus(statusFilter === s.value ? '' : s.value)}
              style={{ background: statusFilter === s.value ? s.bg : 'white', borderRadius: '10px', border: `1.5px solid ${statusFilter === s.value ? s.color : '#EDF2F7'}`, padding: '10px 12px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: s.color, marginBottom: '3px' }}>{s.label}</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: s.color }}>{byStatus[s.value] || 0}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <select style={inp} value={appFilter} onChange={e => setAppFilter(e.target.value)}>
          <option value="">All applications</option>
          {APPLICATIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select style={inp} value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {PIPELINE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {(appFilter || statusFilter) && (
          <button onClick={() => { setAppFilter(''); setStatus('') }} style={{ ...inp, background: '#F1F5F9', color: '#64748B', cursor: 'pointer' }}>× Clear</button>
        )}
      </div>

      {/* Pipeline cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94A3B8', background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7' }}>No pipelines found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(pl => {
            const st = getPipelineStatus(pl.status)
            const isExpanded = expandedId === pl.id
            return (
              <div key={pl.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '800', color: '#156082', fontSize: '13px' }}>{pl.pipeline_code}</span>
                      <span style={{ fontWeight: '600', color: '#3F3F3F', fontSize: '13px' }}>{pl.name}</span>
                      <span style={{ background: st.bg, color: st.color, padding: '2px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: '700' }}>{st.label}</span>
                      {pl.release_number && <span style={{ background: '#F0FDF4', color: '#16A34A', padding: '2px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: '700' }}>v{pl.release_number}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: '#94A3B8' }}>
                      {pl.application && <span>📦 {pl.application}</span>}
                      <span>📋 {pl.request_count} request{pl.request_count !== 1 ? 's' : ''}</span>
                      <span>🗓 {new Date(pl.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => toggleExpand(pl)} style={{ padding: '6px 12px', background: '#F1F5F9', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', color: '#64748B', fontFamily: 'Montserrat, sans-serif', fontWeight: '600' }}>
                      {isExpanded ? '▲ Collapse' : '▼ Requests'}
                    </button>
                    {canEdit && (
                      <>
                        <button onClick={() => openEdit(pl)} style={{ padding: '6px 12px', background: '#EFF6FF', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', color: '#3B82F6', fontFamily: 'Montserrat, sans-serif', fontWeight: '600' }}>Edit</button>
                        <button onClick={() => handleDelete(pl.id)} style={{ padding: '6px 12px', background: '#FEF2F2', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', color: '#EF4444', fontFamily: 'Montserrat, sans-serif', fontWeight: '600' }}>Delete</button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid #EDF2F7', background: '#FAFBFC' }}>
                    {pl.description && (
                      <div style={{ padding: '12px 20px', fontSize: '12px', color: '#64748B', borderBottom: '1px solid #EDF2F7' }}>{pl.description}</div>
                    )}
                    {expandedReqs.length === 0 ? (
                      <div style={{ padding: '16px 20px', fontSize: '12px', color: '#94A3B8' }}>No requests linked to this pipeline.</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: '#F1F5F9' }}>
                            {['#', 'Title', 'Status', 'Priority', 'Assignee'].map(h => (
                              <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {expandedReqs.map((r: any) => {
                            const rs = getPipelineStatus(r.status)
                            return (
                              <tr key={r.id} style={{ borderTop: '1px solid #EDF2F7' }}>
                                <td style={{ padding: '8px 16px', fontWeight: '700', color: '#156082' }}>{r.request_number}</td>
                                <td style={{ padding: '8px 16px', color: '#3F3F3F' }}>{r.title}</td>
                                <td style={{ padding: '8px 16px' }}><span style={{ background: rs.bg, color: rs.color, padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{rs.label}</span></td>
                                <td style={{ padding: '8px 16px', color: '#64748B', textTransform: 'capitalize' }}>{r.priority}</td>
                                <td style={{ padding: '8px 16px', color: '#64748B' }}>{r.assignee_name || r.assignee_email || '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>{editing ? 'Edit Pipeline' : 'New Pipeline'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={lbl}>Pipeline ID</label>
                  <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder="Auto-generated if empty" value={form.pipeline_code} onChange={e => setForm((f: any) => ({ ...f, pipeline_code: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Release Number</label>
                  <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder="e.g. 1.2.0" value={form.release_number} onChange={e => setForm((f: any) => ({ ...f, release_number: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={lbl}>Name *</label>
                <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder="Pipeline name" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={lbl}>Application</label>
                  <select style={{ ...inp, width: '100%' }} value={form.application} onChange={e => setForm((f: any) => ({ ...f, application: e.target.value }))}>
                    <option value="">Select…</option>
                    {APPLICATIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Status</label>
                  <select style={{ ...inp, width: '100%' }} value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                    {PIPELINE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Description</label>
                <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '70px', resize: 'vertical' }} placeholder="Brief description…" value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.name.trim()}
                  style={{ padding: '9px 18px', background: saving || !form.name.trim() ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Pipeline'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DevPipelinePage() {
  return <DevelopmentLayout><PipelineContent /></DevelopmentLayout>
}
