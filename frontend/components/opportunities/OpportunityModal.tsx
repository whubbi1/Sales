'use client'
// components/opportunities/OpportunityModal.tsx
import { useState, useEffect } from 'react'
import { opportunitiesAPI, companiesAPI, contactsAPI, partnersAPI } from '@/lib/api'

const DEAL_STATUSES = ['Presentation To Be Scheduled','Presentation Done','Proposition Ongoing','Proposition Accepted','Contract Ongoing','Contract Finalised','PO Received','Contract Lost']
const PROJECT_STATUSES = ['Daily Invoicing','Project','Software Licenses']
const DEAL_TYPES = ['SAP','GRC','Smart Global Governance','SecurityBridge','Onapsis','BowBridge IBM OpenPages']

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
  const [consultantInput, setConsultantInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toDateStr = (d?: string) => d ? new Date(d).toISOString().split('T')[0] : ''

  const [form, setForm] = useState({
    deal_name: opportunity?.deal_name || '',
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
    contracting_party: opportunity?.contracting_party || '',
    deal_type: opportunity?.deal_type || '',
    notes: opportunity?.notes || '',
    assigned_to: opportunity?.assigned_to || '',
    contact_ids: opportunity?.contacts?.map((c: any) => c.id) || [],
  })

  useEffect(() => {
    Promise.all([companiesAPI.list({}), contactsAPI.list({}), partnersAPI.list({})]).then(([c, ct, p]) => {
      setCompanies(c); setContacts(ct); setPartners(p)
    }).catch(() => {})
  }, [])

  const toggleContact = (contactId: string) => {
    setForm(p => ({
      ...p,
      contact_ids: p.contact_ids.includes(contactId)
        ? p.contact_ids.filter((id: string) => id !== contactId)
        : [...p.contact_ids, contactId]
    }))
  }

  const addConsultant = () => {
    const c = consultantInput.trim()
    if (c && !form.assigned_consultants.includes(c)) {
      setForm(p => ({ ...p, assigned_consultants: [...p.assigned_consultants, c] }))
      setConsultantInput('')
    }
  }

  const handleSave = async () => {
    if (!form.deal_name.trim()) { setError('Deal name is required'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        company_id: form.company_id && form.company_id.trim() !== '' ? form.company_id : null,
        partner_id: form.partner_id && form.partner_id.trim() !== '' ? form.partner_id : null,
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
              <FormField label="Deal Name *" full>
                <input className="form-input" value={form.deal_name} onChange={e => setForm(p => ({ ...p, deal_name: e.target.value }))} placeholder="S001 - Company - Project" />
              </FormField>
              <FormField label="Deal ID">
                <input className="form-input" value={form.deal_id} onChange={e => setForm(p => ({ ...p, deal_id: e.target.value }))} placeholder="S001" />
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
                <input className="form-input" value={form.contracting_party} onChange={e => setForm(p => ({ ...p, contracting_party: e.target.value }))} placeholder="Company name" />
              </FormField>
              <FormField label="Assigned To">
                <input className="form-input" value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} placeholder="Sales rep" />
              </FormField>
            </div>
          </div>

          <div>
            <p className="section-label">Assigned Consultants</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input className="form-input" value={consultantInput} onChange={e => setConsultantInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addConsultant()} placeholder="Consultant name..." style={{ flex: 1 }} />
              <button className="btn-secondary" onClick={addConsultant}>Add</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {form.assigned_consultants.map((c: string) => (
                <span key={c} style={{ background: '#EFF6FF', color: '#2563EB', padding: '3px 9px', borderRadius: '12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {c}
                  <button onClick={() => setForm(p => ({ ...p, assigned_consultants: p.assigned_consultants.filter((x: string) => x !== c) }))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563EB', fontSize: '13px', lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
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
