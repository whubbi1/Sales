'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { adminAPI } from '@/lib/adminApi'

const SERVICE_ICONS: Record<string, string> = {
  ecs: '🐳', rds: '🗄️', amplify: '⚡', alb: '⚖️',
  cognito: '🔐', ecr: '📦', cloudwatch: '📊',
}

const STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  healthy:  { bg: '#ECFDF5', color: '#059669', dot: '#10B981' },
  degraded: { bg: '#FFF7ED', color: '#D97706', dot: '#F59E0B' },
  down:     { bg: '#FEF2F2', color: '#DC2626', dot: '#EF4444' },
  unknown:  { bg: '#F1F5F9', color: '#45B6E4', dot: '#45B6E4' },
}

export default function AdminCockpitPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'health' | 'costs' | 'logs'>('health')
  const [health, setHealth] = useState<any>(null)
  const [costs, setCosts] = useState<any>(null)
  const [logs, setLogs] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const loadData = async () => {
    setLoading(true)
    try {
      if (tab === 'health') setHealth(await adminAPI.getHealth())
      else if (tab === 'costs') setCosts(await adminAPI.getCosts())
      else if (tab === 'logs') setLogs(await adminAPI.getLogs())
    } catch (e) { console.error(e) }
    setLoading(false)
    setLastRefresh(new Date())
  }

  useEffect(() => { loadData() }, [tab])

  const tabs = [
    { id: 'health', label: 'Service Health', icon: '💚' },
    { id: 'costs',  label: 'Cost Tracking',  icon: '💰' },
    { id: 'logs',   label: 'Error Logs',     icon: '🔍' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#156082', padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => router.push('/home')} style={{ border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontFamily: 'Montserrat, sans-serif', fontWeight: '600' }}>← Back</button>
          <span style={{ color: 'white', fontSize: '15px', fontWeight: '800', letterSpacing: '-0.01em' }}>🔧 Admin Cockpit</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>Last refresh: {lastRefresh.toLocaleTimeString()}</span>
          <button onClick={loadData} style={{ border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontFamily: 'Montserrat, sans-serif', fontWeight: '600' }}>↻ Refresh</button>
        </div>
      </div>

      {/* Summary bar */}
      {health && (
        <div style={{ background: 'white', borderBottom: '1px solid #EDF2F7', padding: '12px 32px', display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: health.summary.healthy === health.summary.total ? '#10B981' : '#F59E0B' }} />
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#156082' }}>
              {health.summary.healthy === health.summary.total ? 'All Systems Operational' : `${health.summary.degraded} Service(s) Degraded`}
            </span>
          </div>
          <span style={{ color: '#45B6E4', fontSize: '12px' }}>{health.summary.healthy}/{health.summary.total} services healthy</span>
        </div>
      )}

      <div style={{ padding: '24px 32px' }}>
        {/* Tab nav */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'white', padding: '4px', borderRadius: '10px', border: '1px solid #EDF2F7', width: 'fit-content' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding: '8px 20px', borderRadius: '7px', border: 'none', background: tab === t.id ? '#156082' : 'transparent', color: tab === t.id ? 'white' : '#45B6E4', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.12s' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4', fontSize: '13px' }}>Loading...</div>}

        {/* ── Health Tab ── */}
        {!loading && tab === 'health' && health && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {health.services.map((svc: any) => {
              const s = STATUS_STYLE[svc.status] || STATUS_STYLE.unknown
              return (
                <div key={svc.name} style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '24px' }}>{SERVICE_ICONS[svc.type] || '⚙️'}</span>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#156082' }}>{svc.name}</span>
                    </div>
                    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
                      {svc.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#45B6E4', margin: 0, lineHeight: '1.5' }}>{svc.details}</p>
                  {svc.taskDef && <p style={{ fontSize: '11px', color: '#45B6E4', marginTop: '4px' }}>Task: {svc.taskDef}</p>}
                  {svc.engine && <p style={{ fontSize: '11px', color: '#45B6E4', marginTop: '4px' }}>{svc.engine}</p>}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Costs Tab ── */}
        {!loading && tab === 'costs' && costs && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
              {[
                { label: 'Current Month', value: `$${costs.current_month.toFixed(2)}`, color: '#156082', sub: `${costs.period?.start} → today` },
                { label: 'Estimated Month', value: `$${costs.estimated_month.toFixed(2)}`, color: '#e97132', sub: 'Projected total' },
                { label: 'Daily Average', value: `$${costs.daily?.length > 0 ? (costs.current_month / costs.daily.length).toFixed(2) : '0.00'}`, color: '#45B6E4', sub: 'Last 30 days' },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '8px' }}>{stat.label}</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: stat.color, marginBottom: '4px' }}>{stat.value}</div>
                  <div style={{ fontSize: '11px', color: '#45B6E4' }}>{stat.sub}</div>
                </div>
              ))}
            </div>

            {/* By service */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#156082', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost by Service</h3>
              {costs.by_service.length === 0 ? (
                <p style={{ color: '#45B6E4', fontSize: '13px' }}>No cost data available. {costs.error && `Error: ${costs.error}`}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {costs.by_service.map((item: any) => {
                    const pct = costs.current_month > 0 ? (item.cost / costs.current_month) * 100 : 0
                    return (
                      <div key={item.service}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#3F3F3F' }}>{item.service}</span>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#156082' }}>${item.cost.toFixed(2)}</span>
                        </div>
                        <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: '#156082', borderRadius: '3px', transition: 'width 0.5s' }} />
                        </div>
                        <span style={{ fontSize: '10px', color: '#45B6E4' }}>{pct.toFixed(1)}%</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Logs Tab ── */}
        {!loading && tab === 'logs' && logs && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#156082' }}>Recent Error Logs</span>
              <span style={{ fontSize: '12px', color: '#45B6E4' }}>{logs.total} entries</span>
            </div>
            {logs.logs.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4', fontSize: '13px' }}>No error logs found. 🎉</div>
            ) : (
              <div style={{ overflow: 'auto', maxHeight: '600px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ background: '#FAFBFC', position: 'sticky', top: 0 }}>
                    <tr>
                      {['Timestamp', 'Level', 'User', 'Page', 'Service', 'Message'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.logs.map((log: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 16px', color: '#45B6E4', whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleString()}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ background: log.level === 'ERROR' ? '#FEF2F2' : log.level === 'WARNING' ? '#FFF7ED' : '#ECFDF5', color: log.level === 'ERROR' ? '#DC2626' : log.level === 'WARNING' ? '#D97706' : '#059669', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>
                            {log.level}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', color: '#3F3F3F', fontWeight: '500' }}>{log.user}</td>
                        <td style={{ padding: '10px 16px', color: '#45B6E4' }}>{log.page}</td>
                        <td style={{ padding: '10px 16px', color: '#45B6E4' }}>{log.service}</td>
                        <td style={{ padding: '10px 16px', color: '#3F3F3F', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
