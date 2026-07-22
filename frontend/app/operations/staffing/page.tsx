'use client'
import { useState, useEffect } from 'react'
import { OperationsLayout, useOperationsPerm } from '@/components/OperationsLayout'
import { opportunitiesAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { PageHeader } from '@/components/shared/RecordLayout'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, SortArrow } from '@/components/it/ReportBuilder'
import { StaffingDrilldownModal } from '@/components/shared/StaffingDrilldownModal'

const API = 'https://api.whubbi.wcomply.com'
const CLOSED_STATUSES = ['Contract Won', 'Contract Lost']

function weekdaysInMonth(year: number, monthIndex0: number) {
  const days = new Date(year, monthIndex0 + 1, 0).getDate()
  let count = 0
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, monthIndex0, d).getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

function nextSixMonths() {
  const now = new Date()
  const months: { key: string; label: string; year: number; monthIndex0: number }[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    months.push({ key: `month_${i}`, label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), year: d.getFullYear(), monthIndex0: d.getMonth() })
  }
  return months
}

// Real calendar month key ("2026-08-01") for a relative month_N slot — used to look up
// staffing allocations, kept separate from the stable month_N column key used for
// saved-view persistence (a "month_3" column always means "3 months from now").
function calendarKey(monthIndex0: number, year: number) {
  return `${year}-${String(monthIndex0 + 1).padStart(2, '0')}-01`
}

function ratioColor(ratio: number) {
  if (ratio < 0.8) return '#DC2626'
  if (ratio > 1.2) return '#D97706'
  return '#059669'
}

function StaffingContent() {
  const { level } = useOperationsPerm('staffing')
  const [users, setUsers] = useState<any[]>([])
  const [staffing, setStaffing] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [drilldown, setDrilldown] = useState<{ email: string; resource: string; calKey: string; label: string; monthLabel: string } | null>(null)

  const months = nextSixMonths()
  const COLUMNS: ReportColumn[] = [
    { key: 'resource', label: 'Resource', filterable: 'text' },
    ...months.map(m => ({ key: m.key, label: m.label })),
  ]
  const rb = useReportBuilder('operations_staffing', COLUMNS, userEmail)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/settings/users`).then(r => r.json()).then(d => d.users || []),
      opportunitiesAPI.getAllStaffing(),
    ]).then(([u, s]) => { setUsers(u); setStaffing(s) }).finally(() => setLoading(false))
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  if (level === 'loading' || loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )

  const employeeName = (u: any) => u.display_name || `${u.first_name} ${u.last_name}`
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  // days staffed for one email, in one deal_status bucket, for one calendar month key
  const daysFor = (email: string, calKey: string, bucket: 'ongoing' | 'open') => {
    return staffing
      .filter((s: any) => s.user_email === email)
      .filter((s: any) => bucket === 'ongoing' ? s.deal_status === 'Contract Won' : !CLOSED_STATUSES.includes(s.deal_status))
      .reduce((sum: number, s: any) => sum + (s.months || []).filter((m: any) => m.month.slice(0, 10) === calKey).reduce((a: number, m: any) => a + m.days, 0), 0)
  }

  // Per-opportunity breakdown for the drill-down popup — same bucket rules as daysFor above.
  const breakdownFor = (email: string, calKey: string, label: string) => {
    return staffing
      .filter((s: any) => s.user_email === email)
      .filter((s: any) => {
        if (label === 'Ongoing') return s.deal_status === 'Contract Won'
        if (label === 'Open') return !CLOSED_STATUSES.includes(s.deal_status)
        return s.deal_status === 'Contract Won' || !CLOSED_STATUSES.includes(s.deal_status)
      })
      .map((s: any) => ({
        label: s.opportunity_name,
        sublabel: s.deal_status,
        days: (s.months || []).filter((m: any) => m.month.slice(0, 10) === calKey).reduce((a: number, m: any) => a + m.days, 0),
      }))
      .filter((r: any) => r.days > 0)
  }

  const withDisplay = users.map(u => ({ ...u, resource: employeeName(u) }))
  const searched = withDisplay.filter(u => !search.trim() || u.resource.toLowerCase().includes(search.trim().toLowerCase()))
  const reported = applyReport(searched, COLUMNS, rb.filters, rb.sortField, rb.sortDir)

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader
        title="👥 Staffing"
        count={reported.length}
        search={{ value: search, onChange: setSearch }}
        action={<ReportPanel columns={COLUMNS} rb={rb} />}
      />
      <p style={{ fontSize: '12px', color: '#94A3B8', margin: '-14px 0 16px' }}>Utilization for the next 6 months — green 0.8–1.2, red under 0.8, orange over 1.2</p>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {isVisible('resource') && (
                <th onClick={() => rb.toggleSort('resource')} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                  Resource<SortArrow active={rb.sortField === 'resource'} dir={rb.sortDir} />
                </th>
              )}
              <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}></th>
              {months.filter(m => isVisible(m.key)).map(m => <th key={m.key} style={{ textAlign: 'center', padding: '10px 12px', fontSize: '10px', fontWeight: '700', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{m.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {reported.map((u: any) => {
              const email = u.email
              const rows: { label: string; bold?: boolean }[] = [{ label: 'Ongoing' }, { label: 'Open' }, { label: 'Total', bold: true }]
              return rows.map((row, ri) => (
                <tr key={`${email}-${row.label}`} style={{ borderBottom: ri === 2 ? '2px solid #E2E8F0' : '1px solid #F8FAFC' }}>
                  {ri === 0 && isVisible('resource') && <td rowSpan={3} style={{ padding: '8px 16px', fontWeight: '700', color: '#144766', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{u.resource}</td>}
                  <td style={{ padding: '4px 12px', color: '#94A3B8', fontSize: '11px', whiteSpace: 'nowrap' }}>{row.label}</td>
                  {months.filter(m => isVisible(m.key)).map(m => {
                    const calKey = calendarKey(m.monthIndex0, m.year)
                    const ongoing = daysFor(email, calKey, 'ongoing')
                    const open = daysFor(email, calKey, 'open')
                    const days = row.label === 'Ongoing' ? ongoing : row.label === 'Open' ? open : ongoing + open
                    const standard = weekdaysInMonth(m.year, m.monthIndex0)
                    const ratio = standard ? days / standard : 0
                    return (
                      <td key={m.key} title={`${days} day${days === 1 ? '' : 's'} — click for details`}
                        onClick={() => days > 0 && setDrilldown({ email, resource: u.resource, calKey, label: row.label, monthLabel: m.label })}
                        style={{ padding: '4px 12px', textAlign: 'center', fontWeight: row.bold ? '800' : '500', color: days === 0 && row.label !== 'Total' ? '#CBD5E0' : ratioColor(ratio), cursor: days > 0 ? 'pointer' : 'default' }}>
                        {days === 0 && row.label !== 'Total' ? '—' : ratio.toFixed(2)}
                      </td>
                    )
                  })}
                </tr>
              ))
            })}
          </tbody>
        </table>
      </div>

      {drilldown && (
        <StaffingDrilldownModal
          title={`${drilldown.resource} — ${drilldown.label}`}
          subtitle={drilldown.monthLabel}
          rows={breakdownFor(drilldown.email, drilldown.calKey, drilldown.label)}
          onClose={() => setDrilldown(null)}
        />
      )}
    </div>
  )
}

export default function OperationsStaffingPage() {
  return <OperationsLayout><StaffingContent /></OperationsLayout>
}
