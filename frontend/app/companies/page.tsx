'use client'
// app/companies/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { companiesAPI, partnersAPI } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/shared/RecordLayout'
import { CompanyModal } from '@/components/companies/CompanyModal'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, ColumnResizeHandle, REPORT_CELL_STYLE, SortArrow, Pagination } from '@/components/it/ReportBuilder'
import { getStoredUser } from '@/lib/auth'

const LEVEL_LABELS: Record<number, string> = { 1: 'Group', 2: 'Parent', 3: 'Child', 4: 'Sub-Child' }

const COLUMNS: ReportColumn[] = [
  { key: 'name', label: 'Company', filterable: 'text' },
  { key: 'internal_id', label: 'ID', filterable: 'text' },
  { key: 'level_label', label: 'Level', filterable: 'select', options: ['Group', 'Parent', 'Child', 'Sub-Child'] },
  { key: 'main_contact_display', label: 'Contact', filterable: 'text' },
  { key: 'domains_display', label: 'Domains' },
  { key: 'main_erp_display', label: 'ERP' },
  { key: 'hosting_display', label: 'Hosting' },
  { key: 'status', label: 'Status', filterable: 'select', options: ['lead', 'prospect', 'client', 'partner'] },
  { key: 'assigned_to', label: 'Assigned', filterable: 'text' },
]

// table-layout:fixed (needed so resized column widths actually stick) divides unset columns
// evenly by default, which looks worse than the old content-based auto layout — these give
// the first-ever render sane proportions until a user drags a column to their own preference.
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  name: 260, level_label: 110, main_contact_display: 170, domains_display: 170,
  main_erp_display: 150, hosting_display: 150, status: 110, assigned_to: 150,
}

export default function CompaniesPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [stats, setStats] = useState<any>(null)
  const [nameSearch, setNameSearch] = useState('')

  const rb = useReportBuilder('company', COLUMNS, userEmail)

  const load = async () => {
    try {
      setLoading(true)
      const [companyRows, partnerRows] = await Promise.all([
        companiesAPI.list({}),
        partnersAPI.list({}),
      ])
      const mappedPartners = partnerRows.map((p: any) => ({
        ...p, status: 'partner', level: 1, parent: null,
        main_contact: p.main_contact_first_name ? { first_name: p.main_contact_first_name, last_name: p.main_contact_last_name } : null,
        _isPartner: true,
      }))
      setCompanies([...companyRows, ...mappedPartners].sort((a, b) => a.name.localeCompare(b.name)))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
    companiesAPI.dashboardStats().then(setStats).catch(() => {})
  }, [])

  const withDisplay = companies.map(c => ({
    ...c,
    level_label: LEVEL_LABELS[c.level],
    main_contact_display: c.main_contact ? `${c.main_contact.first_name} ${c.main_contact.last_name}` : '',
    domains_display: (c.domain_names || []).join(', '),
    main_erp_display: (c.main_erp || []).join(', '),
    hosting_display: (c.sap_hosting_partner || []).join(', '),
  }))

  // Default view: Group (level 1) companies first, each one's children nested directly
  // underneath it (depth-first), rather than every level interleaved alphabetically. Only
  // applies while the user hasn't picked their own sort — clicking a column header to sort
  // is a deliberate override and falls back to a plain flat sort like any other report.
  const isDefaultOrder = rb.sortField === 'name' && rb.sortDir === 'asc'
  const buildTree = (rows: any[]) => {
    const byParent: Record<string, any[]> = {}
    rows.forEach(c => { const k = c.parent_id || 'root'; (byParent[k] = byParent[k] || []).push(c) })
    const sortByName = (arr: any[]) => arr.slice().sort((a, b) => a.name.localeCompare(b.name))
    const flatten = (parentKey: string): any[] => sortByName(byParent[parentKey] || []).flatMap(c => [c, ...flatten(c.id)])
    return flatten('root')
  }
  const ordered = isDefaultOrder
    ? [...buildTree(withDisplay.filter(c => !c._isPartner)), ...withDisplay.filter(c => c._isPartner).sort((a, b) => a.name.localeCompare(b.name))]
    : withDisplay

  const searched = ordered.filter(c => !nameSearch.trim() || c.name.toLowerCase().includes(nameSearch.trim().toLowerCase()))
  const reported = applyReport(searched, COLUMNS, rb.filters, isDefaultOrder ? '' : rb.sortField, rb.sortDir)
  const pageRows = reported.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '24px 28px' }}>
          <PageHeader
            title="Companies"
            count={reported.length}
            search={{ value: nameSearch, onChange: setNameSearch }}
            action={
              <div style={{ display: 'flex', gap: '8px' }}>
                <ReportPanel columns={COLUMNS} rb={rb} />
                <button className="btn-primary" onClick={() => setShowModal(true)}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  New Company
                </button>
              </div>
            }
          />

          {/* Dashboard */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: 'Contacts', value: stats.total_contacts, color: '#144766' },
                { label: 'Open Opportunities', value: stats.open_count, color: '#219BD6' },
                { label: 'Open Pipeline', value: `€${stats.open_amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, color: '#219BD6' },
                { label: 'Won Opportunities', value: stats.won_count, color: '#059669' },
                { label: 'Won Amount', value: `€${stats.won_amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, color: '#059669' },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '4px' }}>{stat.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Table */}
          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'auto' }}>
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
                  <tr><td colSpan={COLUMNS.length}><EmptyState icon="🏢" title="No companies yet" description="Create your first company by clicking New Company" /></td></tr>
                ) : pageRows.map(company => (
                  <tr key={company.id} onClick={() => router.push(company._isPartner ? `/partners/${company.id}` : `/companies/${company.id}`)} style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    {isVisible('name') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {company.level > 1 && <span style={{ marginLeft: `${(company.level - 1) * 12}px` }}>└</span>}
                          <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: '#144766', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat, sans-serif', fontSize: '12px', flexShrink: 0 }}>
                            {company.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div>{company.name}</div>
                            {company.parent && <div>↑ {company.parent.name}</div>}
                          </div>
                        </div>
                      </td>
                    )}
                    {isVisible('internal_id') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{company.internal_id || '—'}</td>
                    )}
                    {isVisible('level_label') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{LEVEL_LABELS[company.level]}</td>
                    )}
                    {isVisible('main_contact_display') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{company.main_contact_display || '—'}</td>
                    )}
                    {isVisible('domains_display') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>
                        {(company.domain_names || []).slice(0, 2).join(', ')}
                        {(company.domain_names || []).length > 2 && <span> +{company.domain_names.length - 2}</span>}
                      </td>
                    )}
                    {isVisible('main_erp_display') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>
                        {(company.main_erp || []).slice(0, 2).join(', ')}
                        {(company.main_erp || []).length > 2 && <span> +{company.main_erp.length - 2}</span>}
                      </td>
                    )}
                    {isVisible('hosting_display') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>
                        {(company.sap_hosting_partner || []).join(', ') || '—'}
                      </td>
                    )}
                    {isVisible('status') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE, textTransform: 'capitalize' as const }}>{company.status}</td>
                    )}
                    {isVisible('assigned_to') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{company.assigned_to || '—'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={rb.page} setPage={rb.setPage} total={reported.length} />
          </div>
        </div>

        {showModal && <CompanyModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} companies={companies.filter(c => !c._isPartner)} />}
      </main>
    </div>
  )
}
