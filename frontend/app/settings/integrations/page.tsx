'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ProfileLayout from '@/components/ProfileLayout'
import { TabNav } from '@/components/shared/RecordLayout'
import { getStoredUser } from '@/lib/auth'
import { outlookAPI, mcpTokensAPI } from '@/lib/api'

const API = 'https://api.whubbi.wcomply.com'

const btn: React.CSSProperties = {
  padding: '9px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif',
}
const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  synced:       { bg: '#ECFDF5', text: '#059669' },
  pending_push: { bg: '#FFF7ED', text: '#D97706' },
  error:        { bg: '#FEF2F2', text: '#DC2626' },
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
  const [tab, setTab] = useState('Microsoft 365')
  const [notice, setNotice] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (params.get('outlook_connected')) setNotice({ type: 'success', text: 'Mailbox connected successfully.' })
    else if (params.get('outlook_error')) setNotice({ type: 'error', text: `Connection failed: ${params.get('outlook_error')}` })
    if (params.get('outlook_connected') || params.get('outlook_error')) router.replace('/settings/integrations')
  }, [params])

  return (
    <ProfileLayout>
      <div style={{ padding: '28px 32px', maxWidth: '760px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Integrations</h1>
          <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>Connect and manage the external tools linked to your WHUBBI account</p>
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

        <TabNav tabs={['Microsoft 365', 'Claude / MCP Access', 'PayFit']} active={tab} onChange={setTab} />

        {tab === 'Microsoft 365' && <Microsoft365Section />}
        {tab === 'Claude / MCP Access' && <McpSection />}
        {tab === 'PayFit' && <PayfitSection />}
      </div>
    </ProfileLayout>
  )
}

function Microsoft365Section() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    const user = getStoredUser()
    if (user?.email) { setEmail(user.email); load(user.email) }
    else setLoading(false)
  }, [])

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

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>

  return (
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
  )
}

