'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GRCLayout } from '@/components/GRCLayout'
import { grcAccessReviewAPI } from '@/lib/api'

function GRCDashboardContent() {
  const router = useRouter()
  const [overview, setOverview] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    grcAccessReviewAPI.overview().then(setOverview).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>

  const tiles = [
    { label: 'Ongoing Access Reviews', value: overview?.ongoing_access_reviews ?? 0, icon: '🔑', color: '#156082', href: '/grc/access-review' },
    { label: 'Company Risks', value: overview?.open_risks ?? 0, icon: '⚠️', color: '#DC2626', href: '/grc/risks' },
    { label: 'Ongoing Audits', value: overview?.ongoing_audits ?? 0, icon: '🔍', color: '#D97706', href: '/grc/audits' },
  ]

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>📊 GRC Dashboard</h1>
        <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>Governance, Risk & Compliance at a glance</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '28px' }}>
        {tiles.map(t => (
          <div key={t.label} onClick={() => router.push(t.href)}
            style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '20px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderTop: `3px solid ${t.color}` }}>
            <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '8px' }}>{t.icon} {t.label}</div>
            <div style={{ fontSize: '30px', fontWeight: '900', color: t.color }}>{t.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '14px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Framework Compliance</h2>
        <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>Click a framework to see its requirements</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px' }}>
        {(overview?.frameworks || []).map((f: any) => (
          <div key={f.id} onClick={() => router.push(`/grc/frameworks?id=${f.id}`)}
            style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '16px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: f.color || '#156082', marginBottom: '8px' }}>{f.name}</div>
            <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
              <div style={{ height: '100%', width: `${f.compliance_pct}%`, background: f.color || '#156082', borderRadius: '3px' }} />
            </div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: f.color || '#156082' }}>{f.compliance_pct}% compliant</div>
          </div>
        ))}
        {(overview?.frameworks || []).length === 0 && (
          <p style={{ fontSize: '12px', color: '#94A3B8' }}>No frameworks yet.</p>
        )}
      </div>
    </div>
  )
}

export default function GRCDashboardPage() {
  return <GRCLayout><GRCDashboardContent /></GRCLayout>
}
