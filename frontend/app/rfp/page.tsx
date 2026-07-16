'use client'
// app/rfp/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { rfpAPI } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/shared/RecordLayout'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, REPORT_CELL_STYLE, SortArrow, Pagination } from '@/components/it/ReportBuilder'
import { getStoredUser } from '@/lib/auth'

const STATUS_OPTIONS = ['Open', 'Submitted', 'Won', 'Lost']

const COLUMNS: ReportColumn[] = [
  { key: 'name', label: 'RFP', filterable: 'text' },
  { key: 'customer_name', label: 'Customer', filterable: 'text' },
  { key: 'owner', label: 'Owner', filterable: 'text' },
  { key: 'status', label: 'Status', filterable: 'select', options: STATUS_OPTIONS },
  { key: 'opportunities_count', label: 'Opportunities' },
]

export default function RFPPage() {
  const router = useRouter()
  const [rfps, setRfps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')

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
  }, [])

  const withDisplay = rfps.map(r => ({
    ...r,
    customer_name: r.company?.name || r.partner?.name || '',
    opportunities_count: r.opportunities?.length || 0,
  }))
  const reported = applyReport(withDisplay, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const pageRows = reported.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '24px 28px' }}>
          <PageHeader
            title="RFP"
            count={reported.length}
            action={<ReportPanel columns={COLUMNS} rb={rb} />}
          />

          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#FAFBFC' }}>
                <tr>
                  {COLUMNS.filter(c => isVisible(c.key)).map(c => (
                    <th key={c.key} onClick={() => rb.toggleSort(c.key)} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>{c.label}<SortArrow active={rb.sortField === c.key} dir={rb.sortDir} /></th>
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
      </main>
    </div>
  )
}
