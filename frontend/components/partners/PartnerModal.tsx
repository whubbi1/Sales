'use client'
// components/partners/PartnerModal.tsx
import { useState, useEffect } from 'react'
import { partnersAPI, contactsAPI } from '@/lib/api'

const ERP_OPTIONS     = ["SAP", "Dynamics", "IFS", "Infor", "Odoo", "Oracle", "JDE", "SAGE", "Unknown", "Other"]
const CYBER_OPTIONS   = ["SAP ETD", "SAP GRC", "SAP Focused Run", "Cloud ALM", "SecurityBridge", "Onapsis", "Layer Seven Security", "Other"]
const HOSTING_OPTIONS = ["RISE", "AWS", "Azure", "GXP", "BLUE", "SENS", "Scaleway", "Private Datacenter", "Other"]

function FormField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

export function PartnerModal({ partner, onClose, onSave }: any) {
  const [form, setForm] = useState({
    name: partner?.name || '',
    main_contact_id: partner?.main_contact_id || '',
    domain_names: partner?.domain_names || [],
    phone: partner?.phone || '',
    sector: partner?.sector || '',
    country: partner?.country || '',
    status: partner?.status || 'active',
    main_erp: partner?.main_erp || [],
    cybersecurity_solutions: partner?.cybersecurity_solutions || [],
    sap_hosting_partner: partner?.sap_hosting_partner || [],
    linkedin_url: partner?.linkedin_url || '',
    notes: partner?.notes || '',
    assigned_to: partner?.assigned_to || '',
    assigned_to_email: partner?.assigned_to_email || '',
  })
  const [domainInput, setDomainInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [contacts, setContacts] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    contactsAPI.list({}).then(setContacts).catch(() => {})
    fetch('https://api.whubbi.wcomply.com/settings/users').then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [])

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

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Partner name is required'); return }
    setSaving(true); setError('')
    try {
      const payload = { ...form, main_contact_id: form.main_contact_id || null }
      if (partner) { await partnersAPI.update(partner.id, payload) }
      else { await partnersAPI.create(payload) }
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>
            {partner ? 'Edit Partner' : 'New Partner'}
            {partner?.internal_id && <span style={{ fontSize: '11px', fontWeight: '600', color: '#9B9B9B', marginLeft: '8px' }}>{partner.internal_id}</span>}
          </h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div>
            <p className="section-label">Partner Information</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <FormField label="Partner Name *">
                <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Acme Reseller" />
              </FormField>
              <FormField label="Main Contact">
                <select className="form-input" value={form.main_contact_id} onChange={e => setForm(p => ({ ...p, main_contact_id: e.target.value }))}>
                  <option value="">Select contact…</option>
                  {contacts.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
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
                  <option value="active">Active</option><option value="inactive">Inactive</option>
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
            <input className="form-input" value={form.linkedin_url} onChange={e => setForm(p => ({ ...p, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/company/..." />
          </FormField>

          {[
            { label: 'Main ERP', field: 'main_erp', options: ERP_OPTIONS },
            { label: 'Cybersecurity Solutions', field: 'cybersecurity_solutions', options: CYBER_OPTIONS },
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
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : partner ? 'Save Changes' : 'Create Partner'}</button>
        </div>
      </div>
    </div>
  )
}
