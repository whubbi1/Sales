'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { reportingAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

function FormField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

export function DashboardBuilderForm({ dashboard }: { dashboard?: any }) {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState(dashboard?.name || '')
  const [reportIds, setReportIds] = useState<string[]>(dashboard?.report_ids || [])
  const [sharedWith, setSharedWith] = useState<string[]>(dashboard?.shared_with?.filter((s: string) => s !== '*') || [])
  const [shareAll, setShareAll] = useState(dashboard?.shared_with?.includes('*') || false)

  useEffect(() => {
    const u = getStoredUser()
    if (u?.email) {
      setUserEmail(u.email)
      reportingAPI.listReports(u.email).then(setReports).catch(() => {})
    }
    fetch(`${API}/settings/users`).then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [])

  const employeeName = (u: any) => u.display_name || `${u.first_name} ${u.last_name}`
  const sortedUsers = [...users].sort((a, b) => employeeName(a).localeCompare(employeeName(b))).filter(u => u.email !== userEmail)

  const toggleReport = (id: string) => setReportIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleShare = (email: string) => setSharedWith(p => p.includes(email) ? p.filter(e => e !== email) : [...p, email])

  const save = async () => {
    if (!name.trim()) { setError('Give the dashboard a name first'); return }
    if (reportIds.length === 0) { setError('Pick at least one report'); return }
    setSaving(true); setError('')
    try {
      const payload = { name: name.trim(), owner_email: dashboard?.owner_email || userEmail, report_ids: reportIds, shared_with: shareAll ? ['*'] : sharedWith }
      if (dashboard) await reportingAPI.updateDashboard(dashboard.id, payload)
      else await reportingAPI.createDashboard(payload)
      router.push('/reporting/dashboards')
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <p className="section-label" style={{ marginBottom: '10px' }}>Reports to include</p>
        {reports.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No reports available yet — create one first.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reports.map((r: any) => (
              <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px', cursor: 'pointer', background: reportIds.includes(r.id) ? '#F5F3FF' : 'white' }}>
                <input type="checkbox" checked={reportIds.includes(r.id)} onChange={() => toggleReport(r.id)} />
                <div>
                  <div style={{ fontWeight: '700', color: '#144766', fontSize: '13px' }}>{r.name}</div>
                  <div style={{ fontSize: '11px', color: '#9B9B9B' }}>{r.spec?.entity} · {r.chart_type}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <p className="section-label" style={{ marginBottom: '10px' }}>Save Dashboard</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
          <FormField label="Dashboard Name">
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Sales Overview" />
          </FormField>
          <FormField label="Share with">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginBottom: '8px' }}>
              <input type="checkbox" checked={shareAll} onChange={e => setShareAll(e.target.checked)} />
              Everyone in WHUBBI
            </label>
            {!shareAll && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '90px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px' }}>
                {sortedUsers.map((u: any) => (
                  <label key={u.email} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '3px 8px', borderRadius: '6px', background: sharedWith.includes(u.email) ? '#F5F3FF' : '#F8FAFC', cursor: 'pointer' }}>
                    <input type="checkbox" checked={sharedWith.includes(u.email)} onChange={() => toggleShare(u.email)} />
                    {employeeName(u)}
                  </label>
                ))}
              </div>
            )}
          </FormField>
          {error && <p style={{ color: '#DC2626', fontSize: '12px' }}>{error}</p>}
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : dashboard ? 'Save Changes' : 'Save Dashboard'}</button>
        </div>
      </div>
    </div>
  )
}
