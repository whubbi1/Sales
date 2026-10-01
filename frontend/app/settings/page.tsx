'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProfileLayout from '@/components/ProfileLayout'
import { getStoredUser } from '@/lib/auth'
import { apiFetch } from '@/lib/apiClient'

const card: React.CSSProperties = { background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const cardTitle: React.CSSProperties = { fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', margin: '0 0 14px' }
const empty: React.CSSProperties = { fontSize: '12px', color: '#94A3B8' }
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const TASK_STATUS_LABEL: Record<string, string> = { new: 'New', open: 'Open', in_progress: 'In Progress' }

interface Integration { label: string; icon: string; connected: boolean; href: string }

export default function ProfileDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [openTrainings, setOpenTrainings] = useState<any[]>([])
  const [performedTrainings, setPerformedTrainings] = useState<any[]>([])
  const [certifications, setCertifications] = useState<any[]>([])
  const [openTasks, setOpenTasks] = useState<any[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])

  useEffect(() => {
    const user = getStoredUser()
    if (!user?.email) { setLoading(false); return }
    const email = encodeURIComponent(user.email)

    Promise.all([
      apiFetch(`/training/assignments/${email}`).then(r => r.json()).catch(() => ({ assignments: [] })),
      apiFetch(`/training/trainings/${email}`).then(r => r.json()).catch(() => ({ trainings: [] })),
      apiFetch(`/training/certifications/${email}`).then(r => r.json()).catch(() => ({ certifications: [] })),
      apiFetch(`/tasks?email=${email}&scope=own`).then(r => r.json()).catch(() => ({ tasks: [] })),
      apiFetch(`/outlook/status?email=${email}`).then(r => r.json()).catch(() => ({ connected: false })),
      apiFetch(`/settings/mcp-tokens/${email}`).then(r => r.json()).catch(() => ({ tokens: [] })),
      apiFetch(`/payfit/my/${email}`).then(r => r.json()).catch(() => ({ linked: false })),
    ]).then(([assignments, trainings, certs, tasks, outlook, mcp, payfit]) => {
      setOpenTrainings((assignments.assignments || []).filter((a: any) => a.status === 'assigned'))
      setPerformedTrainings(trainings.trainings || [])
      setCertifications(certs.certifications || [])
      setOpenTasks((tasks.tasks || []).filter((t: any) => ['new', 'open', 'in_progress'].includes(t.status)))
      setIntegrations([
        { label: 'Microsoft 365', icon: '📧', connected: !!outlook.connected, href: '/settings/integrations' },
        { label: 'Claude / MCP Access', icon: '🤖', connected: (mcp.tokens || []).some((t: any) => !t.revoked), href: '/settings/integrations' },
        { label: 'PayFit', icon: '💶', connected: !!payfit.linked, href: '/settings/integrations' },
      ])
      setLoading(false)
    })
  }, [])

  return (
    <ProfileLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#156082', margin: '0 0 4px' }}>Dashboard</h1>
          <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>Your personal overview</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
            <div style={card}>
              <h3 style={cardTitle}>Open Trainings</h3>
              {openTrainings.length === 0 ? <p style={empty}>No trainings currently assigned to you.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {openTrainings.map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #EDF2F7' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#156082' }}>{t.training_name}</span>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>Due {fmtDate(t.due_date)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: '12px' }}><button onClick={() => router.push('/settings/training')} style={{ background: 'none', border: 'none', color: '#156082', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0 }}>View Training page →</button></div>
            </div>

            <div style={card}>
              <h3 style={cardTitle}>Performed Trainings</h3>
              {performedTrainings.length === 0 ? <p style={empty}>No trainings recorded yet.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {performedTrainings.slice(0, 5).map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #EDF2F7' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#156082' }}>{t.name}</span>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>{fmtDate(t.training_date)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: '12px' }}><button onClick={() => router.push('/settings/training')} style={{ background: 'none', border: 'none', color: '#156082', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0 }}>View Training page →</button></div>
            </div>

            <div style={card}>
              <h3 style={cardTitle}>Certifications</h3>
              {certifications.length === 0 ? <p style={empty}>No certifications recorded yet.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {certifications.slice(0, 5).map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #EDF2F7' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#156082' }}>{c.name}</span>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>{fmtDate(c.cert_date)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: '12px' }}><button onClick={() => router.push('/settings/certifications')} style={{ background: 'none', border: 'none', color: '#156082', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0 }}>View Certifications page →</button></div>
            </div>

            <div style={card}>
              <h3 style={cardTitle}>Open Tasks</h3>
              {openTasks.length === 0 ? <p style={empty}>No open tasks.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {openTasks.slice(0, 5).map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #EDF2F7' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#156082' }}>{t.title}</span>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>{TASK_STATUS_LABEL[t.status] || t.status}{t.due_date ? ` · Due ${fmtDate(t.due_date)}` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: '12px' }}><button onClick={() => router.push('/task-manager')} style={{ background: 'none', border: 'none', color: '#156082', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0 }}>View Task Manager →</button></div>
            </div>

            <div style={{ ...card, gridColumn: '1 / -1' }}>
              <h3 style={cardTitle}>Integrations</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {integrations.map(i => (
                  <button key={i.label} onClick={() => router.push(i.href)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: i.connected ? '#ECFDF5' : '#F8FAFC', border: `1px solid ${i.connected ? '#A7F3D0' : '#EDF2F7'}`, borderRadius: '10px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                    <span style={{ fontSize: '16px' }}>{i.icon}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#156082' }}>{i.label}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: i.connected ? '#059669' : '#94A3B8' }}>{i.connected ? '● Connected' : '○ Not connected'}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </ProfileLayout>
  )
}
