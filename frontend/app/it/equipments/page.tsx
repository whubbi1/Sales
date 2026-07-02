'use client'
import { useState, useEffect } from 'react'
import ITLayout, { useITPerm } from '@/components/ITLayout'

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

function EquipmentsContent() {
  const { canEdit } = useITPerm()
  const [equipments, setEquipments] = useState<any[]>([])
  const [users, setUsers]           = useState<any[]>([])
  const [locations, setLocations]   = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<any>(null)
  const [form, setForm]             = useState<any>(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch]         = useState('')

  useEffect(() => {
    loadEquipments()
    fetch(`${API}/settings/users`).then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
    fetch(`${API}/legal/locations`).then(r => r.json()).then(d => setLocations(d.locations || [])).catch(() => {})
  }, [])

  const handleLocationChange = (locationId: string) => {
    if (!locationId) { setForm((f: any) => ({ ...f, location_id: '', location_name: 'All' })); return }
    const loc = locations.find((l: any) => l.id === locationId)
    setForm((f: any) => ({ ...f, location_id: locationId, location_name: loc?.location_name || 'All' }))
  }

  const loadEquipments = async () => {
    setLoading(true)
    const d = await fetch(`${API}/it/equipments`).then(r => r.json()).catch(() => ({ equipments: [] }))
    setEquipments(d.equipments || [])
    setLoading(false)
  }

  const filtered = equipments.filter(e => {
    if (typeFilter && e.equipment_type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (e.name || '').toLowerCase().includes(q) || (e.serial_number || '').toLowerCase().includes(q)
    }
    return true
  })

  const openCreate = () => { setForm(EMPTY_FORM); setEditing(null); setShowModal(true) }
  const openEdit = (eq: any) => {
    setForm({
      equipment_type: eq.equipment_type || 'IT',
      name: eq.name || '',
      serial_number: eq.serial_number || '',
      purchase_date: eq.purchase_date || '',
      purchase_price: eq.purchase_price != null ? String(eq.purchase_price) : '',
      entry_service_date: eq.entry_service_date || '',
      planned_end_service_date: eq.planned_end_service_date || '',
      end_service_date: eq.end_service_date || '',
      end_service_reason: eq.end_service_reason || '',
      comment: eq.comment || '',
      assigned_email: eq.assigned_email || '',
      assigned_name: eq.assigned_name || '',
      location_id: eq.location_id || '',
      location_name: eq.location_name || 'All',
    })
    setEditing(eq)
    setShowModal(true)
  }

  const handleAssigneeChange = (email: string) => {
    const u = users.find((uu: any) => uu.email === email)
    setForm((f: any) => ({ ...f, assigned_email: email, assigned_name: u?.display_name || u?.first_name && u?.last_name ? `${u.first_name} ${u.last_name}` : '' }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    if (editing) {
      await fetch(`${API}/it/equipments/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
    } else {
      await fetch(`${API}/it/equipments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
    }
    setSaving(false)
    setShowModal(false)
    loadEquipments()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this equipment record? This cannot be undone.')) return
    await fetch(`${API}/it/equipments/${id}`, { method: 'DELETE' })
    loadEquipments()
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>🖥️ Equipments</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <button onClick={openCreate} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
            + New Equipment
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input style={{ ...inp, width: '220px' }} placeholder="Search name or serial number…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={inp} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(search || typeFilter) && (
          <button onClick={() => { setSearch(''); setTypeFilter('') }} style={{ ...inp, background: '#F1F5F9', color: '#64748B', cursor: 'pointer' }}>× Clear</button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {['Type', 'Name', 'Serial Number', 'Assigned To', 'Location', 'Purchase Date', 'Planned End of Service', 'Status', canEdit ? 'Actions' : null].filter(Boolean).map(h => (
                <th key={h as string} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No equipment found.</td></tr>
            ) : filtered.map(eq => {
              const ended = !!eq.end_service_date
              return (
                <tr key={eq.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 12px' }}><span style={{ background: '#F1F5F9', color: '#3F3F3F', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{eq.equipment_type}</span></td>
                  <td style={{ padding: '10px 12px', fontWeight: '700', color: '#156082' }}>{eq.name}</td>
                  <td style={{ padding: '10px 12px', color: '#64748B' }}>{eq.serial_number || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#3F3F3F' }}>{eq.assigned_name || eq.assigned_email || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: (!eq.location_name || eq.location_name === 'All') ? '#EEF2FF' : '#F1F5F9', color: (!eq.location_name || eq.location_name === 'All') ? '#156082' : '#3F3F3F', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{eq.location_name || 'All'}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{eq.purchase_date ? new Date(eq.purchase_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{eq.planned_end_service_date ? new Date(eq.planned_end_service_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: ended ? '#FEF2F2' : '#ECFDF5', color: ended ? '#DC2626' : '#059669', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{ended ? 'End of Service' : 'Active'}</span>
                  </td>
                  {canEdit && (
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => openEdit(eq)} style={{ padding: '5px 10px', background: '#EFF6FF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#3B82F6', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Edit</button>
                        <button onClick={() => handleDelete(eq.id)} style={{ padding: '5px 10px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#EF4444', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '560px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>{editing ? 'Edit Equipment' : 'New Equipment'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
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
                  <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder="e.g. MacBook Pro 14&quot;" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
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
                  <label style={lbl}>Date of End of Service</label>
                  <input type="date" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.end_service_date} onChange={e => setForm((f: any) => ({ ...f, end_service_date: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Reason for End of Service</label>
                  <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.end_service_reason} onChange={e => setForm((f: any) => ({ ...f, end_service_reason: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={lbl}>Comment</label>
                <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '70px', resize: 'vertical' }} value={form.comment} onChange={e => setForm((f: any) => ({ ...f, comment: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.name.trim()}
                  style={{ padding: '9px 18px', background: saving || !form.name.trim() ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Equipment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function EquipmentsPage() {
  return <ITLayout><EquipmentsContent /></ITLayout>
}
