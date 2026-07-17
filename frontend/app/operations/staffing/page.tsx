'use client'
import { useState, useEffect } from 'react'
import { OperationsLayout, useOperationsPerm } from '@/components/OperationsLayout'
import { opportunitiesAPI } from '@/lib/api'

const API = 'https://api.whubbi.wcomply.com'
const CLOSED_STATUSES = ['Contract Ongoing', 'Contract Finalised', 'Contract Lost']

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
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), year: d.getFullYear(), monthIndex0: d.getMonth() })
  }
  return months
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

  useEffect(() => {
    Promise.all([
      fetch(`${API}/settings/users`).then(r => r.json()).then(d => d.users || []),
      opportunitiesAPI.getAllStaffing(),
    ]).then(([u, s]) => { setUsers(u); setStaffing(s) }).finally(() => setLoading(false))
  }, [])

  if (level === 'loading' || loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )

  const months = nextSixMonths()
  const employeeName = (u: any) => u.display_name || `${u.first_name} ${u.last_name}`
  const sortedUsers = [...users]
    .filter(u => !search.trim() || employeeName(u).toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => employeeName(a).localeCompare(employeeName(b)))

  // days staffed for one email, in one deal_status bucket, for one month key
  const daysFor = (email: string, monthKey: string, bucket: 'ongoing' | 'open') => {
    return staffing
      .filter((s: any) => s.user_email === email)
      .filter((s: any) => bucket === 'ongoing' ? s.deal_status === 'Contract Ongoing' : !CLOSED_STATUSES.includes(s.deal_status))
      .reduce((sum: number, s: any) => sum + (s.months || []).filter((m: any) => m.month.slice(0, 10) === monthKey).reduce((a: number, m: any) => a + m.days, 0), 0)
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>👥 Staffing</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>Utilization for the next 6 months — green 0.8–1.2, red under 0.8, orange over 1.2</p>
        </div>
        <input className="form-input" style={{ width: '240px' }} placeholder="Search resource…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>Resource</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}></th>
              {months.map(m => <th key={m.key} style={{ textAlign: 'center', padding: '10px 12px', fontSize: '10px', fontWeight: '700', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{m.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((u: any) => {
              const email = u.email
              const rows: { label: string; bold?: boolean }[] = [{ label: 'Ongoing' }, { label: 'Open' }, { label: 'Total', bold: true }]
              return rows.map((row, ri) => (
                <tr key={`${email}-${row.label}`} style={{ borderBottom: ri === 2 ? '2px solid #E2E8F0' : '1px solid #F8FAFC' }}>
                  {ri === 0 && <td rowSpan={3} style={{ padding: '8px 16px', fontWeight: '700', color: '#144766', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{employeeName(u)}</td>}
                  <td style={{ padding: '4px 12px', color: '#94A3B8', fontSize: '11px', whiteSpace: 'nowrap' }}>{row.label}</td>
                  {months.map(m => {
                    const ongoing = daysFor(email, m.key, 'ongoing')
                    const open = daysFor(email, m.key, 'open')
                    const days = row.label === 'Ongoing' ? ongoing : row.label === 'Open' ? open : ongoing + open
                    const standard = weekdaysInMonth(m.year, m.monthIndex0)
                    const ratio = standard ? days / standard : 0
                    return (
                      <td key={m.key} title={`${days} day${days === 1 ? '' : 's'}`} style={{ padding: '4px 12px', textAlign: 'center', fontWeight: row.bold ? '800' : '500', color: days === 0 && row.label !== 'Total' ? '#CBD5E0' : ratioColor(ratio) }}>
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
    </div>
  )
}

export default function OperationsStaffingPage() {
  return <OperationsLayout><StaffingContent /></OperationsLayout>
}
