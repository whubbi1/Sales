'use client'
import { useState, useEffect, useRef } from 'react'
import { LegalLayout } from '@/components/LegalLayout'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'
const CODE_RE = /^[A-Za-z0-9]{5}$/

const COUNTRIES = [
  { value: 'france',         label: '🇫🇷 France' },
  { value: 'portugal',       label: '🇵🇹 Portugal' },
  { value: 'czech_republic', label: '🇨🇿 Czech Republic' },
  { value: 'romania',        label: '🇷🇴 Romania' },
  { value: 'spain',          label: '🇪🇸 Spain' },
  { value: 'luxembourg',     label: '🇱🇺 Luxembourg' },
  { value: 'belgium',        label: '🇧🇪 Belgium' },
  { value: 'netherlands',    label: '🇳🇱 Netherlands' },
  { value: 'germany',        label: '🇩🇪 Germany' },
  { value: 'uk',             label: '🇬🇧 United Kingdom' },
]

function InlineText({ value, onSave, placeholder = '—', style = {} }: {
  value: string; onSave: (v: string) => void; placeholder?: string; style?: React.CSSProperties
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
        borderRadius: '6px', padding: '3px 7px', outline: 'none',
        background: editing ? 'white' : 'transparent', cursor: editing ? 'text' : 'pointer',
        width: '100%', boxSizing: 'border-box' as const,
        color: value ? '#1F2937' : '#9CA3AF', minHeight: '28px',
        ...style,
      }} />
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
      onClick={e => { e.stopPropagation(); setEditing(true) }}
      readOnly={!editing}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
      style={{
        fontFamily: 'monospace', fontSize: '11px', fontWeight: '700', color: '#156082',
        background: editing ? 'white' : '#EFF6FF',
        border: editing ? '1.5px solid #156082' : '1.5px solid transparent',
        borderRadius: '10px', padding: '2px 8px', outline: 'none', cursor: editing ? 'text' : 'pointer',
        width: '64px', boxSizing: 'border-box' as const, textAlign: 'center' as const, textTransform: 'uppercase' as const,
      }} />
  )
}

