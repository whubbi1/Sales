'use client'
// components/contacts/ContactModal.tsx
import { useState, useEffect } from 'react'
import { contactsAPI, companiesAPI, partnersAPI, marketingAPI, projectsAPI } from '@/lib/api'

const JOB_TYPES = ['CIO','CTO','CISO','SAP Manager','SAP Architect','SAP GRC','SAP Security Manager','SAP Technical Manager','Cybersecurity Architect','SOC Manager','Internal Audit','CFO','Partner','Buyer','Other']
const SUBSCRIPTIONS = ['Marketing Information','Customer Service Communication','One to One','Opted Out']
const DATA_SOURCE_OPTIONS = ['LinkedIn', 'Event', 'Project', 'Partner']
const LANGUAGES = ['Afrikaans','Albanian','Amharic','Arabic','Armenian','Azerbaijani','Basque','Belarusian','Bengali','Bosnian','Bulgarian','Catalan','Chinese (Simplified)','Chinese (Traditional)','Croatian','Czech','Danish','Dutch','English','Estonian','Finnish','French','Georgian','German','Greek','Gujarati','Hebrew','Hindi','Hungarian','Icelandic','Indonesian','Irish','Italian','Japanese','Kazakh','Korean','Latvian','Lithuanian','Macedonian','Malay','Maltese','Mongolian','Nepali','Norwegian','Persian','Polish','Portuguese','Romanian','Russian','Serbian','Slovak','Slovenian','Spanish','Swahili','Swedish','Tamil','Telugu','Thai','Turkish','Ukrainian','Urdu','Vietnamese','Welsh']

// FormField MUST be outside modal to avoid focus loss on re-render
function FormField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

// Maps a Data Source ref type to how to fetch/list/label its records — mirrors the
// same config on the contact detail page (frontend/app/contacts/[id]/page.tsx).
const REF_TYPE_CONFIG: Record<string, { fetch: () => Promise<any[]>; label: (r: any) => string }> = {
  Event:   { fetch: () => marketingAPI.listEvents().then((d: any) => d.events || []), label: (r: any) => r.title },
  Project: { fetch: () => projectsAPI.list(), label: (r: any) => r.project_name },
  Partner: { fetch: () => partnersAPI.list(), label: (r: any) => r.name },
}

