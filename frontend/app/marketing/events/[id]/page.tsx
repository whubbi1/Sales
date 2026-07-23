'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MarketingLayout, useMarketingPerm } from '@/components/MarketingLayout'
import { marketingAPI, partnersAPI, contactsAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { RichTextEditor } from '@/components/shared/RichTextEditor'

const API = 'https://api.whubbi.wcomply.com'

const TYPE_LABEL: Record<string, string> = { webinar: 'Webinar', physical: 'Physical Event', mailing: 'Mailing', other: 'Other' }
const EVENT_STATUSES = ['To be planned', 'Planned', 'Under preparation', 'Finished']
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  'To be planned': { bg: '#F1F5F9', color: '#475569' }, 'Planned': { bg: '#EFF6FF', color: '#156082' },
  'Under preparation': { bg: '#FFF7ED', color: '#D97706' }, 'Finished': { bg: '#F1F5F9', color: '#64748B' },
}

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

// Creating/editing a Mailing assigned to this event — picking a template snapshots its
// email_title/content into this mailing's own fields (see marketing.py), independently
// editable from there. The mailing group defaults to contacts matching the template's
// audience (job_type) but any contact can be added or removed.
function MailingModal({ eventId, mailing, templates, users, contacts, onClose, onSaved }: any) {
  const [templateId, setTemplateId] = useState(mailing?.template_id || '')
  const [name, setName] = useState(mailing?.name || '')
  const [emailTitle, setEmailTitle] = useState(mailing?.email_title || '')
  const [content, setContent] = useState(mailing?.content || '')
  const [ownerEmail, setOwnerEmail] = useState(mailing?.owner_email || '')
  const [senderName, setSenderName] = useState(mailing?.sender_name || '')
  const [sendDate, setSendDate] = useState(mailing?.send_date ? mailing.send_date.slice(0, 10) : '')
  const [contactIds, setContactIds] = useState<string[]>((mailing?.contacts || []).map((c: any) => c.id))
  const [contactSearch, setContactSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const applyTemplate = (tid: string) => {
    setTemplateId(tid)
    const t = templates.find((tt: any) => tt.id === tid)
    if (!t) return
    setEmailTitle(t.email_title || '')
    setContent(t.content || '')
    // Pre-selects the mailing group from the template's declared audience — still just a
    // starting point, every contact stays individually toggleable below.
    if (!mailing && (t.audience || []).length > 0) {
      setContactIds(contacts.filter((c: any) => t.audience.includes(c.job_type)).map((c: any) => c.id))
    }
  }

  const toggleContact = (cid: string) => setContactIds(prev => prev.includes(cid) ? prev.filter(x => x !== cid) : [...prev, cid])
  const filteredContacts = contacts.filter((c: any) => !contactSearch.trim() || `${c.first_name} ${c.last_name}`.toLowerCase().includes(contactSearch.trim().toLowerCase()))

  const submit = async () => {
    if (!name.trim()) { setError('Mailing name is required'); return }
    setSaving(true); setError('')
    try {
      const u = users.find((uu: any) => uu.email === ownerEmail)
      const payload = {
        template_id: templateId || null, name: name.trim(), email_title: emailTitle || null, content,
        owner_email: ownerEmail || null, owner_name: u ? (u.display_name || `${u.first_name} ${u.last_name}`) : null,
        sender_name: senderName.trim() || null, send_date: sendDate || null,
        contact_ids: contactIds,
      }
      if (mailing) {
        await marketingAPI.updateMailing(mailing.id, payload)
        // Reconcile the contact list against whatever it was before, since update_mailing
        // doesn't touch contacts itself (only create does) — mirrors marketing_mailing_contacts.
        const before = new Set((mailing.contacts || []).map((c: any) => c.id))
        const after = new Set(contactIds)
        for (const cid of after) if (!before.has(cid)) await marketingAPI.linkMailingContact(mailing.id, cid)
        for (const cid of before) if (!after.has(cid)) await marketingAPI.unlinkMailingContact(mailing.id, cid)
      } else {
        await marketingAPI.createEventMailing(eventId, payload)
      }
      onSaved()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '640px', maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>{mailing ? 'Edit Mailing' : 'New Mailing'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Mailing Name *</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' }} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q3 Newsletter - August batch" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Send Date</label>
              <input type="date" style={{ ...inp, width: '100%', boxSizing: 'border-box' }} value={sendDate} onChange={e => setSendDate(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Owner</label>
              <select style={{ ...inp, width: '100%' }} value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)}>
                <option value="">Select owner…</option>
                {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Sender Name</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' }} value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Name shown as the sender" />
            </div>
          </div>
          <div>
            <label style={lbl}>Template</label>
            <select style={{ ...inp, width: '100%' }} value={templateId} onChange={e => applyTemplate(e.target.value)}>
              <option value="">No template — write content directly</option>
              {templates.map((t: any) => <option key={t.id} value={t.id}>{t.short_title}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Email Title (subject)</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' }} value={emailTitle} onChange={e => setEmailTitle(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Content</label>
            <RichTextEditor value={content} onChange={setContent} minHeight="200px" />
          </div>
          <div>
            <label style={lbl}>Mailing Group ({contactIds.length} contact{contactIds.length !== 1 ? 's' : ''})</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box', marginBottom: '6px' }} placeholder="Search contacts…" value={contactSearch} onChange={e => setContactSearch(e.target.value)} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '140px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px' }}>
              {filteredContacts.length === 0 ? <span style={{ fontSize: '12px', color: '#94A3B8' }}>No matching contacts.</span> : filteredContacts.map((c: any) => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '3px 8px', borderRadius: '6px', background: contactIds.includes(c.id) ? '#EEF2FF' : '#F8FAFC', cursor: 'pointer' }}>
                  <input type="checkbox" checked={contactIds.includes(c.id)} onChange={() => toggleContact(c.id)} />
                  {c.first_name} {c.last_name}
                </label>
              ))}
            </div>
          </div>
          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid #EDF2F7', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ padding: '9px 18px', background: saving ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
            {saving ? 'Saving…' : mailing ? 'Save Changes' : 'Create Mailing'}
          </button>
        </div>
      </div>
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
  const [contacts, setContacts] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [mailings, setMailings] = useState<any[]>([])
  const [showMailingModal, setShowMailingModal] = useState(false)
  const [editingMailing, setEditingMailing] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingField, setEditingField] = useState<string | null>(null)

  const [contributorEmail, setContributorEmail] = useState('')
  const [showAddLink, setShowAddLink] = useState(false)
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [addPartnerId, setAddPartnerId] = useState('')
  const [addContactId, setAddContactId] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const e = await marketingAPI.getEvent(id as string)
      setEvent(e)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }
  const loadMailings = () => marketingAPI.listEventMailings(id as string).then(d => setMailings(d.mailings || [])).catch(() => {})

  useEffect(() => {
    load()
    loadMailings()
    fetch(`${API}/settings/users`).then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
    partnersAPI.list({}).then(setPartners).catch(() => {})
    contactsAPI.list({}).then(setContacts).catch(() => {})
    marketingAPI.listEmailTemplates().then(d => setTemplates(d.templates || [])).catch(() => {})
  }, [id])

  if (level === 'loading' || loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )
  if (!event) return <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>Event not found.</div>

  // These all merge into local state instead of calling load() — a full refetch of the event
  // + every sub-list after each single-field edit caused a visible reload/flicker on every blur.
  const updateField = async (fields: any) => {
    setError('')
    try {
      const updated = await marketingAPI.updateEvent(event.id, fields)
      setEditingField(null)
      setEvent((prev: any) => ({ ...prev, ...updated }))
    } catch (e: any) { setError(e.message) }
  }

  const addContributor = async () => {
    if (!contributorEmail) return
    const u = users.find((u: any) => u.email === contributorEmail)
    const user_name = u?.display_name || `${u?.first_name || ''} ${u?.last_name || ''}`.trim()
    const { id } = await marketingAPI.addContributor(event.id, { user_email: contributorEmail, user_name })
    setContributorEmail('')
    setEvent((prev: any) => ({ ...prev, contributors: [...(prev.contributors || []), { id, user_email: contributorEmail, user_name }] }))
  }
  const removeContributor = async (cid: string) => {
    await marketingAPI.removeContributor(event.id, cid)
    setEvent((prev: any) => ({ ...prev, contributors: (prev.contributors || []).filter((c: any) => c.id !== cid) }))
  }

  const addLink = async () => {
    if (!linkLabel.trim() || !linkUrl.trim()) return
    const label = linkLabel.trim(), url = linkUrl.trim()
    const { id } = await marketingAPI.addUrl(event.id, { label, url })
    setLinkLabel(''); setLinkUrl(''); setShowAddLink(false)
    setEvent((prev: any) => ({ ...prev, urls: [...(prev.urls || []), { id, label, url }] }))
  }
  const removeLink = async (uid: string) => {
    await marketingAPI.removeUrl(event.id, uid)
    setEvent((prev: any) => ({ ...prev, urls: (prev.urls || []).filter((u: any) => u.id !== uid) }))
  }

  const linkPartner = async () => {
    if (!addPartnerId) return
    const partner = partners.find((p: any) => p.id === addPartnerId)
    await marketingAPI.linkPartner(event.id, addPartnerId)
    setAddPartnerId('')
    if (partner) setEvent((prev: any) => ({ ...prev, partners: [...(prev.partners || []), { id: partner.id, name: partner.name, status: partner.status }] }))
  }
  const unlinkPartner = async (partnerId: string) => {
    await marketingAPI.unlinkPartner(event.id, partnerId)
    setEvent((prev: any) => ({ ...prev, partners: (prev.partners || []).filter((p: any) => p.id !== partnerId) }))
  }

  const linkContact = async () => {
    if (!addContactId) return
    const contact = contacts.find((c: any) => c.id === addContactId)
    await marketingAPI.linkContact(event.id, addContactId)
    setAddContactId('')
    if (contact) setEvent((prev: any) => ({ ...prev, contacts: [...(prev.contacts || []), { id: contact.id, first_name: contact.first_name, last_name: contact.last_name, email: contact.email }] }))
  }
  const unlinkContact = async (contactId: string) => {
    await marketingAPI.unlinkContact(event.id, contactId)
    setEvent((prev: any) => ({ ...prev, contacts: (prev.contacts || []).filter((c: any) => c.id !== contactId) }))
  }

  const deleteMailing = async (mailing: any) => {
    if (!confirm(`Delete mailing "${mailing.name}"?`)) return
    await marketingAPI.deleteMailing(mailing.id)
    loadMailings()
  }

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true)
    try {
      const { logo_url } = await marketingAPI.uploadEventLogo(event.id, file)
      setEvent((prev: any) => ({ ...prev, logo_url }))
    } finally { setUploadingLogo(false) }
  }

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try {
      await marketingAPI.deleteEvent(event.id)
      router.push('/marketing/events')
    } catch (e: any) { setError(e.message); setDeleting(false) }
  }

  const linkedPartnerIds = new Set((event.partners || []).map((p: any) => p.id))
  const availablePartners = partners.filter((p: any) => !linkedPartnerIds.has(p.id))
  const linkedContactIds = new Set((event.contacts || []).map((c: any) => c.id))
  const availableContacts = contacts.filter((c: any) => !linkedContactIds.has(c.id))

  return (
    <div style={{ padding: '24px 28px', maxWidth: '900px' }}>
      <button onClick={() => router.push('/marketing/events')} style={{ background: 'none', border: 'none', color: '#45B6E4', fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: 0, marginBottom: '14px' }}>← Back to Events</button>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px' }}>
          {canEdit && (
            <div onClick={() => logoInputRef.current?.click()} title="Click to change logo"
              style={{ width: '48px', height: '48px', borderRadius: '10px', background: event.logo_url ? 'white' : '#EFF6FF', color: '#156082', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0, cursor: 'pointer', overflow: 'hidden', border: '1px solid #EDF2F7' }}>
              {uploadingLogo ? <span style={{ fontSize: '9px', color: '#9B9B9B' }}>...</span> : event.logo_url ? <img src={event.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : '🎪'}
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = '' }} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <EditableCell display={<span style={{ background: '#F1F5F9', color: '#3F3F3F', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{TYPE_LABEL[event.event_type] || event.event_type}</span>}
                editing={editingField === 'event_type'} canEdit={canEdit} onStartEdit={() => setEditingField('event_type')}>
                <select autoFocus style={inp} defaultValue={event.event_type} onChange={e => updateField({ event_type: e.target.value })} onBlur={() => setEditingField(null)}>
                  {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </EditableCell>
              <EditableCell display={<span style={{ background: STATUS_COLOR[event.status]?.bg || '#F1F5F9', color: STATUS_COLOR[event.status]?.color || '#475569', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{event.status || 'To be planned'}</span>}
                editing={editingField === 'status'} canEdit={canEdit} onStartEdit={() => setEditingField('status')}>
                <select autoFocus style={inp} defaultValue={event.status || 'To be planned'} onChange={e => updateField({ status: e.target.value })} onBlur={() => setEditingField(null)}>
                  {EVENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
          {canEdit && (
            <button onClick={() => { setDeleteConfirm(''); setShowDelete(true) }}
              style={{ ...btn, background: 'white', color: '#DC2626', border: '1.5px solid #FCA5A5', flexShrink: 0 }}>
              Delete
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
          <div>
            <div style={lbl}>Start Date</div>
            <EditableCell display={fmtDate(event.event_date)} editing={editingField === 'event_date'} canEdit={canEdit} onStartEdit={() => setEditingField('event_date')}>
              <input autoFocus type="date" style={inp} defaultValue={event.event_date ? event.event_date.slice(0, 10) : ''} onBlur={e => updateField({ event_date: e.target.value })} />
            </EditableCell>
          </div>
          <div>
            <div style={lbl}>End Date</div>
            <EditableCell display={fmtDate(event.end_date)} editing={editingField === 'end_date'} canEdit={canEdit} onStartEdit={() => setEditingField('end_date')}>
              <input autoFocus type="date" style={inp} defaultValue={event.end_date ? event.end_date.slice(0, 10) : ''} onBlur={e => updateField({ end_date: e.target.value })} />
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
        <div style={lbl}>Leads &amp; Deals from this Event</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#219BD6' }}>{event.leads_count || 0}</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Leads ({event.leads_to_opportunity_count || 0} linked to a deal/opportunity)</div>
          </div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#D97706' }}>{event.opportunities_count || 0}</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Opportunities</div>
          </div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#059669' }}>{event.won_deals_count || 0}</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Won Deals</div>
          </div>
        </div>
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
          <div style={lbl}>Linked Contacts ({(event.contacts || []).length})</div>
        </div>
        {canEdit && availableContacts.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <select style={{ ...inp, flex: 1 }} value={addContactId} onChange={e => setAddContactId(e.target.value)}>
              <option value="">Select a contact…</option>
              {availableContacts.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
            <button onClick={linkContact} disabled={!addContactId} style={{ ...btn, background: '#156082', color: 'white' }}>+ Link</button>
          </div>
        )}
        {(event.contacts || []).length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No contacts linked yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {event.contacts.map((c: any) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                <a href={`/contacts/${c.id}`} style={{ fontSize: '12px', fontWeight: '600', color: '#156082', textDecoration: 'none' }}>{c.first_name} {c.last_name}</a>
                {canEdit && <button onClick={() => unlinkContact(c.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
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

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={lbl}>Mailings ({mailings.length})</div>
          {canEdit && <button onClick={() => { setEditingMailing(null); setShowMailingModal(true) }} style={{ ...btn, background: '#EFF6FF', color: '#156082' }}>+ New Mailing</button>}
        </div>
        {mailings.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No mailings assigned to this event yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {mailings.map((m: any) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #EDF2F7', borderRadius: '8px', cursor: canEdit ? 'pointer' : 'default' }}
                onClick={() => { if (canEdit) { setEditingMailing(m); setShowMailingModal(true) } }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#156082' }}>{m.name}</div>
                  <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                    {m.template?.short_title ? `Template: ${m.template.short_title} · ` : ''}
                    {(m.contacts || []).length} recipient{(m.contacts || []).length !== 1 ? 's' : ''}
                    {m.send_date ? ` · Sends ${fmtDate(m.send_date)}` : ''}
                    {m.owner_name ? ` · Owner: ${m.owner_name}` : ''}
                    {m.sender_name ? ` · From: ${m.sender_name}` : ''}
                  </div>
                </div>
                {canEdit && <button onClick={e => { e.stopPropagation(); deleteMailing(m) }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {showMailingModal && (
        <MailingModal eventId={event.id} mailing={editingMailing} templates={templates} users={users} contacts={contacts}
          onClose={() => setShowMailingModal(false)}
          onSaved={() => { setShowMailingModal(false); loadMailings() }} />
      )}

      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#DC2626' }}>Delete Event</h2>
              <button onClick={() => setShowDelete(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: '#3F3F3F', marginBottom: '8px' }}>
                You are about to permanently delete <strong>{event.title}</strong>. This action cannot be undone.
              </p>
              <p style={{ fontSize: '13px', color: '#3F3F3F', marginBottom: '12px' }}>
                Type <strong style={{ color: '#DC2626' }}>DELETE</strong> to confirm.
              </p>
              <input
                className="form-input"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDelete()}
                placeholder="Type DELETE to confirm"
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDelete(false)}>Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                style={{ background: deleteConfirm === 'DELETE' ? '#DC2626' : '#FCA5A5', color: 'white', padding: '8px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'not-allowed', transition: 'background 0.15s' }}
              >
                {deleting ? 'Deleting...' : 'Delete Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function EventDetailPage() {
  return <MarketingLayout><EventDetailContent /></MarketingLayout>
}
