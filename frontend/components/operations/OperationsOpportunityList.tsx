'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { opportunitiesAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, ColumnResizeHandle, REPORT_CELL_STYLE, SortArrow, Pagination } from '@/components/it/ReportBuilder'
import { PageHeader } from '@/components/shared/RecordLayout'

const STATUSES = ['Contract Won']

const COLUMNS: ReportColumn[] = [
  { key: 'deal_name', label: 'Opportunity', filterable: 'text' },
  { key: 'company_name', label: 'Company/Partner', filterable: 'text' },
  { key: 'deal_amount', label: 'Amount' },
  { key: 'deal_status', label: 'Status', filterable: 'select', options: STATUSES },
  { key: 'contract_start_date', label: 'Contract Start' },
  { key: 'contract_end_date', label: 'Contract End' },
  { key: 'assigned_to', label: 'Owner', filterable: 'text' },
]

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  deal_name: 240, company_name: 180, deal_amount: 130, deal_status: 150,
  contract_start_date: 130, contract_end_date: 130, assigned_to: 160,
}

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export function OperationsOpportunityList({ module, title, icon, projectTypes }: { module: string; title: string; icon: string; projectTypes: string[] }) {
  const router = useRouter()
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [search, setSearch] = useState('')

  const rb = useReportBuilder(module, COLUMNS, userEmail)

  useEffect(() => {
    opportunitiesAPI.list({}).then(setOpportunities).catch(() => {}).finally(() => setLoading(false))
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  const scoped = opportunities.filter((o: any) => STATUSES.includes(o.deal_status) && projectTypes.includes(o.project_status))
  const withDisplay = scoped.map(o => ({ ...o, company_name: o.company?.name || o.partner?.name || '' }))
  const searched = withDisplay.filter(o => !search.trim() || o.deal_name.toLowerCase().includes(search.trim().toLowerCase()))
  const reported = applyReport(searched, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const pageRows = reported.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)
  const totalAmount = withDisplay.reduce((s, o) => s + (o.deal_amount || 0), 0)

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader
        title={`${icon} ${title}`}
        count={reported.length}
        search={{ value: search, onChange: setSearch }}
        action={<ReportPanel columns={COLUMNS} rb={rb} />}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px', maxWidth: '480px' }}>
        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '4px' }}>Total</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#144766' }}>{withDisplay.length}</div>
        </div>
        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '4px' }}>Total Amount</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669' }}>€{totalAmount.toLocaleString('en-US')}</div>
        </div>
      </div>

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
              <tr><td colSpan={COLUMNS.length} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Nothing here yet.</td></tr>
            ) : pageRows.map(o => (
              <tr key={o.id} onClick={() => router.push(`/opportunities/${o.id}`)} style={{ cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                {isVisible('deal_name') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE, fontWeight: 600, color: '#144766' }}>{o.deal_name}</td>}
                {isVisible('company_name') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{o.company_name || '—'}</td>}
                {isVisible('deal_amount') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{o.deal_amount ? `€${o.deal_amount.toLocaleString('en-US')}` : '—'}</td>}
                {isVisible('deal_status') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}><span style={{ background: '#D1FAE5', color: '#059669', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{o.deal_status}</span></td>}
                {isVisible('contract_start_date') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{fmt(o.contract_start_date)}</td>}
                {isVisible('contract_end_date') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{fmt(o.contract_end_date)}</td>}
                {isVisible('assigned_to') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{o.assigned_to || '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={rb.page} setPage={rb.setPage} total={reported.length} />
      </div>
    </div>
  )
}
