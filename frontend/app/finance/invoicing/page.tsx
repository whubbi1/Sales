'use client'
// app/finance/invoicing/page.tsx
import { useState, useEffect } from 'react'
import { FinanceLayout } from '@/components/FinanceLayout'
import { financeInvoicesAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { InvoiceModal } from '@/components/finance/InvoiceModal'

const APPROVAL_STYLE: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#FFFBEB', color: '#D97706' },
  approved: { bg: '#ECFDF5', color: '#059669' },
  rejected: { bg: '#FEF2F2', color: '#DC2626' },
}

export default function InvoicingPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [userEmail, setUserEmail] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      setInvoices(await financeInvoicesAPI.list(search ? { search } : {}))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [search])

  const remove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Delete this invoice?')) return
    await financeInvoicesAPI.delete(id)
    load()
  }

  const decide = async (e: React.MouseEvent, invoice: any, action: 'approve' | 'reject') => {
    e.stopPropagation()
    const comment = window.prompt(action === 'approve' ? 'Optional approval comment:' : 'Reason for rejection (optional):') || ''
    try {
      await financeInvoicesAPI.setApproval(invoice.id, { action, acting_email: userEmail, comment })
      load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const totalPending = invoices.filter(i => i.approval_status === 'pending').reduce((sum, i) => sum + (i.amount || 0), 0)

  return (
    <FinanceLayout>
      <div style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#144766', margin: 0 }}>Invoicing</h1>
            <p style={{ fontSize: '12px', color: '#9B9B9B', margin: '2px 0 0' }}>{invoices.length} invoice{invoices.length !== 1 ? 's' : ''} · {totalPending.toLocaleString()} EUR pending approval</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." style={{ width: '220px' }} />
            <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Invoice
            </button>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#FAFBFC' }}>
              <tr>
                {['ID', 'Invoice #', 'Supplier', 'PO', 'Amount (EUR)', 'Due', 'Approval', 'Approver', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Loading...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>No invoices yet. Click New Invoice to add one.</td></tr>
              ) : invoices.map((i: any) => {
                const st = APPROVAL_STYLE[i.approval_status] || APPROVAL_STYLE.pending
                const canDecide = i.approval_status === 'pending' && i.approver_email && i.approver_email === userEmail
                return (
                  <tr key={i.id} onClick={() => { setEditing(i); setShowModal(true) }} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '11px', color: '#9B9B9B', fontWeight: '600' }}>{i.internal_id}</td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '13px', fontWeight: '700', color: '#144766' }}>{i.invoice_number || '—'}</td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F' }}>{i.supplier_name || '—'}</td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F' }}>{i.po_internal_id || '—'}</td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F' }}>{i.amount != null ? Number(i.amount).toLocaleString() : '—'}</td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F' }}>{i.due_date || '—'}</td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ background: st.bg, color: st.color, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', textTransform: 'capitalize' as const }}>{i.approval_status}</span>
                    </td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '11px', color: '#9B9B9B' }}>{i.approver_name || '—'}</td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', textAlign: 'right' as const, whiteSpace: 'nowrap' as const }}>
                      {canDecide ? (
                        <>
                          <button onClick={e => decide(e, i, 'approve')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#059669', fontSize: '11px', fontWeight: '700', marginRight: '10px' }}>Approve</button>
                          <button onClick={e => decide(e, i, 'reject')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '11px', fontWeight: '700', marginRight: '10px' }}>Reject</button>
                        </>
                      ) : null}
                      <button onClick={e => remove(e, i.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '11px', fontWeight: '600' }}>Delete</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <InvoiceModal invoice={editing} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />}
    </FinanceLayout>
  )
}
