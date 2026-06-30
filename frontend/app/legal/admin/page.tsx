'use client'
import { useState, useEffect, useRef } from 'react'
import { LegalLayout } from '@/components/LegalLayout'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const SCOPE_OPTIONS = [
  { value: 'both',      label: 'Both' },
  { value: 'entities',  label: 'Entities only' },
  { value: 'locations', label: 'Locations only' },
]
const SCOPE_STYLE: Record<string, { bg: string; color: string }> = {
  both:      { bg: '#EFF6FF', color: '#3B82F6' },
  entities:  { bg: '#ECFDF5', color: '#059669' },
  locations: { bg: '#FFF7ED', color: '#D97706' },
}

function InlineText({ value, onSave, placeholder = '—' }: {
  value: string; onSave: (v: string) => void; placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing && ref.current) ref.current.focus() }, [editing])
  const commit = () => { setEditing(false); if (draft.trim() !== value) onSave(draft.trim()) }
  return (
    <input ref={ref} value={editing ? draft : (value || placeholder)}
      readOnly={!editing}
      onClick={() => setEditing(true)}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
      style={{
        fontFamily: 'Montserrat, sans-serif', fontSize: '13px',
        border: editing ? '1.5px solid #156082' : '1.5px solid transparent',
        borderRadius: '6px', padding: '4px 8px', outline: 'none',
        background: editing ? 'white' : 'transparent', cursor: editing ? 'text' : 'pointer',
        width: '100%', boxSizing: 'border-box' as const,
        color: value ? '#1F2937' : '#9CA3AF',
      }} />
  )
}

export default function LegalAdminPage() {
  const [docTypes, setDocTypes] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newScope, setNewScope] = useState('both')
  const [adding, setAdding]     = useState(false)

  useEffect(() => {
    const user = getStoredUser(); if (user) setUserEmail(user.email)
    load()
  }, [])

  const load = () => {
    setLoading(true)
    fetch(`${API}/legal/doc-types`).then(r => r.json()).then(d => setDocTypes(d.doc_types || [])).finally(() => setLoading(false))
  }

  const saveLabel = async (id: string, label: string) => {
    const dt = docTypes.find(d => d.id === id)
    if (!dt) return
    setDocTypes(prev => prev.map(d => d.id === id ? { ...d, label } : d))
    await fetch(`${API}/legal/doc-types/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...dt, label }),
    })
  }

  const saveScope = async (id: string, scope: string) => {
    const dt = docTypes.find(d => d.id === id)
    if (!dt) return
    setDocTypes(prev => prev.map(d => d.id === id ? { ...d, scope } : d))
    await fetch(`${API}/legal/doc-types/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...dt, scope }),
    })
  }

  const addDocType = async () => {
    if (!newLabel.trim()) return
    setAdding(true)
    await fetch(`${API}/legal/doc-types`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel.trim(), scope: newScope, created_by: userEmail }),
    })
    setNewLabel(''); setNewScope('both'); setAdding(false); load()
  }

  const deleteDocType = async (id: string) => {
    if (!confirm('Delete this document type?')) return
    await fetch(`${API}/legal/doc-types/${id}`, { method: 'DELETE' })
    setDocTypes(prev => prev.filter(d => d.id !== id))
  }

  return (
    <LegalLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>⚙️ Admin Cockpit</h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>Configure document types — set which module each applies to</p>
        </div>

        {/* Add new doc type */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px 20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '12px' }}>Add Document Type</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: '10px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Label *</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDocType()}
                placeholder="e.g. Articles of Association"
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'Montserrat, sans-serif', fontSize: '12px', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Applies to</label>
              <select value={newScope} onChange={e => setNewScope(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'Montserrat, sans-serif', fontSize: '12px', outline: 'none', background: 'white' }}>
                {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <button onClick={addDocType} disabled={!newLabel.trim() || adding}
              style={{ padding: '9px 20px', background: newLabel.trim() ? '#156082' : '#F1F5F9', color: newLabel.trim() ? 'white' : '#94A3B8', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '700', cursor: newLabel.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
              {adding ? 'Adding…' : '+ Add Type'}
            </button>
          </div>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>}

        {!loading && docTypes.length === 0 && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
            No document types yet.
          </div>
        )}

        {!loading && docTypes.length > 0 && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '10px 20px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC', display: 'grid', gridTemplateColumns: '1fr 180px 36px', gap: '12px' }}>
              <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>Label (click to edit)</span>
              <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>Applies to</span>
              <span></span>
            </div>
            {docTypes.map((dt, i) => {
              const scopeStyle = SCOPE_STYLE[dt.scope] || SCOPE_STYLE.both
              return (
                <div key={dt.id} style={{ padding: '10px 20px', borderBottom: '1px solid #F9FAFB', background: i % 2 === 0 ? 'white' : '#FAFBFC', display: 'grid', gridTemplateColumns: '1fr 180px 36px', gap: '12px', alignItems: 'center' }}>
                  <InlineText value={dt.label || ''} placeholder="Label"
                    onSave={v => saveLabel(dt.id, v)} />
                  <select value={dt.scope || 'both'} onChange={e => saveScope(dt.id, e.target.value)}
                    style={{ padding: '4px 8px', border: `1.5px solid ${scopeStyle.bg}`, borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', fontSize: '11px', fontWeight: '700', background: scopeStyle.bg, color: scopeStyle.color, cursor: 'pointer', outline: 'none' }}>
                    {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button onClick={() => deleteDocType(dt.id)}
                    style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </LegalLayout>
  )
}
