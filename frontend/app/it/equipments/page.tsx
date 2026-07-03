'use client'
import { useState, useEffect } from 'react'
import ITLayout, { useITPerm } from '@/components/ITLayout'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn } from '@/components/it/ReportBuilder'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'
const EQUIPMENT_TYPES = ['IT', 'Furniture', 'Hardware', 'Others']

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

const EMPTY_FORM = {
  equipment_type: 'IT', name: '', serial_number: '',
  purchase_date: '', purchase_price: '',
  entry_service_date: '', planned_end_service_date: '', end_service_date: '',
  end_service_reason: '', comment: '',
  assigned_email: '', assigned_name: '',
  location_id: '', location_name: 'All',
}

const COLUMNS: ReportColumn[] = [
  { key: 'equipment_type', label: 'Type', filterable: 'select', options: EQUIPMENT_TYPES },
  { key: 'name', label: 'Name', filterable: 'text' },
  { key: 'serial_number', label: 'Serial Number', filterable: 'text' },
  { key: 'assigned_name', label: 'Assigned To', filterable: 'text' },
  { key: 'location_name', label: 'Location', filterable: 'text' },
  { key: 'purchase_date', label: 'Purchase Date' },
  { key: 'purchase_price', label: 'Purchase Price' },
  { key: 'entry_service_date', label: 'Entry into Service' },
  { key: 'planned_end_service_date', label: 'Planned End of Service' },
  { key: 'end_service_date', label: 'End of Service' },
  { key: 'end_service_reason', label: 'End of Service Reason', filterable: 'text' },
  { key: 'comment', label: 'Comment', filterable: 'text' },
  { key: 'status', label: 'Status', filterable: 'select', options: ['Active', 'End of Service'] },
]

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

function fmtDate(d: string) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
}

function withDefaults(base: any, initial?: any) {
  if (!initial) return base
  const out = { ...base }
  for (const k of Object.keys(base)) {
    if (initial[k] !== undefined && initial[k] !== null) out[k] = initial[k]
  }
  return out
}

