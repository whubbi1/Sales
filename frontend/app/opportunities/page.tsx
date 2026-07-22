'use client'
// app/opportunities/page.tsx
import { useState, useEffect, useMemo, Suspense, Fragment } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { opportunitiesAPI, legalAPI } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/shared/RecordLayout'
import { OpportunityModal } from '@/components/opportunities/OpportunityModal'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, ColumnResizeHandle, REPORT_CELL_STYLE, SortArrow, Pagination } from '@/components/it/ReportBuilder'
import { getStoredUser } from '@/lib/auth'

const STATUS_OPTIONS = ['Presentation To Be Scheduled','Presentation Done','Proposition Ongoing','Proposition Accepted','RFP Ongoing','Contract Ongoing','Contract Finalised','PO Received','Contract Lost']

const BASE_COLUMNS: ReportColumn[] = [
  { key: 'deal_name', label: 'Opportunity', filterable: 'text' },
  { key: 'company_name', label: 'Company', filterable: 'text' },
  { key: 'deal_type', label: 'Type', filterable: 'text' },
  { key: 'deal_amount', label: 'Amount' },
  { key: 'deal_status', label: 'Status', filterable: 'select', options: STATUS_OPTIONS },
  { key: 'closing_date', label: 'Closing Date' },
  { key: 'project_status', label: 'Project Type', filterable: 'text' },
  { key: 'contacts_count', label: 'Contacts' },
]

// table-layout:fixed (needed so resized column widths actually stick) divides unset columns
// evenly by default, which looks worse than the old content-based auto layout — these give
// the first-ever render sane proportions until a user drags a column to their own preference.
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  deal_name: 240, company_name: 170, deal_type: 140, deal_amount: 130,
  deal_status: 170, closing_date: 130, project_status: 140, contacts_count: 100,
  main_operational_team_name: 170, sales_team_name: 170,
}

function OpportunitiesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPipelineBreakdown, setShowPipelineBreakdown] = useState(false)
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [nameSearch, setNameSearch] = useState('')
  const [operationalTeams, setOperationalTeams] = useState<any[]>([])
  const [salesTeams, setSalesTeams] = useState<any[]>([])
  const [kpiPopup, setKpiPopup] = useState<string | null>(null)
  const [popupOpTeam, setPopupOpTeam] = useState('')
  const [popupSalesTeam, setPopupSalesTeam] = useState('')

  const prefillCompanyId = searchParams.get('company_id') || ''
  const prefillPartnerId = searchParams.get('partner_id') || ''
  const prefillContactId = searchParams.get('contact_id') || ''

  // Filter options need the full live team list, not just whatever appears in currently-loaded
  // opportunities, so an unused team still shows up as a selectable filter.
  const COLUMNS: ReportColumn[] = useMemo(() => [
    ...BASE_COLUMNS,
    { key: 'main_operational_team_name', label: 'Operational Team', filterable: 'select', options: operationalTeams.map((t: any) => t.title) },
    { key: 'sales_team_name', label: 'Sales Team', filterable: 'select', options: salesTeams.map((t: any) => t.title) },
  ], [operationalTeams, salesTeams])

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
    legalAPI.getOrgEntities('operational_team').then(d => setOperationalTeams(d.org_entities || [])).catch(() => {})
    legalAPI.getOrgEntities('sales_entity').then(d => setSalesTeams(d.org_entities || [])).catch(() => {})
  }, [])

  const totalValue = opportunities.filter(o => o.deal_amount).reduce((sum, o) => sum + o.deal_amount, 0)
  const KPI_FILTERS: Record<string, (o: any) => boolean> = {
    open: (o: any) => !['Contract Lost', 'PO Received', 'Contract Finalised'].includes(o.deal_status),
    won: (o: any) => ['PO Received', 'Contract Finalised'].includes(o.deal_status),
    lost: (o: any) => o.deal_status === 'Contract Lost',
  }
  const KPI_LABELS: Record<string, string> = { open: 'Open Opportunities', won: 'Won', lost: 'Lost' }
  const pipelineByStatus = STATUS_OPTIONS.map(s => {
    const inStatus = opportunities.filter(o => o.deal_status === s)
    return { status: s, count: inStatus.length, total: inStatus.filter(o => o.deal_amount).reduce((sum, o) => sum + o.deal_amount, 0), opportunities: inStatus }
  })

  const withDisplay = opportunities.map(o => ({
    ...o,
    company_name: o.company?.name || '',
    contacts_count: o.contacts?.length || 0,
    main_operational_team_name: o.main_operational_team?.title || '',
    sales_team_name: o.sales_team?.title || '',
  }))
  const searched = withDisplay.filter(o => !nameSearch.trim() || o.deal_name.toLowerCase().includes(nameSearch.trim().toLowerCase()))
  const reported = applyReport(searched, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const pageRows = reported.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '24px 28px' }}>
          <PageHeader
            title="Opportunities"
            count={reported.length}
            search={{ value: nameSearch, onChange: setNameSearch }}
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
              { key: 'total', label: 'Total Pipeline', value: `€${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, color: '#144766' },
              { key: 'open', label: 'Open Opportunities', value: opportunities.filter(KPI_FILTERS.open).length, color: '#219BD6' },
              { key: 'won', label: 'Won', value: opportunities.filter(KPI_FILTERS.won).length, color: '#059669' },
              { key: 'lost', label: 'Lost', value: opportunities.filter(KPI_FILTERS.lost).length, color: '#DC2626' },
            ].map(stat => (
              <div key={stat.label} onClick={() => {
                  if (stat.label === 'Total Pipeline') { setExpandedStatus(null); setShowPipelineBreakdown(true) }
                  else { setKpiPopup(stat.key); setPopupOpTeam(''); setPopupSalesTeam('') }
                }}
                style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '4px' }}>{stat.label}</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {showPipelineBreakdown && (
            <div className="modal-overlay" onClick={() => setShowPipelineBreakdown(false)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                <div className="modal-header">
                  <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>Total Pipeline by Status</h2>
                  <button onClick={() => setShowPipelineBreakdown(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
                </div>
                <div className="modal-body">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0' }}>Status</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0' }}>Count</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pipelineByStatus.map(row => (
                        <Fragment key={row.status}>
                          <tr>
                            <td style={{ padding: '8px', fontSize: '12px', color: '#3F3F3F', borderBottom: '1px solid #F1F5F9' }}>{row.status}</td>
                            <td onClick={() => row.count > 0 && setExpandedStatus(expandedStatus === row.status ? null : row.status)}
                              style={{ padding: '8px', fontSize: '12px', color: row.count > 0 ? '#219BD6' : '#3F3F3F', fontWeight: row.count > 0 ? '700' : '400', borderBottom: '1px solid #F1F5F9', textAlign: 'right', cursor: row.count > 0 ? 'pointer' : 'default', textDecoration: row.count > 0 ? 'underline' : 'none' }}>
                              {row.count}
                            </td>
                            <td style={{ padding: '8px', fontSize: '12px', fontWeight: '600', color: '#144766', borderBottom: '1px solid #F1F5F9', textAlign: 'right' }}>€{row.total.toLocaleString('en-US', { minimumFractionDigits: 0 })}</td>
                          </tr>
                          {expandedStatus === row.status && (
                            <tr>
                              <td colSpan={3} style={{ padding: '4px 8px 10px 20px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {row.opportunities.map((o: any) => (
                                    <div key={o.id} onClick={() => router.push(`/opportunities/${o.id}`)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', cursor: 'pointer' }}>
                                      <span style={{ color: '#219BD6', fontWeight: '600' }}>{o.deal_name}</span>
                                      <span style={{ color: '#3F3F3F' }}>{o.deal_amount ? `€${o.deal_amount.toLocaleString('en-US')}` : '—'}</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                      <tr>
                        <td style={{ padding: '10px 8px', fontSize: '12px', fontWeight: '700', color: '#144766' }}>Total</td>
                        <td style={{ padding: '10px 8px', fontSize: '12px', fontWeight: '700', color: '#144766', textAlign: 'right' }}>{opportunities.length}</td>
                        <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: '800', color: '#144766', textAlign: 'right' }}>€{totalValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead style={{ background: '#FAFBFC' }}>
                <tr>
                  {COLUMNS.filter(c => isVisible(c.key)).map(c => (
                    <th key={c.key} onClick={() => rb.toggleSort(c.key)} style={{ position: 'relative', textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: `${rb.columnWidths[c.key] || DEFAULT_COLUMN_WIDTHS[c.key] || 150}px`, cursor: 'pointer', userSelect: 'none' }}>
                      {c.label}<SortArrow active={rb.sortField === c.key} dir={rb.sortDir} />
                      <ColumnResizeHandle colKey={c.key} rb={rb} />
                    </th>
                  ))}
                  <th style={{ borderBottom: '1px solid #E2E8F0' }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Loading...</td></tr>
                ) : reported.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length + 1}><EmptyState icon="💼" title="No opportunities yet" description="Create your first opportunity by clicking New Opportunity" /></td></tr>
                ) : pageRows.map(opp => (
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
                    {isVisible('main_operational_team_name') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{opp.main_operational_team?.title || '—'}</td>
                    )}
                    {isVisible('sales_team_name') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{opp.sales_team?.title || '—'}</td>
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
            <Pagination page={rb.page} setPage={rb.setPage} total={reported.length} />
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

        {kpiPopup && (() => {
          const matches = withDisplay
            .filter(KPI_FILTERS[kpiPopup])
            .filter(o => !popupOpTeam || o.main_operational_team_name === popupOpTeam)
            .filter(o => !popupSalesTeam || o.sales_team_name === popupSalesTeam)
          return (
            <div className="modal-overlay" onClick={() => setKpiPopup(null)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                <div className="modal-header">
                  <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>{KPI_LABELS[kpiPopup]} ({matches.length})</h2>
                  <button onClick={() => setKpiPopup(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
                </div>
                <div className="modal-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                    <div>
                      <label className="form-label">Operational Team</label>
                      <select className="form-input" value={popupOpTeam} onChange={e => setPopupOpTeam(e.target.value)}>
                        <option value="">All teams</option>
                        {operationalTeams.map((t: any) => <option key={t.id} value={t.title}>{t.title}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Sales Team</label>
                      <select className="form-input" value={popupSalesTeam} onChange={e => setPopupSalesTeam(e.target.value)}>
                        <option value="">All teams</option>
                        {salesTeams.map((t: any) => <option key={t.id} value={t.title}>{t.title}</option>)}
                      </select>
                    </div>
                  </div>

                  {matches.length === 0 ? (
                    <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No opportunities match this filter.</p>
                  ) : (
                    <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {matches.map(o => (
                        <div key={o.id} onClick={() => router.push(`/opportunities/${o.id}`)}
                          style={{ padding: '9px 12px', borderRadius: '7px', background: '#F8FAFC', border: '1px solid #EDF2F7', cursor: 'pointer', fontSize: '13px', color: '#144766', fontWeight: '600' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#EFF6FF')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#F8FAFC')}>
                          {o.deal_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}
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
