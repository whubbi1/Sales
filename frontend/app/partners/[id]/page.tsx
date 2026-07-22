'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { partnersAPI, contactsAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { RecordLayout, PropertyRow, SidebarSection, SidebarCard, StatusBadge, TabNav, EmptyState } from '@/components/shared/RecordLayout'
import { PartnerActionItems } from '@/components/partners/PartnerActionItems'
import { PartnerModal } from '@/components/partners/PartnerModal'
import { ActivityFeed } from '@/components/shared/ActivityFeed'
import { PartnerArticles } from '@/components/partners/PartnerArticles'

const ERP_OPTIONS     = ["SAP", "Dynamics", "IFS", "Infor", "Odoo", "Oracle", "JDE", "SAGE", "Unknown", "Other"]
const CYBER_OPTIONS   = ["SAP ETD", "SAP GRC", "SAP Focused Run", "Cloud ALM", "SecurityBridge", "Onapsis", "Layer Seven Security", "Other"]
const HOSTING_OPTIONS = ["RISE", "AWS", "Azure", "GXP", "BLUE", "SENS", "Scaleway", "Private Datacenter", "Other"]

const inlineInp: React.CSSProperties = { fontSize: '12px', padding: '4px 7px', border: '1px solid #219BD6', borderRadius: '5px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white' }

function EditableText({ value, editing, onStartEdit, onSave, placeholder, textarea }: any) {
  const [val, setVal] = useState(value || '')
  useEffect(() => { setVal(value || '') }, [editing])
  if (!editing) {
    return (
      <span onClick={onStartEdit} title="Click to edit" style={{ cursor: 'pointer', padding: '2px 4px', margin: '-2px -4px', borderRadius: '4px', display: 'inline-block' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        {value || <span style={{ color: '#CBD5E0' }}>{placeholder || '—'}</span>}
      </span>
    )
  }
  const commit = () => onSave(val)
  return textarea ? (
    <textarea autoFocus style={{ ...inlineInp, width: '100%', resize: 'vertical' }} rows={3} value={val} onChange={e => setVal(e.target.value)}
      onBlur={commit} onKeyDown={e => { if (e.key === 'Escape') onSave(value) }} />
  ) : (
    <input autoFocus style={inlineInp} value={val} onChange={e => setVal(e.target.value)}
      onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onSave(value) }} />
  )
}

