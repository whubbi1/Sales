'use client'
import { useEffect, useState } from 'react'
import { pmAPI, contactsAPI } from '@/lib/api'
import { Card, Table, TD, DEL_BTN, LINK_BTN, Modal, Field, ErrorBanner, useAction, Badge } from './shared'
import { LANGUAGES, NUMBER_FORMATS, CURRENCIES } from '@/lib/contactOptions'

export const SECTIONS: { key: string; label: string }[] = [
  { key: 'basic_info', label: 'Project Setup' }, { key: 'members', label: 'Members' }, { key: 'planning', label: 'Planning' },
  { key: 'tasks', label: 'Tasks' }, { key: 'meetings', label: 'Meetings' }, { key: 'actions', label: 'Action List' },
  { key: 'decisions', label: 'Decision Register' }, { key: 'risks', label: 'Risk Management' }, { key: 'deliverables', label: 'Deliverables' },
]
const EMPTY = { name: '', email: '', phone: '', project_role: '', company_role: '', contact_id: null as string | null, permissions: Object.fromEntries(SECTIONS.map(s => [s.key, 'view'])) as Record<string, string> }
// Optional subscriptions offered in the inline "create new contact" form. 'Operation' is
// mandatory there (it's what grants Operations/Project Management portal access) and
// 'Opted Out' is deliberately omitted — the two are mutually exclusive, so offering an
// opt-out next to a mandatory subscription would be contradictory.
const NEW_CONTACT_SUBSCRIPTIONS = ['Marketing Information', 'Customer Service Communication', 'One to One']
const EMPTY_NEW_CONTACT = { first_name: '', last_name: '', job_name: '', mobile_phone: '', email: '', preferred_language: '', subscriptions: [] as string[], number_format: 'european', currency: 'EUR' }

function contactName(c: any): string {
  return `${c.first_name} ${c.last_name}`.trim()
}

