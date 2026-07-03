'use client'
import { useState, useEffect } from 'react'
import ITLayout, { useITPerm } from '@/components/ITLayout'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn } from '@/components/it/ReportBuilder'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const COLUMNS: ReportColumn[] = [
  { key: 'name', label: 'Software Name', filterable: 'text' },
  { key: 'editor', label: 'Editor', filterable: 'text' },
  { key: 'version', label: 'Version', filterable: 'text' },
  { key: 'install_link', label: 'Installation Files' },
  { key: 'owner_name', label: 'Owner', filterable: 'text' },
  { key: 'location_name', label: 'Location', filterable: 'text' },
]

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

const EMPTY_FORM = { name: '', editor: '', version: '', install_link: '', owner_email: '', owner_name: '', location_id: '', location_name: 'All' }

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

function withDefaults(base: any, initial?: any) {
  if (!initial) return base
  const out = { ...base }
  for (const k of Object.keys(base)) {
    if (initial[k] !== undefined && initial[k] !== null) out[k] = initial[k]
  }
  return out
}

function NewSoftwareModal({ users, locations, initial, title, submitLabel, onClose, onSave }: any) {
  const [form, setForm] = useState<any>(() => withDefaults(EMPTY_FORM, initial))
  const [saving, setSaving] = useState(false)
  const valid = form.name.trim().length > 0
  const handleOwnerChange = (email: string) => {
    const u = users.find((uu: any) => uu.email === email)
    setForm((f: any) => ({ ...f, owner_email: email, owner_name: u?.display_name || (u ? `${u.first_name} ${u.last_name}` : '') }))
  }
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
      <div style={{ background: 'white', borderRadius: '14px', width: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>{title || 'New Software'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Software Name *</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Software Editor</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.editor} onChange={e => setForm((f: any) => ({ ...f, editor: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Software Version</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.version} onChange={e => setForm((f: any) => ({ ...f, version: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={lbl}>Link to Installation Files</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder="https://…" value={form.install_link} onChange={e => setForm((f: any) => ({ ...f, install_link: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Owner of the Solution</label>
            <select style={{ ...inp, width: '100%' }} value={form.owner_email} onChange={e => handleOwnerChange(e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Location</label>
            <select style={{ ...inp, width: '100%' }} value={form.location_id} onChange={e => handleLocationChange(e.target.value)}>
              <option value="">All</option>
              {locations.map((l: any) => <option key={l.id} value={l.id}>{l.location_name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
            <button onClick={submit} disabled={saving || !valid}
              style={{ padding: '9px 18px', background: saving || !valid ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              {saving ? 'Saving…' : (submitLabel || 'Create Software')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditableOwner({ item, users, editing, onStartEdit, onSave }: any) {
  if (!editing) {
    return (
      <div onClick={onStartEdit} title="Click to edit"
        style={{ fontSize: '12px', color: '#3F3F3F', cursor: 'pointer', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        {item.owner_name || item.owner_email || <span style={{ color: '#94A3B8' }}>—</span>}
      </div>
    )
  }
  return (
    <select autoFocus style={inp} defaultValue={item.owner_email || ''}
      onChange={e => {
        const email = e.target.value
        const u = users.find((uu: any) => uu.email === email)
        onSave({ owner_email: email, owner_name: u?.display_name || (u ? `${u.first_name} ${u.last_name}` : '') })
      }}
      onBlur={onStartEdit}>
      <option value="">Unassigned</option>
      {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
    </select>
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

function SoftwareContent() {
  const { canEdit } = useITPerm()
  const [software, setSoftware] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editItem, setEditItem] = useState<any | null>(null)
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null)
  const [search, setSearch] = useState('')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    load()
    fetch(`${API}/settings/users`).then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
    fetch(`${API}/legal/locations`).then(r => r.json()).then(d => setLocations(d.locations || [])).catch(() => {})
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  const rb = useReportBuilder('software', COLUMNS, userEmail)

  const load = async () => {
    setLoading(true)
    const d = await fetch(`${API}/it/software`).then(r => r.json()).catch(() => ({ software: [] }))
    setSoftware(d.software || [])
    setLoading(false)
  }

  const searched = software.filter(s => !search || `${s.name} ${s.editor}`.toLowerCase().includes(search.toLowerCase()))
  const filtered = applyReport(searched, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  const createItem = async (form: any) => {
    await fetch(`${API}/it/software`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setShowNew(false)
    load()
  }

  const patchItem = async (item: any, fields: any) => {
    await fetch(`${API}/it/software/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: item.name, editor: item.editor, version: item.version, install_link: item.install_link, owner_email: item.owner_email, owner_name: item.owner_name, location_id: item.location_id, location_name: item.location_name, ...fields }),
    })
    setEditing(null)
    load()
  }

  const deleteItem = async (item: any) => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    await fetch(`${API}/it/software/${item.id}`, { method: 'DELETE' })
    load()
  }

  const saveEditItem = async (form: any) => {
    await patchItem(editItem, form)
    setEditItem(null)
  }

  const isEditing = (id: string, field: string) => editing?.id === id && editing.field === field

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>💿 Software</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{filtered.length} software solution{filtered.length !== 1 ? 's' : ''} used by WCOMPLY · click any field to edit</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ReportPanel columns={COLUMNS} rb={rb} />
          {canEdit && (
            <button onClick={() => setShowNew(true)} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>+ New Software</button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <input style={{ ...inp, width: '260px' }} placeholder="Search name or editor…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflowX: 'auto', overflowY: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', maxWidth: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {COLUMNS.filter(c => isVisible(c.key)).map(c => (
                <th key={c.key} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>{c.label}</th>
              ))}
              {canEdit && <th style={{ padding: '10px 12px', borderBottom: '1px solid #EDF2F7' }} />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No software solutions recorded yet.</td></tr>
            ) : filtered.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                {isVisible('name') && (
                  <td style={{ padding: '10px 12px', minWidth: '160px', fontWeight: '700', color: '#156082' }}>
                    <EditableCell display={item.name} editing={isEditing(item.id, 'name')} onStartEdit={() => canEdit && setEditing({ id: item.id, field: 'name' })}>
                      <input autoFocus style={inp} defaultValue={item.name} onBlur={e => patchItem(item, { name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('editor') && (
                  <td style={{ padding: '10px 12px', minWidth: '140px' }}>
                    <EditableCell display={item.editor} editing={isEditing(item.id, 'editor')} onStartEdit={() => canEdit && setEditing({ id: item.id, field: 'editor' })}>
                      <input autoFocus style={inp} defaultValue={item.editor} onBlur={e => patchItem(item, { editor: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('version') && (
                  <td style={{ padding: '10px 12px', minWidth: '100px' }}>
                    <EditableCell display={item.version} editing={isEditing(item.id, 'version')} onStartEdit={() => canEdit && setEditing({ id: item.id, field: 'version' })}>
                      <input autoFocus style={inp} defaultValue={item.version} onBlur={e => patchItem(item, { version: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('install_link') && (
                  <td style={{ padding: '10px 12px', minWidth: '160px' }}>
                    <EditableCell display={item.install_link ? <a href={item.install_link} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6' }} onClick={e => e.stopPropagation()}>🔗 Link</a> : null}
                      editing={isEditing(item.id, 'install_link')} onStartEdit={() => canEdit && setEditing({ id: item.id, field: 'install_link' })}>
                      <input autoFocus style={inp} defaultValue={item.install_link} onBlur={e => patchItem(item, { install_link: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('owner_name') && (
                  <td style={{ padding: '10px 12px', minWidth: '160px' }}>
                    <EditableOwner item={item} users={users} editing={isEditing(item.id, 'owner')}
                      onStartEdit={() => canEdit && setEditing(editing?.id === item.id && editing?.field === 'owner' ? null : { id: item.id, field: 'owner' })}
                      onSave={(fields: any) => patchItem(item, fields)} />
                  </td>
                )}
                {isVisible('location_name') && (
                  <td style={{ padding: '10px 12px', minWidth: '120px' }}>
                    <EditableLocation item={item} locations={locations} editing={isEditing(item.id, 'location')}
                      onStartEdit={() => canEdit && setEditing(editing?.id === item.id && editing?.field === 'location' ? null : { id: item.id, field: 'location' })}
                      onSave={(fields: any) => patchItem(item, fields)} />
                  </td>
                )}
                {canEdit && (
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setEditItem(item)} style={{ padding: '5px 10px', marginRight: '6px', background: '#EFF6FF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#156082', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Edit</button>
                    <button onClick={() => deleteItem(item)} style={{ padding: '5px 10px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#EF4444', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && <NewSoftwareModal users={users} locations={locations} onClose={() => setShowNew(false)} onSave={createItem} />}
      {editItem && (
        <NewSoftwareModal users={users} locations={locations} initial={editItem} title="Edit Software" submitLabel="Save Changes"
          onClose={() => setEditItem(null)} onSave={saveEditItem} />
      )}
    </div>
  )
}

export default function SoftwarePage() {
  return <ITLayout><SoftwareContent /></ITLayout>
}
