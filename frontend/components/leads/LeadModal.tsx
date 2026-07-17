'use client'
import { useState, useEffect } from 'react'
import { leadsAPI, companiesAPI, partnersAPI } from '@/lib/api'

const ORIGINS = ['Referral', 'Website', 'Cold Outreach', 'Event', 'Partner', 'Inbound', 'Other']
const STATUSES = ['Open', 'In Progress', 'Closed', 'Create an Opportunity']

function FormField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

export function LeadModal({ lead, initialCompanyId, onClose, onSave }: any) {
  const [companies, setCompanies] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [companyContacts, setCompanyContacts] = useState<any[]>([])
  const [partnerContacts, setPartnerContacts] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toDateStr = (d?: string) => d ? new Date(d).toISOString().split('T')[0] : ''

  const [form, setForm] = useState({
    title: lead?.title || '',
    company_id: lead?.company_id || (!lead ? initialCompanyId : '') || '',
    contact_id: lead?.contact_id || '',
    partner_ids: (lead?.partners || []).map((p: any) => p.id) as string[],
    partner_contact_ids: (lead?.partner_contacts || []).map((c: any) => c.id) as string[],
    start_date: toDateStr(lead?.start_date),
    end_date: toDateStr(lead?.end_date),
    origin: lead?.origin || '',
    status: lead?.status || 'Open',
  })

  useEffect(() => {
    companiesAPI.list({}).then(setCompanies).catch(() => {})
    partnersAPI.list({}).then(setPartners).catch(() => {})
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
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        origin: form.origin || null,
        status: form.status,
      }
      if (lead) await leadsAPI.update(lead.id, payload)
      else await leadsAPI.create(payload)
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>{lead ? 'Edit Lead' : 'New Lead'}</h2>
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
          <FormField label="Lead Status">
            <select className="form-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
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