function NewEquipmentModal({ users, locations, initial, title, submitLabel, onClose, onSave }: any) {
  const [form, setForm] = useState<any>(() => withDefaults(EMPTY_FORM, initial))
  const [saving, setSaving] = useState(false)
  const valid = form.name.trim().length > 0

  const handleAssigneeChange = (email: string) => {
    const u = users.find((uu: any) => uu.email === email)
    setForm((f: any) => ({ ...f, assigned_email: email, assigned_name: u?.display_name || (u ? `${u.first_name} ${u.last_name}` : '') }))
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
      <div style={{ background: 'white', borderRadius: '14px', width: '560px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>{title || 'New Equipment'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Type</label>
              <select style={{ ...inp, width: '100%' }} value={form.equipment_type} onChange={e => setForm((f: any) => ({ ...f, equipment_type: e.target.value }))}>
                {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Name *</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder='e.g. MacBook Pro 14"' value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Serial Number</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.serial_number} onChange={e => setForm((f: any) => ({ ...f, serial_number: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Assigned To</label>
              <select style={{ ...inp, width: '100%' }} value={form.assigned_email} onChange={e => handleAssigneeChange(e.target.value)}>
                <option value="">Unassigned</option>
                {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>Location</label>
            <select style={{ ...inp, width: '100%' }} value={form.location_id} onChange={e => handleLocationChange(e.target.value)}>
              <option value="">All</option>
              {locations.map((l: any) => <option key={l.id} value={l.id}>{l.location_name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Purchase Date</label>
              <input type="date" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.purchase_date} onChange={e => setForm((f: any) => ({ ...f, purchase_date: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Purchase Price</label>
              <input type="number" step="0.01" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder="0.00" value={form.purchase_price} onChange={e => setForm((f: any) => ({ ...f, purchase_price: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Date of Entry into Service</label>
              <input type="date" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.entry_service_date} onChange={e => setForm((f: any) => ({ ...f, entry_service_date: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Planned End of Service</label>
              <input type="date" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.planned_end_service_date} onChange={e => setForm((f: any) => ({ ...f, planned_end_service_date: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>End of Service Date</label>
              <input type="date" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.end_service_date} onChange={e => setForm((f: any) => ({ ...f, end_service_date: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>End of Service Reason</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.end_service_reason} onChange={e => setForm((f: any) => ({ ...f, end_service_reason: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={lbl}>Comment</label>
            <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '60px', resize: 'vertical' as const }} value={form.comment} onChange={e => setForm((f: any) => ({ ...f, comment: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
            <button onClick={submit} disabled={saving || !valid}
              style={{ padding: '9px 18px', background: saving || !valid ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              {saving ? 'Saving…' : (submitLabel || 'Create Equipment')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditableAssignee({ item, users, editing, onStartEdit, onSave }: any) {
  if (!editing) {
    return (
      <div onClick={onStartEdit} title="Click to edit"
        style={{ fontSize: '12px', color: '#3F3F3F', cursor: 'pointer', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        {item.assigned_name || item.assigned_email || <span style={{ color: '#94A3B8' }}>—</span>}
      </div>
    )
  }
  return (
    <select autoFocus style={inp} defaultValue={item.assigned_email || ''}
      onChange={e => {
        const email = e.target.value
        const u = users.find((uu: any) => uu.email === email)
        onSave({ assigned_email: email, assigned_name: u?.display_name || (u ? `${u.first_name} ${u.last_name}` : '') })
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

function EquipmentsContent() {
  const { canEdit } = useITPerm()
  const [equipments, setEquipments] = useState<any[]>([])
  const [users, setUsers]           = useState<any[]>([])
  const [locations, setLocations]   = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [showNew, setShowNew]       = useState(false)
  const [editItem, setEditItem]     = useState<any | null>(null)
  const [editing, setEditing]       = useState<{ id: string; field: string } | null>(null)
  const [search, setSearch]         = useState('')
  const [userEmail, setUserEmail]   = useState('')

  useEffect(() => {
    loadEquipments()
    fetch(`${API}/settings/users`).then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
    fetch(`${API}/legal/locations`).then(r => r.json()).then(d => setLocations(d.locations || [])).catch(() => {})
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  const rb = useReportBuilder('equipment', COLUMNS, userEmail)

  const loadEquipments = async () => {
    setLoading(true)
    const d = await fetch(`${API}/it/equipments`).then(r => r.json()).catch(() => ({ equipments: [] }))
    setEquipments(d.equipments || [])
    setLoading(false)
  }

  const withStatus = equipments.map(e => ({ ...e, status: e.end_service_date ? 'End of Service' : 'Active' }))
  const searched = withStatus.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    return (e.name || '').toLowerCase().includes(q) || (e.serial_number || '').toLowerCase().includes(q)
  })
  const reported = applyReport(searched, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  const createItem = async (form: any) => {
    await fetch(`${API}/it/equipments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setShowNew(false)
    loadEquipments()
  }

  const patchItem = async (item: any, fields: any) => {
    await fetch(`${API}/it/equipments/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipment_type: item.equipment_type, name: item.name, serial_number: item.serial_number,
        purchase_date: item.purchase_date, purchase_price: item.purchase_price,
        entry_service_date: item.entry_service_date, planned_end_service_date: item.planned_end_service_date,
        end_service_date: item.end_service_date, end_service_reason: item.end_service_reason, comment: item.comment,
        assigned_email: item.assigned_email, assigned_name: item.assigned_name,
        location_id: item.location_id, location_name: item.location_name,
        ...fields,
      }),
    })
    setEditing(null)
    loadEquipments()
  }

  const deleteItem = async (item: any) => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    await fetch(`${API}/it/equipments/${item.id}`, { method: 'DELETE' })
    loadEquipments()
  }

  const saveEditItem = async (form: any) => {
    await patchItem(editItem, form)
    setEditItem(null)
  }

  const isEditing = (id: string, field: string) => editing?.id === id && editing.field === field
  const toggleEdit = (id: string, field: string) => canEdit && setEditing(isEditing(id, field) ? null : { id, field })

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>🖥️ Equipments</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{reported.length} item{reported.length !== 1 ? 's' : ''} · click any field to edit</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ReportPanel columns={COLUMNS} rb={rb} />
          {canEdit && (
            <button onClick={() => setShowNew(true)} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              + New Equipment
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <input style={{ ...inp, width: '260px' }} placeholder="Search name or serial number…" value={search} onChange={e => setSearch(e.target.value)} />
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
            ) : reported.length === 0 ? (
              <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No equipment found.</td></tr>
            ) : reported.map(eq => (
              <tr key={eq.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                {isVisible('equipment_type') && (
                  <td style={{ padding: '10px 12px', minWidth: '90px' }}>
                    <EditableCell display={<span style={{ background: '#F1F5F9', color: '#3F3F3F', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{eq.equipment_type}</span>}
                      editing={isEditing(eq.id, 'equipment_type')} onStartEdit={() => toggleEdit(eq.id, 'equipment_type')}>
                      <select autoFocus style={inp} defaultValue={eq.equipment_type} onChange={e => patchItem(eq, { equipment_type: e.target.value })} onBlur={() => setEditing(null)}>
                        {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </EditableCell>
                  </td>
                )}
                {isVisible('name') && (
                  <td style={{ padding: '10px 12px', minWidth: '160px', fontWeight: '700', color: '#156082' }}>
                    <EditableCell display={eq.name} editing={isEditing(eq.id, 'name')} onStartEdit={() => toggleEdit(eq.id, 'name')}>
                      <input autoFocus style={inp} defaultValue={eq.name} onBlur={e => patchItem(eq, { name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('serial_number') && (
                  <td style={{ padding: '10px 12px', minWidth: '130px' }}>
                    <EditableCell display={eq.serial_number} editing={isEditing(eq.id, 'serial_number')} onStartEdit={() => toggleEdit(eq.id, 'serial_number')}>
                      <input autoFocus style={inp} defaultValue={eq.serial_number} onBlur={e => patchItem(eq, { serial_number: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('assigned_name') && (
                  <td style={{ padding: '10px 12px', minWidth: '150px' }}>
                    <EditableAssignee item={eq} users={users} editing={isEditing(eq.id, 'assigned')}
                      onStartEdit={() => toggleEdit(eq.id, 'assigned')} onSave={(fields: any) => patchItem(eq, fields)} />
                  </td>
                )}
                {isVisible('location_name') && (
                  <td style={{ padding: '10px 12px', minWidth: '120px' }}>
                    <EditableLocation item={eq} locations={locations} editing={isEditing(eq.id, 'location')}
                      onStartEdit={() => toggleEdit(eq.id, 'location')} onSave={(fields: any) => patchItem(eq, fields)} />
                  </td>
                )}
                {isVisible('purchase_date') && (
                  <td style={{ padding: '10px 12px', minWidth: '120px' }}>
                    <EditableCell display={fmtDate(eq.purchase_date)} editing={isEditing(eq.id, 'purchase_date')} onStartEdit={() => toggleEdit(eq.id, 'purchase_date')}>
                      <input autoFocus type="date" style={inp} defaultValue={eq.purchase_date || ''} onBlur={e => patchItem(eq, { purchase_date: e.target.value })} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('purchase_price') && (
                  <td style={{ padding: '10px 12px', minWidth: '100px' }}>
                    <EditableCell display={eq.purchase_price != null ? String(eq.purchase_price) : ''} editing={isEditing(eq.id, 'purchase_price')} onStartEdit={() => toggleEdit(eq.id, 'purchase_price')}>
                      <input autoFocus type="number" step="0.01" style={inp} defaultValue={eq.purchase_price != null ? String(eq.purchase_price) : ''} onBlur={e => patchItem(eq, { purchase_price: e.target.value })} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('entry_service_date') && (
                  <td style={{ padding: '10px 12px', minWidth: '130px' }}>
                    <EditableCell display={fmtDate(eq.entry_service_date)} editing={isEditing(eq.id, 'entry_service_date')} onStartEdit={() => toggleEdit(eq.id, 'entry_service_date')}>
                      <input autoFocus type="date" style={inp} defaultValue={eq.entry_service_date || ''} onBlur={e => patchItem(eq, { entry_service_date: e.target.value })} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('planned_end_service_date') && (
                  <td style={{ padding: '10px 12px', minWidth: '150px' }}>
                    <EditableCell display={fmtDate(eq.planned_end_service_date)} editing={isEditing(eq.id, 'planned_end_service_date')} onStartEdit={() => toggleEdit(eq.id, 'planned_end_service_date')}>
                      <input autoFocus type="date" style={inp} defaultValue={eq.planned_end_service_date || ''} onBlur={e => patchItem(eq, { planned_end_service_date: e.target.value })} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('end_service_date') && (
                  <td style={{ padding: '10px 12px', minWidth: '130px' }}>
                    <EditableCell display={fmtDate(eq.end_service_date)} editing={isEditing(eq.id, 'end_service_date')} onStartEdit={() => toggleEdit(eq.id, 'end_service_date')}>
                      <input autoFocus type="date" style={inp} defaultValue={eq.end_service_date || ''} onBlur={e => patchItem(eq, { end_service_date: e.target.value })} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('end_service_reason') && (
                  <td style={{ padding: '10px 12px', minWidth: '160px' }}>
                    <EditableCell display={eq.end_service_reason} editing={isEditing(eq.id, 'end_service_reason')} onStartEdit={() => toggleEdit(eq.id, 'end_service_reason')}>
                      <input autoFocus style={inp} defaultValue={eq.end_service_reason} onBlur={e => patchItem(eq, { end_service_reason: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('comment') && (
                  <td style={{ padding: '10px 12px', minWidth: '180px', color: '#64748B' }}>
                    <EditableCell display={eq.comment} editing={isEditing(eq.id, 'comment')} onStartEdit={() => toggleEdit(eq.id, 'comment')}>
                      <textarea autoFocus style={{ ...inp, width: '100%', minWidth: '200px', boxSizing: 'border-box' as const, minHeight: '50px', resize: 'vertical' }} defaultValue={eq.comment} onBlur={e => patchItem(eq, { comment: e.target.value })} />
                    </EditableCell>
                  </td>
                )}
                {isVisible('status') && (
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: eq.status === 'End of Service' ? '#FEF2F2' : '#ECFDF5', color: eq.status === 'End of Service' ? '#DC2626' : '#059669', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{eq.status}</span>
                  </td>
                )}
                {canEdit && (
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setEditItem(eq)} style={{ padding: '5px 10px', marginRight: '6px', background: '#EFF6FF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#156082', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Edit</button>
                    <button onClick={() => deleteItem(eq)} style={{ padding: '5px 10px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#EF4444', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && <NewEquipmentModal users={users} locations={locations} onClose={() => setShowNew(false)} onSave={createItem} />}
      {editItem && (
        <NewEquipmentModal users={users} locations={locations} initial={editItem} title="Edit Equipment" submitLabel="Save Changes"
          onClose={() => setEditItem(null)} onSave={saveEditItem} />
      )}
    </div>
  )
}

export default function EquipmentsPage() {
  return <ITLayout><EquipmentsContent /></ITLayout>
}
