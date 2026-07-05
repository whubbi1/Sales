'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { TestingLayout, useTestingPerm } from '@/components/TestingLayout'
import { testingAPI } from '@/lib/api'

const API = 'https://api.whubbi.wcomply.com'

const card: React.CSSProperties = { background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px 22px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const lbl: React.CSSProperties = { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '6px' }
const inp: React.CSSProperties = { fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white' }
const btn: React.CSSProperties = { padding: '7px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }

function EditableCell({ display, editing, canEdit, onStartEdit, children }: any) {
  return editing ? children : (
    <div onClick={() => canEdit && onStartEdit()} title={canEdit ? 'Click to edit' : undefined}
      style={{ fontSize: '12px', color: '#3F3F3F', cursor: canEdit ? 'pointer' : 'default', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px' }}
      onMouseEnter={e => canEdit && (e.currentTarget.style.background = '#F1F5F9')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {display || <span style={{ color: '#94A3B8' }}>—</span>}
    </div>
  )
}

const EMPTY_SCRIPT = { title: '', details: '', expected_result: '', url: '' }

function ScriptForm({ onSave, onCancel }: any) {
  const [form, setForm] = useState(EMPTY_SCRIPT)
  return (
    <div style={{ background: '#F5F7FA', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input style={inp} placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} placeholder="Details / instructions…" value={form.details} onChange={e => setForm(f => ({ ...f, details: e.target.value }))} />
        <textarea style={{ ...inp, minHeight: '50px', resize: 'vertical' }} placeholder="Expected result…" value={form.expected_result} onChange={e => setForm(f => ({ ...f, expected_result: e.target.value }))} />
        <input style={inp} placeholder="URL (optional)" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => form.title.trim() && onSave(form)} disabled={!form.title.trim()} style={{ ...btn, background: form.title.trim() ? '#156082' : '#94A3B8', color: 'white' }}>Save Script</button>
          <button onClick={onCancel} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function TestPlanDetailContent() {
  const { id } = useParams()
  const router = useRouter()
  const { level, canEdit } = useTestingPerm('plans')
  const [plan, setPlan] = useState<any>(null)
  const [applications, setApplications] = useState<any[]>([])
  const [submodules, setSubmodules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingField, setEditingField] = useState<string | null>(null)
  const [showAddScript, setShowAddScript] = useState(false)
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const p = await testingAPI.getPlan(id as string)
      setPlan(p)
      if (p.application_id) {
        fetch(`${API}/it/applications/${p.application_id}/submodules`).then(r => r.json()).then(d => setSubmodules(d.submodules || [])).catch(() => {})
      }
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    fetch(`${API}/it/applications`).then(r => r.json()).then(d => setApplications(d.applications || [])).catch(() => {})
  }, [id])

  if (level === 'loading' || loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )
  if (!plan) return <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>Test plan not found.</div>

  const updateField = async (fields: any) => {
    setError('')
    try { await testingAPI.updatePlan(plan.id, fields); setEditingField(null); load() }
    catch (e: any) { setError(e.message) }
  }

  const addScript = async (form: any) => {
    await testingAPI.createScript(plan.id, form)
    setShowAddScript(false)
    load()
  }
  const patchScript = async (scriptId: string, fields: any) => {
    await testingAPI.updateScript(plan.id, scriptId, fields)
    setEditingScriptId(null)
    load()
  }
  const removeScript = async (script: any) => {
    if (!confirm(`Delete script "${script.title}"?`)) return
    await testingAPI.deleteScript(plan.id, script.id)
    load()
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: '900px' }}>
      <button onClick={() => router.push('/testing/test-plans')} style={{ background: 'none', border: 'none', color: '#45B6E4', fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: 0, marginBottom: '14px' }}>← Back to Test Plans</button>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: '11px', fontWeight: '700' }}>{plan.plan_number}</span>
        </div>
        <EditableCell display={<h1 style={{ fontSize: '19px', fontWeight: '800', color: '#156082', margin: '0 0 6px' }}>{plan.title}</h1>}
          editing={editingField === 'title'} canEdit={canEdit} onStartEdit={() => setEditingField('title')}>
          <input autoFocus style={{ ...inp, fontSize: '15px', fontWeight: '700', width: '100%', boxSizing: 'border-box' as const, marginBottom: '6px' }} defaultValue={plan.title}
            onBlur={e => updateField({ title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
        </EditableCell>
        <EditableCell display={<p style={{ fontSize: '12px', color: '#64748B', margin: 0, whiteSpace: 'pre-wrap' }}>{plan.description || 'No description.'}</p>}
          editing={editingField === 'description'} canEdit={canEdit} onStartEdit={() => setEditingField('description')}>
          <textarea autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '60px', resize: 'vertical' as const }} defaultValue={plan.description}
            onBlur={e => updateField({ description: e.target.value })} />
        </EditableCell>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
          <div>
            <div style={lbl}>Application</div>
            <EditableCell display={plan.application_name} editing={editingField === 'application'} canEdit={canEdit} onStartEdit={() => setEditingField('application')}>
              <select autoFocus style={inp} defaultValue={plan.application_id || ''}
                onChange={e => { updateField({ application_id: e.target.value, submodule_id: '' }) }} onBlur={() => setEditingField(null)}>
                <option value="">None</option>
                {applications.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </EditableCell>
          </div>
          <div>
            <div style={lbl}>Submodule</div>
            <EditableCell display={plan.submodule_name} editing={editingField === 'submodule'} canEdit={canEdit && !!plan.application_id} onStartEdit={() => setEditingField('submodule')}>
              <select autoFocus style={inp} defaultValue={plan.submodule_id || ''} onChange={e => updateField({ submodule_id: e.target.value })} onBlur={() => setEditingField(null)}>
                <option value="">Whole application</option>
                {submodules.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </EditableCell>
          </div>
        </div>
        {error && <div style={{ marginTop: '12px', background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={lbl}>Test Scripts ({(plan.scripts || []).length})</div>
          {canEdit && !showAddScript && <button onClick={() => setShowAddScript(true)} style={{ ...btn, background: '#EFF6FF', color: '#156082' }}>+ Add Script</button>}
        </div>
        {showAddScript && <ScriptForm onSave={addScript} onCancel={() => setShowAddScript(false)} />}
        {(plan.scripts || []).length === 0 && !showAddScript ? (
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No test scripts yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {plan.scripts.map((s: any, i: number) => (
              <div key={s.id} style={{ border: '1px solid #EDF2F7', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>#{i + 1}</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#156082' }}>{s.title}</span>
                    <span style={{ fontSize: '10px', color: '#CBD5E0', fontFamily: 'monospace' }}>{s.script_number}</span>
                  </div>
                  {canEdit && <button onClick={() => removeScript(s)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
                </div>
                {s.details && <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px', whiteSpace: 'pre-wrap' }}><b>Details:</b> {s.details}</div>}
                {s.expected_result && <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px', whiteSpace: 'pre-wrap' }}><b>Expected:</b> {s.expected_result}</div>}
                {s.url && <div style={{ marginTop: '4px' }}><a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#156082' }}>🔗 {s.url}</a></div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function TestPlanDetailPage() {
  return <TestingLayout><TestPlanDetailContent /></TestingLayout>
}
