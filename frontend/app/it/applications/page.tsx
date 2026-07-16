'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ITLayout, { useITPerm } from '@/components/ITLayout'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, ColumnResizeHandle, SortArrow, Pagination } from '@/components/it/ReportBuilder'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const USE_OPTIONS = ['Demo', 'Production', 'Development']

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

const EMPTY_FORM = { name: '', editor: '', version: '', use: '', owner_email: '', owner_name: '', all_locations: true, location_ids: [] as string[], location_names: [] as string[] }

const COLUMNS: ReportColumn[] = [
  { key: 'name', label: 'Application Name', filterable: 'text' },
  { key: 'editor', label: 'Editor', filterable: 'text' },
  { key: 'version', label: 'Version', filterable: 'text' },
  { key: 'use', label: 'Use', filterable: 'select', options: USE_OPTIONS },
  { key: 'owner_name', label: 'Owner', filterable: 'text' },
  { key: 'locations_display', label: 'Locations', filterable: 'text' },
]

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  name: 200, editor: 150, version: 100, use: 130, owner_name: 170, locations_display: 170,
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

function LocationChecklist({ allLocations, selectedIds, locations, onToggleAll, onToggleLocation }: any) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', marginBottom: '6px', background: allLocations ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${allLocations ? '#156082' : '#E2E8F0'}`, borderRadius: '8px', fontSize: '11px', cursor: 'pointer', color: allLocations ? '#156082' : '#64748B', fontWeight: '700' }}>
        <input type="checkbox" checked={allLocations} onChange={onToggleAll} style={{ margin: 0 }} />
        All Locations
      </label>
      {!allLocations && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {locations.map((l: any) => (
            <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: selectedIds.includes(l.id) ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${selectedIds.includes(l.id) ? '#156082' : '#E2E8F0'}`, borderRadius: '14px', fontSize: '11px', cursor: 'pointer', color: selectedIds.includes(l.id) ? '#156082' : '#64748B' }}>
              <input type="checkbox" checked={selectedIds.includes(l.id)} onChange={() => onToggleLocation(l.id)} style={{ margin: 0 }} />
              {l.location_name}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function NewApplicationModal({ users, locations, onClose, onSave }: any) {
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const valid = form.name.trim().length > 0

  const handleOwnerChange = (email: string) => {
    const u = users.find((uu: any) => uu.email === email)
    setForm((f: any) => ({ ...f, owner_email: email, owner_name: u?.display_name || (u ? `${u.first_name} ${u.last_name}` : '') }))
  }
  const toggleAll = () => setForm((f: any) => ({ ...f, all_locations: !f.all_locations, location_ids: [], location_names: [] }))
  const toggleLocation = (id: string) => {
    setForm((f: any) => {
      const has = f.location_ids.includes(id)
      const ids = has ? f.location_ids.filter((x: string) => x !== id) : [...f.location_ids, id]
      const names = ids.map((i: string) => locations.find((l: any) => l.id === i)?.location_name).filter(Boolean)
      return { ...f, location_ids: ids, location_names: names }
    })
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
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>New Application</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Application Name *</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Editor Name</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.editor} onChange={e => setForm((f: any) => ({ ...f, editor: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Version</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.version} onChange={e => setForm((f: any) => ({ ...f, version: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={lbl}>Use</label>
            <select style={{ ...inp, width: '100%' }} value={form.use} onChange={e => setForm((f: any) => ({ ...f, use: e.target.value }))}>
              <option value="">Select…</option>
              {USE_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Owner of the Application</label>
            <select style={{ ...inp, width: '100%' }} value={form.owner_email} onChange={e => handleOwnerChange(e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Locations Using the Application</label>
            <LocationChecklist allLocations={form.all_locations} selectedIds={form.location_ids} locations={locations} onToggleAll={toggleAll} onToggleLocation={toggleLocation} />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
            <button onClick={submit} disabled={saving || !valid}
              style={{ padding: '9px 18px', background: saving || !valid ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              {saving ? 'Creating…' : 'Create Application'}
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

function EditableLocations({ item, locations, editing, onStartEdit, onSave }: any) {
  const [draftAll, setDraftAll] = useState<boolean>(item.all_locations)
  const [draftIds, setDraftIds] = useState<string[]>(item.location_ids || [])
  useEffect(() => { setDraftAll(item.all_locations); setDraftIds(item.location_ids || []) }, [editing])

  if (!editing) {
    return (
      <div onClick={onStartEdit} title="Click to edit" style={{ cursor: 'pointer', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        {item.all_locations ? (
          <span style={{ background: '#EEF2FF', color: '#156082', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>All</span>
        ) : (item.location_names || []).length > 0 ? (
          <span style={{ fontSize: '12px', color: '#3F3F3F' }}>{(item.location_names || []).join(', ')}</span>
        ) : (
          <span style={{ color: '#94A3B8' }}>—</span>
        )}
      </div>
    )
  }

  const toggleAll = () => { setDraftAll(a => !a); setDraftIds([]) }
  const toggleLoc = (id: string) => setDraftIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id])
  const names = draftIds.map(i => locations.find((l: any) => l.id === i)?.location_name).filter(Boolean)

  return (
    <div style={{ minWidth: '240px' }}>
      <LocationChecklist allLocations={draftAll} selectedIds={draftIds} locations={locations} onToggleAll={toggleAll} onToggleLocation={toggleLoc} />
      <button onClick={() => onSave({ all_locations: draftAll, location_ids: draftAll ? [] : draftIds, location_names: draftAll ? [] : names })}
        style={{ marginTop: '6px', padding: '4px 10px', background: '#156082', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
        Done
      </button>
    </div>
  )
}

function ApplicationsContent() {
  const router = useRouter()
  const { canEdit } = useITPerm()
  const [applications, setApplications] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
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

  const rb = useReportBuilder('application', COLUMNS, userEmail)

  const load = async () => {
    setLoading(true)
    const d = await fetch(`${API}/it/applications`).then(r => r.json()).catch(() => ({ applications: [] }))
    setApplications(d.applications || [])
    setLoading(false)
  }

  const withDisplay = applications.map(a => ({ ...a, locations_display: a.all_locations ? 'All' : (a.location_names || []).join(', ') }))
  const searched = withDisplay.filter(a => !search || `${a.name} ${a.editor}`.toLowerCase().includes(search.toLowerCase()))
  const reported = applyReport(searched, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const pageRows = reported.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  const createItem = async (form: any) => {
    await fetch(`${API}/it/applications`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setShowNew(false)
    load()
  }

  const patchItem = async (item: any, fields: any) => {
    await fetch(`${API}/it/applications/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: item.name, editor: item.editor, version: item.version, use: item.use,
        owner_email: item.owner_email, owner_name: item.owner_name,
        all_locations: item.all_locations, location_ids: item.location_ids, location_names: item.location_names,
        ...fields,
      }),
    })
    setEditing(null)
    load()
  }

  const deleteItem = async (item: any) => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    await fetch(`${API}/it/applications/${item.id}`, { method: 'DELETE' })
    load()
  }

  const isEditing = (id: string, field: string) => editing?.id === id && editing.field === field
  const toggleEdit = (id: string, field: string) => canEdit && setEditing(isEditing(id, field) ? null : { id, field })

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>🧩 Applications</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{reported.length} application{reported.length !== 1 ? 's' : ''} used by WCOMPLY · click any field to edit</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ReportPanel columns={COLUMNS} rb={rb} />
          {canEdit && (
            <button onClick={() => setShowNew(true)} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>+ New Application</button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <input style={{ ...inp, width: '260px' }} placeholder="Search name or editor…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflowX: 'auto', overflowY: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', maxWidth: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {COLUMNS.filter(c => isVisible(c.key)).map(c => (
                <th key={c.key} onClick={() => rb.toggleSort(c.key)} style={{ position: 'relative', padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: `${rb.columnWidths[c.key] || DEFAULT_COLUMN_WIDTHS[c.key] || 150}px`, cursor: 'pointer', userSelect: 'none' }}>
                  {c.label}<SortArrow active={rb.sortField === c.key} dir={rb.sortDir} />
                  <ColumnResizeHandle colKey={c.key} rb={rb} />
                </th>
              ))}
              <th style={{ padding: '10px 12px', borderBottom: '1px solid #EDF2F7', width: '110px' }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : reported.length === 0 ? (
              <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No applications recorded yet.</td></tr>
            ) : pageRows.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                {isVisible('name') && (
                  <td style={{ padding: '10px 12px', minWidth: '160px', fontWeight: '700', color: '#156082' }}>
                    <EditableCell display={item.name} editing={isEditing(item.id, 'name')} onStartEdit={() => toggleEdit(item.id, 'name')}>
                      <input autoFocus style={inp} defaultValue={item.name} onBlur={e => patchItem(item, { name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('editor') && (
                  <td style={{ padding: '10px 12px', minWidth: '140px' }}>
                    <EditableCell display={item.editor} editing={isEditing(item.id, 'editor')} onStartEdit={() => toggleEdit(item.id, 'editor')}>
                      <input autoFocus style={inp} defaultValue={item.editor} onBlur={e => patchItem(item, { editor: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('version') && (
                  <td style={{ padding: '10px 12px', minWidth: '100px' }}>
                    <EditableCell display={item.version} editing={isEditing(item.id, 'version')} onStartEdit={() => toggleEdit(item.id, 'version')}>
                      <input autoFocus style={inp} defaultValue={item.version} onBlur={e => patchItem(item, { version: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('use') && (
                  <td style={{ padding: '10px 12px', minWidth: '130px' }}>
                    {isEditing(item.id, 'use') ? (
                      <select autoFocus style={inp} defaultValue={item.use || ''} onChange={e => patchItem(item, { use: e.target.value })} onBlur={() => setEditing(null)}>
                        <option value="">Select…</option>
                        {USE_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    ) : (
                      <div onClick={() => toggleEdit(item.id, 'use')} title="Click to edit"
                        style={{ cursor: 'pointer', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {item.use ? <span style={{ background: '#EEF2FF', color: '#4F46E5', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{item.use}</span> : <span style={{ color: '#94A3B8' }}>—</span>}
                      </div>
                    )}
                  </td>
                )}
                {isVisible('owner_name') && (
                  <td style={{ padding: '10px 12px', minWidth: '160px' }}>
                    <EditableOwner item={item} users={users} editing={isEditing(item.id, 'owner')}
                      onStartEdit={() => toggleEdit(item.id, 'owner')} onSave={(fields: any) => patchItem(item, fields)} />
                  </td>
                )}
                {isVisible('locations_display') && (
                  <td style={{ padding: '10px 12px', minWidth: '180px' }}>
                    <EditableLocations item={item} locations={locations} editing={isEditing(item.id, 'locations')}
                      onStartEdit={() => toggleEdit(item.id, 'locations')} onSave={(fields: any) => patchItem(item, fields)} />
                  </td>
                )}
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                  <button onClick={() => router.push(`/it/applications/${item.id}`)} style={{ padding: '5px 10px', marginRight: '6px', background: '#EFF6FF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#156082', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Details</button>
                  {canEdit && (
                    <button onClick={() => deleteItem(item)} style={{ padding: '5px 10px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#EF4444', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={rb.page} setPage={rb.setPage} total={reported.length} />
      </div>

      {showNew && <NewApplicationModal users={users} locations={locations} onClose={() => setShowNew(false)} onSave={createItem} />}
    </div>
  )
}

export default function ApplicationsPage() {
  return <ITLayout><ApplicationsContent /></ITLayout>
}
