'use client'
// components/finance/InvoiceModal.tsx
import { useState, useEffect } from 'react'
import { financeInvoicesAPI, financeSuppliersAPI, financePurchaseOrdersAPI } from '@/lib/api'

function FormField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

const toDateStr = (d?: string) => d ? new Date(d).toISOString().split('T')[0] : ''

export function InvoiceModal({ invoice, onClose, onSave }: any) {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [form, setForm] = useState({
    supplier_id: invoice?.supplier_id || '',
    purchase_order_id: invoice?.purchase_order_id || '',
    invoice_number: invoice?.invoice_number || '',
    amount: invoice?.amount || '',
    invoice_date: toDateStr(invoice?.invoice_date) || toDateStr(new Date().toISOString()),
    due_date: toDateStr(invoice?.due_date),
    approver_email: invoice?.approver_email || '',
    approver_name: invoice?.approver_name || '',
    notes: invoice?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    financeSuppliersAPI.list({}).then(setSuppliers).catch(() => {})
    fetch('https://api.whubbi.wcomply.com/settings/users').then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [])

  useEffect(() => {
    financePurchaseOrdersAPI.list(form.supplier_id ? { supplier_id: form.supplier_id } : {}).then(setPurchaseOrders).catch(() => {})
  }, [form.supplier_id])

  const handleSave = async () => {
    if (!form.supplier_id) { setError('Supplier is required'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        purchase_order_id: form.purchase_order_id || null,
        amount: form.amount ? Number(form.amount) : null,
        due_date: form.due_date || null,
      }
      if (invoice) { await financeInvoicesAPI.update(invoice.id, payload) }
      else { await financeInvoicesAPI.create(payload) }
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>
            {invoice ? 'Edit Invoice' : 'New Invoice'}
            {invoice?.internal_id && <span style={{ fontSize: '11px', fontWeight: '600', color: '#9B9B9B', marginLeft: '8px' }}>{invoice.internal_id}</span>}
          </h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div>
            <p className="section-label">Invoice Information</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <FormField label="Supplier *">
                <select className="form-input" value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value, purchase_order_id: '' }))}>
                  <option value="">Select supplier...</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </FormField>
              <FormField label="Purchase Order">
                <select className="form-input" value={form.purchase_order_id} onChange={e => setForm(p => ({ ...p, purchase_order_id: e.target.value }))}>
                  <option value="">No purchase order</option>
                  {purchaseOrders.map((po: any) => <option key={po.id} value={po.id}>{po.internal_id} — {po.description}</option>)}
                </select>
              </FormField>
              <FormField label="Invoice Number">
                <input className="form-input" value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} placeholder="Supplier's own reference" />
              </FormField>
              <FormField label="Amount (EUR)">
                <input className="form-input" type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="1500" />
              </FormField>
              <FormField label="Invoice Date">
                <input className="form-input" type="date" value={form.invoice_date} onChange={e => setForm(p => ({ ...p, invoice_date: e.target.value }))} />
              </FormField>
              <FormField label="Due Date">
                <input className="form-input" type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
              </FormField>
              <FormField label="Approver">
                <select className="form-input" value={form.approver_email} onChange={e => {
                  const u = users.find((uu: any) => uu.email === e.target.value)
                  setForm(p => ({ ...p, approver_email: e.target.value, approver_name: u ? (u.display_name || `${u.first_name} ${u.last_name}`) : '' }))
                }}>
                  <option value="">Select approver…</option>
                  {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
                </select>
              </FormField>
            </div>
          </div>

          <FormField label="Notes" full>
            <textarea className="form-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." rows={3} style={{ resize: 'vertical' }} />
          </FormField>

          {invoice && invoice.approval_status !== 'pending' && (
            <div style={{ background: invoice.approval_status === 'approved' ? '#ECFDF5' : '#FEF2F2', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', color: invoice.approval_status === 'approved' ? '#059669' : '#DC2626' }}>
              {invoice.approval_status === 'approved' ? 'Approved' : 'Rejected'} by {invoice.approved_by_email} on {new Date(invoice.approved_at).toLocaleString()}
              {invoice.approval_comment && <> — “{invoice.approval_comment}”</>}
            </div>
          )}

          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : invoice ? 'Save Changes' : 'Create Invoice'}</button>
        </div>
      </div>
    </div>
  )
}
