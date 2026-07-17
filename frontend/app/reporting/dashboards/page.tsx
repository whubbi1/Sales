'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ReportingLayout, useReportingPerm } from '@/components/ReportingLayout'
import { reportingAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { PageHeader, EmptyState } from '@/components/shared/RecordLayout'

function DashboardsContent() {
  const router = useRouter()
  const { level } = useReportingPerm('dashboards')
  const [userEmail, setUserEmail] = useState('')
  const [dashboards, setDashboards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const u = getStoredUser()
    if (u?.email) {
      setUserEmail(u.email)
      reportingAPI.listDashboards(u.email).then(setDashboards).catch(() => {}).finally(() => setLoading(false))
    }
  }, [])

  if (level === 'loading' || loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )

  const searched = dashboards.filter(d => !search.trim() || d.name.toLowerCase().includes(search.trim().toLowerCase()))
  const mine = searched.filter(d => d.owner_email === userEmail)
  const shared = searched.filter(d => d.owner_email !== userEmail)

  const dashCard = (d: any) => (
    <div key={d.id} onClick={() => router.push(`/reporting/dashboards/${d.id}`)}
      style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#C4B5FD')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#EDF2F7')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <span style={{ fontSize: '18px' }}>🗂️</span>
        <div style={{ fontWeight: '700', color: '#144766', fontSize: '13px' }}>{d.name}</div>
      </div>
      <div style={{ fontSize: '11px', color: '#9B9B9B' }}>{d.report_ids?.length || 0} report{d.report_ids?.length !== 1 ? 's' : ''} · {d.owner_email === userEmail ? 'Owned by you' : `By ${d.owner_email}`}</div>
    </div>
  )

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader
        title="🗂️ Dashboards"
        count={searched.length}
        search={{ value: search, onChange: setSearch }}
        action={<button className="btn-primary" onClick={() => router.push('/reporting/dashboards/new')}>+ New Dashboard</button>}
      />

      <p className="section-label" style={{ marginBottom: '10px' }}>My Dashboards</p>
      {mine.length === 0 ? <div style={{ marginBottom: '24px' }}><EmptyState icon="🗂️" title="No dashboards yet" description="Click New Dashboard to combine your reports on one page" /></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {mine.map(dashCard)}
        </div>
      )}

      <p className="section-label" style={{ marginBottom: '10px' }}>Shared with Me</p>
      {shared.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>Nothing shared with you yet.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {shared.map(dashCard)}
        </div>
      )}
    </div>
  )
}

export default function DashboardsPage() {
  return <ReportingLayout><DashboardsContent /></ReportingLayout>
}