function InlineSelect({ value, options, onSave }: {
  value: string; options: { value: string; label: string }[]; onSave: (v: string) => void
}) {
  return (
    <select value={value} onChange={e => onSave(e.target.value)}
      style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '12px', border: '1.5px solid transparent', borderRadius: '6px', padding: '3px 6px', outline: 'none', background: 'transparent', cursor: 'pointer', width: '100%' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export default function LegalEntitiesPage() {
  const [entities, setEntities]   = useState<any[]>([])
  const [docTypes, setDocTypes]   = useState<{ value: string; label: string }[]>([])
  const [loading, setLoading]     = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Record<string, 'registrations'|'documents'|'websites'>>({})
  const [showNew, setShowNew]   = useState(false)
  const [newName, setNewName]   = useState('')
  const [newCountry, setNewCountry] = useState('france')
  const [newCode, setNewCode]   = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const user = getStoredUser(); if (user) setUserEmail(user.email)
    load(); loadDocTypes()
  }, [])

  const load = () => {
    setLoading(true)
    fetch(`${API}/legal/entities`).then(r => r.json()).then(d => setEntities(d.entities || [])).finally(() => setLoading(false))
  }

  const loadDocTypes = () => {
    fetch(`${API}/legal/doc-types`).then(r => r.json()).then(d => {
      setDocTypes((d.doc_types || []).map((t: any) => ({ value: t.type_key, label: t.label })))
    })
  }

  const saveEntityField = async (id: string, field: string, value: string) => {
    const entity = entities.find(e => e.id === id)
    if (!entity) return
    setEntities(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
    await fetch(`${API}/legal/entities/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entity, [field]: value, updated_by: userEmail }),
    })
  }

  const saveCode = async (id: string, value: string): Promise<boolean> => {
    const entity = entities.find(e => e.id === id)
    if (!entity) return false
    const res = await fetch(`${API}/legal/entities/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entity, code: value, updated_by: userEmail }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.detail || 'Could not update the code')
      return false
    }
    setEntities(prev => prev.map(e => e.id === id ? { ...e, code: value } : e))
    return true
  }

  const createEntity = async () => {
    if (!newName.trim()) return
    const code = newCode.trim().toUpperCase()
    if (code && !CODE_RE.test(code)) { alert('Code must be exactly 5 letters/digits'); return }
    setCreating(true)
    const r = await fetch(`${API}/legal/entities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ legal_name: newName.trim(), country: newCountry, code, created_by: userEmail }),
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      alert(err.detail || 'Could not create the entity')
      setCreating(false)
      return
    }
    const data = await r.json()
    setNewName(''); setNewCountry('france'); setNewCode(''); setShowNew(false); setCreating(false)
    load()
    if (data.id) setExpandedId(data.id)
  }

  const toggleArchived = async (id: string) => {
    const entity = entities.find(e => e.id === id)
    if (!entity) return
    const next = !entity.is_archived
    setEntities(prev => prev.map(e => e.id === id ? { ...e, is_archived: next } : e))
    await fetch(`${API}/legal/entities/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entity, is_archived: next, updated_by: userEmail }),
    })
  }

  const deleteEntity = async (id: string) => {
    if (!confirm('Delete this legal entity and all its data?')) return
    await fetch(`${API}/legal/entities/${id}`, { method: 'DELETE' })
    setEntities(prev => prev.filter(e => e.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const addReg = async (entityId: string) => {
    const r = await fetch(`${API}/legal/entities/${entityId}/registrations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reg_type: 'SIREN', reg_value: '', created_by: userEmail }),
    })
    const data = await r.json()
    setEntities(prev => prev.map(e => e.id === entityId
      ? { ...e, registrations: [...(e.registrations || []), { id: data.id, reg_type: 'SIREN', reg_value: '' }] } : e))
  }

  const saveReg = async (entityId: string, regId: string, field: string, value: string) => {
    const reg = entities.find(e => e.id === entityId)?.registrations?.find((r: any) => r.id === regId)
    if (!reg) return
    setEntities(prev => prev.map(e => e.id === entityId
      ? { ...e, registrations: e.registrations.map((r: any) => r.id === regId ? { ...r, [field]: value } : r) } : e))
    await fetch(`${API}/legal/entities/${entityId}/registrations/${regId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...reg, [field]: value }),
    })
  }

  const deleteReg = async (entityId: string, regId: string) => {
    await fetch(`${API}/legal/entities/${entityId}/registrations/${regId}`, { method: 'DELETE' })
    setEntities(prev => prev.map(e => e.id === entityId
      ? { ...e, registrations: e.registrations.filter((r: any) => r.id !== regId) } : e))
  }

  const addDoc = async (entityId: string) => {
    const defaultType = docTypes[0]?.value || 'other'
    const r = await fetch(`${API}/legal/entities/${entityId}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_type: defaultType, sharepoint_url: '', created_by: userEmail }),
    })
    const data = await r.json()
    setEntities(prev => prev.map(e => e.id === entityId
      ? { ...e, documents: [...(e.documents || []), { id: data.id, doc_type: defaultType, sharepoint_url: '' }] } : e))
  }

  const saveDoc = async (entityId: string, docId: string, field: string, value: string) => {
    const doc = entities.find(e => e.id === entityId)?.documents?.find((d: any) => d.id === docId)
    if (!doc) return
    setEntities(prev => prev.map(e => e.id === entityId
      ? { ...e, documents: e.documents.map((d: any) => d.id === docId ? { ...d, [field]: value } : d) } : e))
    await fetch(`${API}/legal/entities/${entityId}/documents/${docId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...doc, [field]: value }),
    })
  }

  const deleteDoc = async (entityId: string, docId: string) => {
    await fetch(`${API}/legal/entities/${entityId}/documents/${docId}`, { method: 'DELETE' })
    setEntities(prev => prev.map(e => e.id === entityId
      ? { ...e, documents: e.documents.filter((d: any) => d.id !== docId) } : e))
  }

  const addWeb = async (entityId: string) => {
    const r = await fetch(`${API}/legal/entities/${entityId}/websites`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Website', url: '', created_by: userEmail }),
    })
    const data = await r.json()
    setEntities(prev => prev.map(e => e.id === entityId
      ? { ...e, websites: [...(e.websites || []), { id: data.id, label: 'Website', url: '' }] } : e))
  }

  const saveWeb = async (entityId: string, webId: string, field: string, value: string) => {
    const web = entities.find(e => e.id === entityId)?.websites?.find((w: any) => w.id === webId)
    if (!web) return
    setEntities(prev => prev.map(e => e.id === entityId
      ? { ...e, websites: e.websites.map((w: any) => w.id === webId ? { ...w, [field]: value } : w) } : e))
    await fetch(`${API}/legal/entities/${entityId}/websites/${webId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...web, [field]: value }),
    })
  }

  const deleteWeb = async (entityId: string, webId: string) => {
    await fetch(`${API}/legal/entities/${entityId}/websites/${webId}`, { method: 'DELETE' })
    setEntities(prev => prev.map(e => e.id === entityId
      ? { ...e, websites: e.websites.filter((w: any) => w.id !== webId) } : e))
  }

  const getTab = (id: string) => activeTab[id] || 'registrations'
  const setTab = (id: string, tab: 'registrations'|'documents'|'websites') =>
    setActiveTab(prev => ({ ...prev, [id]: tab }))

  const countryFlag = (val: string) => COUNTRIES.find(c => c.value === val)?.label.split(' ')[0] || '🌍'

  const tabBtn = (entityId: string, tab: 'registrations'|'documents'|'websites', label: string, count: number) => {
    const active = getTab(entityId) === tab
    return (
      <button key={tab} onClick={() => setTab(entityId, tab)}
        style={{ padding: '5px 14px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: active ? '700' : '500',
          fontFamily: 'Montserrat, sans-serif', background: active ? '#156082' : 'transparent',
          color: active ? 'white' : '#45B6E4', borderRadius: '6px' }}>
        {label} ({count})
      </button>
    )
  }

  return (
    <LegalLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>🏢 Legal Entities</h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>{entities.length} entit{entities.length !== 1 ? 'ies' : 'y'}</p>
          </div>
          <button onClick={() => setShowNew(true)}
            style={{ background: '#156082', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
            + New Entity
          </button>
        </div>

        {showNew && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1.5px solid #156082', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(21,96,130,0.1)' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#156082', marginBottom: '14px' }}>New Legal Entity</div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 220px auto auto', gap: '10px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Code</label>
                <input value={newCode} onChange={e => setNewCode(e.target.value)} maxLength={5}
                  onKeyDown={e => e.key === 'Enter' && createEntity()}
                  placeholder="Auto"
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'monospace', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const, textAlign: 'center' as const, textTransform: 'uppercase' as const }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Legal Name *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createEntity()}
                  placeholder="Company SA" autoFocus
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'Montserrat, sans-serif', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Country</label>
                <select value={newCountry} onChange={e => setNewCountry(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'Montserrat, sans-serif', fontSize: '13px', outline: 'none', background: 'white', cursor: 'pointer' }}>
                  {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <button onClick={createEntity} disabled={!newName.trim() || creating}
                style={{ padding: '9px 20px', background: newName.trim() ? '#156082' : '#F1F5F9', color: newName.trim() ? 'white' : '#94A3B8', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: '700', cursor: newName.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button onClick={() => { setShowNew(false); setNewName(''); setNewCode('') }}
                style={{ padding: '9px 14px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '7px', fontSize: '13px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', padding: '60px', color: '#45B6E4' }}>Loading entities…</div>}

        {!loading && entities.length === 0 && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
            No legal entities yet. Click "+ New Entity" to add the first one.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {entities.map(entity => {
            const expanded = expandedId === entity.id
            const tab = getTab(entity.id)
            return (
              <div key={entity.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', opacity: entity.is_archived ? 0.6 : 1 }}>
                <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', background: expanded ? '#F0F7FF' : 'white' }}
                  onClick={() => setExpandedId(expanded ? null : entity.id)}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>{countryFlag(entity.country)}</span>
                  <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
                    <InlineCode value={entity.code || ''} onSave={v => saveCode(entity.id, v)} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#1F2937' }}>{entity.legal_name || '—'}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                      {[entity.street, entity.city, entity.postal_code].filter(Boolean).join(' · ') || 'No address yet'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {(entity.registrations?.length > 0) && <span style={{ fontSize: '10px', background: '#EFF6FF', color: '#156082', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>{entity.registrations.length} reg.</span>}
                    {(entity.documents?.length > 0) && <span style={{ fontSize: '10px', background: '#F0FDF4', color: '#059669', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>{entity.documents.length} doc{entity.documents.length !== 1 ? 's' : ''}</span>}
                    {(entity.websites?.length > 0) && <span style={{ fontSize: '10px', background: '#FFF7ED', color: '#D97706', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>{entity.websites.length} site{entity.websites.length !== 1 ? 's' : ''}</span>}
                  </div>
                  <button onClick={e => { e.stopPropagation(); toggleArchived(entity.id) }}
                    style={{ background: entity.is_archived ? '#F1F5F9' : '#ECFDF5', color: entity.is_archived ? '#64748B' : '#059669', border: 'none', borderRadius: '10px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {entity.is_archived ? 'Archived' : 'Active'}
                  </button>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#94A3B8" strokeWidth={2}
                    style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                {expanded && (
                  <div style={{ borderTop: '1px solid #EDF2F7', padding: '20px' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '10px' }}>Identity</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '12px', marginBottom: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#94A3B8', marginBottom: '2px' }}>Legal Name</label>
                          <InlineText value={entity.legal_name || ''} placeholder="Legal name"
                            onSave={v => saveEntityField(entity.id, 'legal_name', v)}
                            style={{ fontSize: '14px', fontWeight: '600' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#94A3B8', marginBottom: '2px' }}>Country</label>
                          <InlineSelect value={entity.country || 'france'} options={COUNTRIES}
                            onSave={v => saveEntityField(entity.id, 'country', v)} />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#94A3B8', marginBottom: '2px' }}>Street Name & Number</label>
                          <InlineText value={entity.street || ''} placeholder="e.g. 12 Rue de la Paix"
                            onSave={v => saveEntityField(entity.id, 'street', v)} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#94A3B8', marginBottom: '2px' }}>Postal Code</label>
                          <InlineText value={entity.postal_code || ''} placeholder="e.g. 75001"
                            onSave={v => saveEntityField(entity.id, 'postal_code', v)} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#94A3B8', marginBottom: '2px' }}>City</label>
                          <InlineText value={entity.city || ''} placeholder="e.g. Paris"
                            onSave={v => saveEntityField(entity.id, 'city', v)} />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#94A3B8', marginBottom: '2px' }}>Phone</label>
                          <InlineText value={entity.phone || ''} placeholder="e.g. +33 1 23 45 67 89"
                            onSave={v => saveEntityField(entity.id, 'phone', v)} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#94A3B8', marginBottom: '2px' }}>Email</label>
                          <InlineText value={entity.email || ''} placeholder="e.g. contact@company.com"
                            onSave={v => saveEntityField(entity.id, 'email', v)} />
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
                        {tabBtn(entity.id, 'registrations', 'Registrations', entity.registrations?.length || 0)}
                        {tabBtn(entity.id, 'documents', 'Documents', entity.documents?.length || 0)}
                        {tabBtn(entity.id, 'websites', 'Websites', entity.websites?.length || 0)}
                      </div>

                      {tab === 'registrations' && (
                        <div>
                          {(entity.registrations || []).map((reg: any) => (
                            <div key={reg.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 32px', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                              <InlineText value={reg.reg_type || ''} placeholder="e.g. SIREN"
                                onSave={v => saveReg(entity.id, reg.id, 'reg_type', v)}
                                style={{ fontSize: '12px', fontWeight: '600', color: '#156082' }} />
                              <InlineText value={reg.reg_value || ''} placeholder="Registration number"
                                onSave={v => saveReg(entity.id, reg.id, 'reg_value', v)} />
                              <button onClick={() => deleteReg(entity.id, reg.id)}
                                style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            </div>
                          ))}
                          <button onClick={() => addReg(entity.id)}
                            style={{ marginTop: '6px', padding: '5px 14px', background: '#EFF6FF', color: '#156082', border: '1.5px dashed #BFD9EF', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                            + Add Registration
                          </button>
                        </div>
                      )}

                      {tab === 'documents' && (
                        <div>
                          {(entity.documents || []).map((doc: any) => (
                            <div key={doc.id} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 32px', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                              <InlineSelect value={doc.doc_type || (docTypes[0]?.value || '')} options={docTypes}
                                onSave={v => saveDoc(entity.id, doc.id, 'doc_type', v)} />
                              <InlineText value={doc.sharepoint_url || ''} placeholder="SharePoint URL"
                                onSave={v => saveDoc(entity.id, doc.id, 'sharepoint_url', v)} />
                              <button onClick={() => deleteDoc(entity.id, doc.id)}
                                style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            </div>
                          ))}
                          <button onClick={() => addDoc(entity.id)}
                            style={{ marginTop: '6px', padding: '5px 14px', background: '#F0FDF4', color: '#059669', border: '1.5px dashed #86EFAC', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                            + Add Document
                          </button>
                        </div>
                      )}

                      {tab === 'websites' && (
                        <div>
                          {(entity.websites || []).map((web: any) => (
                            <div key={web.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr auto 28px', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                              <InlineText value={web.label || ''} placeholder="Name"
                                onSave={v => saveWeb(entity.id, web.id, 'label', v)}
                                style={{ fontSize: '12px', fontWeight: '600' }} />
                              <InlineText value={web.url || ''} placeholder="https://…"
                                onSave={v => saveWeb(entity.id, web.id, 'url', v)} />
                              {web.url ? (
                                <a href={web.url.startsWith('http') ? web.url : `https://${web.url}`} target="_blank" rel="noopener noreferrer"
                                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#EFF6FF', color: '#156082', borderRadius: '6px', fontSize: '11px', fontWeight: '700', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                  Visit
                                </a>
                              ) : <div />}
                              <button onClick={() => deleteWeb(entity.id, web.id)}
                                style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            </div>
                          ))}
                          <button onClick={() => addWeb(entity.id)}
                            style={{ marginTop: '6px', padding: '5px 14px', background: '#FFF7ED', color: '#D97706', border: '1.5px dashed #FCD34D', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                            + Add Website
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => deleteEntity(entity.id)}
                        style={{ padding: '5px 14px', background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                        Delete Entity
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </LegalLayout>
  )
}
