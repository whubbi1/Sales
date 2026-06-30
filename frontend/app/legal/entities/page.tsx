'use client'
import { LegalLayout } from '@/components/LegalLayout'
import { useEffect, useState } from 'react'
import { fetchUserAttributes } from 'aws-amplify/auth'

const API = 'https://api.whubbi.wcomply.com'

const COUNTRIES = ['France', 'Portugal', 'Czech Republic', 'Romania', 'Spain', 'Other']
const DOC_TYPES  = ['KBIS', 'Legal Certificate', 'Insurance', 'Articles of Incorporation', 'Tax Certificate', 'Bank Certificate', 'Other']
const COUNTRY_FLAGS: Record<string, string> = {
  France: '🇫🇷', Portugal: '🇵🇹', 'Czech Republic': '🇨🇿', Romania: '🇷🇴', Spain: '🇪🇸', Other: '🌍'
}

interface Doc    { id: string; doc_type: string; doc_label: string; sharepoint_url: string }
interface Entity { id: string; legal_name: string; legal_address: string; country: string; registration_description: string; registration_value: string; documents: Doc[]; created_at: string }

const EMPTY_FORM = { legal_name: '', legal_address: '', country: '', registration_description: '', registration_value: '' }
const EMPTY_DOC  = { doc_type: '', doc_label: '', sharepoint_url: '' }

