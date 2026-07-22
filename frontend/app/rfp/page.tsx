'use client'
// app/rfp/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { rfpAPI, legalAPI } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/shared/RecordLayout'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, ColumnResizeHandle, REPORT_CELL_STYLE, SortArrow, Pagination } from '@/components/it/ReportBuilder'
import { getStoredUser } from '@/lib/auth'

const STATUS_OPTIONS = ['Open', 'Submitted', 'Won', 'Lost']

const COLUMNS: ReportColumn[] = [
  { key: 'reference', label: 'Reference', filterable: 'text' },
  { key: 'name', label: 'RFP', filterable: 'text' },
  { key: 'customer_name', label: 'Customer', filterable: 'text' },
  { key: 'owner', label: 'Owner', filterable: 'text' },
  { key: 'status', label: 'Status', filterable: 'select', options: STATUS_OPTIONS },
  { key: 'opportunities_count', label: 'Opportunities' },
]

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  reference: 110, name: 240, customer_name: 170, owner: 160, status: 130, opportunities_count: 150,
}

export default function RFPPage() {
  const router = useRouter()
  const [rfps, setRfps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [nameSearch, setNameSearch] = useState('')
  const [operationalTeams, setOperationalTeams] = useState<any[]>([])
  const [salesTeams, setSalesTeams] = useState<any[]>([])
  const [kpiPopup, setKpiPopup] = useState<string | null>(null)
  const [popupOpTeam, setPopupOpTeam] = useState('')
  const [popupSalesTeam, setPopupSalesTeam] = useState('')

  const rb = useReportBuilder('rfp', COLUMNS, userEmail)

  const load = async () => {
    try {
      setLoading(true)
      const data = await rfpAPI.list({})
      setRfps(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
    legalAPI.getOrgEntities('operational_team').then(d => setOperationalTeams(d.org_entities || [])).catch(() => {})
    legalAPI.getOrgEntities('sales_entity').then(d => setSalesTeams(d.org_entities || [])).catch(() => {})
  }, [])

  // An RFP has no team of its own — it links to Opportunities many-to-many, each with its
  // own team, so a team "matches" an RFP if ANY linked opportunity belongs to it.
  const withDisplay = rfps.map(r => ({
    ...r,
    customer_name: r.company?.name || r.partner?.name || '',
    opportunities_count: r.opportunities?.length || 0,
    operational_team_names: (r.opportunities || []).map((o: any) => o.main_operational_team?.title).filter(Boolean),
    sales_team_names: (r.opportunities || []).map((o: any) => o.sales_team?.title).filter(Boolean),
  }))

  const KPI_FILTERS: Record<string, (r: any) => boolean> = {
    open: (r: any) => r.status === 'Open',
    submitted: (r: any) => r.status === 'Submitted',
    won: (r: any) => r.status === 'Won',
    lost: (r: any) => r.status === 'Lost',
  }
  const KPI_LABELS: Record<string, string> = { total: 'All RFPs', open: 'Open', submitted: 'Submitted', won: 'Won', lost: 'Lost' }
  const searched = withDisplay.filter(r => !nameSearch.trim() || r.name.toLowerCase().includes(nameSearch.trim().toLowerCase()))
  const reported = applyReport(searched, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const pageRows = reported.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  // RFPs have no amount of their own — sum each linked opportunity's deal_amount.
  const rfpAmount = (r: any) => (r.opportunities || []).reduce((s: number, o: any) => s + (o.deal_amount || 0), 0)
  const totalAmount = withDisplay.reduce((s, r) => s + rfpAmount(r), 0)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '24px 28px' }}>
          <PageHeader
            title="RFP"
            count={reported.length}
            search={{ value: nameSearch, onChange: setNameSearch }}
            action={<ReportPanel columns={COLUMNS} rb={rb} />}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '16px' }}>
            {[
              { key: 'total', label: 'Total Amount', value: `€${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, color: '#144766' },
              { key: 'open', label: 'Open', value: withDisplay.filter(r => r.status === 'Open').length, color: '#219BD6' },
              { key: 'submitted', label: 'Submitted', value: withDisplay.filter(r => r.status === 'Submitted').length, color: '#D97706' },
              { key: 'won', label: 'Won', value: withDisplay.filter(r => r.status === 'Won').length, color: '#059669' },
              { key: 'lost', label: 'Lost', value: withDisplay.filter(r => r.status === 'Lost').length, color: '#DC2626' },
            ].map(stat => (
              <div key={stat.label} onClick={() => { setKpiPopup(stat.key); setPopupOpTeam(''); setPopupSalesTeam('') }}
                style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '4px' }}>{stat.label}</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>

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
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={COLUMNS.length} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Loading...</td></tr>
                ) : reported.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length}><EmptyState icon="📄" title="No RFPs yet" description="An RFP is created automatically when an Opportunity's status is set to RFP Ongoing" /></td></tr>
                ) : pageRows.map(rfp => (
                  <tr key={rfp.id} onClick={() => router.push(`/rfp/${rfp.id}`)} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    {isVisible('reference') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE, fontWeight: 700, color: '#64748B' }}>{rfp.reference || '—'}</td>
                    )}
                    {isVisible('name') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: '#144766', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat, sans-serif', fontSize: '12px', flexShrink: 0 }}>
                            {rfp.name[0]?.toUpperCase()}
                          </div>
                          <div>{rfp.name}</div>
                        </div>
                      </td>
                    )}
                    {isVisible('customer_name') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{rfp.customer_name || '—'}</td>
                    )}
                    {isVisible('owner') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{rfp.owner || '—'}</td>
                    )}
                    {isVisible('status') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{rfp.status}</td>
                    )}
                    {isVisible('opportunities_count') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>
                        {rfp.opportunities?.length || 0} opportunit{(rfp.opportunities?.length || 0) !== 1 ? 'ies' : 'y'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={rb.page} setPage={rb.setPage} total={reported.length} />
          </div>
        </div>

        {kpiPopup && (() => {
          const matches = withDisplay
            .filter(r => kpiPopup === 'total' || KPI_FILTERS[kpiPopup](r))
            .filter(r => !popupOpTeam || r.operational_team_names.includes(popupOpTeam))
            .filter(r => !popupSalesTeam || r.sales_team_names.includes(popupSalesTeam))
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
                    <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No RFPs match this filter.</p>
                  ) : (
                    <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {matches.map(r => (
                        <div key={r.id} onClick={() => router.push(`/rfp/${r.id}`)}
                          style={{ padding: '9px 12px', borderRadius: '7px', background: '#F8FAFC', border: '1px solid #EDF2F7', cursor: 'pointer', fontSize: '13px', color: '#144766', fontWeight: '600' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#EFF6FF')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#F8FAFC')}>
                          {r.name}
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
