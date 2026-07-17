'use client'
// components/companies/CompanyModal.tsx
import { useState, useEffect } from 'react'
import { companiesAPI, contactsAPI } from '@/lib/api'

const ERP_OPTIONS     = ["SAP", "Dynamics", "IFS", "Infor", "Odoo", "Oracle", "JDE", "SAGE", "Unknown", "Other"]
const CYBER_OPTIONS   = ["SAP ETD", "SAP GRC", "SAP Focused Run", "Cloud ALM", "SecurityBridge", "Onapsis", "Layer Seven Security", "Other"]
const GRC_OPTIONS     = ["Smart Global Governance", "IBM OpenPages", "Provigis", "Other"]
const HOSTING_OPTIONS = ["RISE", "AWS", "Azure", "GXP", "BLUE", "SENS", "Scaleway", "Private Datacenter", "Other"]
const LEVEL_LABELS: Record<number, string> = { 1: 'Level 1 - Group', 2: 'Level 2 - Parent', 3: 'Level 3 - Child', 4: 'Level 4 - Sub-Child' }

// FormField MUST be outside the modal component to avoid re-renders
function FormField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

export function CompanyModal({ company, companies = [], onClose, onSave }: any) {
  const [form, setForm] = useState({
    name: company?.name || '',
    main_contact_id: company?.main_contact_id || '',
    parent_id: company?.parent_id || '',
    level: company?.level || 1,
    domain_names: company?.domain_names || [],
    phone: company?.phone || '',
    sector: company?.sector || '',
    country: company?.country || '',
    status: company?.status || 'lead',
    main_erp: company?.main_erp || [],
    cybersecurity_solutions: company?.cybersecurity_solutions || [],
    grc_solutions: company?.grc_solutions || [],
    sap_hosting_partner: company?.sap_hosting_partner || [],
    linkedin_url: company?.linkedin_url || '',
    notes: company?.notes || '',
    assigned_to: company?.assigned_to || '',
    assigned_to_email: company?.assigned_to_email || '',
  })
  const [domainInput, setDomainInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [contacts, setContacts] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [enriching, setEnriching] = useState(false)
  const [enrichNote, setEnrichNote] = useState('')

  useEffect(() => {
    contactsAPI.list({}).then(setContacts).catch(() => {})
    fetch('https://api.whubbi.wcomply.com/settings/users').then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [])

  // Fills in only whatever's currently empty — never overwrites something the user
  // already typed. Works the same way whether creating (fill in the blanks) or editing
  // an existing company (re-fetch to fill in anything still missing).
  const fetchFromLinkedIn = async () => {
    const url = form.linkedin_url.trim()
    if (!url) return
    setEnriching(true); setEnrichNote('')
    try {
      const data = await companiesAPI.linkedinEnrich(url)
      setForm(p => ({
        ...p,
        name: p.name || data.name || p.name,
        sector: p.sector || data.sector || p.sector,
        country: p.country || data.country || p.country,
        domain_names: p.domain_names.length ? p.domain_names : (data.domain_names || []),
      }))
    } catch (e: any) { setEnrichNote(e.message) }
    finally { setEnriching(false) }
  }

  // Main Contact is scoped to contacts whose email domain matches one of this company's
  // domains — falls back to every contact when no domain is set yet, so the field isn't
  // uselessly empty for a company that hasn't been given a domain.
  const domainContacts = form.domain_names.length === 0 ? contacts : contacts.filter((c: any) => {
    const domain = (c.email || '').split('@')[1]?.toLowerCase()
    return domain && form.domain_names.some((d: string) => d.toLowerCase() === domain)
  })

  const toggle = (field: string, value: string) => {
    setForm(p => ({ ...p, [field]: (p as any)[field].includes(value) ? (p as any)[field].filter((v: string) => v !== value) : [...(p as any)[field], value] }))
  }

  const addDomain = () => {
    const d = domainInput.trim()
    if (d && !form.domain_names.includes(d)) {
      setForm(p => ({ ...p, domain_names: [...p.domain_names, d] }))
      setDomainInput('')
    }
  }

  const handleParentChange = (parentId: string) => {
    if (!parentId) { setForm(p => ({ ...p, parent_id: '', level: 1 })); return }
    const parent = companies.find((c: any) => c.id === parentId)
    setForm(p => ({ ...p, parent_id: parentId, level: Math.min((parent?.level || 0) + 1, 4) }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Company name is required'); return }
    setSaving(true); setError('')
    try {
      const payload = { ...form, parent_id: form.parent_id || null, main_contact_id: form.main_contact_id || null }
      if (company) { await companiesAPI.update(company.id, payload) }
      else { await companiesAPI.create(payload) }
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const availableParents = companies.filter((c: any) => c.id !== company?.id && c.level < 4)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>
            {company ? 'Edit Company' : 'New Company'}
            {company?.internal_id && <span style={{ fontSize: '11px', fontWeight: '600', color: '#9B9B9B', marginLeft: '8px' }}>{company.internal_id}</span>}
          </h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div>
            <p className="section-label">Company Information</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <FormField label="Company Name *">
                <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Acme Corp" />
              </FormField>
              <FormField label="Main Contact">
                <select className="form-input" value={form.main_contact_id} onChange={e => setForm(p => ({ ...p, main_contact_id: e.target.value }))}>
                  <option value="">Select contact…</option>
                  {domainContacts.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </FormField>
              <FormField label="Phone">
                <input className="form-input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555 000 0000" />
              </FormField>
              <FormField label="Sector">
                <input className="form-input" value={form.sector} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))} placeholder="Finance, Industry..." />
              </FormField>
              <FormField label="Country">
                <input className="form-input" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} placeholder="Belgium" />
              </FormField>
              <FormField label="Status">
                <select className="form-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="lead">Lead</option><option value="prospect">Prospect</option><option value="client">Client</option>{company && <option value="partner">Partner</option>}
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
            <p className="section-label">Hierarchy</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <FormField label="Parent Company">
                <select className="form-input" value={form.parent_id} onChange={e => handleParentChange(e.target.value)}>
                  <option value="">No parent (Top level)</option>
                  {availableParents.map((c: any) => <option key={c.id} value={c.id}>{'- '.repeat(c.level - 1)}{c.name} (L{c.level})</option>)}
                </select>
              </FormField>
              <FormField label="Level">
                <div className="form-input" style={{ background: '#F5F7FA', color: '#9B9B9B', cursor: 'default' }}>{LEVEL_LABELS[form.level]}</div>
              </FormField>
            </div>
          </div>

          <div>
            <p className="section-label">Domain Names</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input className="form-input" value={domainInput} onChange={e => setDomainInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDomain()} placeholder="example.com" style={{ flex: 1 }} />
              <button className="btn-secondary" onClick={addDomain}>Add</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {form.domain_names.map((d: string) => (
                <span key={d} style={{ background: '#EFF6FF', color: '#2563EB', padding: '3px 9px', borderRadius: '12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {d}<button onClick={() => setForm(p => ({ ...p, domain_names: p.domain_names.filter((x: string) => x !== d) }))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563EB', fontSize: '13px', lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
          </div>

          <FormField label="LinkedIn Company Page">
            <div style={{ display: 'flex', gap: '6px' }}>
              <input className="form-input" style={{ flex: 1 }} value={form.linkedin_url} onChange={e => setForm(p => ({ ...p, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/company/..." />
              <button type="button" className="btn-secondary" onClick={fetchFromLinkedIn} disabled={!form.linkedin_url.trim() || enriching} style={{ whiteSpace: 'nowrap' }}>
                {enriching ? 'Fetching…' : company ? '↻ Update from LinkedIn' : '⬇ Fetch from LinkedIn'}
              </button>
            </div>
            {enrichNote && <p style={{ fontSize: '11px', color: '#D97706', margin: '6px 0 0' }}>{enrichNote}</p>}
          </FormField>

          {[
            { label: 'Main ERP', field: 'main_erp', options: ERP_OPTIONS },
            { label: 'SAP Cybersecurity Solutions', field: 'cybersecurity_solutions', options: CYBER_OPTIONS },
            { label: 'GRC Solutions', field: 'grc_solutions', options: GRC_OPTIONS },
            { label: 'SAP Hosting Partner', field: 'sap_hosting_partner', options: HOSTING_OPTIONS },
          ].map(({ label, field, options }) => (
            <div key={field}>
              <p className="section-label">{label}</p>
              <div className="checkbox-group">
                {options.map(opt => (
                  <span key={opt} className={`checkbox-chip ${(form as any)[field].includes(opt) ? 'selected' : ''}`} onClick={() => toggle(field, opt)}>{opt}</span>
                ))}
              </div>
            </div>
          ))}

          <FormField label="Notes" full>
            <textarea className="form-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." rows={3} style={{ resize: 'vertical' }} />
          </FormField>

          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : company ? 'Save Changes' : 'Create Company'}</button>
        </div>
      </div>
    </div>
  )
}
