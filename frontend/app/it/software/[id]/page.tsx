'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ITLayout, { useITPerm } from '@/components/ITLayout'

const API = 'https://api.whubbi.wcomply.com'

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

function SoftwareDetailContent() {
  const { id } = useParams()
  const router = useRouter()
  const { canEdit } = useITPerm()
  const [software, setSoftware] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch(`${API}/it/software/${id}`).then(r => r.json())
      setSoftware(d)
    } catch {
      router.push('/it/software')
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
    await fetch(`${API}/it/software/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: software.name, editor: software.editor, version: software.version, install_link: software.install_link,
        owner_email: software.owner_email, owner_name: software.owner_name,
        location_id: software.location_id, location_name: software.location_name,
        ...fields,
      }),
    })
    setEditing(null)
    load()
  }

  const deleteSoftware = async () => {
    if (!confirm(`Delete "${software.name}"? This cannot be undone.`)) return
    await fetch(`${API}/it/software/${id}`, { method: 'DELETE' })
    router.push('/it/software')
  }

  const toggleAll = () => patch({ location_id: '', location_name: 'All' })
  const toggleLocation = (locId: string) => {
    const loc = locations.find((l: any) => l.id === locId)
    patch({ location_id: locId, location_name: loc?.location_name || 'All' })
  }

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (!software) return null

  return (
    <div style={{ padding: '24px 28px', maxWidth: '860px' }}>
      <button onClick={() => router.push('/it/software')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontWeight: '600', fontSize: '11px', padding: 0, marginBottom: '14px' }}>← Software</button>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#156082', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '800', flexShrink: 0 }}>
              {software.name[0]?.toUpperCase()}
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: 0 }}>
              <EditableCell display={software.name} editing={editing === 'name'} onStartEdit={() => canEdit && setEditing('name')}>
                <input autoFocus style={{ ...inp, fontSize: '18px', fontWeight: '800' }} defaultValue={software.name} onBlur={e => patch({ name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
              </EditableCell>
            </h1>
          </div>
          {canEdit && (
            <button onClick={deleteSoftware} style={{ padding: '7px 14px', background: 'white', color: '#DC2626', border: '1.5px solid #FCA5A5', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: 'Montserrat, sans-serif' }}>Delete</button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          <PropertyRow label="Software Editor">
            <EditableCell display={software.editor} editing={editing === 'editor'} onStartEdit={() => canEdit && setEditing('editor')}>
              <input autoFocus style={inp} defaultValue={software.editor} onBlur={e => patch({ editor: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
            </EditableCell>
          </PropertyRow>
          <PropertyRow label="Software Version">
            <EditableCell display={software.version} editing={editing === 'version'} onStartEdit={() => canEdit && setEditing('version')}>
              <input autoFocus style={inp} defaultValue={software.version} onBlur={e => patch({ version: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
            </EditableCell>
          </PropertyRow>
          <PropertyRow label="Link to Installation Files">
            <EditableCell display={software.install_link ? <a href={software.install_link} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6' }} onClick={e => e.stopPropagation()}>🔗 {software.install_link}</a> : null}
              editing={editing === 'install_link'} onStartEdit={() => canEdit && setEditing('install_link')}>
              <input autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} defaultValue={software.install_link} placeholder="https://…" onBlur={e => patch({ install_link: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
            </EditableCell>
          </PropertyRow>
          <PropertyRow label="Owner of the Solution">
            {editing === 'owner' ? (
              <select autoFocus style={inp} defaultValue={software.owner_email || ''}
                onChange={e => {
                  const u = users.find((uu: any) => uu.email === e.target.value)
                  patch({ owner_email: e.target.value, owner_name: u?.display_name || (u ? `${u.first_name} ${u.last_name}` : '') })
                }}
                onBlur={() => setEditing(null)}>
                <option value="">Unassigned</option>
                {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
              </select>
            ) : (
              <EditableCell display={software.owner_name || software.owner_email} editing={false} onStartEdit={() => canEdit && setEditing('owner')} />
            )}
          </PropertyRow>
          <PropertyRow label="Location">
            {editing === 'location' ? (
              <div style={{ minWidth: '260px' }}>
                <LocationChecklist allLocations={!software.location_id} selectedIds={software.location_id ? [software.location_id] : []} locations={locations} onToggleAll={toggleAll} onToggleLocation={toggleLocation} />
                <button onClick={() => setEditing(null)} style={{ marginTop: '6px', padding: '4px 10px', background: '#156082', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Done</button>
              </div>
            ) : (
              <EditableCell display={<span style={{ background: !software.location_id ? '#EEF2FF' : '#F1F5F9', color: !software.location_id ? '#156082' : '#3F3F3F', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{software.location_name || 'All'}</span>}
                editing={false} onStartEdit={() => canEdit && setEditing('location')} />
            )}
          </PropertyRow>
        </div>
      </div>
    </div>
  )
}

export default function SoftwareDetailPage() {
  return <ITLayout><SoftwareDetailContent /></ITLayout>
}
