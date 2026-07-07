'use client'
// app/finance/suppliers/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FinanceLayout } from '@/components/FinanceLayout'
import { financeSuppliersAPI } from '@/lib/api'
import { SupplierModal } from '@/components/finance/SupplierModal'

export default function SuppliersPage() {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const load = async () => {
    try {
      setLoading(true)
      setSuppliers(await financeSuppliersAPI.list(search ? { search } : {}))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search])

  const remove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Delete this supplier?')) return
    await financeSuppliersAPI.delete(id)
    load()
  }

  return (
    <FinanceLayout>
      <div style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#144766', margin: 0 }}>Suppliers</h1>
            <p style={{ fontSize: '12px', color: '#9B9B9B', margin: '2px 0 0' }}>{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers..." style={{ width: '220px' }} />
            <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Supplier
            </button>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#FAFBFC' }}>
              <tr>
                {['ID', 'Supplier', 'Contact', 'Sector', 'Country', 'Status', 'Assigned', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Loading...</td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>No suppliers yet. Click New Supplier to add one.</td></tr>
              ) : suppliers.map((s: any) => (
                <tr key={s.id} onClick={() => { setEditing(s); setShowModal(true) }} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '11px', color: '#9B9B9B', fontWeight: '600' }}>{s.internal_id}</td>
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '13px', fontWeight: '700', color: '#144766' }}>{s.name}</td>
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F' }}>{s.contact_name || s.email || '—'}</td>
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F' }}>{s.sector || '—'}</td>
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F' }}>{s.country || '—'}</td>
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ background: s.status === 'active' ? '#ECFDF5' : '#F1F5F9', color: s.status === 'active' ? '#059669' : '#9B9B9B', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', textTransform: 'capitalize' as const }}>{s.status}</span>
                  </td>
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '11px', color: '#9B9B9B' }}>{s.assigned_to || '—'}</td>
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', textAlign: 'right' as const }}>
                    <button onClick={e => remove(e, s.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '11px', fontWeight: '600' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <SupplierModal supplier={editing} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />}
    </FinanceLayout>
  )
}
