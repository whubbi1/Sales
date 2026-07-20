'use client'
import { useState, useEffect, useRef } from 'react'
import { LegalLayout } from '@/components/LegalLayout'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'
const CODE_RE = /^[A-Za-z0-9]{5}$/

function InlineText({ value, onSave, placeholder = '—', multiline }: {
  value: string; onSave: (v: string) => void; placeholder?: string; multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing && ref.current) ref.current.focus() }, [editing])
  const commit = () => { setEditing(false); if (draft.trim() !== value) onSave(draft.trim()) }
  const style = {
    fontFamily: 'Montserrat, sans-serif', fontSize: '13px',
    border: editing ? '1.5px solid #156082' : '1.5px solid transparent',
    borderRadius: '6px', padding: '4px 8px', outline: 'none',
    background: editing ? 'white' : 'transparent', cursor: editing ? 'text' : 'pointer',
    width: '100%', boxSizing: 'border-box' as const,
    color: value ? '#1F2937' : '#9CA3AF', resize: 'vertical' as const,
  }
  if (multiline) {
    return (
      <textarea ref={ref} value={editing ? draft : (value || placeholder)}
        readOnly={!editing} rows={editing ? 2 : 1}
        onClick={() => setEditing(true)}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        style={style} />
    )
  }
  return (
    <input ref={ref} value={editing ? draft : (value || placeholder)}
      readOnly={!editing}
      onClick={() => setEditing(true)}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
      style={style} />
  )
}

function InlineCode({ value, onSave }: { value: string; onSave: (v: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.select() } }, [editing])
  const commit = async () => {
    const v = draft.trim().toUpperCase()
    if (v === value) { setEditing(false); return }
    if (!CODE_RE.test(v)) { alert('Code must be exactly 5 letters/digits'); setDraft(value); setEditing(false); return }
    const ok = await onSave(v)
    if (!ok) setDraft(value)
    setEditing(false)
  }
  return (
    <input ref={ref} value={editing ? draft : value} maxLength={5}
      readOnly={!editing}
      onClick={() => setEditing(true)}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
      style={{
        fontFamily: 'monospace', fontSize: '12px', fontWeight: '700', color: '#156082',
        background: editing ? 'white' : '#EFF6FF',
        border: editing ? '1.5px solid #156082' : '1.5px solid transparent',
        borderRadius: '6px', padding: '3px 8px', outline: 'none', cursor: editing ? 'text' : 'pointer',
        width: '100%', boxSizing: 'border-box' as const, textAlign: 'center' as const,
        textTransform: 'uppercase' as const,
      }} />
  )
}

