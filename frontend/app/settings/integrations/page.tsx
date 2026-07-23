'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ProfileLayout from '@/components/ProfileLayout'
import { getStoredUser } from '@/lib/auth'
import { outlookAPI } from '@/lib/api'

const btn: React.CSSProperties = {
  padding: '9px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif',
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<ProfileLayout><div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div></ProfileLayout>}>
      <IntegrationsContent />
    </Suspense>
  )
}

function IntegrationsContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    const user = getStoredUser()
    if (user?.email) { setEmail(user.email); load(user.email) }
    else setLoading(false)
  }, [])

  useEffect(() => {
    if (params.get('outlook_connected')) setNotice({ type: 'success', text: 'Mailbox connected successfully.' })
    else if (params.get('outlook_error')) setNotice({ type: 'error', text: `Connection failed: ${params.get('outlook_error')}` })
    if (params.get('outlook_connected') || params.get('outlook_error')) router.replace('/settings/integrations')
  }, [params])

  const load = async (email: string) => {
    setLoading(true)
    const d = await outlookAPI.status(email).catch(() => ({ connected: false }))
    setStatus(d)
    setLoading(false)
  }

  const connect = async () => {
    setConnecting(true)
    const d = await outlookAPI.connect(email)
    window.location.href = d.auth_url
  }

  const disconnect = async () => {
    if (!confirm('Disconnect your mailbox? Emails already linked in WHUBBI will stay, but you won\'t be able to link or send new ones until you reconnect.')) return
    await outlookAPI.disconnect(email)
    load(email)
  }

  return (
    <ProfileLayout>
      <div style={{ padding: '28px 32px', maxWidth: '760px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Integrations</h1>
          <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>Connect your mailbox to link emails to Leads, Opportunities and Contacts, and to send tracked emails from WHUBBI</p>
        </div>

        {notice && (
          <div style={{
            background: notice.type === 'success' ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${notice.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
            color: notice.type === 'success' ? '#166534' : '#DC2626',
            borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '12px', fontWeight: '600',
          }}>
            {notice.text}
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>}

        {!loading && (
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ fontSize: '28px' }}>📧</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#156082' }}>Microsoft 365 / Outlook</div>
                  {status?.connected ? (
                    <div style={{ fontSize: '11px', color: '#059669', marginTop: '2px', fontWeight: '600' }}>Connected — {status.mailbox_email}</div>
                  ) : (
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>Not connected</div>
                  )}
                </div>
              </div>
              {status?.connected ? (
                <button onClick={disconnect} style={{ ...btn, background: '#FEF2F2', color: '#EF4444' }}>Disconnect</button>
              ) : (
                <button onClick={connect} disabled={connecting} style={{ ...btn, background: connecting ? '#94A3B8' : '#156082', color: 'white' }}>
                  {connecting ? 'Redirecting…' : 'Connect mailbox'}
                </button>
              )}
            </div>

            <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '1px solid #EDF2F7', fontSize: '11px', color: '#64748B', lineHeight: 1.6 }}>
              Once connected, you'll be able to link existing emails and send tracked emails from the <b>Emails</b> tab on any Lead, Opportunity or Contact. WHUBBI only accesses your mailbox to search, link and send emails you explicitly choose — it never reads your inbox in the background.
            </div>
          </div>
        )}
      </div>
    </ProfileLayout>
  )
}
