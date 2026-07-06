'use client'
import { useState, useEffect } from 'react'
import ITLayout, { useITPerm } from '@/components/ITLayout'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, ColumnResizeHandle } from '@/components/it/ReportBuilder'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

const CATEGORIES = ['WCOMPLY Internal Tools', 'Partner Portals']

const EMPTY_FORM = { label: '', url: '', icon: '🔗', active: true, sort_order: 0, location_id: '', location_name: 'All', category: '' }

const COLUMNS: ReportColumn[] = [
  { key: 'icon', label: 'Icon' },
  { key: 'label', label: 'Label', filterable: 'text' },
  { key: 'url', label: 'URL', filterable: 'text' },
  { key: 'category_display', label: 'Category', filterable: 'select', options: [...CATEGORIES, 'Uncategorized'] },
  { key: 'location_name', label: 'Location', filterable: 'text' },
  { key: 'active_display', label: 'Active', filterable: 'select', options: ['Active', 'Inactive'] },
]

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  icon: 70, label: 160, url: 240, category_display: 170, location_name: 130, active_display: 100,
}

function EditableCell({ display, editing, onStartEdit, children }: any) {
  return editing ? children : (
    <div onClick={onStartEdit} title="Click to edit"
      style={{ fontSize: '12px', color: '#3F3F3F', cursor: 'pointer', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {display || <span style={{ color: '#94A3B8' }}>—</span>}
    </div>
  )
}

function NewLinkModal({ locations, onClose, onSave }: any) {
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const valid = form.label.trim().length > 0 && form.url.trim().length > 0

  const handleLocationChange = (locationId: string) => {
    if (!locationId) { setForm((f: any) => ({ ...f, location_id: '', location_name: 'All' })); return }
    const loc = locations.find((l: any) => l.id === locationId)
    setForm((f: any) => ({ ...f, location_id: locationId, location_name: loc?.location_name || 'All' }))
  }
  const submit = async () => {
    if (!valid) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '480px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>New Company Link</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Icon</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.icon} onChange={e => setForm((f: any) => ({ ...f, icon: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Label *</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder="e.g. Intranet" value={form.label} onChange={e => setForm((f: any) => ({ ...f, label: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={lbl}>URL *</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder="https://…" value={form.url} onChange={e => setForm((f: any) => ({ ...f, url: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Location</label>
            <select style={{ ...inp, width: '100%' }} value={form.location_id} onChange={e => handleLocationChange(e.target.value)}>
              <option value="">All</option>
              {locations.map((l: any) => <option key={l.id} value={l.id}>{l.location_name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Category</label>
            <select style={{ ...inp, width: '100%' }} value={form.category} onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))}>
              <option value="">Uncategorized</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
            <button onClick={submit} disabled={saving || !valid}
              style={{ padding: '9px 18px', background: saving || !valid ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              {saving ? 'Creating…' : 'Create Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditableLocation({ item, locations, editing, onStartEdit, onSave }: any) {
  if (!editing) {
    const isAll = !item.location_name || item.location_name === 'All'
    return (
      <div onClick={onStartEdit} title="Click to edit" style={{ cursor: 'pointer', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        <span style={{ background: isAll ? '#EEF2FF' : '#F1F5F9', color: isAll ? '#156082' : '#3F3F3F', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{item.location_name || 'All'}</span>
      </div>
    )
  }
  return (
    <select autoFocus style={inp} defaultValue={item.location_id || ''}
      onChange={e => {
        const locationId = e.target.value
        if (!locationId) { onSave({ location_id: '', location_name: 'All' }); return }
        const loc = locations.find((l: any) => l.id === locationId)
        onSave({ location_id: locationId, location_name: loc?.location_name || 'All' })
      }}
      onBlur={onStartEdit}>
      <option value="">All</option>
      {locations.map((l: any) => <option key={l.id} value={l.id}>{l.location_name}</option>)}
    </select>
  )
}

function CompanyLinksContent() {
  const { canEdit } = useITPerm()
  const [links, setLinks] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    load()
    fetch(`${API}/legal/locations`).then(r => r.json()).then(d => setLocations(d.locations || [])).catch(() => {})
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  const rb = useReportBuilder('company-link', COLUMNS, userEmail)

  const load = async () => {
    setLoading(true)
    const d = await fetch(`${API}/settings/company-links/all`).then(r => r.json()).catch(() => ({ links: [] }))
    setLinks(d.links || [])
    setLoading(false)
  }

  const withDisplay = links.map(l => ({ ...l, category_display: l.category || 'Uncategorized', active_display: l.active ? 'Active' : 'Inactive' }))
  const reported = applyReport(withDisplay, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  const createItem = async (form: any) => {
    await fetch(`${API}/settings/company-links`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setShowNew(false)
    load()
  }

  const patchItem = async (item: any, fields: any) => {
    await fetch(`${API}/settings/company-links/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: item.label, url: item.url, icon: item.icon, active: item.active, sort_order: item.sort_order, location_id: item.location_id, location_name: item.location_name, category: item.category, ...fields }),
    })
    setEditing(null)
    load()
  }

  const deleteItem = async (item: any) => {
    if (!confirm(`Delete "${item.label}"? This cannot be undone.`)) return
    await fetch(`${API}/settings/company-links/${item.id}`, { method: 'DELETE' })
    load()
  }

  const isEditing = (id: string, field: string) => editing?.id === id && editing.field === field
  const toggleEdit = (id: string, field: string) => canEdit && setEditing(isEditing(id, field) ? null : { id, field })

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>🔗 Company Links</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{reported.length} link{reported.length !== 1 ? 's' : ''} shown on the home page · click any field to edit</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ReportPanel columns={COLUMNS} rb={rb} />
          {canEdit && (
            <button onClick={() => setShowNew(true)} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>+ New Link</button>
          )}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflowX: 'auto', overflowY: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', maxWidth: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {COLUMNS.filter(c => isVisible(c.key)).map(c => (
                <th key={c.key} style={{ position: 'relative', padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: `${rb.columnWidths[c.key] || DEFAULT_COLUMN_WIDTHS[c.key] || 150}px` }}>
                  {c.label}
                  <ColumnResizeHandle colKey={c.key} rb={rb} />
                </th>
              ))}
              {canEdit && <th style={{ padding: '10px 12px', borderBottom: '1px solid #EDF2F7', width: '90px' }} />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : reported.length === 0 ? (
              <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No company links yet.</td></tr>
            ) : reported.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                {isVisible('icon') && (
                  <td style={{ padding: '10px 12px', fontSize: '16px' }}>
                    <EditableCell display={item.icon} editing={isEditing(item.id, 'icon')} onStartEdit={() => toggleEdit(item.id, 'icon')}>
                      <input autoFocus style={inp} defaultValue={item.icon} onBlur={e => patchItem(item, { icon: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('label') && (
                  <td style={{ padding: '10px 12px', fontWeight: '700', color: '#156082' }}>
                    <EditableCell display={item.label} editing={isEditing(item.id, 'label')} onStartEdit={() => toggleEdit(item.id, 'label')}>
                      <input autoFocus style={inp} defaultValue={item.label} onBlur={e => patchItem(item, { label: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('url') && (
                  <td style={{ padding: '10px 12px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <EditableCell display={item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6' }} onClick={e => e.stopPropagation()}>{item.url}</a> : null}
                      editing={isEditing(item.id, 'url')} onStartEdit={() => toggleEdit(item.id, 'url')}>
                      <input autoFocus style={{ ...inp, width: '220px' }} defaultValue={item.url} onBlur={e => patchItem(item, { url: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('category_display') && (
                  <td style={{ padding: '10px 12px' }}>
                    {isEditing(item.id, 'category') ? (
                      <select autoFocus style={inp} defaultValue={item.category || ''} onChange={e => patchItem(item, { category: e.target.value || null })} onBlur={() => setEditing(null)}>
                        <option value="">Uncategorized</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <div onClick={() => toggleEdit(item.id, 'category')} title="Click to edit"
                        style={{ cursor: canEdit ? 'pointer' : 'default', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {item.category ? <span style={{ background: '#F5F3FF', color: '#7C3AED', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{item.category}</span> : <span style={{ color: '#94A3B8' }}>Uncategorized</span>}
                      </div>
                    )}
                  </td>
                )}
                {isVisible('location_name') && (
                  <td style={{ padding: '10px 12px' }}>
                    <EditableLocation item={item} locations={locations} editing={isEditing(item.id, 'location')}
                      onStartEdit={() => toggleEdit(item.id, 'location')} onSave={(fields: any) => patchItem(item, fields)} />
                  </td>
                )}
                {isVisible('active_display') && (
                  <td style={{ padding: '10px 12px' }}>
                    <EditableCell display={<span style={{ background: item.active ? '#ECFDF5' : '#FEF2F2', color: item.active ? '#059669' : '#DC2626', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{item.active ? 'Active' : 'Inactive'}</span>}
                      editing={isEditing(item.id, 'active')} onStartEdit={() => toggleEdit(item.id, 'active')}>
                      <select autoFocus style={inp} defaultValue={item.active ? 'true' : 'false'} onChange={e => patchItem(item, { active: e.target.value === 'true' })} onBlur={() => setEditing(null)}>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </EditableCell>
                  </td>
                )}
                {canEdit && (
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => deleteItem(item)} style={{ padding: '5px 10px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#EF4444', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && <NewLinkModal locations={locations} onClose={() => setShowNew(false)} onSave={createItem} />}
    </div>
  )
}

export default function CompanyLinksPage() {
  return <ITLayout><CompanyLinksContent /></ITLayout>
}
