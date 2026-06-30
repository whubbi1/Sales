'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import HelpdeskLayout from '@/components/HelpdeskLayout'
import { BackendCheck } from '@/components/BackendCheck'
import { API, STATUS_STYLE, PRIORITY_STYLE } from './constants'

export default function HelpdeskPage() {
  const router = useRouter()
  const [d, setD] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/helpdesk/dashboard`).then(r => r.json()).then(setD).finally(() => setLoading(false))
  }, [])

  return (
    <HelpdeskLayout>
      <BackendCheck />
      <div style={{ padding: '24px 28px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Helpdesk Dashboard</h1>
          <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>Support tickets overview</p>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading...</div>}

        {!loading && d && (<>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Total', value: d.total, color: '#156082', icon: '🎫' },
              { label: 'Open', value: d.open, color: '#D97706', icon: '📂' },
              { label: 'Resolved', value: d.resolved, color: '#059669', icon: '✅' },
              { label: 'SLA Breached', value: d.sla_breached, color: '#DC2626', icon: '⚠️' },
              { label: 'Avg Resolution', value: `${d.avg_resolution_hours}h`, color: '#45B6E4', icon: '⏱️' },
            ].map(k => (
              <div key={k.label} style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '16px', borderTop: `3px solid ${k.color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4' }}>{k.label}</span>
                  <span>{k.icon}</span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '16px' }}>
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '14px' }}>By Priority</h3>
              {['critical', 'high', 'medium', 'low'].map(p => {
                const s = PRIORITY_STYLE[p]; const count = d.by_priority?.[p] || 0
                return (
                  <div key={p} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.dot }} />
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#3F3F3F', textTransform: 'capitalize' }}>{p}</span>
                    </div>
                    <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700' }}>{count}</span>
                  </div>
                )
              })}
            </div>

            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4' }}>Recent Tickets</span>
                <button onClick={() => router.push('/helpdesk/tickets')} style={{ background: 'none', border: 'none', color: '#156082', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>View all →</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#FAFBFC' }}>
                    {['#', 'Title', 'Category', 'Priority', 'Status', 'Group', 'SLA'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(d.recent_tickets || []).map((t: any) => {
                    const p = PRIORITY_STYLE[t.priority] || PRIORITY_STYLE.medium
                    const s = STATUS_STYLE[t.status] || STATUS_STYLE.new
                    const breached = t.sla_deadline && new Date(t.sla_deadline) < new Date() && !['resolved', 'closed'].includes(t.status)
                    return (
                      <tr key={t.id} onClick={() => router.push(`/helpdesk/tickets/${t.id}`)} style={{ cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                        <td style={{ padding: '9px 12px', fontWeight: '700', color: '#156082', whiteSpace: 'nowrap' }}>{t.ticket_number}</td>
                        <td style={{ padding: '9px 12px', color: '#3F3F3F', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                        <td style={{ padding: '9px 12px' }}>{t.category_name && <span style={{ background: (t.category_color || '#45B6E4') + '20', color: t.category_color || '#45B6E4', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{t.category_icon} {t.category_name}</span>}</td>
                        <td style={{ padding: '9px 12px' }}><span style={{ background: p.bg, color: p.color, padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', textTransform: 'capitalize' }}>{t.priority}</span></td>
                        <td style={{ padding: '9px 12px' }}><span style={{ background: s.bg, color: s.color, padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{s.label}</span></td>
                        <td style={{ padding: '9px 12px', color: '#45B6E4', fontSize: '11px' }}>{t.group_name || '—'}</td>
                        <td style={{ padding: '9px 12px' }}><span style={{ color: breached ? '#DC2626' : '#059669', fontWeight: '700', fontSize: '11px' }}>{breached ? '⚠️' : '✅'}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>)}
      </div>
    </HelpdeskLayout>
  )
}
