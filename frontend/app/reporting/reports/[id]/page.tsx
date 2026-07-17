'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ReportingLayout, useReportingPerm } from '@/components/ReportingLayout'
import { ReportBuilderForm } from '@/components/reporting/ReportBuilderForm'
import { ReportChart } from '@/components/reporting/ReportChart'
import { reportingAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

function ReportDetailContent() {
  const { id } = useParams()
  const router = useRouter()
  const { level } = useReportingPerm('reports')
  const [report, setReport] = useState<any>(null)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [showDelete, setShowDelete] = useState(false)

  const load = async () => {
    try {
      const r = await reportingAPI.getReport(id as string)
      setReport(r)
      setRunning(true)
      const d = await reportingAPI.runReport(id as string)
      setRows(d.rows || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false); setRunning(false)
    }
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  const deleteReport = async () => {
    await reportingAPI.deleteReport(id as string)
    router.push('/reporting/reports')
  }

  if (level === 'loading' || loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )
  if (!report) return null

  if (editing) {
    return (
      <div style={{ padding: '24px 28px' }}>
        <h1 style={{ fontSize: '19px', fontWeight: '800', color: '#156082', marginBottom: '20px', letterSpacing: '-0.01em' }}>📊 Edit Report</h1>
        <ReportBuilderForm report={report} />
      </div>
    )
  }

  const canEdit = report.owner_email === userEmail

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '11px', color: '#9B9B9B' }}>
        <button onClick={() => router.push('/reporting/reports')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#7C3AED', fontWeight: '600', fontSize: '11px', padding: 0 }}>Reports</button>
        <span>/</span><span style={{ color: '#3F3F3F', fontWeight: '600' }}>{report.name}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '19px', fontWeight: '800', color: '#156082', margin: 0, letterSpacing: '-0.01em' }}>{report.name}</h1>
        {canEdit && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setEditing(true)} style={{ background: 'white', color: '#144766', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #CBD5E0', cursor: 'pointer' }}>Edit</button>
            <button onClick={() => setShowDelete(true)} style={{ background: 'white', color: '#DC2626', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #FCA5A5', cursor: 'pointer' }}>Delete</button>
          </div>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {error && <p style={{ color: '#DC2626', fontSize: '12px' }}>{error}</p>}
        {running ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>Running…</p> : <ReportChart rows={rows} spec={report.spec} />}
      </div>

      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#DC2626' }}>Delete Report</h2>
              <button onClick={() => setShowDelete(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: '#3F3F3F' }}>Delete <strong>{report.name}</strong>? This can't be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDelete(false)}>Cancel</button>
              <button onClick={deleteReport} style={{ background: '#DC2626', color: 'white', padding: '8px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ReportDetailPage() {
  return <ReportingLayout><ReportDetailContent /></ReportingLayout>
}
