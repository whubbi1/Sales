'use client'
// app/companies/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { companiesAPI, partnersAPI } from '@/lib/api'
import { PageHeader, StatusBadge, EmptyState } from '@/components/shared/RecordLayout'
import { CompanyModal } from '@/components/companies/CompanyModal'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn } from '@/components/it/ReportBuilder'
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
const LEVEL_COLORS: Record<number, string> = { 1: '#144766', 2: '#1a5a84', 3: '#219BD6', 4: '#7DD3F0' }

const COLUMNS: ReportColumn[] = [
  { key: 'name', label: 'Company', filterable: 'text' },
  { key: 'level_label', label: 'Level', filterable: 'select', options: ['Group', 'Parent', 'Child', 'Sub-Child'] },
  { key: 'main_contact_display', label: 'Contact', filterable: 'text' },
  { key: 'domains_display', label: 'Domains' },
  { key: 'main_erp_display', label: 'ERP' },
  { key: 'hosting_display', label: 'Hosting' },
  { key: 'status', label: 'Status', filterable: 'select', options: ['lead', 'prospect', 'client', 'partner'] },
  { key: 'assigned_to', label: 'Assigned', filterable: 'text' },
]

export default function CompaniesPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [userEmail, setUserEmail] = useState('')
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
                  <tr><td colSpan={COLUMNS.length + 1}><EmptyState icon="🏢" title="No companies yet" description="Create your first company by clicking New Company" /></td></tr>
                ) : reported.map(company => (
                  <tr key={company.id} onClick={() => router.push(company._isPartner ? `/partners/${company.id}` : `/companies/${company.id}`)} style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    {isVisible('name') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {company.level > 1 && <span style={{ color: '#CBD5E0', marginLeft: `${(company.level - 1) * 12}px` }}>└</span>}
                          <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: LEVEL_COLORS[company.level] || '#144766', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', flexShrink: 0 }}>
                            {company.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: '#144766', fontSize: '13px' }}>{company.name}</div>
                            {company.parent && <div style={{ fontSize: '10px', color: '#9B9B9B' }}>↑ {company.parent.name}</div>}
                          </div>
                        </div>
                      </td>
                    )}
                    {isVisible('level_label') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                        <span style={{ background: LEVEL_COLORS[company.level] + '20', color: LEVEL_COLORS[company.level], padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>
                          {LEVEL_LABELS[company.level]}
                        </span>
                      </td>
                    )}
                    {isVisible('main_contact_display') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F' }}>{company.main_contact_display || '—'}</td>
                    )}
                    {isVisible('domains_display') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '11px', color: '#9B9B9B' }}>
                        {(company.domain_names || []).slice(0, 2).join(', ')}
                        {(company.domain_names || []).length > 2 && <span style={{ color: '#219BD6' }}> +{company.domain_names.length - 2}</span>}
                      </td>
                    )}
                    {isVisible('main_erp_display') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                          {(company.main_erp || []).slice(0, 2).map((e: string) => (
                            <span key={e} style={{ background: '#EEF2FF', color: '#4F46E5', padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{e}</span>
                          ))}
                          {(company.main_erp || []).length > 2 && <span style={{ fontSize: '10px', color: '#9B9B9B' }}>+{company.main_erp.length - 2}</span>}
                        </div>
                      </td>
                    )}
                    {isVisible('hosting_display') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                          {(company.sap_hosting_partner || []).slice(0, 2).map((h: string) => (
                            <span key={h} style={{ background: '#ECFDF5', color: '#059669', padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{h}</span>
                          ))}
                        </div>
                      </td>
                    )}
                    {isVisible('status') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                        <StatusBadge value={company.status} />
                      </td>
                    )}
                    {isVisible('assigned_to') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '11px', color: '#9B9B9B' }}>{company.assigned_to || '—'}</td>
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
