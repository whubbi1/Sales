'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

const API = 'https://api.whubbi.wcomply.com'

const ACCOUNTS = [
  { id: '351007427901', name: 'WCOMPLY Main',   color: '#156082', icon: '🏢' },
  { id: '607025226712', name: 'WCOMPLY Prod',   color: '#e97132', icon: '🚀' },
  { id: '882321772619', name: 'WCOMPLY WHUBBI', color: '#45B6E4', icon: '🎯' },
]

function accountColor(id: string): string {
  const map: Record<string,string> = {
    '351007427901': '#156082',
    '607025226712': '#e97132',
    '882321772619': '#45B6E4',
  }
  return map[id] || '#156082'
}

export default function AWSCostsPage() {
  const router = useRouter()
  const [overview, setOverview] = useState<any>(null)
  const [selected, setSelected] = useState<string|null>(null)
  const [accountData, setAccountData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [accountLoading, setAccountLoading] = useState(false)

  useEffect(() => {
    fetch(`${API}/admin/costs/multi`)
      .then(r => r.json()).then(setOverview).finally(() => setLoading(false))
  }, [])

  const loadAccount = async (id: string) => {
    setSelected(id); setAccountLoading(true)
    const d = await fetch(`${API}/admin/costs/account/${id}`).then(r => r.json())
    setAccountData(d); setAccountLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ background: '#156082', padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => router.push('/admin')} style={{ border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontFamily: 'Montserrat, sans-serif', fontWeight: '600' }}>← Admin</button>
        <span style={{ color: 'white', fontSize: '15px', fontWeight: '800' }}>💰 AWS Costs — Multi Account</span>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading...</div>}

        {!loading && overview && (<>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderTop: '3px solid #156082' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '8px' }}>Total This Month</div>
              <div style={{ fontSize: '32px', fontWeight: '900', color: '#156082' }}>${overview.total?.toFixed(2)}</div>
              <div style={{ fontSize: '11px', color: '#45B6E4', marginTop: '4px' }}>{overview.period?.start} → {overview.period?.end}</div>
            </div>
            {ACCOUNTS.map(acc => {
              const d = overview.accounts?.find((a: any) => a.account_id === acc.id)
              const pct = overview.total > 0 ? ((d?.cost || 0) / overview.total * 100).toFixed(1) : '0'
              return (
                <div key={acc.id} onClick={() => loadAccount(acc.id)}
                  style={{ background: 'white', borderRadius: '12px', border: `1.5px solid ${selected === acc.id ? acc.color : '#EDF2F7'}`, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderTop: `3px solid ${acc.color}`, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4' }}>{acc.icon} {acc.name}</div>
                    <span style={{ fontSize: '10px', color: acc.color, fontWeight: '700' }}>{pct}%</span>
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: acc.color }}>${(d?.cost || 0).toFixed(2)}</div>
                  <div style={{ marginTop: '8px', height: '4px', background: '#F1F5F9', borderRadius: '2px' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: acc.color, borderRadius: '2px' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: acc.color, marginTop: '6px', fontWeight: '600' }}>View details →</div>
                </div>
              )
            })}
          </div>

          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '16px' }}>Daily Cost Trend — Last 30 days</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '120px' }}>
              {overview.daily_trend?.map((d: any) => {
                const dayTotal = ACCOUNTS.reduce((sum, acc) => sum + (d[acc.id] || 0), 0)
                const maxDay = Math.max(...(overview.daily_trend || []).map((x: any) => ACCOUNTS.reduce((s, a) => s + (x[a.id] || 0), 0)), 1)
                return (
                  <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }} title={`${d.date}: $${dayTotal.toFixed(2)}`}>
                    {ACCOUNTS.map(acc => {
                      const h = d[acc.id] ? (d[acc.id] / maxDay) * 100 : 0
                      return <div key={acc.id} style={{ width: '100%', height: `${h}%`, background: acc.color, minHeight: h > 0 ? '2px' : '0' }} />
                    })}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '10px', justifyContent: 'center' }}>
              {ACCOUNTS.map(acc => (
                <div key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: acc.color }} />
                  <span style={{ fontSize: '11px', color: '#3F3F3F', fontWeight: '600' }}>{acc.icon} {acc.name}</span>
                </div>
              ))}
            </div>
          </div>

          {selected && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden' }}>
              {accountLoading ? <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading...</div> : accountData && (
                <>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: accountColor(selected) + '08' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: accountColor(selected) }}>{accountData.icon} {accountData.name} ({selected})</span>
                    <span style={{ fontSize: '22px', fontWeight: '900', color: accountColor(selected) }}>${accountData.total?.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
                    <div style={{ padding: '20px', borderRight: '1px solid #EDF2F7' }}>
                      <h3 style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '14px' }}>Cost by Service</h3>
                      {accountData.by_service?.length === 0 ? <p style={{ color: '#45B6E4', fontSize: '13px' }}>No data yet.</p> :
                        accountData.by_service?.map((s: any) => {
                          const pct = accountData.total > 0 ? (s.cost / accountData.total * 100) : 0
                          return (
                            <div key={s.service} style={{ marginBottom: '10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '12px', fontWeight: '600', color: '#3F3F3F' }}>{s.service}</span>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: accountColor(selected) }}>${s.cost.toFixed(2)}</span>
                              </div>
                              <div style={{ height: '5px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: accountColor(selected), borderRadius: '3px' }} />
                              </div>
                            </div>
                          )
                        })}
                    </div>
                    <div style={{ padding: '20px' }}>
                      <h3 style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '14px' }}>Monthly Trend</h3>
                      {accountData.monthly?.map((m: any) => (
                        <div key={m.month} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#3F3F3F' }}>{m.month}</span>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: accountColor(selected) }}>${m.cost.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>)}
      </div>
    </div>
  )
}
