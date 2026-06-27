'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GRCLayout } from '@/components/GRCLayout'

const API = 'https://api.whubbi.wcomply.com'

const FW_COLORS: Record<string, string> = {
  'ISO 27001': '#156082', 'GDPR': '#e97132', 'SOC 2': '#059669', 'NIS2': '#7C3AED'
}

const RISK_COLOR = (score: number) =>
  score >= 15 ? '#DC2626' : score >= 9 ? '#D97706' : score >= 4 ? '#2563EB' : '#059669'

const RISK_LABEL = (score: number) =>
  score >= 15 ? 'Critical' : score >= 9 ? 'High' : score >= 4 ? 'Medium' : 'Low'

export default function GRCDashboard() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/grc/dashboard`).then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  return (
    <GRCLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', marginBottom: '4px' }}>GRC Dashboard</h1>
          <p style={{ fontSize: '12px', color: '#45B6E4' }}>Governance, Risk & Compliance overview</p>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading...</div>}

        {!loading && data && (<>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
            {[
              { label: 'Frameworks', value: data.frameworks?.length || 0, icon: '📋', color: '#156082' },
              { label: 'Total Risks', value: data.risks?.total || 0, icon: '⚠️', color: '#D97706' },
              { label: 'High Risks', value: data.risks?.high_risks?.length || 0, icon: '🔴', color: '#DC2626' },
              { label: 'Active Audits', value: (data.audits?.summary?.in_progress || 0) + (data.audits?.summary?.planned || 0), icon: '🔍', color: '#059669' },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderTop: `3px solid ${kpi.color}` }}>
                <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '8px' }}>{kpi.icon} {kpi.label}</div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Frameworks compliance */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4' }}>📋 Frameworks Compliance</h3>
              <button onClick={() => router.push('/grc/frameworks')} style={{ fontSize: '11px', color: '#156082', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>View all →</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {data.frameworks?.map((fw: any) => (
                <div key={fw.id} onClick={() => router.push(`/grc/frameworks?id=${fw.id}`)}
                  style={{ padding: '16px', borderRadius: '10px', border: `1px solid ${FW_COLORS[fw.name] || '#EDF2F7'}20`, background: `${FW_COLORS[fw.name] || '#156082'}06`, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: FW_COLORS[fw.name] || '#156082' }}>{fw.name}</div>
                      <div style={{ fontSize: '10px', color: '#45B6E4' }}>v{fw.version} · {fw.total_controls} controls</div>
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: '900', color: FW_COLORS[fw.name] || '#156082' }}>{fw.compliance_pct}%</div>
                  </div>
                  <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${fw.compliance_pct}%`, background: FW_COLORS[fw.name] || '#156082', borderRadius: '3px', transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '10px', fontWeight: '600' }}>
                    <span style={{ color: '#059669' }}>✓ {fw.compliant} compliant</span>
                    <span style={{ color: '#D97706' }}>⟳ {fw.in_progress} in progress</span>
                    <span style={{ color: '#45B6E4' }}>○ {fw.not_started} pending</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* High Risks */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4' }}>⚠️ High Priority Risks</h3>
                <button onClick={() => router.push('/grc/risks')} style={{ fontSize: '11px', color: '#156082', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>View all →</button>
              </div>
              {data.risks?.high_risks?.length === 0 && <p style={{ color: '#45B6E4', fontSize: '13px' }}>No high priority risks.</p>}
              {data.risks?.high_risks?.map((risk: any) => {
                const score = risk.probability * risk.impact
                return (
                  <div key={risk.id} style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${RISK_COLOR(score)}20`, marginBottom: '8px', background: `${RISK_COLOR(score)}06` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#3F3F3F' }}>{risk.title}</span>
                      <span style={{ background: RISK_COLOR(score), color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '700' }}>{RISK_LABEL(score)} ({score})</span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#45B6E4', marginTop: '4px' }}>{risk.category} · {risk.owner_name || 'Unassigned'}</div>
                  </div>
                )
              })}
            </div>

            {/* Upcoming Audits */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4' }}>🔍 Upcoming Audits</h3>
                <button onClick={() => router.push('/grc/audits')} style={{ fontSize: '11px', color: '#156082', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>View all →</button>
              </div>
              {data.audits?.upcoming?.length === 0 && <p style={{ color: '#45B6E4', fontSize: '13px' }}>No upcoming audits.</p>}
              {data.audits?.upcoming?.map((audit: any) => (
                <div key={audit.id} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #EDF2F7', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#3F3F3F' }}>{audit.title}</span>
                    <span style={{ background: audit.status === 'in_progress' ? '#059669' : '#D97706', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '700' }}>
                      {audit.status === 'in_progress' ? 'In Progress' : 'Planned'}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#45B6E4', marginTop: '4px' }}>{audit.audit_type} · {audit.auditor_name || 'TBD'}</div>
                </div>
              ))}
              <button onClick={() => router.push('/grc/audits')} style={{ width: '100%', marginTop: '8px', padding: '8px', background: '#F5F7FA', border: '1px dashed #45B6E4', borderRadius: '8px', color: '#156082', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                + New Audit
              </button>
            </div>
          </div>
        </>)}
      </div>
    </GRCLayout>
  )
}