export function OrgEntitiesPage({ category, icon, title, subtitle }: {
  category: string; icon: string; title: string; subtitle: string
}) {
  const [entities, setEntities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCode, setNewCode] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    const user = getStoredUser(); if (user) setUserEmail(user.email)
    load()
  }, [])

  const load = () => {
    setLoading(true)
    fetch(`${API}/legal/org-entities?category=${category}`).then(r => r.json()).then(d => setEntities(d.org_entities || [])).finally(() => setLoading(false))
  }

  const saveTitle = async (id: string, value: string) => {
    const e = entities.find(x => x.id === id); if (!e) return
    setEntities(prev => prev.map(x => x.id === id ? { ...x, title: value } : x))
    await fetch(`${API}/legal/org-entities/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: value, description: e.description, updated_by: userEmail }),
    })
  }

  const saveCode = async (id: string, value: string): Promise<boolean> => {
    const e = entities.find(x => x.id === id); if (!e) return false
    const res = await fetch(`${API}/legal/org-entities/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: e.title, description: e.description, code: value, updated_by: userEmail }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.detail || 'Could not update the code')
      return false
    }
    setEntities(prev => prev.map(x => x.id === id ? { ...x, code: value } : x))
    return true
  }

  const saveDescription = async (id: string, value: string) => {
    const e = entities.find(x => x.id === id); if (!e) return
    setEntities(prev => prev.map(x => x.id === id ? { ...x, description: value } : x))
    await fetch(`${API}/legal/org-entities/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: e.title, description: value, updated_by: userEmail }),
    })
  }

  const toggleArchived = async (id: string) => {
    const e = entities.find(x => x.id === id); if (!e) return
    const next = !e.is_archived
    setEntities(prev => prev.map(x => x.id === id ? { ...x, is_archived: next } : x))
    await fetch(`${API}/legal/org-entities/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: e.title, description: e.description, is_archived: next, updated_by: userEmail }),
    })
  }

  const addEntity = async () => {
    if (!newTitle.trim()) return
    const code = newCode.trim().toUpperCase()
    if (code && !CODE_RE.test(code)) { alert('Code must be exactly 5 letters/digits'); return }
    setAdding(true)
    const res = await fetch(`${API}/legal/org-entities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, title: newTitle.trim(), description: newDescription.trim(), code, created_by: userEmail }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.detail || 'Could not create the entity')
      setAdding(false)
      return
    }
    setNewTitle(''); setNewDescription(''); setNewCode(''); setAdding(false)
    load()
  }

  const deleteEntity = async (id: string) => {
    if (!confirm('Delete this entity?')) return
    await fetch(`${API}/legal/org-entities/${id}`, { method: 'DELETE' })
    setEntities(prev => prev.filter(e => e.id !== id))
  }

  return (
    <LegalLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>{icon} {title}</h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>{subtitle}</p>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px 20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '12px' }}>Add {title.replace(/s$/, '')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1.4fr auto', gap: '10px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Code</label>
              <input value={newCode} onChange={e => setNewCode(e.target.value)} maxLength={5}
                onKeyDown={e => e.key === 'Enter' && addEntity()}
                placeholder="Auto"
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'monospace', fontSize: '12px', outline: 'none', boxSizing: 'border-box' as const, textAlign: 'center' as const, textTransform: 'uppercase' as const }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Title *</label>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEntity()}
                placeholder="e.g. WCOMPLY France"
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'Montserrat, sans-serif', fontSize: '12px', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Description</label>
              <input value={newDescription} onChange={e => setNewDescription(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEntity()}
                placeholder="Optional"
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'Montserrat, sans-serif', fontSize: '12px', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
            <button onClick={addEntity} disabled={!newTitle.trim() || adding}
              style={{ padding: '9px 20px', background: newTitle.trim() ? '#156082' : '#F1F5F9', color: newTitle.trim() ? 'white' : '#94A3B8', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '700', cursor: newTitle.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
              {adding ? 'Adding…' : '+ Add'}
            </button>
          </div>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>}

        {!loading && entities.length === 0 && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
            None yet.
          </div>
        )}

        {!loading && entities.length > 0 && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '10px 20px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC', display: 'grid', gridTemplateColumns: '90px 1fr 1.4fr 90px 36px', gap: '12px' }}>
              <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>Code</span>
              <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>Title</span>
              <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>Description</span>
              <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>Status</span>
              <span></span>
            </div>
            {entities.map((e, i) => (
              <div key={e.id} style={{ padding: '10px 20px', borderBottom: '1px solid #F9FAFB', background: i % 2 === 0 ? 'white' : '#FAFBFC', display: 'grid', gridTemplateColumns: '90px 1fr 1.4fr 90px 36px', gap: '12px', alignItems: 'center', opacity: e.is_archived ? 0.55 : 1 }}>
                <InlineCode value={e.code || ''} onSave={v => saveCode(e.id, v)} />
                <InlineText value={e.title || ''} placeholder="Title" onSave={v => saveTitle(e.id, v)} />
                <InlineText value={e.description || ''} placeholder="Description" onSave={v => saveDescription(e.id, v)} multiline />
                <button onClick={() => toggleArchived(e.id)}
                  style={{ background: e.is_archived ? '#F1F5F9' : '#ECFDF5', color: e.is_archived ? '#64748B' : '#059669', border: 'none', borderRadius: '10px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
                  {e.is_archived ? 'Archived' : 'Active'}
                </button>
                <button onClick={() => deleteEntity(e.id)}
                  style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </LegalLayout>
  )
}
