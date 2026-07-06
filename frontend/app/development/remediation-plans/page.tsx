'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DevelopmentLayout, { useDevPerm } from '@/components/DevelopmentLayout'
import { testingAPI } from '@/lib/api'

const STATUS_LABEL: Record<string, string> = { new: 'New', open: 'Open', in_progress: 'In Progress', closed: 'Closed' }
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  new: { bg: '#F1F5F9', color: '#475569' }, open: { bg: '#EFF6FF', color: '#156082' },
  in_progress: { bg: '#FFF7ED', color: '#D97706' }, closed: { bg: '#ECFDF5', color: '#059669' },
}

function RemediationPlansContent() {
  const router = useRouter()
  const { level } = useDevPerm('remediation')
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    testingAPI.listRemediationPlans().then((d: any) => setPlans(d.plans || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>🛠️ Remediation Plans</h1>
        <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{plans.length} plan{plans.length !== 1 ? 's' : ''}</p>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {['Plan #', 'Campaign', 'Owner', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : plans.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No remediation plans yet.</td></tr>
            ) : plans.map((p: any) => (
              <tr key={p.id} onClick={() => router.push(`/development/remediation-plans/${p.id}`)} style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '10px 12px', color: '#94A3B8', fontFamily: 'monospace', fontSize: '11px' }}>{p.plan_number}</td>
                <td style={{ padding: '10px 12px', fontWeight: '700', color: '#156082' }}>{p.campaign_title}</td>
                <td style={{ padding: '10px 12px', color: '#3F3F3F' }}>{p.owner_name || p.owner_email || '—'}</td>
                <td style={{ padding: '10px 12px' }}><span style={{ background: STATUS_COLOR[p.status]?.bg, color: STATUS_COLOR[p.status]?.color, padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{STATUS_LABEL[p.status] || p.status}</span></td>
                <td style={{ padding: '10px 12px', color: '#64748B' }}>{p.actions_closed}/{p.actions_total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function RemediationPlansPage() {
  return <DevelopmentLayout><RemediationPlansContent /></DevelopmentLayout>
}
