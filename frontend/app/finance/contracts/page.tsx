'use client'
// app/finance/contracts/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FinanceLayout } from '@/components/FinanceLayout'
import { financeContractsAPI } from '@/lib/api'
import { ContractModal } from '@/components/finance/ContractModal'

const EXPIRING_SOON_DAYS = 60

function contractHealth(c: any) {
  if (c.status === 'terminated') return { label: 'Terminated', bg: '#F1F5F9', color: '#9B9B9B' }
  if (c.end_date) {
    const daysLeft = Math.floor((new Date(c.end_date).getTime() - Date.now()) / 86400000)
    if (daysLeft < 0) return { label: 'Expired', bg: '#FEF2F2', color: '#DC2626' }
    if (daysLeft <= EXPIRING_SOON_DAYS) return { label: `Expiring in ${daysLeft}d`, bg: '#FFFBEB', color: '#D97706' }
  }
  return { label: 'Active', bg: '#ECFDF5', color: '#059669' }
}

export default function ContractsPage() {
  const router = useRouter()
  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const load = async () => {
    try {
      setLoading(true)
      setContracts(await financeContractsAPI.list(search ? { search } : {}))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search])

  const remove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Delete this contract? Attached documents will also be deleted.')) return
    await financeContractsAPI.delete(id)
    load()
  }

  return (
    <FinanceLayout>
      <div style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#144766', margin: 0 }}>Contracts</h1>
            <p style={{ fontSize: '12px', color: '#9B9B9B', margin: '2px 0 0' }}>{contracts.length} contract{contracts.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contracts..." style={{ width: '220px' }} />
            <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Contract
            </button>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#FAFBFC' }}>
              <tr>
                {['ID', 'Contract', 'Supplier', 'Start', 'End', 'Value (EUR)', 'Health', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Loading...</td></tr>
              ) : contracts.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>No contracts yet. Click New Contract to add one.</td></tr>
              ) : contracts.map((c: any) => {
                const health = contractHealth(c)
                return (
                  <tr key={c.id} onClick={() => router.push(`/finance/contracts/${c.id}`)} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '11px', color: '#9B9B9B', fontWeight: '600' }}>{c.internal_id}</td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '13px', fontWeight: '700', color: '#144766' }}>{c.contract_name}</td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F' }}>{c.supplier_name || '—'}</td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F' }}>{c.start_date}</td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F' }}>{c.end_date || '—'}</td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F' }}>{c.contract_value != null ? Number(c.contract_value).toLocaleString() : '—'}</td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ background: health.bg, color: health.color, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{health.label}</span>
                    </td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', textAlign: 'right' as const }}>
                      <button onClick={e => { e.stopPropagation(); setEditing(c); setShowModal(true) }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontSize: '11px', fontWeight: '600', marginRight: '10px' }}>Edit</button>
                      <button onClick={e => remove(e, c.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '11px', fontWeight: '600' }}>Delete</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <ContractModal contract={editing} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />}
    </FinanceLayout>
  )
}
