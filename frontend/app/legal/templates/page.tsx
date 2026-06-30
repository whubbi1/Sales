'use client'
import { LegalLayout } from '@/components/LegalLayout'
import { useEffect, useState } from 'react'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'
const FILTER_KEY = 'legal_template_filters'

interface Template {
  id: string; title: string; description: string; doc_type: string
  entity_id: string; entity_name: string; sharepoint_url: string; sort_order: number; created_at: string
}
interface Entity { id: string; legal_name: string }

const DEFAULT_FILTERS = { search: '', entity_id: '', doc_type: '' }
const EMPTY_FORM = { title: '', description: '', doc_type: '', entity_id: '', sharepoint_url: '', sort_order: 0 }

export default function LegalTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [canEdit, setCanEdit] = useState(false)
  const [currentUser, setCurrentUser] = useState({ email: '', name: '' })
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [showForm, setShowForm] = useState(false)
  const [editingTmpl, setEditingTmpl] = useState<Template | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTER_KEY)
      if (saved) setFilters(JSON.parse(saved))
    } catch {}
    const user = getStoredUser()
    if (!user) return
    setCurrentUser({ email: user.email, name: user.name })
    fetch(`${API}/settings/permissions/${user.email}`)
      .then(r => r.json())
      .then(d => setCanEdit(d.permissions?.legal?.templates?.access_mode === 'edit'))
      .catch(() => {})
    fetch(`${API}/legal/entities`).then(r => r.json()).then(d => setEntities(d.entities || []))
    fetch(`${API}/legal/templates`).then(r => r.json()).then(d => { setTemplates(d.templates || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const updateFilter = (key: string, value: string) => {
    const next = { ...filters, [key]: value }
    setFilters(next)
    localStorage.setItem(FILTER_KEY, JSON.stringify(next))
  }

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS)
    localStorage.removeItem(FILTER_KEY)
  }

  const reload = () =>
    fetch(`${API}/legal/templates`).then(r => r.json()).then(d => setTemplates(d.templates || []))

  const saveTemplate = async () => {
    setSaving(true)
    const method = editingTmpl ? 'PUT' : 'POST'
    const url = editingTmpl ? `${API}/legal/templates/${editingTmpl.id}` : `${API}/legal/templates`
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, created_by: currentUser.email, updated_by: currentUser.email }) })
    setShowForm(false); setEditingTmpl(null); setSaving(false); reload()
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return
    await fetch(`${API}/legal/templates/${id}`, { method: 'DELETE' })
    reload()
  }

  const docTypes = Array.from(new Set(templates.map(t => t.doc_type).filter(Boolean)))

  const displayed = templates.filter(t => {
    if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase()) && !(t.doc_type || '').toLowerCase().includes(filters.search.toLowerCase())) return false
    if (filters.entity_id && t.entity_id !== filters.entity_id) return false
    if (filters.doc_type && t.doc_type !== filters.doc_type) return false
    return true
  })

  const hasFilter = !!(filters.search || filters.entity_id || filters.doc_type)

  const inp: React.CSSProperties = { fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif' }
  const modal_inp: React.CSSProperties = { width: '100%', fontSize: '13px', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', display: 'block', marginBottom: '4px' }

  if (loading) return <LegalLayout><div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</div></LegalLayout>

  return (
    <LegalLayout>
      <div style={{ padding: '32px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Template Legal Documents</h1>
          <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>Standard legal document templates and SharePoint links</p>
        </div>

        {/* Filter bar + Add button */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="Search by title or type…" value={filters.search} onChange={e => updateFilter('search', e.target.value)}
            style={{ ...inp, width: '220px' }} />
          <select value={filters.entity_id} onChange={e => updateFilter('entity_id', e.target.value)} style={{ ...inp, width: '190px' }}>
            <option value="">All entities</option>
            {entities.map(e => <option key={e.id} value={e.id}>{e.legal_name}</option>)}
          </select>
          <select value={filters.doc_type} onChange={e => updateFilter('doc_type', e.target.value)} style={{ ...inp, width: '170px' }}>
            <option value="">All types</option>
            {docTypes.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {hasFilter && (
            <button onClick={clearFilters}
              style={{ ...inp, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#64748B', cursor: 'pointer', fontWeight: '600' }}>
              × Clear
            </button>
          )}
          {canEdit && (
            <button onClick={() => { setEditingTmpl(null); setForm(EMPTY_FORM); setShowForm(true) }}
              style={{ background: '#156082', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', marginLeft: 'auto' }}>
              + Add Template
            </button>
          )}
        </div>

        {/* Report table */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ background: '#FAFBFC' }}>
              <tr>
                {['Title', 'Document Type', 'Legal Entity', 'SharePoint', 'Created', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8', fontSize: '13px' }}>
                  {hasFilter ? 'No templates match the current filters.' : canEdit ? 'No templates yet. Click "+ Add Template" to create one.' : 'No templates yet.'}
                </td></tr>
              ) : displayed.map(tmpl => (
                <tr key={tmpl.id} style={{ borderBottom: '1px solid #F1F5F9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: '600', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📄</span>{tmpl.title}
                    </div>
                    {tmpl.description && <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px', paddingLeft: '20px' }}>{tmpl.description}</div>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {tmpl.doc_type
                      ? <span style={{ background: '#EFF6FF', color: '#3B82F6', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{tmpl.doc_type}</span>
                      : <span style={{ color: '#CBD5E1' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#3F3F3F' }}>
                    {tmpl.entity_name || <span style={{ color: '#CBD5E1' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {tmpl.sharepoint_url
                      ? <a href={tmpl.sharepoint_url} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#3B82F6', fontWeight: '600', textDecoration: 'none', fontSize: '11px', background: '#EFF6FF', padding: '3px 10px', borderRadius: '6px' }}>
                          Open
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      : <span style={{ color: '#CBD5E1' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{new Date(tmpl.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => { setEditingTmpl(tmpl); setForm({ title: tmpl.title, description: tmpl.description || '', doc_type: tmpl.doc_type || '', entity_id: tmpl.entity_id || '', sharepoint_url: tmpl.sharepoint_url || '', sort_order: tmpl.sort_order || 0 }); setShowForm(true) }}
                          style={{ fontSize: '11px', color: '#64748B', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>Edit</button>
                        <button onClick={() => deleteTemplate(tmpl.id)}
                          style={{ fontSize: '11px', color: '#EF4444', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>Del</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => { setShowForm(false); setEditingTmpl(null) }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px', width: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#156082', margin: '0 0 20px' }}>
              {editingTmpl ? 'Edit Template' : 'New Template'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={lbl}>Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={modal_inp} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={lbl}>Document Type</label>
                  <input placeholder="e.g. Employment Contract" value={form.doc_type} onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))} style={modal_inp} />
                </div>
                <div>
                  <label style={lbl}>Legal Entity</label>
                  <select value={form.entity_id} onChange={e => setForm(f => ({ ...f, entity_id: e.target.value }))} style={modal_inp}>
                    <option value="">— Select entity —</option>
                    {entities.map(e => <option key={e.id} value={e.id}>{e.legal_name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                  style={{ ...modal_inp, resize: 'vertical' }} />
              </div>
              <div>
                <label style={lbl}>SharePoint URL</label>
                <input placeholder="https://wcomply.sharepoint.com/…" value={form.sharepoint_url} onChange={e => setForm(f => ({ ...f, sharepoint_url: e.target.value }))} style={modal_inp} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={saveTemplate} disabled={!form.title || saving}
                style={{ flex: 1, background: '#156082', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', opacity: (!form.title || saving) ? 0.6 : 1 }}>
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
