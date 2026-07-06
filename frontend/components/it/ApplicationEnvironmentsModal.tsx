'use client'
import { useState, useEffect } from 'react'

const API = 'https://api.whubbi.wcomply.com'

const DEFINITIONS = ['Development', 'Quality', 'Production']
const HOSTING_OPTIONS = ['SAAS', 'PAAS', 'IAAS']

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const btn: React.CSSProperties = { padding: '7px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }

const EMPTY_FORM = { definition: '', hosting_name: '', name: '', url: '' }

export function ApplicationEnvironmentsModal({ application, canEdit, onClose }: any) {
  const [environments, setEnvironments] = useState<any[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null)

  const load = async () => {
    const d = await fetch(`${API}/it/applications/${application.id}/environments`).then(r => r.json()).catch(() => ({ environments: [] }))
    setEnvironments(d.environments || [])
  }
  useEffect(() => { load() }, [application.id])

  const add = async () => {
    if (!form.name.trim()) return
    await fetch(`${API}/it/applications/${application.id}/environments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    setForm(EMPTY_FORM)
    load()
  }
  const patch = async (eid: string, fields: any) => {
    await fetch(`${API}/it/applications/${application.id}/environments/${eid}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields),
    })
    setEditing(null)
    load()
  }
  const remove = async (e: any) => {
    if (!confirm(`Delete environment "${e.name}"?`)) return
    await fetch(`${API}/it/applications/${application.id}/environments/${e.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '640px', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>Environments — {application.name}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {environments.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: 0 }}>No environments yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {environments.map((e: any) => (
                <div key={e.id} style={{ border: '1px solid #EDF2F7', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    {editing?.id === e.id && editing?.field === 'name' ? (
                      <input autoFocus style={{ ...inp, flex: 1, marginRight: '8px' }} defaultValue={e.name} onBlur={ev => patch(e.id, { name: ev.target.value })} onKeyDown={ev => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur() }} />
                    ) : (
                      <div onClick={() => canEdit && setEditing({ id: e.id, field: 'name' })} style={{ fontSize: '13px', fontWeight: '700', color: '#156082', cursor: canEdit ? 'pointer' : 'default' }}>{e.name || <span style={{ color: '#CBD5E0' }}>Unnamed environment</span>}</div>
                    )}
                    {canEdit && <button onClick={() => remove(e)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    {editing?.id === e.id && editing?.field === 'definition' ? (
                      <select autoFocus style={inp} defaultValue={e.definition || ''} onChange={ev => patch(e.id, { definition: ev.target.value })} onBlur={() => setEditing(null)}>
                        <option value="">Select…</option>
                        {DEFINITIONS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    ) : (
                      <span onClick={() => canEdit && setEditing({ id: e.id, field: 'definition' })} style={{ cursor: canEdit ? 'pointer' : 'default', background: '#EEF2FF', color: '#4F46E5', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{e.definition || 'Set definition'}</span>
                    )}
                    {editing?.id === e.id && editing?.field === 'hosting_name' ? (
                      <select autoFocus style={inp} defaultValue={e.hosting_name || ''} onChange={ev => patch(e.id, { hosting_name: ev.target.value })} onBlur={() => setEditing(null)}>
                        <option value="">Select…</option>
                        {HOSTING_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    ) : (
                      <span onClick={() => canEdit && setEditing({ id: e.id, field: 'hosting_name' })} style={{ cursor: canEdit ? 'pointer' : 'default', background: '#ECFDF5', color: '#059669', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{e.hosting_name || 'Set hosting'}</span>
                    )}
                  </div>
                  {editing?.id === e.id && editing?.field === 'url' ? (
                    <input autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} defaultValue={e.url} placeholder="https://…" onBlur={ev => patch(e.id, { url: ev.target.value })} onKeyDown={ev => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur() }} />
                  ) : (
                    <div onClick={() => canEdit && setEditing({ id: e.id, field: 'url' })} style={{ fontSize: '11px', cursor: canEdit ? 'pointer' : 'default' }}>
                      {e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6' }} onClick={ev => ev.stopPropagation()}>🔗 {e.url}</a> : <span style={{ color: '#CBD5E0' }}>No URL — click to add</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {canEdit && (
            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <input style={inp} placeholder="Environment name…" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <select style={inp} value={form.definition} onChange={e => setForm(f => ({ ...f, definition: e.target.value }))}>
                  <option value="">Definition…</option>
                  {DEFINITIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select style={inp} value={form.hosting_name} onChange={e => setForm(f => ({ ...f, hosting_name: e.target.value }))}>
                  <option value="">Hosting…</option>
                  {HOSTING_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <input style={inp} placeholder="https://…" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
              </div>
              <button onClick={add} disabled={!form.name.trim()} style={{ ...btn, background: form.name.trim() ? '#156082' : '#94A3B8', color: 'white' }}>+ Add Environment</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
