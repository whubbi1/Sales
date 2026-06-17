'use client'
# opportunities/[id]/page.tsx
$content = Get-Content "C:\whubbi\frontend\app\opportunities\[id]\page.tsx" -Raw
$content = $content -replace "('use client')", "`$1`n`nexport async function generateStaticParams() {`n  return []`n}`n"
Set-Content "C:\whubbi\frontend\app\opportunities\[id]\page.tsx" $content

// app/opportunities/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { opportunitiesAPI } from '@/lib/api'
import { PageHeader, StatusBadge, EmptyState } from '@/components/shared/RecordLayout'
import { OpportunityModal } from '@/components/opportunities/OpportunityModal'

const STATUS_COLORS: Record<string, string> = {
  'Presentation To Be Scheduled': '#EEF2FF',
  'Presentation Done': '#FFF7ED',
  'Proposition Ongoing': '#FFF7ED',
  'Proposition Accepted': '#ECFDF5',
  'Contract Ongoing': '#ECFDF5',
  'Contract Finalised': '#ECFDF5',
  'PO Received': '#D1FAE5',
  'Contract Lost': '#FEF2F2',
}
const STATUS_TEXT: Record<string, string> = {
  'Presentation To Be Scheduled': '#4F46E5',
  'Presentation Done': '#D97706',
  'Proposition Ongoing': '#EA580C',
  'Proposition Accepted': '#059669',
  'Contract Ongoing': '#059669',
  'Contract Finalised': '#059669',
  'PO Received': '#047857',
  'Contract Lost': '#DC2626',
}

export default function OpportunitiesPage() {
  const router = useRouter()
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const data = await opportunitiesAPI.list({ search: search || undefined, deal_status: statusFilter || undefined })
      setOpportunities(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search, statusFilter])

  const totalValue = opportunities.filter(o => o.deal_amount).reduce((sum, o) => sum + o.deal_amount, 0)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '24px 28px' }}>
          <PageHeader
            title="Opportunities"
            count={opportunities.length}
            action={
              <button className="btn-primary" onClick={() => setShowModal(true)}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Opportunity
              </button>
            }
          />

          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            {[
              { label: 'Total Pipeline', value: `€${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, color: '#144766' },
              { label: 'Open Deals', value: opportunities.filter(o => !['Contract Lost', 'PO Received', 'Contract Finalised'].includes(o.deal_status)).length, color: '#219BD6' },
              { label: 'Won', value: opportunities.filter(o => ['PO Received', 'Contract Finalised'].includes(o.deal_status)).length, color: '#059669' },
              { label: 'Lost', value: opportunities.filter(o => o.deal_status === 'Contract Lost').length, color: '#DC2626' },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '4px' }}>{stat.label}</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '340px' }}>
              <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9B9B9B' }} width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="form-input" style={{ paddingLeft: '30px' }} placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-input" style={{ width: '220px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {['Presentation To Be Scheduled','Presentation Done','Proposition Ongoing','Proposition Accepted','Contract Ongoing','Contract Finalised','PO Received','Contract Lost'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#FAFBFC' }}>
                <tr>
                  {['Deal', 'Company', 'Type', 'Amount', 'Status', 'Closing Date', 'Project Status', 'Contacts'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Loading...</td></tr>
                ) : opportunities.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState icon="💼" title="No opportunities yet" description="Create your first deal by clicking New Opportunity" /></td></tr>
                ) : opportunities.map(opp => (
                  <tr key={opp.id} onClick={() => router.push(`/opportunities/${opp.id}`)} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: '#219BD6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', flexShrink: 0 }}>
                          {opp.deal_name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', color: '#144766', fontSize: '12px' }}>{opp.deal_name}</div>
                          {opp.deal_id && <div style={{ fontSize: '10px', color: '#9B9B9B' }}>#{opp.deal_id}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F' }}>
                      {opp.company ? (
                        <span onClick={e => { e.stopPropagation(); router.push(`/companies/${opp.company.id}`) }} style={{ color: '#219BD6', fontWeight: '600', cursor: 'pointer' }}>{opp.company.name}</span>
                      ) : <span style={{ color: '#CBD5E0' }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9' }}>
                      {opp.deal_type ? (
                        <span style={{ background: '#EEF2FF', color: '#4F46E5', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{opp.deal_type}</span>
                      ) : <span style={{ color: '#CBD5E0', fontSize: '12px' }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9' }}>
                      {opp.deal_amount ? (
                        <span style={{ fontWeight: '800', color: '#059669', fontSize: '13px' }}>€{opp.deal_amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                      ) : <span style={{ color: '#CBD5E0', fontSize: '12px' }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ background: STATUS_COLORS[opp.deal_status] || '#F1F5F9', color: STATUS_TEXT[opp.deal_status] || '#475569', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>
                        {opp.deal_status}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '11px', color: '#9B9B9B' }}>
                      {opp.closing_date ? new Date(opp.closing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9' }}>
                      {opp.project_status ? (
                        <span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{opp.project_status}</span>
                      ) : <span style={{ color: '#CBD5E0', fontSize: '12px' }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '11px', color: '#9B9B9B' }}>
                      {opp.contacts?.length || 0} contact{(opp.contacts?.length || 0) !== 1 ? 's' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {showModal && <OpportunityModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />}
      </main>
    </div>
  )
}
