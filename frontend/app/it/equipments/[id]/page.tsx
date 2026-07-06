'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ITLayout, { useITPerm } from '@/components/ITLayout'

const API = 'https://api.whubbi.wcomply.com'
const EQUIPMENT_TYPES = ['IT', 'Furniture', 'Hardware', 'Others']

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}

function EditableCell({ display, editing, onStartEdit, children }: any) {
  return editing ? children : (
    <div onClick={onStartEdit} title="Click to edit"
      style={{ fontSize: '13px', color: '#3F3F3F', cursor: 'pointer', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '20px', display: 'inline-block' }}
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

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
      <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '4px' }}>{label}</div>
      <div>{children}</div>
    </div>
  )
}

function fmtDate(d: string) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
}

function EquipmentDetailContent() {
  const { id } = useParams()
  const router = useRouter()
  const { canEdit } = useITPerm()
  const [equipment, setEquipment] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch(`${API}/it/equipments/${id}`).then(r => r.json())
      setEquipment(d)
    } catch {
      router.push('/it/equipments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    fetch(`${API}/settings/users`).then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
    fetch(`${API}/legal/locations`).then(r => r.json()).then(d => setLocations(d.locations || [])).catch(() => {})
  }, [id])

  const patch = async (fields: any) => {
    await fetch(`${API}/it/equipments/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipment_type: equipment.equipment_type, name: equipment.name, serial_number: equipment.serial_number,
        purchase_date: equipment.purchase_date, purchase_price: equipment.purchase_price,
        entry_service_date: equipment.entry_service_date, planned_end_service_date: equipment.planned_end_service_date,
        end_service_date: equipment.end_service_date, end_service_reason: equipment.end_service_reason, comment: equipment.comment,
        assigned_email: equipment.assigned_email, assigned_name: equipment.assigned_name,
        location_id: equipment.location_id, location_name: equipment.location_name,
        ...fields,
      }),
    })
    setEditing(null)
    load()
  }

  const deleteEquipment = async () => {
    if (!confirm(`Delete "${equipment.name}"? This cannot be undone.`)) return
    await fetch(`${API}/it/equipments/${id}`, { method: 'DELETE' })
    router.push('/it/equipments')
  }

  const toggleAll = () => patch({ location_id: '', location_name: 'All' })
  const toggleLocation = (locId: string) => {
    const loc = locations.find((l: any) => l.id === locId)
    patch({ location_id: locId, location_name: loc?.location_name || 'All' })
  }

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (!equipment) return null

  const status = equipment.end_service_date ? 'End of Service' : 'Active'

  return (
    <div style={{ padding: '24px 28px', maxWidth: '860px' }}>
      <button onClick={() => router.push('/it/equipments')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontWeight: '600', fontSize: '11px', padding: 0, marginBottom: '14px' }}>← Equipments</button>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#156082', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '800', flexShrink: 0 }}>
              {equipment.name[0]?.toUpperCase()}
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: 0 }}>
                <EditableCell display={equipment.name} editing={editing === 'name'} onStartEdit={() => canEdit && setEditing('name')}>
                  <input autoFocus style={{ ...inp, fontSize: '18px', fontWeight: '800' }} defaultValue={equipment.name} onBlur={e => patch({ name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                </EditableCell>
              </h1>
              <span style={{ background: status === 'End of Service' ? '#FEF2F2' : '#ECFDF5', color: status === 'End of Service' ? '#DC2626' : '#059669', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{status}</span>
            </div>
          </div>
          {canEdit && (
            <button onClick={deleteEquipment} style={{ padding: '7px 14px', background: 'white', color: '#DC2626', border: '1.5px solid #FCA5A5', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: 'Montserrat, sans-serif' }}>Delete</button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          <PropertyRow label="Type">
            {editing === 'equipment_type' ? (
              <select autoFocus style={inp} defaultValue={equipment.equipment_type} onChange={e => patch({ equipment_type: e.target.value })} onBlur={() => setEditing(null)}>
                {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <EditableCell display={<span style={{ background: '#F1F5F9', color: '#3F3F3F', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{equipment.equipment_type}</span>}
                editing={false} onStartEdit={() => canEdit && setEditing('equipment_type')} />
            )}
          </PropertyRow>
          <PropertyRow label="Serial Number">
            <EditableCell display={equipment.serial_number} editing={editing === 'serial_number'} onStartEdit={() => canEdit && setEditing('serial_number')}>
              <input autoFocus style={inp} defaultValue={equipment.serial_number} onBlur={e => patch({ serial_number: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
            </EditableCell>
          </PropertyRow>
          <PropertyRow label="Assigned To">
            {editing === 'assigned' ? (
              <select autoFocus style={inp} defaultValue={equipment.assigned_email || ''}
                onChange={e => {
                  const u = users.find((uu: any) => uu.email === e.target.value)
                  patch({ assigned_email: e.target.value, assigned_name: u?.display_name || (u ? `${u.first_name} ${u.last_name}` : '') })
                }}
                onBlur={() => setEditing(null)}>
                <option value="">Unassigned</option>
                {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
              </select>
            ) : (
              <EditableCell display={equipment.assigned_name || equipment.assigned_email} editing={false} onStartEdit={() => canEdit && setEditing('assigned')} />
            )}
          </PropertyRow>
          <PropertyRow label="Location">
            {editing === 'location' ? (
              <div style={{ minWidth: '260px' }}>
                <LocationChecklist allLocations={!equipment.location_id} selectedIds={equipment.location_id ? [equipment.location_id] : []} locations={locations} onToggleAll={toggleAll} onToggleLocation={toggleLocation} />
                <button onClick={() => setEditing(null)} style={{ marginTop: '6px', padding: '4px 10px', background: '#156082', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Done</button>
              </div>
            ) : (
              <EditableCell display={<span style={{ background: !equipment.location_id ? '#EEF2FF' : '#F1F5F9', color: !equipment.location_id ? '#156082' : '#3F3F3F', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{equipment.location_name || 'All'}</span>}
                editing={false} onStartEdit={() => canEdit && setEditing('location')} />
            )}
          </PropertyRow>
          <PropertyRow label="Purchase Date">
            <EditableCell display={fmtDate(equipment.purchase_date)} editing={editing === 'purchase_date'} onStartEdit={() => canEdit && setEditing('purchase_date')}>
              <input autoFocus type="date" style={inp} defaultValue={equipment.purchase_date || ''} onBlur={e => patch({ purchase_date: e.target.value })} />
            </EditableCell>
          </PropertyRow>
          <PropertyRow label="Purchase Price">
            <EditableCell display={equipment.purchase_price != null ? String(equipment.purchase_price) : ''} editing={editing === 'purchase_price'} onStartEdit={() => canEdit && setEditing('purchase_price')}>
              <input autoFocus type="number" step="0.01" style={inp} defaultValue={equipment.purchase_price != null ? String(equipment.purchase_price) : ''} onBlur={e => patch({ purchase_price: e.target.value })} />
            </EditableCell>
          </PropertyRow>
          <PropertyRow label="Date of Entry into Service">
            <EditableCell display={fmtDate(equipment.entry_service_date)} editing={editing === 'entry_service_date'} onStartEdit={() => canEdit && setEditing('entry_service_date')}>
              <input autoFocus type="date" style={inp} defaultValue={equipment.entry_service_date || ''} onBlur={e => patch({ entry_service_date: e.target.value })} />
            </EditableCell>
          </PropertyRow>
          <PropertyRow label="Planned End of Service">
            <EditableCell display={fmtDate(equipment.planned_end_service_date)} editing={editing === 'planned_end_service_date'} onStartEdit={() => canEdit && setEditing('planned_end_service_date')}>
              <input autoFocus type="date" style={inp} defaultValue={equipment.planned_end_service_date || ''} onBlur={e => patch({ planned_end_service_date: e.target.value })} />
            </EditableCell>
          </PropertyRow>
          <PropertyRow label="End of Service Date">
            <EditableCell display={fmtDate(equipment.end_service_date)} editing={editing === 'end_service_date'} onStartEdit={() => canEdit && setEditing('end_service_date')}>
              <input autoFocus type="date" style={inp} defaultValue={equipment.end_service_date || ''} onBlur={e => patch({ end_service_date: e.target.value })} />
            </EditableCell>
          </PropertyRow>
          <PropertyRow label="End of Service Reason">
            <EditableCell display={equipment.end_service_reason} editing={editing === 'end_service_reason'} onStartEdit={() => canEdit && setEditing('end_service_reason')}>
              <input autoFocus style={inp} defaultValue={equipment.end_service_reason} onBlur={e => patch({ end_service_reason: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
            </EditableCell>
          </PropertyRow>
        </div>
        <PropertyRow label="Comment">
          <EditableCell display={equipment.comment} editing={editing === 'comment'} onStartEdit={() => canEdit && setEditing('comment')}>
            <textarea autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '70px', resize: 'vertical' }} defaultValue={equipment.comment} onBlur={e => patch({ comment: e.target.value })} />
          </EditableCell>
        </PropertyRow>
      </div>
    </div>
  )
}

export default function EquipmentDetailPage() {
  return <ITLayout><EquipmentDetailContent /></ITLayout>
}
