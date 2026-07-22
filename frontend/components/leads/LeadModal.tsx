'use client'
import { useState, useEffect } from 'react'
import { leadsAPI, companiesAPI, partnersAPI, legalAPI, marketingAPI, contactsAPI } from '@/lib/api'

const ORIGINS = ['Referral', 'Website', 'Cold Outreach', 'Event', 'Partner', 'LinkedIn', 'Other']
const STATUSES = ['Open', 'In Progress', 'Closed', 'Create an Opportunity']
// Display-only relabeling — the underlying status value stays 'Create an Opportunity'
// everywhere it's stored/compared (DB enum, backend trigger logic), only how it reads changes.
const STATUS_LABELS: Record<string, string> = { 'Create an Opportunity': 'Converted to Opportunity' }

function FormField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

export function LeadModal({ lead, duplicateFrom, initialCompanyId, initialContactId, initialPartnerId, onClose, onSave }: any) {
  // duplicateFrom prefills the same as an existing lead would, but `lead` itself stays
  // undefined so handleSave below still creates a new record instead of updating one —
  // status/closed_at are deliberately NOT copied, a duplicate always starts fresh at Open.
  const src = lead || duplicateFrom
  const [companies, setCompanies] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [companyContacts, setCompanyContacts] = useState<any[]>([])
  const [partnerContacts, setPartnerContacts] = useState<any[]>([])
  const [operationalTeams, setOperationalTeams] = useState<any[]>([])
  const [salesTeams, setSalesTeams] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [allContacts, setAllContacts] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toDateStr = (d?: string) => d ? new Date(d).toISOString().split('T')[0] : ''
  const isClosed = lead?.status === 'Closed'

  const [form, setForm] = useState({
    title: src?.title || '',
    company_id: src?.company_id || (!lead ? initialCompanyId : '') || '',
    contact_id: src?.contact_id || (!lead ? initialContactId : '') || '',
    partner_ids: src ? (src.partners || []).map((p: any) => p.id) as string[] : (initialPartnerId ? [initialPartnerId] : []),
    partner_contact_ids: (src?.partner_contacts || []).map((c: any) => c.id) as string[],
    main_operational_team_id: src?.main_operational_team_id || '',
    sales_team_id: src?.sales_team_id || '',
    start_date: toDateStr(src?.start_date),
    end_date: toDateStr(src?.end_date),
    origin: src?.origin || '',
    event_id: src?.event_id || '',
    referral_contact_id: src?.referral_contact_id || '',
    status: duplicateFrom ? 'Open' : (src?.status || 'Open'),
  })

  useEffect(() => {
    companiesAPI.list({}).then(setCompanies).catch(() => {})
    partnersAPI.list({}).then(setPartners).catch(() => {})
    legalAPI.getOrgEntities('operational_team').then(d => setOperationalTeams(d.org_entities || [])).catch(() => {})
    legalAPI.getOrgEntities('sales_entity').then(d => setSalesTeams(d.org_entities || [])).catch(() => {})
    marketingAPI.listEvents().then(d => setEvents(d.events || [])).catch(() => {})
    contactsAPI.list({}).then(setAllContacts).catch(() => {})
  }, [])

  useEffect(() => {
    if (form.company_id) companiesAPI.getContacts(form.company_id).then(setCompanyContacts).catch(() => setCompanyContacts([]))
    else setCompanyContacts([])
  }, [form.company_id])

  useEffect(() => {
    if (form.partner_ids.length === 0) { setPartnerContacts([]); return }
    Promise.all(form.partner_ids.map((pid: string) => partnersAPI.getContacts(pid).catch(() => [])))
      .then(lists => {
        const merged = lists.flat()
        setPartnerContacts(merged)
        // Drop any previously-selected partner contact that's no longer reachable
        // through the currently-selected partners.
        setForm(p => ({ ...p, partner_contact_ids: p.partner_contact_ids.filter(id => merged.some((c: any) => c.id === id)) }))
      })
  }, [form.partner_ids.join(',')])

  const sortedCompanies = [...companies].sort((a, b) => a.name.localeCompare(b.name))
  const sortedPartners = [...partners].sort((a, b) => a.name.localeCompare(b.name))
  const sortedOperationalTeams = [...operationalTeams].sort((a, b) => a.title.localeCompare(b.title))
  const sortedSalesTeams = [...salesTeams].sort((a, b) => a.title.localeCompare(b.title))

  const togglePartner = (id: string) => {
    setForm(p => ({ ...p, partner_ids: p.partner_ids.includes(id) ? p.partner_ids.filter(x => x !== id) : [...p.partner_ids, id] }))
  }
  const togglePartnerContact = (id: string) => {
    setForm(p => ({ ...p, partner_contact_ids: p.partner_contact_ids.includes(id) ? p.partner_contact_ids.filter(x => x !== id) : [...p.partner_contact_ids, id] }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        title: form.title.trim(),
        company_id: form.company_id || null,
        contact_id: form.contact_id || null,
        partner_ids: form.partner_ids,
        partner_contact_ids: form.partner_contact_ids,
        main_operational_team_id: form.main_operational_team_id || null,
        sales_team_id: form.sales_team_id || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        origin: form.origin || null,
        event_id: form.origin === 'Event' ? (form.event_id || null) : null,
        referral_contact_id: form.origin === 'Referral' ? (form.referral_contact_id || null) : null,
        status: form.status,
      }
      const result = lead ? await leadsAPI.update(lead.id, payload) : await leadsAPI.create(payload)
      onSave(result)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>{lead ? 'Edit Lead' : duplicateFrom ? 'Duplicate Lead' : 'New Lead'}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <FormField label="Title *" full>
            <input className="form-input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="New SAP GRC opportunity" />
          </FormField>

          <FormField label="Company">
            <select className="form-input" value={form.company_id} onChange={e => setForm(p => ({ ...p, company_id: e.target.value, contact_id: '' }))}>
              <option value="">Select company…</option>
              {sortedCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Company Contact">
            <select className="form-input" value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))} disabled={!form.company_id}>
              <option value="">{form.company_id ? 'Select contact…' : 'Select a company first'}</option>
              {companyContacts.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </FormField>

          <FormField label="Partner(s)" full>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '90px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px' }}>
              {sortedPartners.length === 0 ? <span style={{ fontSize: '12px', color: '#9B9B9B' }}>No partners yet.</span> : sortedPartners.map((p: any) => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '3px 8px', borderRadius: '6px', background: form.partner_ids.includes(p.id) ? '#EEF2FF' : '#F8FAFC', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.partner_ids.includes(p.id)} onChange={() => togglePartner(p.id)} />
                  {p.name}
                </label>
              ))}
            </div>
          </FormField>
          <FormField label="Partner Contacts" full>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '90px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px' }}>
              {partnerContacts.length === 0 ? <span style={{ fontSize: '12px', color: '#9B9B9B' }}>{form.partner_ids.length ? 'No contacts for the selected partner(s).' : 'Select a partner first.'}</span> : partnerContacts.map((c: any) => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '3px 8px', borderRadius: '6px', background: form.partner_contact_ids.includes(c.id) ? '#EEF2FF' : '#F8FAFC', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.partner_contact_ids.includes(c.id)} onChange={() => togglePartnerContact(c.id)} />
                  {c.first_name} {c.last_name}
                </label>
              ))}
            </div>
          </FormField>

          <FormField label="Main Operational Team">
            <select className="form-input" value={form.main_operational_team_id} onChange={e => setForm(p => ({ ...p, main_operational_team_id: e.target.value }))}>
              <option value="">Select team…</option>
              {sortedOperationalTeams.map((t: any) => <option key={t.id} value={t.id}>{t.code} — {t.title}</option>)}
            </select>
          </FormField>
          <FormField label="Sales Team">
            <select className="form-input" value={form.sales_team_id} onChange={e => setForm(p => ({ ...p, sales_team_id: e.target.value }))}>
              <option value="">Select team…</option>
              {sortedSalesTeams.map((t: any) => <option key={t.id} value={t.id}>{t.code} — {t.title}</option>)}
            </select>
          </FormField>

          <FormField label="Start Date">
            <input className="form-input" type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
          </FormField>
          <FormField label="End Date">
            <input className="form-input" type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
          </FormField>

          <FormField label="Lead Origin">
            <select className="form-input" value={form.origin} onChange={e => setForm(p => ({ ...p, origin: e.target.value }))}>
              <option value="">Select origin…</option>
              {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </FormField>
          {form.origin === 'Event' && (
            <FormField label="Event">
              <select className="form-input" value={form.event_id} onChange={e => setForm(p => ({ ...p, event_id: e.target.value }))}>
                <option value="">Select event…</option>
                {[...events].sort((a: any, b: any) => a.title.localeCompare(b.title)).map((ev: any) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
            </FormField>
          )}
          {form.origin === 'Referral' && (
            <FormField label="Referral Contact">
              <select className="form-input" value={form.referral_contact_id} onChange={e => setForm(p => ({ ...p, referral_contact_id: e.target.value }))}>
                <option value="">Select contact…</option>
                {[...allContacts].sort((a: any, b: any) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)).map((c: any) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </FormField>
          )}
          <FormField label="Lead Status">
            <select className="form-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} disabled={isClosed}>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
            </select>
            {isClosed && <p style={{ fontSize: '11px', color: '#9B9B9B', margin: '4px 0 0' }}>Closed on {lead.closed_at ? new Date(lead.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} — a closed lead can't be reopened. Duplicate it to continue this work.</p>}
          </FormField>

          {error && <p style={{ color: '#DC2626', fontSize: '12px', gridColumn: '1/-1' }}>{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : lead ? 'Save' : 'Create Lead'}</button>
        </div>
      </div>
    </div>
  )
}
