'use client'
import { useState, useEffect } from 'react'
import DevelopmentLayout, { useDevPerm } from '@/components/DevelopmentLayout'
import { getStoredUser } from '@/lib/auth'
import { API, APPLICATIONS } from '../constants'

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}
const EMPTY = { title: '', application: '', description: '', script_steps: '', expected_results: '', request_id: '', pipeline_id: '' }

function TestScriptsContent() {
  const { canEdit } = useDevPerm()
  const [scripts, setScripts]     = useState<any[]>([])
  const [pipelines, setPipelines] = useState<any[]>([])
  const [requests, setRequests]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<any>(null)
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [form, setForm]           = useState<any>(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [search, setSearch]       = useState('')
  const [appFilter, setAppFilter] = useState('')
  const user                      = getStoredUser()

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    const [rs, rp, rr] = await Promise.all([
      fetch(`${API}/development/test-scripts`).then(r => r.json()).catch(() => ({ scripts: [] })),
      fetch(`${API}/development/pipelines`).then(r => r.json()).catch(() => ({ pipelines: [] })),
      fetch(`${API}/development/requests`).then(r => r.json()).catch(() => ({ requests: [] })),
    ])
    setScripts(rs.scripts || [])
    setPipelines(rp.pipelines || [])
    setRequests(rr.requests || [])
    setLoading(false)
  }

  const filtered = scripts.filter(s => {
    if (appFilter && s.application !== appFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (s.title || '').toLowerCase().includes(q) || (s.application || '').toLowerCase().includes(q)
    }
    return true
  })

  const openCreate = () => { setForm(EMPTY); setEditing(null); setShowModal(true) }
  const openEdit = (s: any) => {
    setForm({ title: s.title, application: s.application || '', description: s.description || '', script_steps: s.script_steps || '', expected_results: s.expected_results || '', request_id: s.request_id || '', pipeline_id: s.pipeline_id || '' })
    setEditing(s)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    if (editing) {
      await fetch(`${API}/development/test-scripts/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, request_id: form.request_id || null, pipeline_id: form.pipeline_id || null }),
      })
    } else {
      await fetch(`${API}/development/test-scripts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, request_id: form.request_id || null, pipeline_id: form.pipeline_id || null, created_by: user?.email || '' }),
      })
    }
    setSaving(false)
    setShowModal(false)
    loadAll()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this test script? All related executions will also be deleted.')) return
    await fetch(`${API}/development/test-scripts/${id}`, { method: 'DELETE' })
    loadAll()
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>📝 Test Scripts</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{filtered.length} script{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <button onClick={openCreate} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
            + New Script
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input style={{ ...inp, width: '220px' }} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={inp} value={appFilter} onChange={e => setAppFilter(e.target.value)}>
          <option value="">All applications</option>
          {APPLICATIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {(search || appFilter) && (
          <button onClick={() => { setSearch(''); setAppFilter('') }} style={{ ...inp, background: '#F1F5F9', color: '#64748B', cursor: 'pointer' }}>× Clear</button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94A3B8', background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7' }}>No test scripts found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(s => (
            <div key={s.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', color: '#156082', fontSize: '13px', marginBottom: '4px' }}>{s.title}</div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#94A3B8' }}>
                    {s.application && <span>📦 {s.application}</span>}
                    {s.pipeline_code && <span>🔄 {s.pipeline_code}</span>}
                    {s.request_number && <span>📋 {s.request_number}</span>}
                    <span>👤 {s.created_by || '—'}</span>
                    <span>🗓 {new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} style={{ padding: '6px 12px', background: '#F1F5F9', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', color: '#64748B', fontFamily: 'Montserrat, sans-serif', fontWeight: '600' }}>
                    {expanded === s.id ? '▲ Collapse' : '▼ View'}
                  </button>
                  {canEdit && (
                    <>
                      <button onClick={() => openEdit(s)} style={{ padding: '6px 12px', background: '#EFF6FF', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', color: '#3B82F6', fontFamily: 'Montserrat, sans-serif', fontWeight: '600' }}>Edit</button>
                      <button onClick={() => handleDelete(s.id)} style={{ padding: '6px 12px', background: '#FEF2F2', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', color: '#EF4444', fontFamily: 'Montserrat, sans-serif', fontWeight: '600' }}>Delete</button>
                    </>
                  )}
                </div>
              </div>

              {expanded === s.id && (
                <div style={{ borderTop: '1px solid #EDF2F7', padding: '16px 20px', background: '#FAFBFC', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#45B6E4', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Description</div>
                    <div style={{ fontSize: '12px', color: '#3F3F3F', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{s.description || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#45B6E4', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Steps</div>
                    <div style={{ fontSize: '12px', color: '#3F3F3F', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{s.script_steps || '—'}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#45B6E4', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Expected Results</div>
                    <div style={{ fontSize: '12px', color: '#3F3F3F', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{s.expected_results || '—'}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '600px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>{editing ? 'Edit Test Script' : 'New Test Script'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={lbl}>Title *</label>
                <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder="Script title" value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={lbl}>Application</label>
                  <select style={{ ...inp, width: '100%' }} value={form.application} onChange={e => setForm((f: any) => ({ ...f, application: e.target.value }))}>
                    <option value="">Select…</option>
                    {APPLICATIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Pipeline</label>
                  <select style={{ ...inp, width: '100%' }} value={form.pipeline_id} onChange={e => setForm((f: any) => ({ ...f, pipeline_id: e.target.value }))}>
                    <option value="">None</option>
                    {pipelines.map((p: any) => <option key={p.id} value={p.id}>{p.pipeline_code}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Dev Request</label>
                  <select style={{ ...inp, width: '100%' }} value={form.request_id} onChange={e => setForm((f: any) => ({ ...f, request_id: e.target.value }))}>
                    <option value="">None</option>
                    {requests.map((r: any) => <option key={r.id} value={r.id}>{r.request_number}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Description</label>
                <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '60px', resize: 'vertical' }} placeholder="Test script description…" value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Test Steps</label>
                <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '90px', resize: 'vertical' }} placeholder="Step 1: ...&#10;Step 2: ..." value={form.script_steps} onChange={e => setForm((f: any) => ({ ...f, script_steps: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Expected Results</label>
                <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '70px', resize: 'vertical' }} placeholder="Describe the expected outcome…" value={form.expected_results} onChange={e => setForm((f: any) => ({ ...f, expected_results: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.title.trim()}
                  style={{ padding: '9px 18px', background: saving || !form.title.trim() ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Script'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DevTestScriptsPage() {
  return <DevelopmentLayout><TestScriptsContent /></DevelopmentLayout>
}
