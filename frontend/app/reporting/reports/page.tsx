'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ReportingLayout, useReportingPerm } from '@/components/ReportingLayout'
import { reportingAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { PageHeader, EmptyState } from '@/components/shared/RecordLayout'

function ReportsContent() {
  const router = useRouter()
  const { level } = useReportingPerm('reports')
  const [userEmail, setUserEmail] = useState('')
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const u = getStoredUser()
    if (u?.email) {
      setUserEmail(u.email)
      reportingAPI.listReports(u.email).then(setReports).catch(() => {}).finally(() => setLoading(false))
    }
  }, [])

  if (level === 'loading' || loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )

  const searched = reports.filter(r => !search.trim() || r.name.toLowerCase().includes(search.trim().toLowerCase()))
  const mine = searched.filter(r => r.owner_email === userEmail)
  const shared = searched.filter(r => r.owner_email !== userEmail)

  const reportCard = (r: any) => (
    <div key={r.id} onClick={() => router.push(`/reporting/reports/${r.id}`)}
      style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#C4B5FD')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#EDF2F7')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <span style={{ fontSize: '18px' }}>{{ table: '📋', bar: '📊', line: '📈', pie: '🥧' }[r.chart_type as string] || '📋'}</span>
        <div style={{ fontWeight: '700', color: '#144766', fontSize: '13px' }}>{r.name}</div>
      </div>
      <div style={{ fontSize: '11px', color: '#9B9B9B' }}>{r.spec?.entity} · {r.owner_email === userEmail ? 'Owned by you' : `By ${r.owner_email}`}</div>
    </div>
  )

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader
        title="📊 Reports"
        count={searched.length}
        search={{ value: search, onChange: setSearch }}
        action={<button className="btn-primary" onClick={() => router.push('/reporting/reports/new')}>+ New Report</button>}
      />

      <p className="section-label" style={{ marginBottom: '10px' }}>My Reports</p>
      {mine.length === 0 ? <div style={{ marginBottom: '24px' }}><EmptyState icon="📊" title="No reports yet" description="Click New Report to build your first one" /></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {mine.map(reportCard)}
        </div>
      )}

      <p className="section-label" style={{ marginBottom: '10px' }}>Shared with Me</p>
      {shared.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>Nothing shared with you yet.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {shared.map(reportCard)}
        </div>
      )}
    </div>
  )
}

export default function ReportsPage() {
  return <ReportingLayout><ReportsContent /></ReportingLayout>
}