function EditableSelect({ display, value, editing, onStartEdit, onSave, options }: any) {
  if (!editing) {
    return (
      <span onClick={onStartEdit} title="Click to edit" style={{ cursor: 'pointer', padding: '2px 4px', margin: '-2px -4px', borderRadius: '4px', display: 'inline-block' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        {display || <span style={{ color: '#CBD5E0' }}>—</span>}
      </span>
    )
  }
  return (
    <select autoFocus style={inlineInp} value={value || ''} onChange={e => onSave(e.target.value)} onBlur={() => onSave(null, true)}>
      {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export default function PartnerDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [partner, setPartner] = useState<any>(null)
  const [contacts, setContacts] = useState<any[]>([])
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [events, setEvents] = useState<any[]>([])
  const [actionItems, setActionItems] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [allContacts, setAllContacts] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')
  const [editing, setEditing] = useState<string | null>(null)
  const [chipEditing, setChipEditing] = useState<string | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true)
    try {
      const { logo_url } = await partnersAPI.uploadLogo(id as string, file)
      setPartner((p: any) => ({ ...p, logo_url }))
    } finally { setUploadingLogo(false) }
  }

  const load = async () => {
    try {
      const [p, ctcts, opps, leadsRes, cmts, evts, custs, allC, usersResp, actItems] = await Promise.all([
        partnersAPI.get(id as string),
        partnersAPI.getContacts(id as string),
        partnersAPI.getOpportunities(id as string),
        partnersAPI.getLeads(id as string),
        partnersAPI.getComments(id as string),
        partnersAPI.getEvents(id as string),
        partnersAPI.getCustomers(id as string),
        contactsAPI.list({}),
        fetch('https://api.whubbi.wcomply.com/settings/users').then(r => r.json()).catch(() => ({ users: [] })),
        partnersAPI.getActionItems(id as string),
      ])
      setPartner(p)
      setContacts(ctcts)
      setOpportunities(opps)
      setLeads(leadsRes)
      setComments(cmts)
      setEvents(evts)
      setCustomers(custs)
      setAllContacts(allC)
      setUsers(usersResp.users || [])
      setActionItems(actItems)
    } catch {
      router.push('/partners')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const patchField = async (field: string, value: any) => {
    setEditing(null)
    if ((partner as any)[field] === value) return
    await partnersAPI.update(id as string, { [field]: value })
    load()
  }

  const patchAssignedTo = async (email: string | null) => {
    setEditing(null)
    if (email === null) return
    const u = users.find((uu: any) => uu.email === email)
    await partnersAPI.update(id as string, { assigned_to_email: email, assigned_to: u ? (u.display_name || `${u.first_name} ${u.last_name}`) : '' })
    load()
  }

  const toggleChip = async (field: string, value: string) => {
    const current: string[] = (partner as any)[field] || []
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
    await partnersAPI.update(id as string, { [field]: next })
    load()
  }

  const postComment = async () => {
    if (!newComment.trim()) return
    const user = getStoredUser()
    await partnersAPI.addComment(id as string, { author_email: user?.email || '', author_name: user?.name || user?.email || '', comment: newComment.trim() })
    setNewComment('')
    setComments(await partnersAPI.getComments(id as string))
  }
  const deleteComment = async (c: any) => {
    await partnersAPI.deleteComment(id as string, c.id)
    setComments(await partnersAPI.getComments(id as string))
  }

  if (loading) return (
    <RecordLayout
      leftColumn={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#9B9B9B' }}>Loading...</div>}
      rightColumn={<div />}
    />
  )

  if (!partner) return null

  const color = '#7C3AED'
  const mainContactLabel = partner.main_contact_first_name ? `${partner.main_contact_first_name} ${partner.main_contact_last_name}` : ''

  const leftColumn = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '11px', color: '#9B9B9B' }}>
        <button onClick={() => router.push('/partners')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontWeight: '600', fontSize: '11px', padding: 0 }}>Partners</button>
        <span>/</span><span style={{ color: '#3F3F3F', fontWeight: '600' }}>{partner.name}</span>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1 }}>
            <div onClick={() => logoInputRef.current?.click()} title="Click to change logo"
              style={{ width: '48px', height: '48px', borderRadius: '10px', background: partner.logo_url ? 'white' : color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '800', flexShrink: 0, cursor: 'pointer', overflow: 'hidden', border: partner.logo_url ? '1px solid #EDF2F7' : 'none', position: 'relative' }}>
              {uploadingLogo ? (
                <span style={{ fontSize: '9px', color: partner.logo_url ? '#9B9B9B' : 'white' }}>...</span>
              ) : partner.logo_url ? (
                <img src={partner.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                partner.name[0]?.toUpperCase()
              )}
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = '' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#144766', margin: 0 }}>
                  <EditableText value={partner.name} editing={editing === 'name'} onStartEdit={() => setEditing('name')} onSave={(v: string) => patchField('name', v)} />
                </h1>
                {partner.internal_id && <span style={{ fontSize: '11px', fontWeight: '600', color: '#9B9B9B' }}>{partner.internal_id}</span>}
                <EditableSelect display={<StatusBadge value={partner.status} />} value={partner.status} editing={editing === 'status'}
                  onStartEdit={() => setEditing('status')} onSave={(v: any, blur?: boolean) => blur ? setEditing(null) : patchField('status', v)}
                  options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
              </div>
              <p style={{ color: '#9B9B9B', fontSize: '12px', margin: 0 }}>
                <EditableSelect display={mainContactLabel || 'No main contact'} value={partner.main_contact_id} editing={editing === 'main_contact_id'}
                  onStartEdit={() => setEditing('main_contact_id')} onSave={(v: any, blur?: boolean) => blur ? setEditing(null) : patchField('main_contact_id', v)}
                  options={[{ value: '', label: 'No main contact' }, ...contacts.concat(allContacts.filter((c: any) => !contacts.find((x: any) => x.id === c.id))).map((c: any) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))]} />
                {' · '}
                <EditableText value={partner.sector} editing={editing === 'sector'} onStartEdit={() => setEditing('sector')} onSave={(v: string) => patchField('sector', v)} placeholder="No sector" />
                {' · '}
                <EditableText value={partner.country} editing={editing === 'country'} onStartEdit={() => setEditing('country')} onSave={(v: string) => patchField('country', v)} placeholder="No country" />
              </p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11px', alignItems: 'center' }}>
                <span style={{ color: '#6B6B6B' }}>📞 <EditableText value={partner.phone} editing={editing === 'phone'} onStartEdit={() => setEditing('phone')} onSave={(v: string) => patchField('phone', v)} placeholder="No phone" /></span>
                <span style={{ color: '#219BD6', fontWeight: '600' }}>
                  <EditableText value={partner.linkedin_url} editing={editing === 'linkedin_url'} onStartEdit={() => setEditing('linkedin_url')} onSave={(v: string) => patchField('linkedin_url', v)} placeholder="No LinkedIn" />
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowEdit(true)} style={{ background: 'white', color: '#144766', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #CBD5E0', cursor: 'pointer' }}>Edit</button>
          </div>
        </div>
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #F1F5F9', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          {[
            { label: 'Main ERP', field: 'main_erp', options: ERP_OPTIONS, bg: '#EEF2FF', color: '#4F46E5' },
            { label: 'Cybersecurity', field: 'cybersecurity_solutions', options: CYBER_OPTIONS, bg: '#FFF7ED', color: '#EA580C' },
            { label: 'SAP Hosting', field: 'sap_hosting_partner', options: HOSTING_OPTIONS, bg: '#ECFDF5', color: '#059669' },
          ].map(({ label, field, options, bg, color: c }) => (
            <div key={field}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B' }}>{label}</div>
                <button onClick={() => setChipEditing(chipEditing === field ? null : field)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontSize: '9px', fontWeight: '700', padding: 0 }}>{chipEditing === field ? 'Done' : 'Edit'}</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', maxWidth: '260px' }}>
                {chipEditing === field ? options.map(opt => (
                  <span key={opt} onClick={() => toggleChip(field, opt)} style={{ background: (partner as any)[field]?.includes(opt) ? bg : '#F1F5F9', color: (partner as any)[field]?.includes(opt) ? c : '#94A3B8', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600', cursor: 'pointer', border: `1px solid ${(partner as any)[field]?.includes(opt) ? c : '#E2E8F0'}` }}>{opt}</span>
                )) : ((partner as any)[field]?.length > 0 ? (partner as any)[field].map((v: string) => (
                  <span key={v} style={{ background: bg, color: c, padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{v}</span>
                )) : <span style={{ color: '#CBD5E0', fontSize: '10px' }}>None</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '0 20px', background: '#FAFBFC', borderBottom: '2px solid #E2E8F0' }}>
          <TabNav tabs={['Overview', 'Notes', 'Action List', 'Events', 'Articles', 'Customers']} active={tab} onChange={setTab} />
        </div>
        <div style={{ padding: '20px' }}>
          {tab === 'Overview' && (
            <div>
              <div style={{ marginBottom: '18px' }}>
                <EditableText value={partner.notes} editing={editing === 'notes'} onStartEdit={() => setEditing('notes')} onSave={(v: string) => patchField('notes', v)} placeholder="No general notes." textarea />
              </div>
              <p className="section-label">Activity</p>
              <ActivityFeed
                opportunities={opportunities}
                notes={comments.map((c: any) => ({ id: c.id, content: c.comment, created_at: c.created_at }))}
                tasks={actionItems}
                opportunityHref={o => `/opportunities/${o.id}`}
              />
            </div>
          )}

          {tab === 'Notes' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <textarea className="form-input" style={{ flex: 1, resize: 'vertical' }} rows={2} placeholder="Write a note…" value={newComment} onChange={e => setNewComment(e.target.value)} />
                <button className="btn-primary" onClick={postComment} style={{ alignSelf: 'flex-end' }}>Post</button>
              </div>
              {comments.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No notes yet.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {comments.map((c: any) => (
                    <div key={c.id} style={{ padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '700', color: '#144766', fontSize: '12px' }}>{c.author_name || c.author_email}</span>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', color: '#9B9B9B' }}>{new Date(c.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          <button onClick={() => deleteComment(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                        </div>
                      </div>
                      <p style={{ fontSize: '13px', color: '#3F3F3F', margin: 0, whiteSpace: 'pre-wrap' }}>{c.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'Action List' && <PartnerActionItems partnerId={id as string} />}

          {tab === 'Events' && (
            events.length === 0 ? <EmptyState icon="📅" title="No marketing events yet" description="Events linked to this partner from the Marketing module will appear here" /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {events.map((e: any) => (
                  <a key={e.id} href={`/marketing/events/${e.id}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#156082' }}>{e.title}</div>
                      <div style={{ fontSize: '11px', color: '#9B9B9B' }}>{e.event_type}{e.location && ` · ${e.location}`}</div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#9B9B9B' }}>{e.event_date && new Date(e.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </a>
                ))}
              </div>
            )
          )}

          {tab === 'Articles' && <PartnerArticles partnerId={id as string} />}

          {tab === 'Customers' && (
            customers.length === 0 ? <EmptyState icon="🛡️" title="No customers yet" description={`Companies with "${partner.name}" as a Cybersecurity Solution will appear here`} /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {customers.map((c: any) => (
                  <a key={c.id} href={`/companies/${c.id}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#156082' }}>{c.name}</span>
                    <span style={{ fontSize: '11px', color: '#9B9B9B' }}>{c.sector || ''}</span>
                  </a>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )

  const rightColumn = (
    <div>
      <SidebarSection title={`Contacts (${contacts.length})`} onAdd={() => router.push(`/contacts?partner_id=${id}`)}>
        {contacts.length === 0 ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No contacts.</p> : contacts.map((c: any) => <SidebarCard key={c.id} title={`${c.first_name} ${c.last_name}`} subtitle={c.job_type || c.email} href={`/contacts/${c.id}`} color="#e97132" />)}
      </SidebarSection>
      <SidebarSection title={`Opportunities (${opportunities.length})`} onAdd={() => router.push(`/opportunities?partner_id=${id}`)}>
        {opportunities.length === 0 ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No opportunities.</p> : opportunities.map((o: any) => <SidebarCard key={o.id} title={o.deal_name} subtitle={o.deal_status} href={`/opportunities/${o.id}`} color="#219BD6" />)}
      </SidebarSection>
      <SidebarSection title={`Leads (${leads.length})`} onAdd={() => router.push(`/leads?partner_id=${id}`)}>
        {leads.length === 0 ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No leads.</p> : leads.map((l: any) => <SidebarCard key={l.id} title={l.title} subtitle={l.status} href={`/leads/${l.id}`} color="#7C3AED" />)}
      </SidebarSection>
      <SidebarSection title="About this partner">
        <PropertyRow label="Status" value={<StatusBadge value={partner.status} />} />
        <PropertyRow label="Sector" value={partner.sector} />
        <PropertyRow label="Country" value={partner.country} />
        <PropertyRow label="Employees" value={partner.employee_count?.toLocaleString('en-US')} />
        <PropertyRow label="Main contact" value={mainContactLabel} />
        <PropertyRow label="Assigned to" value={
          <EditableSelect display={partner.assigned_to || '—'} value={partner.assigned_to_email} editing={editing === 'assigned_to_email'}
            onStartEdit={() => setEditing('assigned_to_email')} onSave={(v: any, blur?: boolean) => blur ? setEditing(null) : patchAssignedTo(v)}
            options={[{ value: '', label: 'Unassigned' }, ...users.map((u: any) => ({ value: u.email, label: u.display_name || `${u.first_name} ${u.last_name}` }))]} />
        } />
        <PropertyRow label="Created" value={new Date(partner.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
      </SidebarSection>
    </div>
  )

  return (
    <>
      <RecordLayout leftColumn={leftColumn} rightColumn={rightColumn} />
      {showEdit && <PartnerModal partner={partner} onClose={() => setShowEdit(false)} onSave={() => { setShowEdit(false); load() }} />}
    </>
  )
}
