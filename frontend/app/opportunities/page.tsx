'use client'
// app/opportunities/page.tsx
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { opportunitiesAPI } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/shared/RecordLayout'
import { OpportunityModal } from '@/components/opportunities/OpportunityModal'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, REPORT_CELL_STYLE } from '@/components/it/ReportBuilder'
import { getStoredUser } from '@/lib/auth'

const STATUS_OPTIONS = ['Presentation To Be Scheduled','Presentation Done','Proposition Ongoing','Proposition Accepted','Contract Ongoing','Contract Finalised','PO Received','Contract Lost']

const COLUMNS: ReportColumn[] = [
  { key: 'deal_name', label: 'Opportunity', filterable: 'text' },
  { key: 'company_name', label: 'Company', filterable: 'text' },
  { key: 'deal_type', label: 'Type', filterable: 'text' },
  { key: 'deal_amount', label: 'Amount' },
  { key: 'deal_status', label: 'Status', filterable: 'select', options: STATUS_OPTIONS },
  { key: 'closing_date', label: 'Closing Date' },
  { key: 'project_status', label: 'Project Status', filterable: 'text' },
  { key: 'contacts_count', label: 'Contacts' },
]

function OpportunitiesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  const prefillCompanyId = searchParams.get('company_id') || ''
  const prefillPartnerId = searchParams.get('partner_id') || ''
  const prefillContactId = searchParams.get('contact_id') || ''

  const rb = useReportBuilder('opportunity', COLUMNS, userEmail)

  const load = async () => {
    try {
      setLoading(true)
      const data = await opportunitiesAPI.list({})
      setOpportunities(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
    // Company/Contact detail pages link here with these params to open the create
    // modal pre-filled instead of dumping the user on an unrelated list page.
    if (prefillCompanyId || prefillPartnerId || prefillContactId) setShowModal(true)
  }, [])

  const totalValue = opportunities.filter(o => o.deal_amount).reduce((sum, o) => sum + o.deal_amount, 0)

  const withDisplay = opportunities.map(o => ({
    ...o,
    company_name: o.company?.name || '',
    contacts_count: o.contacts?.length || 0,
  }))
  const reported = applyReport(withDisplay, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '24px 28px' }}>
          <PageHeader
            title="Opportunities"
            count={reported.length}
            action={
              <div style={{ display: 'flex', gap: '8px' }}>
                <ReportPanel columns={COLUMNS} rb={rb} />
                <button className="btn-primary" onClick={() => setShowModal(true)}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  New Opportunity
                </button>
              </div>
            }
          />

          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            {[
              { label: 'Total Pipeline', value: `€${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, color: '#144766' },
              { label: 'Open Opportunities', value: opportunities.filter(o => !['Contract Lost', 'PO Received', 'Contract Finalised'].includes(o.deal_status)).length, color: '#219BD6' },
              { label: 'Won', value: opportunities.filter(o => ['PO Received', 'Contract Finalised'].includes(o.deal_status)).length, color: '#059669' },
              { label: 'Lost', value: opportunities.filter(o => o.deal_status === 'Contract Lost').length, color: '#DC2626' },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '4px' }}>{stat.label}</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#FAFBFC' }}>
                <tr>
                  {COLUMNS.filter(c => isVisible(c.key)).map(c => (
                    <th key={c.key} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{c.label}</th>
                  ))}
                  <th style={{ borderBottom: '1px solid #E2E8F0' }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Loading...</td></tr>
                ) : reported.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length + 1}><EmptyState icon="💼" title="No opportunities yet" description="Create your first opportunity by clicking New Opportunity" /></td></tr>
                ) : reported.map(opp => (
                  <tr key={opp.id} onClick={() => router.push(`/opportunities/${opp.id}`)} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    {isVisible('deal_name') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: '#219BD6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat, sans-serif', fontSize: '12px', flexShrink: 0 }}>
                            {opp.deal_name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div>{opp.deal_name}</div>
                            {opp.deal_id && <div>#{opp.deal_id}</div>}
                          </div>
                        </div>
                      </td>
                    )}
                    {isVisible('company_name') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>
                        {opp.company ? (
                          <span onClick={e => { e.stopPropagation(); router.push(`/companies/${opp.company.id}`) }} style={{ cursor: 'pointer' }}>{opp.company.name}</span>
                        ) : '—'}
                      </td>
                    )}
                    {isVisible('deal_type') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{opp.deal_type || '—'}</td>
                    )}
                    {isVisible('deal_amount') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>
                        {opp.deal_amount ? `€${opp.deal_amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}` : '—'}
                      </td>
                    )}
                    {isVisible('deal_status') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{opp.deal_status}</td>
                    )}
                    {isVisible('closing_date') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>
                        {opp.closing_date ? new Date(opp.closing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                    )}
                    {isVisible('project_status') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{opp.project_status || '—'}</td>
                    )}
                    {isVisible('contacts_count') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>
                        {opp.contacts?.length || 0} contact{(opp.contacts?.length || 0) !== 1 ? 's' : ''}
                      </td>
                    )}
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9' }}>
                      <button onClick={e => { e.stopPropagation(); router.push(`/opportunities/${opp.id}`) }}
                        style={{ padding: '5px 12px', background: '#EFF6FF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#219BD6', fontWeight: '700' }}>
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {showModal && (
          <OpportunityModal
            initialCompanyId={prefillCompanyId}
            initialPartnerId={prefillPartnerId}
            initialContactId={prefillContactId}
            onClose={() => setShowModal(false)}
            onSave={() => { setShowModal(false); load() }}
          />
        )}
      </main>
    </div>
  )
}

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex' }}><Sidebar /><main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9B9B9B' }}>Loading...</main></div>}>
      <OpportunitiesContent />
    </Suspense>
  )
}
