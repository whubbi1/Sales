'use client'
// components/opportunities/OpportunityModal.tsx
import { useState, useEffect } from 'react'
import { opportunitiesAPI, companiesAPI, contactsAPI, partnersAPI } from '@/lib/api'

const DEAL_STATUSES = ['Presentation To Be Scheduled','Presentation Done','Proposition Ongoing','Proposition Accepted','Contract Ongoing','Contract Finalised','PO Received','Contract Lost']
const PROJECT_STATUSES = ['Daily Invoicing','Project','Software Licenses']
const DEAL_TYPES = ['SAP','GRC','Smart Global Governance','SecurityBridge','Onapsis','BowBridge IBM OpenPages']

// Mirrors compute_deal_name() in backend/app/services/ids.py — preview only, the
// authoritative value always comes back from the server on save.
function dealNamePreview(closingDate: string, companyName?: string, partnerName?: string, projectName?: string) {
  let quarterLabel = 'TBD'
  if (closingDate) {
    const d = new Date(closingDate)
    const quarter = Math.floor(d.getUTCMonth() / 3) + 1
    quarterLabel = `Q${quarter}${String(d.getUTCFullYear()).slice(-2)}`
  }
  return [quarterLabel, companyName, partnerName, projectName].filter(Boolean).join(' - ')
}

// FormField MUST be outside modal to avoid focus loss on re-render
function FormField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

