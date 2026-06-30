'use client'
import { LegalLayout } from '@/components/LegalLayout'
import { useEffect, useState } from 'react'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const COUNTRIES = ['France', 'Portugal', 'Czech Republic', 'Romania', 'Spain']
const COUNTRY_FLAGS: Record<string, string> = {
  France: '🇫🇷', Portugal: '🇵🇹', 'Czech Republic': '🇨🇿', Romania: '🇷🇴', Spain: '🇪🇸', global: '🌍'
}

interface Template {
  id: string; title: string; description: string; doc_type: string
  country: string; sharepoint_url: string; sort_order: number; created_at: string
}

const EMPTY_FORM = { title: '', description: '', doc_type: '', country: 'global', sharepoint_url: '', sort_order: 0 }

export default function LegalTemplatesPage() {
  const [templates,      setTemplates]      = useState<Template[]>([])
  const [loading,     setLoading]     = useState(true)
  const [canEdit,     setCanEdit]     = useState(false)
  const [currentUser, setCurrentUser] = useState({ email: '', name: '' })
  const [filter,         setFilter]         = useState('all')
  const [showForm,       setShowForm]       = useState(false)
  const [editingTmpl,    setEditingTmpl]    = useState<Template | null>(null)
  const [form,           setForm]           = useState(EMPTY_FORM)
  const [saving,         setSaving]         = useState(false)

  const load = (country?: string) => {
    const qs = country && country !== 'all' ? `?country=${encodeURIComponent(country)}` : ''
    fetch(`${API}/legal/templates${qs}`)
      .then(r => r.json())
      .then(d => { setTemplates(d.templates || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    const user = getStoredUser()
    if (!user) return // LegalLayout handles redirect
    setCurrentUser({ email: user.email, name: user.name })
    fetch(`${API}/settings/permissions/${user.email}`)
      .then(r => r.json())
      .then(d => { setCanEdit(d.permissions?.legal?.templates?.access_mode === 'edit') })
      .catch(() => {})
    load()
  }, [])

  useEffect(() => { load(filter) }, [filter])

  const saveTemplate = async () => {
    setSaving(true)
    const method = editingTmpl ? 'PUT' : 'POST'
    const url    = editingTmpl ? `${API}/legal/templates/${editingTmpl.id}` : `${API}/legal/templates`
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, created_by: currentUser.email, updated_by: currentUser.email }) })
    setShowForm(false); setEditingTmpl(null); setSaving(false); load(filter)
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return
    await fetch(`${API}/legal/templates/${id}`, { method: 'DELETE' })
    load(filter)
  }

  const inputStyle: React.CSSProperties = { width: '100%', fontSize: '13px', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', display: 'block', marginBottom: '4px' }

  if (loading) return <LegalLayout><div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</div></LegalLayout>

  const displayed = filter === 'all' ? templates : templates.filter(t => t.country === filter || t.country === 'global')

  return (
    <LegalLayout>
      <div style={{ padding: '32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Template Legal Documents</h1>
            <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>Standard legal document templates and SharePoint links</p>
          </div>
          {canEdit && (
            <button onClick={() => { setEditingTmpl(null); setForm(EMPTY_FORM); setShowForm(true) }}
              style={{ background: '#1a2744', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
              + Add Template
            </button>
          )}
        </div>

        {/* Country filter */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {['all', ...COUNTRIES].map(c => (
            <button key={c} onClick={() => setFilter(c)}
              style={{ fontSize: '11px', fontWeight: '600', padding: '5px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
                background: filter === c ? '#1a2744' : '#EDF2F7', color: filter === c ? 'white' : '#64748B' }}>
              {c === 'all' ? '🌍 All Countries' : `${COUNTRY_FLAGS[c] || ''} ${c}`}
            </button>
          ))}
        </div>

        {/* Templates grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
          {displayed.length === 0 && (
            <div style={{ gridColumn: '1/-1', background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
              No templates yet.{canEdit ? ' Click "Add Template" to create one.' : ''}
            </div>
          )}
          {displayed.map(tmpl => (
            <div key={tmpl.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <span style={{ fontSize: '26px' }}>📄</span>
                {tmpl.country && tmpl.country !== 'global' && (
                  <span style={{ fontSize: '10px', background: '#EFF6FF', color: '#3B82F6', padding: '2px 8px', borderRadius: '20px', fontWeight: '600' }}>
                    {COUNTRY_FLAGS[tmpl.country] || ''} {tmpl.country}
                  </span>
                )}
                {tmpl.country === 'global' && filter === 'all' && (
                  <span style={{ fontSize: '10px', background: '#F1F5F9', color: '#64748B', padding: '2px 8px', borderRadius: '20px', fontWeight: '600' }}>🌍 All countries</span>
                )}
              </div>
              <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', margin: '0 0 4px' }}>{tmpl.title}</h3>
              {tmpl.doc_type && <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{tmpl.doc_type}</div>}
              {tmpl.description && <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 12px', lineHeight: 1.6, flex: 1 }}>{tmpl.description}</p>}
              <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                {tmpl.sharepoint_url && (
                  <a href={tmpl.sharepoint_url} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: '#3B82F6', background: '#EFF6FF', borderRadius: '6px', padding: '6px', fontWeight: '700', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    Open
                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>
                )}
                {canEdit && <>
                  <button onClick={() => { setEditingTmpl(tmpl); setForm({ title: tmpl.title, description: tmpl.description || '', doc_type: tmpl.doc_type || '', country: tmpl.country || 'global', sharepoint_url: tmpl.sharepoint_url || '', sort_order: tmpl.sort_order || 0 }); setShowForm(true) }}
                    style={{ fontSize: '11px', color: '#64748B', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>Edit</button>
                  <button onClick={() => deleteTemplate(tmpl.id)}
                    style={{ fontSize: '11px', color: '#EF4444', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>Del</button>
                </>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Template Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px', width: '500px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#1a2744', margin: '0 0 20px' }}>
              {editingTmpl ? 'Edit Template' : 'New Template'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} style={inputStyle}/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Document Type</label>
                  <input placeholder="e.g. Employment Contract" value={form.doc_type} onChange={e => setForm(f => ({...f, doc_type: e.target.value}))} style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Country</label>
                  <select value={form.country} onChange={e => setForm(f => ({...f, country: e.target.value}))} style={inputStyle}>
                    <option value="global">🌍 All Countries</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{COUNTRY_FLAGS[c]} {c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}/>
              </div>
              <div>
                <label style={labelStyle}>SharePoint URL</label>
                <input placeholder="https://wcomply.sharepoint.com/..." value={form.sharepoint_url} onChange={e => setForm(f => ({...f, sharepoint_url: e.target.value}))} style={inputStyle}/>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={saveTemplate} disabled={!form.title || saving}
                style={{ flex: 1, background: '#1a2744', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                {saving ? 'Saving…' : editingTmpl ? 'Save Changes' : 'Create Template'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingTmpl(null) }}
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