function CreateTokenModal({ onClose, onCreate }: any) {
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const submit = async () => {
    setSaving(true)
    const result = await onCreate(label.trim() || 'My token')
    setCreated(result)
    setSaving(false)
  }
  const copy = () => {
    navigator.clipboard.writeText(created.token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget && created) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>{created ? 'Token Created' : 'New Access Token'}</h2>
          {created && <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>}
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!created ? (
            <>
              <div>
                <label style={lbl}>Label</label>
                <input autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }}
                  placeholder="e.g. Claude Desktop, work laptop…" value={label} onChange={e => setLabel(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
                <button onClick={submit} disabled={saving} style={{ ...btn, background: saving ? '#94A3B8' : '#156082', color: 'white' }}>
                  {saving ? 'Creating…' : 'Create Token'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '11px', color: '#DC2626', fontWeight: '600' }}>
                Copy this now — it won't be shown again.
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <code style={{ flex: 1, fontSize: '11px', padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', wordBreak: 'break-all' as const }}>{created.token}</code>
                <button onClick={copy} style={{ ...btn, background: copied ? '#059669' : '#156082', color: 'white', whiteSpace: 'nowrap' as const }}>{copied ? 'Copied!' : 'Copy'}</button>
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', lineHeight: 1.6 }}>
                Add this to your Claude Code / Desktop MCP config, pointing at <code>https://api.whubbi.wcomply.com/mcp</code> with header <code>Authorization: Bearer &lt;token&gt;</code>.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{ ...btn, background: '#156082', color: 'white' }}>Done</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function McpSection() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [tokens, setTokens] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    const user = getStoredUser()
    if (user?.email) { setEmail(user.email); setName(user.name || user.email); load(user.email) }
    else setLoading(false)
  }, [])

  const load = async (email: string) => {
    setLoading(true)
    const d = await mcpTokensAPI.list(email).catch(() => ({ tokens: [] }))
    setTokens(d.tokens || [])
    setLoading(false)
  }

  const createToken = async (label: string) => {
    const result = await mcpTokensAPI.create({ email, name, label })
    load(email)
    return result
  }

  const revoke = async (t: any) => {
    if (!confirm(`Revoke "${t.label}"? Any client using it will stop working immediately.`)) return
    await mcpTokensAPI.revoke(t.id)
    load(email)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <button onClick={() => setShowCreate(true)} style={{ ...btn, background: '#156082', color: 'white' }}>+ New Token</button>
      </div>

      <div style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', fontSize: '12px', color: '#1E40AF', lineHeight: 1.6 }}>
        A token lets an MCP client act as <b>you</b> — it sees exactly what you're allowed to see and can only make changes you're allowed to make (same rules as the WHUBBI Permissions page). Keep it private, and revoke it if a device is lost.
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>}

      {!loading && (
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {tokens.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No tokens yet — create one to connect an MCP client.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tokens.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #EDF2F7' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#156082' }}>{t.label}</div>
                    <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                      <code>{t.token_prefix}…</code> · created {new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {t.last_used_at && ` · last used ${new Date(t.last_used_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                    </div>
                  </div>
                  {t.revoked ? (
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', background: '#F1F5F9', padding: '4px 10px', borderRadius: '10px' }}>Revoked</span>
                  ) : (
                    <button onClick={() => revoke(t)} style={{ padding: '5px 12px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#EF4444', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Revoke</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCreate && <CreateTokenModal onClose={() => setShowCreate(false)} onCreate={createToken} />}
    </div>
  )
}

function PayfitSection() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const user = getStoredUser()
    if (user?.email) { setEmail(user.email); load(user.email) }
    else setLoading(false)
  }, [])

  const load = (email: string) => {
    setLoading(true)
    fetch(`${API}/payfit/my/${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ linked: false, collaborator: null, absences: [] }))
      .finally(() => setLoading(false))
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>

  if (!data?.linked) {
    return (
      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '48px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: '28px', marginBottom: '10px' }}>🔍</div>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#3F3F3F', marginBottom: '6px' }}>No PayFit record found for {email}</div>
        <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>
          This shows up once HR has synced collaborators from PayFit and PayFit has a matching email on file for you.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '20px 24px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: '15px', fontWeight: '800', color: '#156082' }}>{data.collaborator.first_name} {data.collaborator.last_name}</div>
        <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
          {data.collaborator.email || '—'} · PayFit ID {data.collaborator.payfit_id}
        </div>
        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px' }}>
          Last synced {data.collaborator.synced_at ? new Date(data.collaborator.synced_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8', marginBottom: '3px' }}>Matricule</div>
            <div style={{ fontSize: '12px', color: '#3F3F3F', fontWeight: '600' }}>{data.collaborator.matricule || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8', marginBottom: '3px' }}>Birthdate</div>
            <div style={{ fontSize: '12px', color: '#3F3F3F', fontWeight: '600' }}>
              {data.collaborator.birth_date ? new Date(data.collaborator.birth_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8', marginBottom: '3px' }}>Manager</div>
            <div style={{ fontSize: '12px', color: '#3F3F3F', fontWeight: '600' }}>
              {data.collaborator.manager_first_name ? `${data.collaborator.manager_first_name} ${data.collaborator.manager_last_name}` : (data.collaborator.manager_payfit_id ? 'Not yet synced' : '—')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8', marginBottom: '3px' }}>Team</div>
            <div style={{ fontSize: '12px', color: '#3F3F3F', fontWeight: '600' }}>{data.collaborator.team_name || '—'}</div>
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '16px 24px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: '13px', fontWeight: '800', color: '#156082', marginBottom: '8px' }}>Contract</div>
        {data.contract?.available ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8', marginBottom: '3px' }}>Start Date</div>
              <div style={{ fontSize: '12px', color: '#3F3F3F', fontWeight: '600' }}>{data.contract.start_date || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8', marginBottom: '3px' }}>End Date</div>
              <div style={{ fontSize: '12px', color: '#3F3F3F', fontWeight: '600' }}>{data.contract.end_date || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8', marginBottom: '3px' }}>Status</div>
              <div style={{ fontSize: '12px', color: '#3F3F3F', fontWeight: '600' }}>{data.contract.status || '—'}</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: '#D97706', background: '#FFF7ED', padding: '10px 14px', borderRadius: '8px' }}>
            ⚠️ {data.contract?.reason || 'Contract data is not available yet.'}
          </div>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #F1F5F9' }}>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#156082' }}>Absences</span>
        </div>
        {data.absences.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>No absences on record.</div>
        ) : (
          data.absences.map((a: any, i: number) => {
            const c = STATUS_COLOR[a.status] || STATUS_COLOR.error
            return (
              <div key={a.id} style={{ padding: '12px 24px', borderTop: i === 0 ? 'none' : '1px solid #F9FAFB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#3F3F3F' }}>{a.absence_type} · {a.start_date} → {a.end_date}</div>
                  {a.error_detail && <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '2px' }}>{a.error_detail}</div>}
                </div>
                <span style={{ fontSize: '10px', fontWeight: '700', background: c.bg, color: c.text, padding: '3px 9px', borderRadius: '10px', flexShrink: 0 }}>{a.status}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
