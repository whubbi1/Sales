'use client'
// components/finance/SupplierModal.tsx
import { useState, useEffect } from 'react'
import { financeSuppliersAPI } from '@/lib/api'

function FormField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

export function SupplierModal({ supplier, onClose, onSave }: any) {
  const [form, setForm] = useState({
    name: supplier?.name || '',
    contact_name: supplier?.contact_name || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    sector: supplier?.sector || '',
    country: supplier?.country || '',
    status: supplier?.status || 'active',
    assigned_to: supplier?.assigned_to || '',
    assigned_to_email: supplier?.assigned_to_email || '',
    notes: supplier?.notes || '',
  })
  const [users, setUsers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('https://api.whubbi.wcomply.com/settings/users').then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [])

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Supplier name is required'); return }
    setSaving(true); setError('')
    try {
      if (supplier) { await financeSuppliersAPI.update(supplier.id, form) }
      else { await financeSuppliersAPI.create(form) }
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>
            {supplier ? 'Edit Supplier' : 'New Supplier'}
            {supplier?.internal_id && <span style={{ fontSize: '11px', fontWeight: '600', color: '#9B9B9B', marginLeft: '8px' }}>{supplier.internal_id}</span>}
          </h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div>
            <p className="section-label">Supplier Information</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <FormField label="Supplier Name *">
                <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Acme Office Supplies" />
              </FormField>
              <FormField label="Contact Name">
                <input className="form-input" value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} placeholder="Jane Smith" />
              </FormField>
              <FormField label="Email">
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="billing@supplier.com" />
              </FormField>
              <FormField label="Phone">
                <input className="form-input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555 000 0000" />
              </FormField>
              <FormField label="Sector">
                <input className="form-input" value={form.sector} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))} placeholder="Office Supplies, Software..." />
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

          <FormField label="Notes" full>
            <textarea className="form-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." rows={3} style={{ resize: 'vertical' }} />
          </FormField>

          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : supplier ? 'Save Changes' : 'Create Supplier'}</button>
        </div>
      </div>
    </div>
  )
}
