'use client'
import { useState, useEffect, useRef } from 'react'
import { LegalLayout } from '@/components/LegalLayout'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

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

export default function LegalLocationsPage() {
  const [locations, setLocations] = useState<any[]>([])
  const [docTypes, setDocTypes]   = useState<{ value: string; label: string }[]>([])
  const [loading, setLoading]     = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Record<string, 'registrations'|'documents'|'websites'>>({})
  const [showNew, setShowNew]   = useState(false)
  const [newName, setNewName]   = useState('')
  const [newCountry, setNewCountry] = useState('france')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const user = getStoredUser(); if (user) setUserEmail(user.email)
    load(); loadDocTypes()
  }, [])

  const load = () => {
    setLoading(true)
    fetch(`${API}/legal/locations`).then(r => r.json()).then(d => setLocations(d.locations || [])).finally(() => setLoading(false))
  }

  const loadDocTypes = () => {
    fetch(`${API}/legal/doc-types`).then(r => r.json()).then(d => {
      setDocTypes((d.doc_types || []).map((t: any) => ({ value: t.type_key, label: t.label })))
    })
  }

  const saveField = async (id: string, field: string, value: string) => {
    const loc = locations.find(l => l.id === id)
    if (!loc) return
    setLocations(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
    await fetch(`${API}/legal/locations/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...loc, [field]: value, updated_by: userEmail }),
    })
  }

  const createLocation = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const r = await fetch(`${API}/legal/locations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_name: newName.trim(), country: newCountry, created_by: userEmail }),
    })
    const data = await r.json()
    setNewName(''); setNewCountry('france'); setShowNew(false); setCreating(false)
    load()
    if (data.id) setExpandedId(data.id)
  }

  const deleteLocation = async (id: string) => {
    if (!confirm('Delete this location and all its data?')) return
    await fetch(`${API}/legal/locations/${id}`, { method: 'DELETE' })
    setLocations(prev => prev.filter(l => l.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const addReg = async (locId: string) => {
    const r = await fetch(`${API}/legal/locations/${locId}/registrations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reg_type: 'SIRET', reg_value: '', created_by: userEmail }),
    })
    const data = await r.json()
    setLocations(prev => prev.map(l => l.id === locId
      ? { ...l, registrations: [...(l.registrations || []), { id: data.id, reg_type: 'SIRET', reg_value: '' }] } : l))
  }

  const saveReg = async (locId: string, regId: string, field: string, value: string) => {
    const reg = locations.find(l => l.id === locId)?.registrations?.find((r: any) => r.id === regId)
    if (!reg) return
    setLocations(prev => prev.map(l => l.id === locId
      ? { ...l, registrations: l.registrations.map((r: any) => r.id === regId ? { ...r, [field]: value } : r) } : l))
    await fetch(`${API}/legal/locations/${locId}/registrations/${regId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...reg, [field]: value }),
    })
  }

  const deleteReg = async (locId: string, regId: string) => {
    await fetch(`${API}/legal/locations/${locId}/registrations/${regId}`, { method: 'DELETE' })
    setLocations(prev => prev.map(l => l.id === locId
      ? { ...l, registrations: l.registrations.filter((r: any) => r.id !== regId) } : l))
  }

  const addDoc = async (locId: string) => {
    const defaultType = docTypes[0]?.value || 'other'
    const r = await fetch(`${API}/legal/locations/${locId}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_type: defaultType, sharepoint_url: '', created_by: userEmail }),
    })
    const data = await r.json()
    setLocations(prev => prev.map(l => l.id === locId
      ? { ...l, documents: [...(l.documents || []), { id: data.id, doc_type: defaultType, sharepoint_url: '' }] } : l))
  }

  const saveDoc = async (locId: string, docId: string, field: string, value: string) => {
    const doc = locations.find(l => l.id === locId)?.documents?.find((d: any) => d.id === docId)
    if (!doc) return
    setLocations(prev => prev.map(l => l.id === locId
      ? { ...l, documents: l.documents.map((d: any) => d.id === docId ? { ...d, [field]: value } : d) } : l))
    await fetch(`${API}/legal/locations/${locId}/documents/${docId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...doc, [field]: value }),
    })
  }

  const deleteDoc = async (locId: string, docId: string) => {
    await fetch(`${API}/legal/locations/${locId}/documents/${docId}`, { method: 'DELETE' })
    setLocations(prev => prev.map(l => l.id === locId
      ? { ...l, documents: l.documents.filter((d: any) => d.id !== docId) } : l))
  }

  const addWeb = async (locId: string) => {
    const r = await fetch(`${API}/legal/locations/${locId}/websites`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Website', url: '', created_by: userEmail }),
    })
    const data = await r.json()
    setLocations(prev => prev.map(l => l.id === locId
      ? { ...l, websites: [...(l.websites || []), { id: data.id, label: 'Website', url: '' }] } : l))
  }

  const saveWeb = async (locId: string, webId: string, field: string, value: string) => {
    const web = locations.find(l => l.id === locId)?.websites?.find((w: any) => w.id === webId)
    if (!web) return
    setLocations(prev => prev.map(l => l.id === locId
      ? { ...l, websites: l.websites.map((w: any) => w.id === webId ? { ...w, [field]: value } : w) } : l))
    await fetch(`${API}/legal/locations/${locId}/websites/${webId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...web, [field]: value }),
    })
  }

  const deleteWeb = async (locId: string, webId: string) => {
    await fetch(`${API}/legal/locations/${locId}/websites/${webId}`, { method: 'DELETE' })
    setLocations(prev => prev.map(l => l.id === locId
      ? { ...l, websites: l.websites.filter((w: any) => w.id !== webId) } : l))
  }

  const getTab = (id: string) => activeTab[id] || 'registrations'
  const setTab = (id: string, tab: 'registrations'|'documents'|'websites') =>
    setActiveTab(prev => ({ ...prev, [id]: tab }))

  const countryFlag = (val: string) => COUNTRIES.find(c => c.value === val)?.label.split(' ')[0] || '🌍'

  const tabBtn = (locId: string, tab: 'registrations'|'documents'|'websites', label: string, count: number) => {
    const active = getTab(locId) === tab
    return (
      <button key={tab} onClick={() => setTab(locId, tab)}
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
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>📍 Locations</h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>{locations.length} location{locations.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowNew(true)}
            style={{ background: '#156082', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
            + New Location
          </button>
        </div>

        {showNew && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1.5px solid #156082', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(21,96,130,0.1)' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#156082', marginBottom: '14px' }}>New Location</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px auto auto', gap: '10px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Location Name *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createLocation()}
                  placeholder="Paris HQ" autoFocus
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'Montserrat, sans-serif', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Country</label>
                <select value={newCountry} onChange={e => setNewCountry(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'Montserrat, sans-serif', fontSize: '13px', outline: 'none', background: 'white', cursor: 'pointer' }}>
                  {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <button onClick={createLocation} disabled={!newName.trim() || creating}
                style={{ padding: '9px 20px', background: newName.trim() ? '#156082' : '#F1F5F9', color: newName.trim() ? 'white' : '#94A3B8', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: '700', cursor: newName.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button onClick={() => { setShowNew(false); setNewName('') }}
                style={{ padding: '9px 14px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '7px', fontSize: '13px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', padding: '60px', color: '#45B6E4' }}>Loading locations…</div>}

        {!loading && locations.length === 0 && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
            No locations yet. Click "+ New Location" to add the first one.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {locations.map(loc => {
            const expanded = expandedId === loc.id
            const tab = getTab(loc.id)
            return (
              <div key={loc.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', background: expanded ? '#F0F7FF' : 'white' }}
                  onClick={() => setExpandedId(expanded ? null : loc.id)}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>{countryFlag(loc.country)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#1F2937' }}>{loc.location_name || '—'}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                      {[loc.street, loc.city, loc.postal_code].filter(Boolean).join(' · ') || 'No address yet'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {(loc.registrations?.length > 0) && <span style={{ fontSize: '10px', background: '#EFF6FF', color: '#156082', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>{loc.registrations.length} reg.</span>}
                    {(loc.documents?.length > 0) && <span style={{ fontSize: '10px', background: '#F0FDF4', color: '#059669', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>{loc.documents.length} doc{loc.documents.length !== 1 ? 's' : ''}</span>}
                    {(loc.websites?.length > 0) && <span style={{ fontSize: '10px', background: '#FFF7ED', color: '#D97706', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>{loc.websites.length} site{loc.websites.length !== 1 ? 's' : ''}</span>}
                  </div>
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
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#94A3B8', marginBottom: '2px' }}>Location Name</label>
                          <InlineText value={loc.location_name || ''} placeholder="Location name"
                            onSave={v => saveField(loc.id, 'location_name', v)}
                            style={{ fontSize: '14px', fontWeight: '600' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#94A3B8', marginBottom: '2px' }}>Country</label>
                          <InlineSelect value={loc.country || 'france'} options={COUNTRIES}
                            onSave={v => saveField(loc.id, 'country', v)} />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#94A3B8', marginBottom: '2px' }}>Street Name & Number</label>
                          <InlineText value={loc.street || ''} placeholder="e.g. 12 Rue de la Paix"
                            onSave={v => saveField(loc.id, 'street', v)} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#94A3B8', marginBottom: '2px' }}>Postal Code</label>
                          <InlineText value={loc.postal_code || ''} placeholder="e.g. 75001"
                            onSave={v => saveField(loc.id, 'postal_code', v)} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#94A3B8', marginBottom: '2px' }}>City</label>
                          <InlineText value={loc.city || ''} placeholder="e.g. Paris"
                            onSave={v => saveField(loc.id, 'city', v)} />
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
                        {tabBtn(loc.id, 'registrations', 'Registrations', loc.registrations?.length || 0)}
                        {tabBtn(loc.id, 'documents', 'Documents', loc.documents?.length || 0)}
                        {tabBtn(loc.id, 'websites', 'Websites', loc.websites?.length || 0)}
                      </div>

                      {tab === 'registrations' && (
                        <div>
                          {(loc.registrations || []).map((reg: any) => (
                            <div key={reg.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 32px', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                              <InlineText value={reg.reg_type || ''} placeholder="e.g. SIRET"
                                onSave={v => saveReg(loc.id, reg.id, 'reg_type', v)}
                                style={{ fontSize: '12px', fontWeight: '600', color: '#156082' }} />
                              <InlineText value={reg.reg_value || ''} placeholder="Registration number"
                                onSave={v => saveReg(loc.id, reg.id, 'reg_value', v)} />
                              <button onClick={() => deleteReg(loc.id, reg.id)}
                                style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            </div>
                          ))}
                          <button onClick={() => addReg(loc.id)}
                            style={{ marginTop: '6px', padding: '5px 14px', background: '#EFF6FF', color: '#156082', border: '1.5px dashed #BFD9EF', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                            + Add Registration
                          </button>
                        </div>
                      )}

                      {tab === 'documents' && (
                        <div>
                          {(loc.documents || []).map((doc: any) => (
                            <div key={doc.id} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 32px', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                              <InlineSelect value={doc.doc_type || (docTypes[0]?.value || '')} options={docTypes}
                                onSave={v => saveDoc(loc.id, doc.id, 'doc_type', v)} />
                              <InlineText value={doc.sharepoint_url || ''} placeholder="SharePoint URL"
                                onSave={v => saveDoc(loc.id, doc.id, 'sharepoint_url', v)} />
                              <button onClick={() => deleteDoc(loc.id, doc.id)}
                                style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            </div>
                          ))}
                          <button onClick={() => addDoc(loc.id)}
                            style={{ marginTop: '6px', padding: '5px 14px', background: '#F0FDF4', color: '#059669', border: '1.5px dashed #86EFAC', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                            + Add Document
                          </button>
                        </div>
                      )}

                      {tab === 'websites' && (
                        <div>
                          {(loc.websites || []).map((web: any) => (
                            <div key={web.id} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 32px', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                              <InlineText value={web.label || ''} placeholder="Label"
                                onSave={v => saveWeb(loc.id, web.id, 'label', v)}
                                style={{ fontSize: '12px', fontWeight: '600' }} />
                              <InlineText value={web.url || ''} placeholder="https://…"
                                onSave={v => saveWeb(loc.id, web.id, 'url', v)} />
                              <button onClick={() => deleteWeb(loc.id, web.id)}
                                style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            </div>
                          ))}
                          <button onClick={() => addWeb(loc.id)}
                            style={{ marginTop: '6px', padding: '5px 14px', background: '#FFF7ED', color: '#D97706', border: '1.5px dashed #FCD34D', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                            + Add Website
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => deleteLocation(loc.id)}
                        style={{ padding: '5px 14px', background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                        Delete Location
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
