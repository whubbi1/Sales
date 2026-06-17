'use client'
# companies/[id]/page.tsx
$content = Get-Content "C:\whubbi\frontend\app\companies\[id]\page.tsx" -Raw
$insert = "`nexport async function generateStaticParams() {`n  return []`n}`n"
$content = $content -replace "('use client')", "`$1`n$insert"
Set-Content "C:\whubbi\frontend\app\companies\[id]\page.tsx" $content

// app/companies/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { companiesAPI } from '@/lib/api'
import { PageHeader, StatusBadge, EmptyState } from '@/components/shared/RecordLayout'
import { CompanyModal } from '@/components/companies/CompanyModal'

const LEVEL_LABELS: Record<number, string> = { 1: 'Group', 2: 'Parent', 3: 'Child', 4: 'Sub-Child' }
const LEVEL_COLORS: Record<number, string> = { 1: '#144766', 2: '#1a5a84', 3: '#219BD6', 4: '#7DD3F0' }

export default function CompaniesPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const data = await companiesAPI.list({ search: search || undefined, status: statusFilter || undefined })
      setCompanies(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search, statusFilter])

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '24px 28px' }}>
          <PageHeader
            title="Companies"
            count={companies.length}
            action={
              <button className="btn-primary" onClick={() => setShowModal(true)}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Company
              </button>
            }
          />

          {/* Filters */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '340px' }}>
              <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9B9B9B' }} width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="form-input" style={{ paddingLeft: '30px' }} placeholder="Search companies..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-input" style={{ width: '150px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="lead">Lead</option>
              <option value="prospect">Prospect</option>
              <option value="client">Client</option>
              <option value="partner">Partner</option>
            </select>
          </div>

          {/* Table */}
          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#FAFBFC' }}>
                <tr>
                  {['Company', 'Level', 'Contact', 'Domains', 'ERP', 'Hosting', 'Status', 'Assigned'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Loading...</td></tr>
                ) : companies.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState icon="🏢" title="No companies yet" description="Create your first company by clicking New Company" /></td></tr>
                ) : companies.map(company => (
                  <tr key={company.id} onClick={() => router.push(`/companies/${company.id}`)} style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
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
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ background: LEVEL_COLORS[company.level] + '20', color: LEVEL_COLORS[company.level], padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>
                        {LEVEL_LABELS[company.level]}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F' }}>{company.contact_name || '—'}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '11px', color: '#9B9B9B' }}>
                      {(company.domain_names || []).slice(0, 2).join(', ')}
                      {(company.domain_names || []).length > 2 && <span style={{ color: '#219BD6' }}> +{company.domain_names.length - 2}</span>}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {(company.main_erp || []).slice(0, 2).map((e: string) => (
                          <span key={e} style={{ background: '#EEF2FF', color: '#4F46E5', padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{e}</span>
                        ))}
                        {(company.main_erp || []).length > 2 && <span style={{ fontSize: '10px', color: '#9B9B9B' }}>+{company.main_erp.length - 2}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {(company.sap_hosting_partner || []).slice(0, 2).map((h: string) => (
                          <span key={h} style={{ background: '#ECFDF5', color: '#059669', padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{h}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                      <StatusBadge value={company.status} />
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '11px', color: '#9B9B9B' }}>{company.assigned_to || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {showModal && <CompanyModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} companies={companies} />}
      </main>
    </div>
  )
}