export default function LegalEntitiesPage() {
  const [entities,        setEntities]        = useState<Entity[]>([])
  const [loading,         setLoading]         = useState(true)
  const [hasAccess,       setHasAccess]       = useState<boolean | null>(null)
  const [canEdit,         setCanEdit]         = useState(false)
  const [currentUser,     setCurrentUser]     = useState({ email: '', name: '' })
  const [showEntityForm,  setShowEntityForm]  = useState(false)
  const [editingEntity,   setEditingEntity]   = useState<Entity | null>(null)
  const [expandedEntity,  setExpandedEntity]  = useState<string | null>(null)
  const [showDocForm,     setShowDocForm]     = useState<string | null>(null)
  const [form,            setForm]            = useState(EMPTY_FORM)
  const [docForm,         setDocForm]         = useState(EMPTY_DOC)
  const [saving,          setSaving]          = useState(false)

  const load = () => {
    fetch(`${API}/legal/entities`)
      .then(r => r.json())
      .then(d => { setEntities(d.entities || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchUserAttributes().then(a => {
      const email = a.email || ''
      const name  = (a.name || `${a.given_name || ''} ${a.family_name || ''}`.trim()) || email.split('@')[0]
      setCurrentUser({ email, name })
      if (!email) { setHasAccess(false); setLoading(false); return }
      fetch(`${API}/settings/permissions/${email}`)
        .then(r => r.json())
        .then(d => {
          const legalPerms = d.permissions?.legal
          // If the legal module isn't in the response yet (old backend / no record), allow access
          if (!legalPerms) { setHasAccess(true); setCanEdit(true); load(); return }
          const perm = legalPerms.entities || {}
          // Only block if explicitly set to 'none'
          const blocked = perm.access_mode === 'none'
          setHasAccess(!blocked)
          setCanEdit(perm.access_mode === 'edit')
          if (!blocked) load()
          else setLoading(false)
        })
        .catch(() => { setHasAccess(true); setCanEdit(true); load() })
    }).catch(() => { setHasAccess(false); setLoading(false) })
  }, [])

  const openAddEntity = () => { setEditingEntity(null); setForm(EMPTY_FORM); setShowEntityForm(true) }
  const openEditEntity = (e: Entity) => { setEditingEntity(e); setForm({ legal_name: e.legal_name, legal_address: e.legal_address || '', country: e.country || '', registration_description: e.registration_description || '', registration_value: e.registration_value || '' }); setShowEntityForm(true) }

  const saveEntity = async () => {
    setSaving(true)
    const method = editingEntity ? 'PUT' : 'POST'
    const url    = editingEntity ? `${API}/legal/entities/${editingEntity.id}` : `${API}/legal/entities`
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, created_by: currentUser.email, updated_by: currentUser.email }) })
    setShowEntityForm(false); setEditingEntity(null); setSaving(false); load()
  }

  const deleteEntity = async (id: string) => {
    if (!confirm('Delete this legal entity and all its documents?')) return
    await fetch(`${API}/legal/entities/${id}`, { method: 'DELETE' })
    load()
  }

  const saveDoc = async (entityId: string) => {
    await fetch(`${API}/legal/entities/${entityId}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...docForm, created_by: currentUser.email })
    })
    setShowDocForm(null); setDocForm(EMPTY_DOC); load()
  }

  const deleteDoc = async (entityId: string, docId: string) => {
    await fetch(`${API}/legal/entities/${entityId}/documents/${docId}`, { method: 'DELETE' })
    load()
  }

  const inputStyle: React.CSSProperties = { width: '100%', fontSize: '13px', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', display: 'block', marginBottom: '4px' }

  if (loading) return <LegalLayout><div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</div></LegalLayout>

  if (hasAccess === false) return (
    <LegalLayout>
      <div style={{ padding: '80px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#156082', marginBottom: '8px' }}>Access Restricted</h2>
        <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '400px', margin: '0 auto' }}>
          You don't have permission to access Legal Entities.<br/>
          Contact your HR administrator to request access, or ask the WHUBBI Bot.
        </p>
      </div>
    </LegalLayout>
  )

  return (
    <LegalLayout>
      <div style={{ padding: '32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Legal Entities</h1>
            <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>WCOMPLY legal entities and registration documents</p>
          </div>
          {canEdit && (
            <button onClick={openAddEntity}
              style={{ background: '#1a2744', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
              + Add Legal Entity
            </button>
          )}
        </div>

        {/* Entities list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {entities.length === 0 && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
              No legal entities yet.{canEdit ? ' Click "Add Legal Entity" to create one.' : ''}
            </div>
          )}

          {entities.map(entity => (
            <div key={entity.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              {/* Entity row */}
              <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                  {COUNTRY_FLAGS[entity.country] || '🏢'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1E293B', margin: 0 }}>{entity.legal_name}</h3>
                    {entity.country && <span style={{ fontSize: '10px', background: '#EFF6FF', color: '#3B82F6', padding: '2px 8px', borderRadius: '20px', fontWeight: '600', flexShrink: 0 }}>{entity.country}</span>}
                  </div>
                  {entity.legal_address && <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 4px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{entity.legal_address}</p>}
                  {entity.registration_description && (
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>
                      {entity.registration_description}:&nbsp;
                      <span style={{ fontWeight: '400', color: '#64748B' }}>{entity.registration_value}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => setExpandedEntity(expandedEntity === entity.id ? null : entity.id)}
                    style={{ fontSize: '11px', color: '#3B82F6', background: '#EFF6FF', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontWeight: '600', fontFamily: 'Montserrat, sans-serif' }}>
                    {entity.documents?.length || 0} doc{(entity.documents?.length || 0) !== 1 ? 's' : ''} {expandedEntity === entity.id ? '▲' : '▼'}
                  </button>
                  {canEdit && <>
                    <button onClick={() => openEditEntity(entity)}
                      style={{ fontSize: '11px', color: '#64748B', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>Edit</button>
                    <button onClick={() => deleteEntity(entity.id)}
                      style={{ fontSize: '11px', color: '#EF4444', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>Delete</button>
                  </>}
                </div>
              </div>

              {/* Documents section */}
              {expandedEntity === entity.id && (
                <div style={{ borderTop: '1px solid #EDF2F7', padding: '14px 20px 14px 74px', background: '#FAFBFF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>Legal Documents</div>
                    {canEdit && (
                      <button onClick={() => { setShowDocForm(entity.id); setDocForm(EMPTY_DOC) }}
                        style={{ fontSize: '11px', color: '#3B82F6', background: '#EFF6FF', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: '600', fontFamily: 'Montserrat, sans-serif' }}>
                        + Add Document
                      </button>
                    )}
                  </div>

                  {(!entity.documents || entity.documents.length === 0) && showDocForm !== entity.id && (
                    <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No documents linked yet.</p>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(entity.documents || []).map(doc => (
                      <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'white', borderRadius: '8px', border: '1px solid #EDF2F7' }}>
                        <span style={{ fontSize: '16px' }}>📎</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: '#1E293B' }}>{doc.doc_label}</div>
                          {doc.doc_type && <div style={{ fontSize: '10px', color: '#94A3B8' }}>{doc.doc_type}</div>}
                        </div>
                        {doc.sharepoint_url && (
                          <a href={doc.sharepoint_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: '11px', color: '#3B82F6', fontWeight: '600', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            Open
                            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          </a>
                        )}
                        {canEdit && (
                          <button onClick={() => deleteDoc(entity.id, doc.id)}
                            style={{ fontSize: '12px', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}>✕</button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Inline add-doc form */}
                  {showDocForm === entity.id && (
                    <div style={{ marginTop: '10px', padding: '12px', background: 'white', borderRadius: '8px', border: '1px solid #EDF2F7' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 2fr', gap: '8px', marginBottom: '8px' }}>
                        <select value={docForm.doc_type} onChange={e => setDocForm(f => ({...f, doc_type: e.target.value}))}
                          style={{ fontSize: '11px', padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontFamily: 'Montserrat, sans-serif' }}>
                          <option value="">Doc Type…</option>
                          {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input placeholder="Label *" value={docForm.doc_label} onChange={e => setDocForm(f => ({...f, doc_label: e.target.value}))}
                          style={{ fontSize: '11px', padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontFamily: 'Montserrat, sans-serif' }}/>
                        <input placeholder="SharePoint URL" value={docForm.sharepoint_url} onChange={e => setDocForm(f => ({...f, sharepoint_url: e.target.value}))}
                          style={{ fontSize: '11px', padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontFamily: 'Montserrat, sans-serif' }}/>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => saveDoc(entity.id)} disabled={!docForm.doc_label}
                          style={{ fontSize: '11px', background: '#1a2744', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 14px', cursor: 'pointer', fontWeight: '600', fontFamily: 'Montserrat, sans-serif' }}>Save</button>
                        <button onClick={() => setShowDocForm(null)}
                          style={{ fontSize: '11px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '6px', padding: '5px 14px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Entity Modal */}
      {showEntityForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px', width: '540px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#1a2744', margin: '0 0 20px' }}>
              {editingEntity ? 'Edit Legal Entity' : 'New Legal Entity'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Legal Name *</label>
                <input value={form.legal_name} onChange={e => setForm(f => ({...f, legal_name: e.target.value}))} style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Legal Address</label>
                <textarea value={form.legal_address} onChange={e => setForm(f => ({...f, legal_address: e.target.value}))} rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}/>
              </div>
              <div>
                <label style={labelStyle}>Country</label>
                <select value={form.country} onChange={e => setForm(f => ({...f, country: e.target.value}))} style={inputStyle}>
                  <option value="">Select country…</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{COUNTRY_FLAGS[c]} {c}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Registration Description</label>
                  <input placeholder="e.g. KBIS Number" value={form.registration_description} onChange={e => setForm(f => ({...f, registration_description: e.target.value}))} style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Registration Value</label>
                  <input placeholder="e.g. 123 456 789" value={form.registration_value} onChange={e => setForm(f => ({...f, registration_value: e.target.value}))} style={inputStyle}/>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={saveEntity} disabled={!form.legal_name || saving}
                style={{ flex: 1, background: '#1a2744', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                {saving ? 'Saving…' : editingEntity ? 'Save Changes' : 'Create Entity'}
              </button>
              <button onClick={() => { setShowEntityForm(false); setEditingEntity(null) }}
                style={{ flex: 1, background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </LegalLayout>
  )
}
