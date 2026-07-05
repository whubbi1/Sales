'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MarketingLayout, useMarketingPerm } from '@/components/MarketingLayout'
import { marketingAPI, partnersAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const TYPE_LABEL: Record<string, string> = { webinar: 'Webinar', physical: 'Physical Event', mailing: 'Mailing', other: 'Other' }

const card: React.CSSProperties = { background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px 22px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const lbl: React.CSSProperties = { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '6px' }
const inp: React.CSSProperties = { fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white' }
const btn: React.CSSProperties = { padding: '7px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }

function fmtDate(d: string) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

function EditableCell({ display, editing, canEdit, onStartEdit, children }: any) {
  return editing ? children : (
    <div onClick={() => canEdit && onStartEdit()} title={canEdit ? 'Click to edit' : undefined}
      style={{ fontSize: '12px', color: '#3F3F3F', cursor: canEdit ? 'pointer' : 'default', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px' }}
      onMouseEnter={e => canEdit && (e.currentTarget.style.background = '#F1F5F9')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {display || <span style={{ color: '#94A3B8' }}>—</span>}
    </div>
  )
}

function EventDetailContent() {
  const { id } = useParams()
  const router = useRouter()
  const { level, canEdit } = useMarketingPerm('events')
  const [event, setEvent] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingField, setEditingField] = useState<string | null>(null)

  const [contributorEmail, setContributorEmail] = useState('')
  const [showAddLink, setShowAddLink] = useState(false)
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [addPartnerId, setAddPartnerId] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const e = await marketingAPI.getEvent(id as string)
      setEvent(e)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    fetch(`${API}/settings/users`).then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
    partnersAPI.list({}).then(setPartners).catch(() => {})
  }, [id])

  if (level === 'loading' || loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )
  if (!event) return <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>Event not found.</div>

  const updateField = async (fields: any) => {
    setError('')
    try {
      await marketingAPI.updateEvent(event.id, fields)
      setEditingField(null)
      load()
    } catch (e: any) { setError(e.message) }
  }

  const addContributor = async () => {
    if (!contributorEmail) return
    const u = users.find((u: any) => u.email === contributorEmail)
    await marketingAPI.addContributor(event.id, { user_email: contributorEmail, user_name: u?.display_name || `${u?.first_name} ${u?.last_name}` })
    setContributorEmail('')
    load()
  }
  const removeContributor = async (cid: string) => { await marketingAPI.removeContributor(event.id, cid); load() }

  const addLink = async () => {
    if (!linkLabel.trim() || !linkUrl.trim()) return
    await marketingAPI.addUrl(event.id, { label: linkLabel.trim(), url: linkUrl.trim() })
    setLinkLabel(''); setLinkUrl(''); setShowAddLink(false)
    load()
  }
  const removeLink = async (uid: string) => { await marketingAPI.removeUrl(event.id, uid); load() }

  const linkPartner = async () => {
    if (!addPartnerId) return
    await marketingAPI.linkPartner(event.id, addPartnerId)
    setAddPartnerId('')
    load()
  }
  const unlinkPartner = async (partnerId: string) => { await marketingAPI.unlinkPartner(event.id, partnerId); load() }

  const linkedPartnerIds = new Set((event.partners || []).map((p: any) => p.id))
  const availablePartners = partners.filter((p: any) => !linkedPartnerIds.has(p.id))

  return (
    <div style={{ padding: '24px 28px', maxWidth: '900px' }}>
      <button onClick={() => router.push('/marketing/events')} style={{ background: 'none', border: 'none', color: '#45B6E4', fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: 0, marginBottom: '14px' }}>← Back to Events</button>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <EditableCell display={<span style={{ background: '#F1F5F9', color: '#3F3F3F', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{TYPE_LABEL[event.event_type] || event.event_type}</span>}
                editing={editingField === 'event_type'} canEdit={canEdit} onStartEdit={() => setEditingField('event_type')}>
                <select autoFocus style={inp} defaultValue={event.event_type} onChange={e => updateField({ event_type: e.target.value })} onBlur={() => setEditingField(null)}>
                  {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </EditableCell>
            </div>
            <EditableCell display={<h1 style={{ fontSize: '19px', fontWeight: '800', color: '#156082', margin: '0 0 6px' }}>{event.title}</h1>}
              editing={editingField === 'title'} canEdit={canEdit} onStartEdit={() => setEditingField('title')}>
              <input autoFocus style={{ ...inp, fontSize: '15px', fontWeight: '700', width: '100%', boxSizing: 'border-box' as const, marginBottom: '6px' }} defaultValue={event.title}
                onBlur={e => updateField({ title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
            </EditableCell>
            <EditableCell display={<p style={{ fontSize: '12px', color: '#64748B', margin: 0, whiteSpace: 'pre-wrap' }}>{event.description || 'No description.'}</p>}
              editing={editingField === 'description'} canEdit={canEdit} onStartEdit={() => setEditingField('description')}>
              <textarea autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '60px', resize: 'vertical' as const }} defaultValue={event.description}
                onBlur={e => updateField({ description: e.target.value })} />
            </EditableCell>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
          <div>
            <div style={lbl}>Date</div>
            <EditableCell display={fmtDate(event.event_date)} editing={editingField === 'event_date'} canEdit={canEdit} onStartEdit={() => setEditingField('event_date')}>
              <input autoFocus type="date" style={inp} defaultValue={event.event_date ? event.event_date.slice(0, 10) : ''} onBlur={e => updateField({ event_date: e.target.value })} />
            </EditableCell>
          </div>
          <div>
            <div style={lbl}>Location</div>
            <EditableCell display={event.location} editing={editingField === 'location'} canEdit={canEdit} onStartEdit={() => setEditingField('location')}>
              <input autoFocus style={inp} defaultValue={event.location || ''} onBlur={e => updateField({ location: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
            </EditableCell>
          </div>
          <div>
            <div style={lbl}>Owner</div>
            <EditableCell display={event.owner_name || event.owner_email} editing={editingField === 'owner'} canEdit={canEdit} onStartEdit={() => setEditingField('owner')}>
              <select autoFocus style={inp} defaultValue={event.owner_email || ''}
                onChange={e => {
                  const email = e.target.value
                  const u = users.find((u: any) => u.email === email)
                  updateField({ owner_email: email, owner_name: u?.display_name || (u ? `${u.first_name} ${u.last_name}` : '') })
                }}
                onBlur={() => setEditingField(null)}>
                <option value="">Select owner…</option>
                {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
              </select>
            </EditableCell>
          </div>
        </div>
        {error && <div style={{ marginTop: '12px', background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={lbl}>Contributors ({(event.contributors || []).length})</div>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <select style={{ ...inp, flex: 1 }} value={contributorEmail} onChange={e => setContributorEmail(e.target.value)}>
              <option value="">Select a contributor…</option>
              {users.filter((u: any) => !(event.contributors || []).some((c: any) => c.user_email === u.email)).map((u: any) => (
                <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>
              ))}
            </select>
            <button onClick={addContributor} disabled={!contributorEmail} style={{ ...btn, background: '#156082', color: 'white' }}>+ Add</button>
          </div>
        )}
        {(event.contributors || []).length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No contributors yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {event.contributors.map((c: any) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#156082' }}>{c.user_name || c.user_email}</span>
                {canEdit && <button onClick={() => removeContributor(c.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={lbl}>Linked Partners ({(event.partners || []).length})</div>
        </div>
        {canEdit && availablePartners.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <select style={{ ...inp, flex: 1 }} value={addPartnerId} onChange={e => setAddPartnerId(e.target.value)}>
              <option value="">Select a partner…</option>
              {availablePartners.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={linkPartner} disabled={!addPartnerId} style={{ ...btn, background: '#156082', color: 'white' }}>+ Link</button>
          </div>
        )}
        {(event.partners || []).length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No partners linked yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {event.partners.map((p: any) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                <a href={`/partners/${p.id}`} style={{ fontSize: '12px', fontWeight: '600', color: '#156082', textDecoration: 'none' }}>{p.name}</a>
                {canEdit && <button onClick={() => unlinkPartner(p.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={lbl}>URLs ({(event.urls || []).length})</div>
          {canEdit && !showAddLink && <button onClick={() => setShowAddLink(true)} style={{ ...btn, background: '#EFF6FF', color: '#156082' }}>+ Add URL</button>}
        </div>
        {(event.urls || []).length === 0 && !showAddLink ? (
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No URLs attached yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: showAddLink ? '10px' : 0 }}>
            {(event.urls || []).map((l: any) => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#156082', fontWeight: '600', textDecoration: 'none' }}>🔗 {l.label}</a>
                {canEdit && <button onClick={() => removeLink(l.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
              </div>
            ))}
          </div>
        )}
        {showAddLink && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input style={{ ...inp, width: '160px' }} placeholder="Label…" value={linkLabel} onChange={e => setLinkLabel(e.target.value)} />
            <input style={{ ...inp, flex: 1 }} placeholder="https://…" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addLink() }} />
            <button onClick={addLink} style={{ ...btn, background: '#156082', color: 'white' }}>Add</button>
            <button onClick={() => { setShowAddLink(false); setLinkLabel(''); setLinkUrl('') }} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function EventDetailPage() {
  return <MarketingLayout><EventDetailContent /></MarketingLayout>
}
