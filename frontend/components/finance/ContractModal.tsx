'use client'
// components/finance/ContractModal.tsx
import { useState, useEffect } from 'react'
import { financeContractsAPI, financeSuppliersAPI } from '@/lib/api'

function FormField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

const toDateStr = (d?: string) => d ? new Date(d).toISOString().split('T')[0] : ''

export function ContractModal({ contract, onClose, onSave }: any) {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [form, setForm] = useState({
    supplier_id: contract?.supplier_id || '',
    contract_name: contract?.contract_name || '',
    start_date: toDateStr(contract?.start_date),
    end_date: toDateStr(contract?.end_date),
    contract_value: contract?.contract_value || '',
    status: contract?.status || 'active',
    assigned_to: contract?.assigned_to || '',
    assigned_to_email: contract?.assigned_to_email || '',
    notes: contract?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    financeSuppliersAPI.list({}).then(setSuppliers).catch(() => {})
    fetch('https://api.whubbi.wcomply.com/settings/users').then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [])

  const handleSave = async () => {
    if (!form.supplier_id) { setError('Supplier is required'); return }
    if (!form.contract_name.trim()) { setError('Contract name is required'); return }
    if (!form.start_date) { setError('Start date is required'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        end_date: form.end_date || null,
        contract_value: form.contract_value ? Number(form.contract_value) : null,
      }
      if (contract) { await financeContractsAPI.update(contract.id, payload) }
      else { await financeContractsAPI.create(payload) }
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>
            {contract ? 'Edit Contract' : 'New Contract'}
            {contract?.internal_id && <span style={{ fontSize: '11px', fontWeight: '600', color: '#9B9B9B', marginLeft: '8px' }}>{contract.internal_id}</span>}
          </h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div>
            <p className="section-label">Contract Information</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <FormField label="Supplier *">
                <select className="form-input" value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))}>
                  <option value="">Select supplier...</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </FormField>
              <FormField label="Contract Name *">
                <input className="form-input" value={form.contract_name} onChange={e => setForm(p => ({ ...p, contract_name: e.target.value }))} placeholder="Annual Office Supplies Agreement" />
              </FormField>
              <FormField label="Start Date *">
                <input className="form-input" type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
              </FormField>
              <FormField label="End Date">
                <input className="form-input" type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
              </FormField>
              <FormField label="Contract Value (EUR)">
                <input className="form-input" type="number" value={form.contract_value} onChange={e => setForm(p => ({ ...p, contract_value: e.target.value }))} placeholder="24000" />
              </FormField>
              <FormField label="Status">
                <select className="form-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="active">Active</option><option value="terminated">Terminated</option>
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

          {!contract && (
            <p style={{ fontSize: '11px', color: '#9B9B9B', margin: 0 }}>You can attach documents (signed PDF, amendments...) after creating the contract.</p>
          )}

          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : contract ? 'Save Changes' : 'Create Contract'}</button>
        </div>
      </div>
    </div>
  )
}
