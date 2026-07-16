'use client'
// app/companies/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { companiesAPI, partnersAPI } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/shared/RecordLayout'
import { CompanyModal } from '@/components/companies/CompanyModal'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, ColumnResizeHandle, REPORT_CELL_STYLE } from '@/components/it/ReportBuilder'
import { getStoredUser } from '@/lib/auth'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

async function claudeSearch(prompt: string): Promise<string> {
  const r = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 1500,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }]
    })
  })
  const d = await r.json()
  return d.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n') || 'No results found.'
}

const LEVEL_LABELS: Record<number, string> = { 1: 'Group', 2: 'Parent', 3: 'Child', 4: 'Sub-Child' }

const COLUMNS: ReportColumn[] = [
  { key: 'internal_id', label: 'ID', filterable: 'text' },
  { key: 'name', label: 'Company', filterable: 'text' },
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
  const [showSearch, setShowSearch] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [searchType, setSearchType] = useState('')

  const runSearch = async (company: any, type: string) => {
    setAiLoading(true); setAiResult(''); setSearchType(type)
    let prompt = ''
    if (type === 'general') {
      prompt = `Search for comprehensive information about the company "${company.name}". Find: website, key executives, recent news, business activities, financial information, and any notable developments.`
    } else if (type === 'sap') {
      prompt = `Search for SAP-related information about "${company.name}". Find: their SAP implementation details, SAP projects, SAP partnerships, ERP systems used, any SAP-related news or case studies, and their digital transformation initiatives.`
    } else if (type === 'cybersecurity') {
      prompt = `Search for cybersecurity information about "${company.name}". Find: any cybersecurity incidents, data breaches, security certifications (ISO 27001, SOC2), their security posture, any partnerships with cybersecurity vendors.`
    } else if (type === 'mergers') {
      prompt = `Search for merger, acquisition, and strategic information about "${company.name}". Find: any recent M&A activity, acquisitions made, companies they were acquired by, partnerships, joint ventures, and strategic alliances.`
    }
    const result = await claudeSearch(prompt)
    setAiResult(result); setAiLoading(false)
  }

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
  const reported = applyReport(withDisplay, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '24px 28px' }}>
          <PageHeader
            title="Companies"
            count={reported.length}
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
                    <th key={c.key} style={{ position: 'relative', textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: `${rb.columnWidths[c.key] || DEFAULT_COLUMN_WIDTHS[c.key] || 150}px` }}>
                      {c.label}
                      <ColumnResizeHandle colKey={c.key} rb={rb} />
                    </th>
                  ))}
                  <th style={{ borderBottom: '1px solid #E2E8F0', width: '90px' }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Loading...</td></tr>
                ) : reported.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length + 1}><EmptyState icon="🏢" title="No companies yet" description="Create your first company by clicking New Company" /></td></tr>
                ) : reported.map(company => (
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
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                      <button onClick={e => { e.stopPropagation(); setSelectedCompany(company); setAiResult(''); setShowSearch(true) }}
                        style={{ padding:'4px 10px', background:'#EFF6FF', color:'#156082', border:'none', borderRadius:'6px', fontSize:'10px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif', whiteSpace:'nowrap' }}>
                        🔍 Search
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Company Web Search Panel */}
        {selectedCompany && showSearch && (
          <div style={{ position:'fixed', right:0, top:0, width:'440px', height:'100vh', background:'white', boxShadow:'-4px 0 24px rgba(0,0,0,0.12)', zIndex:200, display:'flex', flexDirection:'column', fontFamily:'Montserrat, sans-serif' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #EDF2F7', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#156082' }}>
              <div>
                <div style={{ fontSize:'13px', fontWeight:'800', color:'white' }}>🔍 {selectedCompany.name}</div>
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.6)', marginTop:'2px' }}>Internet Research</div>
              </div>
              <button onClick={()=>setShowSearch(false)} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'white', width:'28px', height:'28px', borderRadius:'6px', cursor:'pointer', fontSize:'16px' }}>×</button>
            </div>

            <div style={{ padding:'14px', borderBottom:'1px solid #EDF2F7', display:'flex', gap:'6px', flexWrap:'wrap' }}>
              {[
                { type:'general',      label:'🌐 General',      color:'#156082' },
                { type:'sap',          label:'⚙️ SAP',          color:'#0078D4' },
                { type:'cybersecurity',label:'🛡️ Cybersecurity', color:'#DC2626' },
                { type:'mergers',      label:'🤝 M&A',          color:'#7C3AED' },
              ].map(btn => (
                <button key={btn.type} onClick={()=>runSearch(selectedCompany, btn.type)} disabled={aiLoading}
                  style={{ flex:1, minWidth:'80px', padding:'8px 6px', background: searchType===btn.type ? btn.color : btn.color+'15', color: searchType===btn.type ? 'white' : btn.color, border:`1.5px solid ${btn.color}30`, borderRadius:'8px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif', transition:'all 0.15s' }}>
                  {btn.label}
                </button>
              ))}
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'14px' }}>
              {aiLoading && (
                <div style={{ textAlign:'center', padding:'32px', color:'#45B6E4' }}>
                  <div style={{ fontSize:'24px', marginBottom:'8px' }}>🤖</div>
                  <div style={{ fontSize:'12px', fontWeight:'600' }}>Claude AI is searching the web...</div>
                  <div style={{ fontSize:'11px', color:'#94A3B8', marginTop:'4px' }}>This may take a few seconds</div>
                </div>
              )}
              {aiResult && !aiLoading && (
                <div>
                  <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'10px' }}>
                    {searchType === 'general' ? '🌐 General Information' : searchType === 'sap' ? '⚙️ SAP & ERP' : searchType === 'cybersecurity' ? '🛡️ Cybersecurity' : '🤝 M&A & Partnerships'}
                  </div>
                  <div style={{ background:'#F8FAFC', borderRadius:'10px', padding:'14px', fontSize:'12px', color:'#3F3F3F', lineHeight:'1.8', whiteSpace:'pre-wrap' }}>
                    {aiResult}
                  </div>
                </div>
              )}
              {!aiResult && !aiLoading && (
                <div style={{ textAlign:'center', padding:'32px', color:'#45B6E4', fontSize:'12px' }}>
                  <div style={{ fontSize:'32px', marginBottom:'12px' }}>🏢</div>
                  Select a search type above to find information about {selectedCompany.name}.
                </div>
              )}
            </div>
          </div>
        )}
        {showModal && <CompanyModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} companies={companies.filter(c => !c._isPartner)} />}
      </main>
    </div>
  )
}