export function ContactModal({ contact, onClose, onSave }: any) {
  const [companies, setCompanies] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [dataSourceRefOptions, setDataSourceRefOptions] = useState<any[]>([])
  const [form, setForm] = useState({
    first_name: contact?.first_name || '',
    last_name: contact?.last_name || '',
    company_id: contact?.company_id || contact?.company?.id || '',
    partner_id: contact?.partner_id || contact?.partner?.id || '',
    email: contact?.email || '',
    mobile_phone: contact?.mobile_phone || '',
    office_phone: contact?.office_phone || '',
    linkedin_url: contact?.linkedin_url || '',
    job_name: contact?.job_name || '',
    job_type: contact?.job_type || '',
    lead_status: contact?.lead_status || 'New',
    preferred_language: contact?.preferred_language || '',
    subscriptions: contact?.subscriptions || [],
    assigned_to: contact?.assigned_to || '',
    assigned_to_email: contact?.assigned_to_email || '',
    notes: contact?.notes || '',
    data_source: contact?.data_source || 'LinkedIn',
    data_source_ref_type: contact?.data_source_ref_type || '',
    data_source_ref_id: contact?.data_source_ref_id || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [enriching, setEnriching] = useState(false)
  const [enrichNote, setEnrichNote] = useState('')
  const [optOutReason, setOptOutReason] = useState('')
  const wasOptedOut = (contact?.subscriptions || []).includes('Opted Out')

  useEffect(() => {
    companiesAPI.list({}).then(setCompanies).catch(() => {})
    partnersAPI.list({}).then(setPartners).catch(() => {})
    fetch('https://api.whubbi.wcomply.com/settings/users').then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [])

  useEffect(() => {
    const cfg = REF_TYPE_CONFIG[form.data_source]
    if (!cfg) { setDataSourceRefOptions([]); return }
    cfg.fetch().then(setDataSourceRefOptions).catch(() => setDataSourceRefOptions([]))
  }, [form.data_source])

  const onDataSourceChange = (v: string) => {
    setForm(p => ({ ...p, data_source: v, data_source_ref_type: v === 'LinkedIn' ? '' : v, data_source_ref_id: v === p.data_source ? p.data_source_ref_id : '' }))
  }

  // Fills in only whatever's currently empty — never overwrites something the user
  // already typed. Works the same way whether creating (fill in the blanks) or editing
  // an existing contact (re-fetch to fill in anything still missing).
  const fetchFromLinkedIn = async () => {
    const url = form.linkedin_url.trim()
    if (!url) return
    setEnriching(true); setEnrichNote('')
    try {
      const data = await contactsAPI.linkedinEnrich(url)
      setForm(p => ({
        ...p,
        first_name: p.first_name || data.first_name || p.first_name,
        last_name: p.last_name || data.last_name || p.last_name,
        job_name: p.job_name || data.job_name || p.job_name,
        job_type: p.job_type || (JOB_TYPES.includes(data.job_type) ? data.job_type : '') || p.job_type,
      }))
      if (data.company_name && !form.company_id && !form.partner_id) {
        const match = companies.find((c: any) => c.name.toLowerCase() === data.company_name.toLowerCase())
        if (match) setForm(p => ({ ...p, company_id: match.id }))
        else setEnrichNote(`Detected company "${data.company_name}" — not found in the system, link it manually if needed.`)
      }
    } catch (e: any) { setEnrichNote(e.message) }
    finally { setEnriching(false) }
  }

  // Companies and Partners are two separate underlying links (company_id/partner_id), but a
  // contact only ever belongs to one of them — presented as a single merged picker instead of
  // two dropdowns where picking one is supposed to imply "not the other".
  const companyPartnerOptions = [
    ...companies.map((c: any) => ({ value: `company:${c.id}`, label: c.name })),
    ...partners.map((p: any) => ({ value: `partner:${p.id}`, label: p.name })),
  ].sort((a, b) => a.label.localeCompare(b.label))
  const companyPartnerValue = form.company_id ? `company:${form.company_id}` : form.partner_id ? `partner:${form.partner_id}` : ''
  const onCompanyPartnerChange = (v: string) => {
    const [kind, id] = v.split(':')
    setForm(p => ({ ...p, company_id: kind === 'company' ? id : '', partner_id: kind === 'partner' ? id : '' }))
  }

  const toggleSub = (sub: string) => {
    setForm(p => {
      const isOn = p.subscriptions.includes(sub)
      let subscriptions = isOn ? p.subscriptions.filter((s: string) => s !== sub) : [...p.subscriptions, sub]
      // Opted Out and Marketing Information are mutually exclusive — activating one
      // clears the other, since an opted-out contact can never receive marketing.
      if (sub === 'Opted Out' && !isOn) subscriptions = subscriptions.filter((s: string) => s !== 'Marketing Information')
      if (sub === 'Marketing Information' && !isOn) subscriptions = subscriptions.filter((s: string) => s !== 'Opted Out')
      return { ...p, subscriptions }
    })
  }

  const isOptedOut = form.subscriptions.includes('Opted Out')
  const optOutJustActivated = isOptedOut && !wasOptedOut

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) { setError('First and last name are required'); return }
    if (optOutJustActivated && !optOutReason.trim()) { setError('Please explain why this contact is being opted out'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        company_id: form.company_id || null,
        partner_id: form.partner_id || null,
        data_source_ref_type: form.data_source_ref_type || null,
        data_source_ref_id: form.data_source_ref_id || null,
      }
      let contactId = contact?.id
      if (contact) { await contactsAPI.update(contact.id, payload) }
      else { const created = await contactsAPI.create(payload); contactId = created.id }
      if (optOutJustActivated && contactId) await contactsAPI.createNote(contactId, { content: `Opted out: ${optOutReason.trim()}` })
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>
            {contact ? 'Edit Contact' : 'New Contact'}
            {contact?.internal_id && <span style={{ fontSize: '11px', fontWeight: '600', color: '#9B9B9B', marginLeft: '8px' }}>{contact.internal_id}</span>}
          </h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

          <div>
            <p className="section-label">Identity</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <FormField label="First Name *">
                <input className="form-input" value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} placeholder="Marie" />
              </FormField>
              <FormField label="Last Name *">
                <input className="form-input" value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} placeholder="Dupont" />
              </FormField>
              <FormField label="Company / Partner" full>
                <select className="form-input" value={companyPartnerValue} onChange={e => onCompanyPartnerChange(e.target.value)}>
                  <option value="">None</option>
                  {companyPartnerOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FormField>
              <FormField label="Lead Status">
                <select className="form-input" value={form.lead_status} onChange={e => setForm(p => ({ ...p, lead_status: e.target.value }))}>
                  <option value="New">New</option>
                  <option value="Open">Open</option>
                  <option value="Connected">Connected</option>
                </select>
              </FormField>
              <FormField label="Data Source">
                <select className="form-input" value={form.data_source} onChange={e => onDataSourceChange(e.target.value)}>
                  {DATA_SOURCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </FormField>
              {form.data_source !== 'LinkedIn' && (
                <FormField label={`Select ${form.data_source}`}>
                  <select className="form-input" value={form.data_source_ref_id} onChange={e => setForm(p => ({ ...p, data_source_ref_id: e.target.value }))}>
                    <option value="">None selected…</option>
                    {dataSourceRefOptions.map((r: any) => <option key={r.id} value={r.id}>{REF_TYPE_CONFIG[form.data_source].label(r)}</option>)}
                  </select>
                </FormField>
              )}
            </div>
          </div>

          <div>
            <p className="section-label">Contact Information</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <FormField label="Email">
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="marie@company.com" />
              </FormField>
              <FormField label="Mobile Phone">
                <input className="form-input" value={form.mobile_phone} onChange={e => setForm(p => ({ ...p, mobile_phone: e.target.value }))} placeholder="+32 470 00 00 00" />
              </FormField>
              <FormField label="Office Phone">
                <input className="form-input" value={form.office_phone} onChange={e => setForm(p => ({ ...p, office_phone: e.target.value }))} placeholder="+32 2 000 00 00" />
              </FormField>
              <FormField label="LinkedIn" full>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input className="form-input" style={{ flex: 1 }} value={form.linkedin_url} onChange={e => setForm(p => ({ ...p, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/..." />
                  <button type="button" className="btn-secondary" onClick={fetchFromLinkedIn} disabled={!form.linkedin_url.trim() || enriching} style={{ whiteSpace: 'nowrap' }}>
                    {enriching ? 'Fetching…' : contact ? '↻ Update from LinkedIn' : '⬇ Fetch from LinkedIn'}
                  </button>
                </div>
                {enrichNote && <p style={{ fontSize: '11px', color: '#D97706', margin: '6px 0 0' }}>{enrichNote}</p>}
              </FormField>
            </div>
          </div>

          <div>
            <p className="section-label">Professional</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <FormField label="Job Title">
                <input className="form-input" value={form.job_name} onChange={e => setForm(p => ({ ...p, job_name: e.target.value }))} placeholder="SAP Security Manager" />
              </FormField>
              <FormField label="Job Type">
                <select className="form-input" value={form.job_type} onChange={e => setForm(p => ({ ...p, job_type: e.target.value }))}>
                  <option value="">Select job type...</option>
                  {JOB_TYPES.map(jt => <option key={jt} value={jt}>{jt}</option>)}
                </select>
              </FormField>
              <FormField label="Preferred Language">
                <select className="form-input" value={form.preferred_language} onChange={e => setForm(p => ({ ...p, preferred_language: e.target.value }))}>
                  <option value="">Select language...</option>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </FormField>
              <FormField label="Assigned To">
                <select className="form-input" value={form.assigned_to_email} onChange={e => {
                  const u = users.find((uu: any) => uu.email === e.target.value)
                  setForm(p => ({ ...p, assigned_to_email: e.target.value, assigned_to: u ? (u.display_name || `${u.first_name} ${u.last_name}`) : '' }))
                }}>
                  <option value="">Select employee…</option>
                  {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
                </select>
              </FormField>
            </div>
          </div>

          <div>
            <p className="section-label">Subscriptions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SUBSCRIPTIONS.map(sub => {
                const disabled = sub === 'Marketing Information' && isOptedOut
                return (
                  <label key={sub} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', border: `1.5px solid ${form.subscriptions.includes(sub) ? (sub === 'Opted Out' ? '#DC2626' : '#219BD6') : '#E2E8F0'}`, borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer', background: disabled ? '#F8FAFC' : form.subscriptions.includes(sub) ? (sub === 'Opted Out' ? '#FEF2F2' : '#EFF8FD') : 'white' }}>
                    <input type="checkbox" checked={form.subscriptions.includes(sub)} disabled={disabled} onChange={() => toggleSub(sub)} style={{ accentColor: sub === 'Opted Out' ? '#DC2626' : '#219BD6', width: '14px', height: '14px' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: disabled ? '#9B9B9B' : form.subscriptions.includes(sub) ? '#144766' : '#6B6B6B' }}>{sub}</span>
                    {disabled && <span style={{ fontSize: '11px', color: '#9B9B9B' }}>— blocked while Opted Out is active</span>}
                  </label>
                )
              })}
            </div>
            {optOutJustActivated && (
              <FormField label="Reason for opting out *" full>
                <textarea className="form-input" value={optOutReason} onChange={e => setOptOutReason(e.target.value)} placeholder="Explain why this contact is being opted out…" rows={2} style={{ resize: 'vertical', marginTop: '8px' }} />
              </FormField>
            )}
          </div>

          <FormField label="Notes" full>
            <textarea className="form-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." rows={3} style={{ resize: 'vertical' }} />
          </FormField>

          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : contact ? 'Save Changes' : 'Create Contact'}</button>
        </div>
      </div>
    </div>
  )
}
