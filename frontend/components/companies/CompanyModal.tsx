'use client'
// components/companies/CompanyModal.tsx
import { useState } from 'react'
import { companiesAPI } from '@/lib/api'

const ERP_OPTIONS     = ["SAP", "Dynamics", "IFS", "Infor", "Odoo", "Oracle", "JDE", "SAGE", "Unknown", "Other"]
const CYBER_OPTIONS   = ["SAP ETD", "SAP GRC", "SAP Focused Run", "Cloud ALM", "SecurityBridge", "Onapsis", "Layer Seven Security", "Other"]
const HOSTING_OPTIONS = ["RISE", "AWS", "Azure", "GXP", "BLUE", "SENS", "Scaleway", "Private Datacenter", "Other"]
const LEVEL_LABELS    = { 1: 'Level 1 — Group', 2: 'Level 2 — Parent', 3: 'Level 3 — Child', 4: 'Level 4 — Sub-Child' }

export function CompanyModal({ company, companies = [], onClose, onSave }: any) {
  const [form, setForm] = useState({
    name: company?.name || '',
    contact_name: company?.contact_name || '',
    parent_id: company?.parent_id || '',
    level: company?.level || 1,
    domain_names: company?.domain_names || [],
    phone: company?.phone || '',
    sector: company?.sector || '',
    country: company?.country || '',
    status: company?.status || 'lead',
    main_erp: company?.main_erp || [],
    cybersecurity_solutions: company?.cybersecurity_solutions || [],
    sap_hosting_partner: company?.sap_hosting_partner || [],
    linkedin_url: company?.linkedin_url || '',
    notes: company?.notes || '',
    assigned_to: company?.assigned_to || '',
  })
  const [domainInput, setDomainInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
      const payload = { ...form, parent_id: form.parent_id || null }
      if (company) { await companiesAPI.update(company.id, payload) }
      else { await companiesAPI.create(payload) }
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const availableParents = companies.filter((c: any) => c.id !== company?.id && c.level < 4)

  const Field = ({ label, children }: any) => (
    <div><label className="form-label">{label}</label>{children}</div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>{company ? 'Edit Company' : 'New Company'}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div>
            <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '10px' }}>Company Information</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label="Company Name *"><input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Acme Corp" /></Field>
              <Field label="Main Contact"><input className="form-input" value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} placeholder="John Doe" /></Field>
              <Field label="Phone"><input className="form-input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555 000 0000" /></Field>
              <Field label="Sector"><input className="form-input" value={form.sector} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))} placeholder="Finance, Industry..." /></Field>
              <Field label="Country"><input className="form-input" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} placeholder="Belgium" /></Field>
              <Field label="Status">
                <select className="form-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="lead">Lead</option><option value="prospect">Prospect</option><option value="client">Client</option><option value="partner">Partner</option>
                </select>
              </Field>
              <Field label="Assigned To"><input className="form-input" value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} placeholder="Sales rep" /></Field>
            </div>
          </div>

          <div>
            <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '10px' }}>Hierarchy</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label="Parent Company">
                <select className="form-input" value={form.parent_id} onChange={e => handleParentChange(e.target.value)}>
                  <option value="">No parent (Top level)</option>
                  {availableParents.map((c: any) => <option key={c.id} value={c.id}>{'— '.repeat(c.level - 1)}{c.name} (L{c.level})</option>)}
                </select>
              </Field>
              <Field label="Level">
                <div className="form-input" style={{ background: '#F5F7FA', color: '#9B9B9B', cursor: 'default' }}>{(LEVEL_LABELS as any)[form.level]}</div>
              </Field>
            </div>
          </div>

          <div>
            <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '10px' }}>Domain Names</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input className="form-input" value={domainInput} onChange={e => setDomainInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDomain()} placeholder="example.com" style={{ flex: 1 }} />
              <button className="btn-secondary" onClick={addDomain}>Add</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {form.domain_names.map((d: string) => (
                <span key={d} style={{ background: '#EFF6FF', color: '#2563EB', padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {d}<button onClick={() => setForm(p => ({ ...p, domain_names: p.domain_names.filter((x: string) => x !== d) }))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563EB', fontSize: '13px', lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">LinkedIn Company Page</label>
            <input className="form-input" value={form.linkedin_url} onChange={e => setForm(p => ({ ...p, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/company/..." />
          </div>

          {[
            { label: 'Main ERP', field: 'main_erp', options: ERP_OPTIONS },
            { label: 'Cybersecurity Solutions', field: 'cybersecurity_solutions', options: CYBER_OPTIONS },
            { label: 'SAP Hosting Partner', field: 'sap_hosting_partner', options: HOSTING_OPTIONS },
          ].map(({ label, field, options }) => (
            <div key={field}>
              <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '8px' }}>{label}</p>
              <div className="checkbox-group">
                {options.map(opt => (
                  <span key={opt} className={`checkbox-chip ${(form as any)[field].includes(opt) ? 'selected' : ''}`} onClick={() => toggle(field, opt)}>{opt}</span>
                ))}
              </div>
            </div>
          ))}

          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '500' }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : company ? 'Save Changes' : 'Create Company'}</button>
        </div>
      </div>
    </div>
  )
}
