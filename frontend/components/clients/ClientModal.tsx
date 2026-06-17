'use client'
// components/clients/ClientModal.tsx
import { useState } from 'react'
import { clientsAPI } from '@/lib/api'

const ERP_OPTIONS     = ["SAP", "Dynamics", "IFS", "Infor", "Odoo", "Oracle", "JDE", "SAGE", "Unknown", "Other"]
const CYBER_OPTIONS   = ["SAP ETD", "SAP GRC", "SAP Focused Run", "Cloud ALM", "SecurityBridge", "Onapsis", "Layer Seven Security", "Other"]
const HOSTING_OPTIONS = ["RISE", "AWS", "Azure", "GXP", "BLUE", "SENS", "Scaleway", "Private Datacenter", "Other"]
const LEVEL_LABELS    = { 1: 'Level 1 — Group', 2: 'Level 2 — Parent', 3: 'Level 3 — Child', 4: 'Level 4 — Sub-Child' }

interface Props {
  client?: any
  clients?: any[]
  onClose: () => void
  onSave: () => void
}

export function ClientModal({ client, clients = [], onClose, onSave }: Props) {
  const [form, setForm] = useState({
    name: client?.name || '',
    company: client?.company || '',
    parent_id: client?.parent_id || '',
    level: client?.level || 1,
    domain_names: client?.domain_names || [],
    phone: client?.phone || '',
    sector: client?.sector || '',
    status: client?.status || 'lead',
    main_erp: client?.main_erp || [],
    cybersecurity_solutions: client?.cybersecurity_solutions || [],
    sap_hosting_partner: client?.sap_hosting_partner || [],
    linkedin_url: client?.linkedin_url || '',
    notes: client?.notes || '',
    assigned_to: client?.assigned_to || '',
  })
  const [domainInput, setDomainInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggle = (field: string, value: string) => {
    setForm(p => ({
      ...p,
      [field]: (p as any)[field].includes(value)
        ? (p as any)[field].filter((v: string) => v !== value)
        : [...(p as any)[field], value]
    }))
  }

  const addDomain = () => {
    const d = domainInput.trim()
    if (d && !form.domain_names.includes(d)) {
      setForm(p => ({ ...p, domain_names: [...p.domain_names, d] }))
      setDomainInput('')
    }
  }

  const handleParentChange = (parentId: string) => {
    if (!parentId) {
      setForm(p => ({ ...p, parent_id: '', level: 1 }))
      return
    }
    const parent = clients.find(c => c.id === parentId)
    const newLevel = parent ? Math.min(parent.level + 1, 4) : 1
    setForm(p => ({ ...p, parent_id: parentId, level: newLevel }))
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.company.trim()) {
      setError('Company name and contact name are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, parent_id: form.parent_id || null }
      if (client) {
        await clientsAPI.update(client.id, payload)
      } else {
        await clientsAPI.create(payload)
      }
      onSave()
    } catch (e: any) {
      setError(e.message || 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  // Available parents (exclude self and own children)
  const availableParents = clients.filter(c => c.id !== client?.id && c.level < 4)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--primary)' }}>
            {client ? 'Edit Client' : 'New Client'}
          </h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Company & Contact */}
          <div>
            <p className="section-title">Company Information</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="form-label">Company Name *</label>
                <input className="form-input" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="Acme Corp" />
              </div>
              <div>
                <label className="form-label">Main Contact *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555 000 0000" />
              </div>
              <div>
                <label className="form-label">Sector</label>
                <input className="form-input" value={form.sector} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))} placeholder="Finance, Industry..." />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="lead">Lead</option>
                  <option value="prospect">Prospect</option>
                  <option value="client">Client</option>
                  <option value="partner">Partner</option>
                </select>
              </div>
              <div>
                <label className="form-label">Assigned To</label>
                <input className="form-input" value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} placeholder="Sales rep name" />
              </div>
            </div>
          </div>

          {/* Hierarchy */}
          <div>
            <p className="section-title">Company Hierarchy</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="form-label">Parent Company</label>
                <select className="form-input" value={form.parent_id} onChange={e => handleParentChange(e.target.value)}>
                  <option value="">No parent (Top level)</option>
                  {availableParents.map(c => (
                    <option key={c.id} value={c.id}>
                      {'— '.repeat(c.level - 1)}{c.company} (Level {c.level})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Hierarchy Level</label>
                <div className="form-input" style={{ background: 'var(--bg)', cursor: 'default', color: 'var(--text-muted)' }}>
                  {(LEVEL_LABELS as any)[form.level]}
                </div>
              </div>
            </div>
          </div>

          {/* Domains */}
          <div>
            <p className="section-title">Domain Names</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input className="form-input" value={domainInput} onChange={e => setDomainInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDomain()}
                placeholder="example.com" style={{ flex: 1 }} />
              <button className="btn-secondary" onClick={addDomain}>Add</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {form.domain_names.map((d: string) => (
                <span key={d} style={{ background: '#EFF6FF', color: '#2563EB', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {d}
                  <button onClick={() => setForm(p => ({ ...p, domain_names: p.domain_names.filter((x: string) => x !== d) }))}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563EB', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
          </div>

          {/* LinkedIn */}
          <div>
            <label className="form-label">LinkedIn Company Page</label>
            <input className="form-input" value={form.linkedin_url} onChange={e => setForm(p => ({ ...p, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/company/..." />
          </div>

          {/* ERP */}
          <div>
            <p className="section-title">Main ERP</p>
            <div className="checkbox-group">
              {ERP_OPTIONS.map(opt => (
                <span key={opt} className={`checkbox-chip ${form.main_erp.includes(opt) ? 'selected' : ''}`} onClick={() => toggle('main_erp', opt)}>{opt}</span>
              ))}
            </div>
          </div>

          {/* Cybersecurity */}
          <div>
            <p className="section-title">Cybersecurity Solutions</p>
            <div className="checkbox-group">
              {CYBER_OPTIONS.map(opt => (
                <span key={opt} className={`checkbox-chip ${form.cybersecurity_solutions.includes(opt) ? 'selected' : ''}`} onClick={() => toggle('cybersecurity_solutions', opt)}>{opt}</span>
              ))}
            </div>
          </div>

          {/* SAP Hosting */}
          <div>
            <p className="section-title">SAP Hosting Partner</p>
            <div className="checkbox-group">
              {HOSTING_OPTIONS.map(opt => (
                <span key={opt} className={`checkbox-chip ${form.sap_hosting_partner.includes(opt) ? 'selected' : ''}`} onClick={() => toggle('sap_hosting_partner', opt)}>{opt}</span>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '500' }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : client ? 'Save Changes' : 'Create Client'}
          </button>
        </div>
      </div>
    </div>
  )
}