export function OpportunityModal({ opportunity, onClose, onSave }: any) {
  const [companies, setCompanies] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toDateStr = (d?: string) => d ? new Date(d).toISOString().split('T')[0] : ''

  const [form, setForm] = useState({
    company_id: opportunity?.company_id || opportunity?.company?.id || '',
    partner_id: opportunity?.partner_id || opportunity?.partner?.id || '',
    deal_id: opportunity?.deal_id || '',
    project_name: opportunity?.project_name || '',
    deal_amount: opportunity?.deal_amount || '',
    closing_date: toDateStr(opportunity?.closing_date),
    deal_status: opportunity?.deal_status || 'Presentation To Be Scheduled',
    assigned_consultants: opportunity?.assigned_consultants || [],
    contract_start_date: toDateStr(opportunity?.contract_start_date),
    contract_end_date: toDateStr(opportunity?.contract_end_date),
    project_status: opportunity?.project_status || '',
    contracting_party_id: opportunity?.contracting_party_id || opportunity?.contracting_party_company?.id || '',
    contracting_party: opportunity?.contracting_party || '',
    deal_type: opportunity?.deal_type || '',
    notes: opportunity?.notes || '',
    assigned_to: opportunity?.assigned_to || '',
    assigned_to_email: opportunity?.assigned_to_email || '',
    contact_ids: opportunity?.contacts?.map((c: any) => c.id) || [],
  })

  useEffect(() => {
    Promise.all([companiesAPI.list({}), contactsAPI.list({}), partnersAPI.list({})]).then(([c, ct, p]) => {
      setCompanies(c); setContacts(ct); setPartners(p)
    }).catch(() => {})
    fetch('https://api.whubbi.wcomply.com/settings/users').then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [])

  const selectedCompany = companies.find((c: any) => c.id === form.company_id)
  const selectedPartner = partners.find((p: any) => p.id === form.partner_id)
  const dealNamePreviewText = dealNamePreview(form.closing_date, selectedCompany?.name, selectedPartner?.name, form.project_name)

  const toggleContact = (contactId: string) => {
    setForm(p => ({
      ...p,
      contact_ids: p.contact_ids.includes(contactId)
        ? p.contact_ids.filter((id: string) => id !== contactId)
        : [...p.contact_ids, contactId]
    }))
  }

  const toggleConsultant = (u: any) => {
    setForm(p => ({
      ...p,
      assigned_consultants: p.assigned_consultants.some((c: any) => c.email === u.email)
        ? p.assigned_consultants.filter((c: any) => c.email !== u.email)
        : [...p.assigned_consultants, { email: u.email, name: u.display_name || `${u.first_name} ${u.last_name}` }]
    }))
  }

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        company_id: form.company_id && form.company_id.trim() !== '' ? form.company_id : null,
        partner_id: form.partner_id && form.partner_id.trim() !== '' ? form.partner_id : null,
        contracting_party_id: form.contracting_party_id && form.contracting_party_id.trim() !== '' ? form.contracting_party_id : null,
        deal_amount: form.deal_amount ? Number(form.deal_amount) : null,
        closing_date: form.closing_date || null,
        contract_start_date: form.contract_start_date || null,
        contract_end_date: form.contract_end_date || null,
        project_status: form.project_status || null,
        deal_type: form.deal_type || null,
      }
      if (opportunity) { await opportunitiesAPI.update(opportunity.id, payload) }
      else { await opportunitiesAPI.create(payload) }
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>{opportunity ? 'Edit Opportunity' : 'New Opportunity'}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

          <div>
            <p className="section-label">Deal Information</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <FormField label="Deal Name (auto-generated)" full>
                <input className="form-input" value={dealNamePreviewText} readOnly disabled style={{ color: '#6B7280', background: '#F8FAFC' }} />
              </FormField>
              <FormField label="Deal ID">
                <input className="form-input" value={form.deal_id || '(auto-generated after save)'} readOnly disabled style={{ color: '#6B7280', background: '#F8FAFC' }} />
              </FormField>
              <FormField label="Project Name">
                <input className="form-input" value={form.project_name} onChange={e => setForm(p => ({ ...p, project_name: e.target.value }))} placeholder="SAP RISE Migration" />
              </FormField>
              <FormField label="Company">
                <select className="form-input" value={form.company_id} onChange={e => setForm(p => ({ ...p, company_id: e.target.value }))}>
                  <option value="">No company</option>
                  {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FormField>
              <FormField label="Partner">
                <select className="form-input" value={form.partner_id} onChange={e => setForm(p => ({ ...p, partner_id: e.target.value }))}>
                  <option value="">No partner</option>
                  {partners.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </FormField>
              <FormField label="Deal Type">
                <select className="form-input" value={form.deal_type} onChange={e => setForm(p => ({ ...p, deal_type: e.target.value }))}>
                  <option value="">Select deal type...</option>
                  {DEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Deal Status">
                <select className="form-input" value={form.deal_status} onChange={e => setForm(p => ({ ...p, deal_status: e.target.value }))}>
                  {DEAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
            </div>
          </div>

          <div>
            <p className="section-label">Financial & Timeline</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <FormField label="Deal Amount (EUR)">
                <input className="form-input" type="number" value={form.deal_amount} onChange={e => setForm(p => ({ ...p, deal_amount: e.target.value }))} placeholder="50000" />
              </FormField>
              <FormField label="Closing Date">
                <input className="form-input" type="date" value={form.closing_date} onChange={e => setForm(p => ({ ...p, closing_date: e.target.value }))} />
              </FormField>
              <FormField label="Contract Start Date">
                <input className="form-input" type="date" value={form.contract_start_date} onChange={e => setForm(p => ({ ...p, contract_start_date: e.target.value }))} />
              </FormField>
              <FormField label="Contract End Date">
                <input className="form-input" type="date" value={form.contract_end_date} onChange={e => setForm(p => ({ ...p, contract_end_date: e.target.value }))} />
              </FormField>
            </div>
          </div>

          <div>
            <p className="section-label">Project Details</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <FormField label="Project Status">
                <select className="form-input" value={form.project_status} onChange={e => setForm(p => ({ ...p, project_status: e.target.value }))}>
                  <option value="">Select...</option>
                  {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="Contracting Party">
                <select className="form-input" value={form.contracting_party_id} onChange={e => {
                  const c = companies.find((cc: any) => cc.id === e.target.value)
                  setForm(p => ({ ...p, contracting_party_id: e.target.value, contracting_party: c ? c.name : '' }))
                }}>
                  <option value="">Select company...</option>
                  {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FormField>
              <FormField label="Assigned To">
                <select className="form-input" value={form.assigned_to_email} onChange={e => {
                  const u = users.find((uu: any) => uu.email === e.target.value)
                  setForm(p => ({ ...p, assigned_to_email: e.target.value, assigned_to: u ? (u.display_name || `${u.first_name} ${u.last_name}`) : '' }))
                }}>
                  <option value="">Select employee...</option>
                  {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
                </select>
              </FormField>
            </div>
          </div>

          <div>
            <p className="section-label">Assigned Consultants</p>
            {form.assigned_consultants.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                {form.assigned_consultants.map((c: any) => (
                  <span key={c.email} style={{ background: '#EFF6FF', color: '#2563EB', padding: '3px 9px', borderRadius: '12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {c.name || c.email}
                    <button onClick={() => setForm(p => ({ ...p, assigned_consultants: p.assigned_consultants.filter((x: any) => x.email !== c.email) }))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563EB', fontSize: '13px', lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '4px' }}>
              {users.map((u: any) => {
                const checked = form.assigned_consultants.some((c: any) => c.email === u.email)
                return (
                  <label key={u.email} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', cursor: 'pointer', borderRadius: '6px', background: checked ? '#EFF8FD' : 'transparent' }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleConsultant(u)} style={{ accentColor: '#219BD6', width: '14px', height: '14px' }} />
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#144766' }}>{u.display_name || `${u.first_name} ${u.last_name}`}</div>
                  </label>
                )
              })}
            </div>
          </div>

          {contacts.length > 0 && (
            <div>
              <p className="section-label">Linked Contacts</p>
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '4px' }}>
                {contacts.map((c: any) => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', cursor: 'pointer', borderRadius: '6px', background: form.contact_ids.includes(c.id) ? '#EFF8FD' : 'transparent' }}>
                    <input type="checkbox" checked={form.contact_ids.includes(c.id)} onChange={() => toggleContact(c.id)} style={{ accentColor: '#219BD6', width: '14px', height: '14px' }} />
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#e97132', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', flexShrink: 0 }}>
                      {c.first_name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#144766' }}>{c.first_name} {c.last_name}</div>
                      <div style={{ fontSize: '10px', color: '#9B9B9B' }}>{c.job_type || c.email || ''}</div>
                    </div>
                  </label>
                ))}
              </div>
              {form.contact_ids.length > 0 && <p style={{ fontSize: '11px', color: '#219BD6', fontWeight: '600', marginTop: '6px' }}>{form.contact_ids.length} contact{form.contact_ids.length > 1 ? 's' : ''} selected</p>}
            </div>
          )}

          <FormField label="Notes" full>
            <textarea className="form-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." rows={3} style={{ resize: 'vertical' }} />
          </FormField>

          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : opportunity ? 'Save Changes' : 'Create Opportunity'}</button>
        </div>
      </div>
    </div>
  )
}
