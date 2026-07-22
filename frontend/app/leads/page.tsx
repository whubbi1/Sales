'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { leadsAPI, legalAPI } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/shared/RecordLayout'
import { LeadModal } from '@/components/leads/LeadModal'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, ColumnResizeHandle, REPORT_CELL_STYLE, SortArrow, Pagination } from '@/components/it/ReportBuilder'
import { getStoredUser } from '@/lib/auth'

const STATUS_OPTIONS = ['Open', 'In Progress', 'Closed', 'Create an Opportunity']
// Display-only relabeling — the underlying status value stays 'Create an Opportunity'
// everywhere it's stored/compared (DB enum, backend trigger logic), only how it reads changes.
const STATUS_LABELS: Record<string, string> = { 'Create an Opportunity': 'Converted to Opportunity' }
const statusLabel = (s: string) => STATUS_LABELS[s] || s

const BASE_COLUMNS: ReportColumn[] = [
  { key: 'lead_number', label: 'Lead ID', filterable: 'text' },
  { key: 'title', label: 'Title', filterable: 'text' },
  { key: 'company_name', label: 'Company', filterable: 'text' },
  { key: 'partners_names', label: 'Partner(s)', filterable: 'text' },
  { key: 'origin', label: 'Origin', filterable: 'text' },
  { key: 'status', label: 'Status', filterable: 'select', options: STATUS_OPTIONS },
  { key: 'start_date', label: 'Start' },
  { key: 'end_date', label: 'End' },
]

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  lead_number: 110, title: 240, company_name: 170, partners_names: 170,
  origin: 130, status: 160, start_date: 120, end_date: 120,
  main_operational_team_name: 170, sales_team_name: 170,
}

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

function statusColors(status: string) {
  if (status === 'Closed') return { bg: '#F1F5F9', color: '#64748B' }
  if (status === 'Create an Opportunity') return { bg: '#ECFDF5', color: '#059669' }
  if (status === 'In Progress') return { bg: '#FFF7ED', color: '#D97706' }
  return { bg: '#EFF6FF', color: '#219BD6' }
}

export default function LeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [search, setSearch] = useState('')
  const [operationalTeams, setOperationalTeams] = useState<any[]>([])
  const [salesTeams, setSalesTeams] = useState<any[]>([])
  const [kpiPopup, setKpiPopup] = useState<string | null>(null)
  const [popupOpTeam, setPopupOpTeam] = useState('')
  const [popupSalesTeam, setPopupSalesTeam] = useState('')

  // Filter options need the full live team list, not just whatever appears in currently-loaded
  // leads, so an unused team still shows up as a selectable filter.
  const COLUMNS: ReportColumn[] = useMemo(() => [
    ...BASE_COLUMNS,
    { key: 'main_operational_team_name', label: 'Operational Team', filterable: 'select', options: operationalTeams.map((t: any) => t.title) },
    { key: 'sales_team_name', label: 'Sales Team', filterable: 'select', options: salesTeams.map((t: any) => t.title) },
  ], [operationalTeams, salesTeams])

  const rb = useReportBuilder('leads', COLUMNS, userEmail)

  const load = async () => {
    try {
      setLoading(true)
      setLeads(await leadsAPI.list({}))
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

  const withDisplay = leads.map(l => ({
    ...l,
    company_name: l.company?.name || '',
    partners_names: (l.partners || []).map((p: any) => p.name).join(', '),
    main_operational_team_name: l.main_operational_team?.title || '',
    sales_team_name: l.sales_team?.title || '',
  }))
  const searched = withDisplay.filter(l => !search.trim() || l.title.toLowerCase().includes(search.trim().toLowerCase()) || (l.lead_number || '').toLowerCase().includes(search.trim().toLowerCase()))
  const reported = applyReport(searched, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const pageRows = reported.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '24px 28px' }}>
          <PageHeader
            title="Leads"
            count={reported.length}
            search={{ value: search, onChange: setSearch }}
            action={
              <div style={{ display: 'flex', gap: '8px' }}>
                <ReportPanel columns={COLUMNS} rb={rb} />
                <button className="btn-primary" onClick={() => setShowModal(true)}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  New Lead
                </button>
              </div>
            }
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            {STATUS_OPTIONS.map(s => (
              <div key={s} onClick={() => { setKpiPopup(s); setPopupOpTeam(''); setPopupSalesTeam('') }}
                style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '4px' }}>{statusLabel(s)}</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: statusColors(s).color }}>{leads.filter(l => l.status === s).length}</div>
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
                  <tr><td colSpan={COLUMNS.length}><EmptyState icon="🎯" title="No leads yet" description="Create your first lead by clicking New Lead" /></td></tr>
                ) : pageRows.map(l => (
                  <tr key={l.id} onClick={() => router.push(`/leads/${l.id}`)} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    {isVisible('lead_number') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE, fontWeight: 700, color: '#64748B' }}>{l.lead_number || '—'}</td>}
                    {isVisible('title') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE, fontWeight: 600, color: '#144766' }}>{l.title}</td>}
                    {isVisible('company_name') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{l.company_name || '—'}</td>}
                    {isVisible('partners_names') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{l.partners_names || '—'}</td>}
                    {isVisible('origin') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{l.origin || '—'}</td>}
                    {isVisible('status') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>
                        <span style={{ background: statusColors(l.status).bg, color: statusColors(l.status).color, padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{statusLabel(l.status)}</span>
                      </td>
                    )}
                    {isVisible('start_date') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{fmt(l.start_date)}</td>}
                    {isVisible('end_date') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{fmt(l.end_date)}</td>}
                    {isVisible('main_operational_team_name') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{l.main_operational_team_name || '—'}</td>}
                    {isVisible('sales_team_name') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{l.sales_team_name || '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={rb.page} setPage={rb.setPage} total={reported.length} />
          </div>
        </div>
        {showModal && <LeadModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />}

        {kpiPopup && (() => {
          const matches = withDisplay
            .filter(l => l.status === kpiPopup)
            .filter(l => !popupOpTeam || l.main_operational_team_name === popupOpTeam)
            .filter(l => !popupSalesTeam || l.sales_team_name === popupSalesTeam)
          return (
            <div className="modal-overlay" onClick={() => setKpiPopup(null)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                <div className="modal-header">
                  <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>{statusLabel(kpiPopup)} ({matches.length})</h2>
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
                    <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No leads match this filter.</p>
                  ) : (
                    <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {matches.map(l => (
                        <div key={l.id} onClick={() => router.push(`/leads/${l.id}`)}
                          style={{ padding: '9px 12px', borderRadius: '7px', background: '#F8FAFC', border: '1px solid #EDF2F7', cursor: 'pointer', fontSize: '13px', color: '#144766', fontWeight: '600' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#EFF6FF')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#F8FAFC')}>
                          {l.title}
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
