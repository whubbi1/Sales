'use client'
import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { PageHeader, EmptyState } from '@/components/shared/RecordLayout'
import { portalAPI } from '@/lib/api'

interface PortalInvitation {
  id: string
  contact_id: string
  contact_first_name: string
  contact_last_name: string
  contact_email: string
  company_name: string | null
  portal_type: string
  status: 'pending' | 'accepted' | 'revoked'
  invited_by: string
  created_at: string
  expires_at: string
}

interface PortalUser {
  id: string
  contact_id: string
  contact_first_name: string
  contact_last_name: string
  company_name: string | null
  email: string
  portal_type: string
  status: 'active' | 'revoked'
  auth_provider: string | null
  first_login_at: string | null
  last_login_at: string | null
  created_at: string
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#FFF7ED', color: '#D97706' },
  accepted: { bg: '#ECFDF5', color: '#059669' },
  active: { bg: '#ECFDF5', color: '#059669' },
  revoked: { bg: '#FEF2F2', color: '#DC2626' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || { bg: '#F1F5F9', color: '#64748B' }
  return <span style={{ background: s.bg, color: s.color, padding: '2px 9px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, textTransform: 'capitalize' as const }}>{status}</span>
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const th: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#9B9B9B', borderBottom: '1px solid #EDF2F7' }
const td: React.CSSProperties = { padding: '12px 14px', fontSize: '13px', color: '#3F3F3F', borderBottom: '1px solid #F5F7FA' }

export default function PortalManagementPage() {
  const [tab, setTab] = useState<'users' | 'invitations'>('users')
  const [users, setUsers] = useState<PortalUser[]>([])
  const [invitations, setInvitations] = useState<PortalInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const [u, i] = await Promise.all([portalAPI.listUsers(), portalAPI.listInvitations()])
    setUsers(u.users || [])
    setInvitations(i.invitations || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const revokeUser = async (id: string) => {
    setBusyId(id)
    try { await portalAPI.revokeUser(id); await load() } finally { setBusyId(null) }
  }
  const revokeInvitation = async (id: string) => {
    setBusyId(id)
    try { await portalAPI.revokeInvitation(id); await load() } finally { setBusyId(null) }
  }

  const pendingInvitations = invitations.filter(i => i.status === 'pending')

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '24px 28px' }}>
          <PageHeader title="Portal Access" count={tab === 'users' ? users.length : invitations.length} />

          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
            <button onClick={() => setTab('users')}
              style={{ padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', background: tab === 'users' ? 'white' : 'transparent', color: tab === 'users' ? '#156082' : '#94A3B8', fontWeight: 700, fontSize: '12px', cursor: 'pointer', borderBottom: tab === 'users' ? '2px solid #156082' : '2px solid transparent' }}>
              Active Users ({users.filter(u => u.status === 'active').length})
            </button>
            <button onClick={() => setTab('invitations')}
              style={{ padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', background: tab === 'invitations' ? 'white' : 'transparent', color: tab === 'invitations' ? '#156082' : '#94A3B8', fontWeight: 700, fontSize: '12px', cursor: 'pointer', borderBottom: tab === 'invitations' ? '2px solid #156082' : '2px solid transparent' }}>
              Invitations ({pendingInvitations.length} pending)
            </button>
          </div>

          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>Loading…</div>
            ) : tab === 'users' ? (
              users.length === 0 ? (
                <EmptyState icon="🔑" title="No portal users yet" description="Invite a contact from their contact page to grant them portal access." />
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Contact</th>
                      <th style={th}>Company</th>
                      <th style={th}>Email</th>
                      <th style={th}>Signed in with</th>
                      <th style={th}>Last login</th>
                      <th style={th}>Status</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td style={td}>{u.contact_first_name} {u.contact_last_name}</td>
                        <td style={td}>{u.company_name || '—'}</td>
                        <td style={td}>{u.email}</td>
                        <td style={td}>{u.auth_provider || '—'}</td>
                        <td style={td}>{fmtDate(u.last_login_at)}</td>
                        <td style={td}><StatusBadge status={u.status} /></td>
                        <td style={{ ...td, textAlign: 'right' as const }}>
                          {u.status === 'active' && (
                            <button onClick={() => revokeUser(u.id)} disabled={busyId === u.id}
                              style={{ background: 'white', color: '#DC2626', padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, border: '1.5px solid #FCA5A5', cursor: busyId === u.id ? 'not-allowed' : 'pointer' }}>
                              {busyId === u.id ? 'Revoking…' : 'Revoke access'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : invitations.length === 0 ? (
              <EmptyState icon="📨" title="No invitations sent yet" description="Invite a contact from their contact page to send a portal invitation." />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Contact</th>
                    <th style={th}>Company</th>
                    <th style={th}>Sent to</th>
                    <th style={th}>Invited by</th>
                    <th style={th}>Sent</th>
                    <th style={th}>Expires</th>
                    <th style={th}>Status</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map(i => (
                    <tr key={i.id}>
                      <td style={td}>{i.contact_first_name} {i.contact_last_name}</td>
                      <td style={td}>{i.company_name || '—'}</td>
                      <td style={td}>{i.contact_email}</td>
                      <td style={td}>{i.invited_by}</td>
                      <td style={td}>{fmtDate(i.created_at)}</td>
                      <td style={td}>{fmtDate(i.expires_at)}</td>
                      <td style={td}><StatusBadge status={i.status} /></td>
                      <td style={{ ...td, textAlign: 'right' as const }}>
                        {i.status === 'pending' && (
                          <button onClick={() => revokeInvitation(i.id)} disabled={busyId === i.id}
                            style={{ background: 'white', color: '#DC2626', padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, border: '1.5px solid #FCA5A5', cursor: busyId === i.id ? 'not-allowed' : 'pointer' }}>
                            {busyId === i.id ? 'Revoking…' : 'Revoke'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
