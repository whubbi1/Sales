'use client'
// components/finance/PurchaseOrderModal.tsx
import { useState, useEffect } from 'react'
import { financePurchaseOrdersAPI, financeSuppliersAPI, financeContractsAPI } from '@/lib/api'

function FormField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

const toDateStr = (d?: string) => d ? new Date(d).toISOString().split('T')[0] : ''

export function PurchaseOrderModal({ purchaseOrder, onClose, onSave }: any) {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [form, setForm] = useState({
    supplier_id: purchaseOrder?.supplier_id || '',
    contract_id: purchaseOrder?.contract_id || '',
    description: purchaseOrder?.description || '',
    amount: purchaseOrder?.amount || '',
    order_date: toDateStr(purchaseOrder?.order_date) || toDateStr(new Date().toISOString()),
    expected_delivery_date: toDateStr(purchaseOrder?.expected_delivery_date),
    status: purchaseOrder?.status || 'draft',
    assigned_to: purchaseOrder?.assigned_to || '',
    assigned_to_email: purchaseOrder?.assigned_to_email || '',
    notes: purchaseOrder?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    financeSuppliersAPI.list({}).then(setSuppliers).catch(() => {})
    fetch('https://api.whubbi.wcomply.com/settings/users').then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [])

  useEffect(() => {
    financeContractsAPI.list(form.supplier_id ? { supplier_id: form.supplier_id } : {}).then(setContracts).catch(() => {})
  }, [form.supplier_id])

  const handleSave = async () => {
    if (!form.supplier_id) { setError('Supplier is required'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        contract_id: form.contract_id || null,
        amount: form.amount ? Number(form.amount) : null,
        expected_delivery_date: form.expected_delivery_date || null,
      }
      if (purchaseOrder) { await financePurchaseOrdersAPI.update(purchaseOrder.id, payload) }
      else { await financePurchaseOrdersAPI.create(payload) }
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>
            {purchaseOrder ? 'Edit Purchase Order' : 'New Purchase Order'}
            {purchaseOrder?.internal_id && <span style={{ fontSize: '11px', fontWeight: '600', color: '#9B9B9B', marginLeft: '8px' }}>{purchaseOrder.internal_id}</span>}
          </h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div>
            <p className="section-label">Purchase Order Information</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <FormField label="Supplier *">
                <select className="form-input" value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value, contract_id: '' }))}>
                  <option value="">Select supplier...</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </FormField>
              <FormField label="Linked Contract">
                <select className="form-input" value={form.contract_id} onChange={e => setForm(p => ({ ...p, contract_id: e.target.value }))}>
                  <option value="">No contract</option>
                  {contracts.map((c: any) => <option key={c.id} value={c.id}>{c.contract_name}</option>)}
                </select>
              </FormField>
              <FormField label="Description" full>
                <input className="form-input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Q3 paper and toner restock" />
              </FormField>
              <FormField label="Amount (EUR)">
                <input className="form-input" type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="1500" />
              </FormField>
              <FormField label="Status">
                <select className="form-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="draft">Draft</option><option value="sent">Sent</option><option value="received">Received</option><option value="cancelled">Cancelled</option>
                </select>
              </FormField>
              <FormField label="Order Date">
                <input className="form-input" type="date" value={form.order_date} onChange={e => setForm(p => ({ ...p, order_date: e.target.value }))} />
              </FormField>
              <FormField label="Expected Delivery Date">
                <input className="form-input" type="date" value={form.expected_delivery_date} onChange={e => setForm(p => ({ ...p, expected_delivery_date: e.target.value }))} />
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
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : purchaseOrder ? 'Save Changes' : 'Create Purchase Order'}</button>
        </div>
      </div>
    </div>
  )
}
