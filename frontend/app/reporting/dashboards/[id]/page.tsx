'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ReportingLayout, useReportingPerm } from '@/components/ReportingLayout'
import { DashboardBuilderForm } from '@/components/reporting/DashboardBuilderForm'
import { ReportChart } from '@/components/reporting/ReportChart'
import { reportingAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

function DashboardDetailContent() {
  const { id } = useParams()
  const router = useRouter()
  const { level } = useReportingPerm('dashboards')
  const [dashboard, setDashboard] = useState<any>(null)
  const [tiles, setTiles] = useState<{ report: any; rows: any[]; error?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [showDelete, setShowDelete] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await reportingAPI.getDashboard(id as string)
      setDashboard(d)
      const results = await Promise.all((d.report_ids || []).map(async (rid: string) => {
        try {
          const [report, run] = await Promise.all([reportingAPI.getReport(rid), reportingAPI.runReport(rid)])
          return { report, rows: run.rows || [] }
        } catch (e: any) {
          return { report: { id: rid, name: 'Unavailable' }, rows: [], error: e.message }
        }
      }))
      setTiles(results)
    } catch {
      router.push('/reporting/dashboards')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  const deleteDashboard = async () => {
    await reportingAPI.deleteDashboard(id as string)
    router.push('/reporting/dashboards')
  }

  if (level === 'loading' || loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )
  if (!dashboard) return null

  if (editing) {
    return (
      <div style={{ padding: '24px 28px' }}>
        <h1 style={{ fontSize: '19px', fontWeight: '800', color: '#156082', marginBottom: '20px', letterSpacing: '-0.01em' }}>🗂️ Edit Dashboard</h1>
        <DashboardBuilderForm dashboard={dashboard} />
      </div>
    )
  }

  const canEdit = dashboard.owner_email === userEmail

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '11px', color: '#9B9B9B' }}>
        <button onClick={() => router.push('/reporting/dashboards')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#7C3AED', fontWeight: '600', fontSize: '11px', padding: 0 }}>Dashboards</button>
        <span>/</span><span style={{ color: '#3F3F3F', fontWeight: '600' }}>{dashboard.name}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '19px', fontWeight: '800', color: '#156082', margin: 0, letterSpacing: '-0.01em' }}>{dashboard.name}</h1>
        {canEdit && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setEditing(true)} style={{ background: 'white', color: '#144766', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #CBD5E0', cursor: 'pointer' }}>Edit</button>
            <button onClick={() => setShowDelete(true)} style={{ background: 'white', color: '#DC2626', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #FCA5A5', cursor: 'pointer' }}>Delete</button>
          </div>
        )}
      </div>

      {tiles.length === 0 ? (
        <p style={{ color: '#9B9B9B', fontSize: '13px' }}>This dashboard has no reports yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' }}>
          {tiles.map((t, i) => (
            <div key={i} style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p className="section-label" style={{ margin: 0 }}>{t.report.name}</p>
                <a href={`/reporting/reports/${t.report.id}`} style={{ fontSize: '11px', color: '#7C3AED', fontWeight: '600' }}>Open ↗</a>
              </div>
              {t.error ? <p style={{ color: '#DC2626', fontSize: '12px' }}>{t.error}</p> : <ReportChart rows={t.rows} spec={t.report.spec} />}
            </div>
          ))}
        </div>
      )}

      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#DC2626' }}>Delete Dashboard</h2>
              <button onClick={() => setShowDelete(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: '#3F3F3F' }}>Delete <strong>{dashboard.name}</strong>? This can't be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDelete(false)}>Cancel</button>
              <button onClick={deleteDashboard} style={{ background: '#DC2626', color: 'white', padding: '8px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardDetailPage() {
  return <ReportingLayout><DashboardDetailContent /></ReportingLayout>
}
