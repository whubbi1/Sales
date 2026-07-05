'use client'
import { useState, useEffect } from 'react'
import ProfileLayout from '@/components/ProfileLayout'
import { getStoredUser } from '@/lib/auth'
import { mcpTokensAPI } from '@/lib/api'

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}
const btn: React.CSSProperties = {
  padding: '9px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif',
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

export default function McpAccessPage() {
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
    <ProfileLayout>
      <div style={{ padding: '28px 32px', maxWidth: '760px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Claude / MCP Access</h1>
            <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>Connect Claude Code, Claude Desktop, or claude.ai to your own WHUBBI data and permissions</p>
          </div>
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
    </ProfileLayout>
  )
}