export function MembersTab({ projectId, isManager }: { projectId: string; isManager: boolean }) {
  const [members, setMembers] = useState<any[]>([])
  const [editing, setEditing] = useState<any>(null)
  const [contactQuery, setContactQuery] = useState('')
  const [contactResults, setContactResults] = useState<any[]>([])
  const [creatingContact, setCreatingContact] = useState<any>(null)
  const { busy, error, run } = useAction()
  const { busy: contactBusy, error: contactError, run: runContact } = useAction()

  const load = () => pmAPI.members.list(projectId).then(setMembers).catch(() => {})
  useEffect(() => { load() }, [projectId])

  useEffect(() => {
    const q = contactQuery.trim()
    if (q.length < 2) { setContactResults([]); return }
    const t = setTimeout(() => { contactsAPI.list({ search: q }).then(r => setContactResults(r.slice(0, 6))).catch(() => {}) }, 300)
    return () => clearTimeout(t)
  }, [contactQuery])

  const openMember = (m: any) => { setEditing(m); setContactQuery(''); setContactResults([]); setCreatingContact(null) }

  const applyContact = (c: any) => {
    setEditing((p: any) => ({ ...p, name: contactName(c), email: c.email || p.email, phone: c.mobile_phone || p.phone, contact_id: c.id }))
    setContactQuery(''); setContactResults([]); setCreatingContact(null)
  }
  const createContact = () => runContact(async () => {
    if (!creatingContact.first_name.trim() || !creatingContact.last_name.trim()) throw new Error('First and last name are required')
    const created = await contactsAPI.create({
      ...creatingContact,
      subscriptions: [...creatingContact.subscriptions, 'Operation'],
      data_source: 'Project', data_source_ref_type: 'projects', data_source_ref_id: projectId,
    })
    applyContact(created)
  })

  const save = () => run(async () => {
    const { id, ...body } = editing
    if (id) await pmAPI.members.update(projectId, id, body)
    else await pmAPI.members.create(projectId, body)
    setEditing(null); load()
  })
  const remove = (m: any) => confirm(`Remove ${m.name} from the project?`) && run(async () => { await pmAPI.members.remove(projectId, m.id); load() })
  const setAll = (level: string) => setEditing({ ...editing, permissions: Object.fromEntries(SECTIONS.map(s => [s.key, s.key === 'members' && level === 'edit' ? 'view' : level])) })

  return (
    <Card title="Project members" action={isManager && <button className="btn-primary" onClick={() => openMember({ ...EMPTY, permissions: { ...EMPTY.permissions } })}>+ Member</button>}>
      <ErrorBanner error={editing ? '' : error} />
      {!isManager && <p style={{ fontSize: '11px', color: '#64748B', marginTop: 0 }}>Only project managers can add members or change their authorisations.</p>}
      <Table headers={['Name', 'Email', 'Phone', 'Project role', 'Company role', 'Authorisations', '']} empty={members.length === 0}>
        {members.map(m => (
          <tr key={m.id}>
            <td style={{ ...TD, fontWeight: 600 }}>
              {isManager ? <button style={LINK_BTN} onClick={() => openMember({ ...m })}>{m.name}</button> : m.name}
              {m.contact_id && <a href={`/contacts/${m.contact_id}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '6px', fontSize: '10px', color: '#94A3B8' }}>↗ contact</a>}
            </td>
            <td style={TD}><a href={`mailto:${m.email}`} style={{ color: '#219BD6' }}>{m.email}</a></td>
            <td style={TD}>{m.phone || '—'}</td>
            <td style={TD}>{m.project_role || '—'}</td>
            <td style={TD}>{m.company_role || '—'}</td>
            <td style={{ ...TD, maxWidth: '320px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {SECTIONS.filter(s => (m.permissions?.[s.key] || 'none') !== 'none').map(s => (
                  <Badge key={s.key} value={`${s.label}${m.permissions[s.key] === 'edit' ? ' ✎' : ''}`} tone={m.permissions[s.key] === 'edit' ? 'blue' : 'grey'} />
                ))}
              </div>
            </td>
            <td style={TD}>{isManager && <button aria-label={`Remove ${m.name}`} style={DEL_BTN} onClick={() => remove(m)}>×</button>}</td>
          </tr>
        ))}
      </Table>

      {editing && (
        <Modal title={editing.id ? 'Edit member' : 'New member'} onClose={() => setEditing(null)} onSave={save} saving={busy} width={720}>
          <div style={{ gridColumn: '1 / -1' }}><ErrorBanner error={error} /></div>

          {!editing.id && !creatingContact && (
            <div style={{ gridColumn: '1 / -1', background: '#F8FAFC', border: '1px solid #EDF2F7', borderRadius: '8px', padding: '12px' }}>
              <span className="form-label">Link to a contact</span>
              <input className="form-input" placeholder="Search by name or email…" value={contactQuery} onChange={e => setContactQuery(e.target.value)} />
              {contactResults.length > 0 && (
                <div style={{ marginTop: '6px', border: '1px solid #EDF2F7', borderRadius: '6px', overflow: 'hidden' }}>
                  {contactResults.map(c => (
                    <button key={c.id} type="button" onClick={() => applyContact(c)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', borderBottom: '1px solid #F1F5F9', background: 'white', cursor: 'pointer' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>{contactName(c)}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>{c.email || '—'} · {c.company?.name || c.partner?.name || '—'}</div>
                    </button>
                  ))}
                </div>
              )}
              {editing.contact_id && <p style={{ fontSize: '11px', color: '#059669', margin: '6px 0 0' }}>✓ Linked to a contact.</p>}
              <p style={{ fontSize: '11px', margin: '8px 0 0' }}>
                Can't find them? <button style={LINK_BTN} onClick={() => setCreatingContact({ ...EMPTY_NEW_CONTACT })}>+ Create new contact</button>
              </p>
            </div>
          )}

          {creatingContact && (
            <div style={{ gridColumn: '1 / -1', background: '#F8FAFC', border: '1px solid #EDF2F7', borderRadius: '8px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="form-label">New contact</span>
                <button style={LINK_BTN} onClick={() => setCreatingContact(null)}>Cancel</button>
              </div>
              <ErrorBanner error={contactError} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                <Field label="First name *"><input className="form-input" value={creatingContact.first_name} onChange={e => setCreatingContact({ ...creatingContact, first_name: e.target.value })} /></Field>
                <Field label="Last name *"><input className="form-input" value={creatingContact.last_name} onChange={e => setCreatingContact({ ...creatingContact, last_name: e.target.value })} /></Field>
                <Field label="Position"><input className="form-input" value={creatingContact.job_name} onChange={e => setCreatingContact({ ...creatingContact, job_name: e.target.value })} /></Field>
                <Field label="Mobile phone"><input className="form-input" value={creatingContact.mobile_phone} onChange={e => setCreatingContact({ ...creatingContact, mobile_phone: e.target.value })} /></Field>
                <Field label="Email"><input className="form-input" type="email" value={creatingContact.email} onChange={e => setCreatingContact({ ...creatingContact, email: e.target.value })} /></Field>
                <Field label="Preferred language">
                  <select className="form-input" value={creatingContact.preferred_language} onChange={e => setCreatingContact({ ...creatingContact, preferred_language: e.target.value })}>
                    <option value="">Select language…</option>
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Number format">
                  <select className="form-input" value={creatingContact.number_format} onChange={e => setCreatingContact({ ...creatingContact, number_format: e.target.value })}>
                    {NUMBER_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </Field>
                <Field label="Currency">
                  <select className="form-input" value={creatingContact.currency} onChange={e => setCreatingContact({ ...creatingContact, currency: e.target.value })}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Subscriptions" full>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    <span style={{ fontSize: '11px', background: '#EFF8FD', color: '#144766', fontWeight: 700, padding: '4px 8px', borderRadius: '6px' }}>✓ Operation (required)</span>
                    {NEW_CONTACT_SUBSCRIPTIONS.map(sub => (
                      <label key={sub} style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input type="checkbox" checked={creatingContact.subscriptions.includes(sub)}
                          onChange={() => setCreatingContact({ ...creatingContact, subscriptions: creatingContact.subscriptions.includes(sub) ? creatingContact.subscriptions.filter((s: string) => s !== sub) : [...creatingContact.subscriptions, sub] })} />
                        {sub}
                      </label>
                    ))}
                  </div>
                </Field>
              </div>
              <div style={{ textAlign: 'right', marginTop: '10px' }}>
                <button className="btn-primary" onClick={createContact} disabled={contactBusy}>{contactBusy ? 'Creating…' : 'Create & link'}</button>
              </div>
            </div>
          )}

          <Field label="Name *"><input className="form-input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="Email *"><input className="form-input" type="email" value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} /></Field>
          <Field label="Phone"><input className="form-input" value={editing.phone || ''} onChange={e => setEditing({ ...editing, phone: e.target.value })} /></Field>
          <Field label="Project role"><input className="form-input" placeholder="e.g. Project Manager, Key User" value={editing.project_role || ''} onChange={e => setEditing({ ...editing, project_role: e.target.value })} /></Field>
          <Field label="Company role" full><input className="form-input" placeholder="e.g. CFO, IT Director" value={editing.company_role || ''} onChange={e => setEditing({ ...editing, company_role: e.target.value })} /></Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="form-label">Authorisations on this project</span>
              <span style={{ fontSize: '11px', display: 'flex', gap: '10px' }}>
                Set all: <button style={LINK_BTN} onClick={() => setAll('none')}>None</button><button style={LINK_BTN} onClick={() => setAll('view')}>View</button><button style={LINK_BTN} onClick={() => setAll('edit')}>Edit</button>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 16px', marginTop: '6px' }}>
              {SECTIONS.map(s => (
                <label key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', gap: '8px' }}>
                  {s.label}
                  <select className="form-input" style={{ width: '90px', padding: '4px 6px' }} value={editing.permissions?.[s.key] || 'none'}
                    onChange={e => setEditing({ ...editing, permissions: { ...editing.permissions, [s.key]: e.target.value } })}>
                    <option value="none">None</option><option value="view">View</option>
                    {s.key !== 'members' && <option value="edit">Edit</option>}
                  </select>
                </label>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: '#94A3B8', marginBottom: 0 }}>The member also needs access to Operations › Project Management in WHUBBI permissions.</p>
          </div>
        </Modal>
      )}
    </Card>
  )
}
