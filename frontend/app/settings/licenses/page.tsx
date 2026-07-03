'use client'
import { useState, useEffect } from 'react'
import ProfileLayout from '@/components/ProfileLayout'
import { getStoredUser } from '@/lib/auth'
import { taskManagerAPI } from '@/lib/api'

const API = 'https://api.whubbi.wcomply.com'

const KIND_LABEL: Record<string, string> = { license: 'License', group: 'Group', role: 'Role' }

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

interface RequestTarget { kind: 'license' | 'group' | 'role'; action: 'add' | 'delete'; itemName?: string }

function RequestTaskModal({ target, msOwner, onClose, onSent }: { target: RequestTarget; msOwner: { email: string; name: string } | null; onClose: () => void; onSent: () => void }) {
  const me = getStoredUser()
  const kindLabel = KIND_LABEL[target.kind]
  const [title, setTitle] = useState(
    target.action === 'add' ? `Request new Microsoft ${kindLabel}` : `Remove Microsoft ${kindLabel}: ${target.itemName}`
  )
  const [description, setDescription] = useState(
    target.action === 'add'
      ? `Please provision a new Microsoft ${kindLabel.toLowerCase()} for ${me?.name || me?.email || 'me'}.`
      : `Please remove the Microsoft ${kindLabel.toLowerCase()} "${target.itemName}" from ${me?.name || me?.email || 'me'}.`
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    if (!msOwner?.email) { setError('No owner is configured for "Microsoft" in the IT Software catalog. Ask IT to set one before sending requests.'); return }
    setSaving(true); setError('')
    try {
      const r = await taskManagerAPI.create({
        title: title.trim(), description, source: 'mywhubbi',
        owner_email: msOwner.email, owner_name: msOwner.name,
        assignee_email: msOwner.email, assignee_name: msOwner.name,
        created_by_email: me?.email || '', acting_email: me?.email || '',
      })
      await taskManagerAPI.addWatcher(r.id, { acting_email: msOwner.email, user_email: me?.email || '', user_name: me?.name || me?.email || '' })
      onSent()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '480px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>{target.action === 'add' ? `Request New ${kindLabel}` : `Request ${kindLabel} Removal`}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>
            This creates a task assigned to {msOwner?.name || msOwner?.email || 'the Microsoft software owner'} (from IT → Software). You'll be added as a watcher so you can follow its progress.
          </p>
          <div>
            <label style={lbl}>Title *</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '80px', resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
            <button onClick={submit} disabled={saving}
              style={{ padding: '9px 18px', background: saving ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              {saving ? 'Sending…' : 'Send Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LicensesGroupsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [msOwner, setMsOwner] = useState<{ email: string; name: string } | null>(null)
  const [requestTarget, setRequestTarget] = useState<RequestTarget | null>(null)
  const [sentMessage, setSentMessage] = useState('')

  useEffect(() => {
    const user = getStoredUser()
    if (user?.email) loadProfile(user.email)
    else setLoading(false)

    fetch(`${API}/it/software?search=Microsoft`).then(r => r.json()).then(d => {
      const match = (d.software || []).find((s: any) => s.owner_email)
      if (match) setMsOwner({ email: match.owner_email, name: match.owner_name || match.owner_email })
    }).catch(() => {})
  }, [])

  const loadProfile = async (email: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/settings/profile/${email}`)
      const data = await res.json()
      setProfile(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const requestSent = () => {
    setRequestTarget(null)
    setSentMessage(`Request sent to ${msOwner?.name || msOwner?.email}.`)
    setTimeout(() => setSentMessage(''), 4000)
  }

  const sectionHeader = (title: string, count: number, kind: RequestTarget['kind']) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '8px' }}>
      <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', margin: 0 }}>{title} ({count})</h3>
      <button onClick={() => setRequestTarget({ kind, action: 'add' })}
        style={{ padding: '5px 10px', background: '#EFF6FF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', color: '#156082', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
        + Request New
      </button>
    </div>
  )

  return (
    <ProfileLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Licenses & Groups</h1>
          <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>Your Microsoft licenses, groups, and roles</p>
        </div>

        {sentMessage && <div style={{ marginBottom: '16px', background: '#ECFDF5', color: '#059669', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>✓ {sentMessage}</div>}

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading...</div>}

        {!loading && profile && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {/* Licenses */}
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              {sectionHeader('Microsoft Licenses', profile.ms_licenses?.length || 0, 'license')}
              {(profile.ms_licenses || []).length === 0 ? (
                <p style={{ color: '#45B6E4', fontSize: '13px' }}>No licenses found. Sync profile first.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(profile.ms_licenses || []).map((lic: string) => (
                    <div key={lic} style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>📄</span>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#3F3F3F', flex: 1 }}>{lic}</span>
                      <button onClick={() => setRequestTarget({ kind: 'license', action: 'delete', itemName: lic })} title="Request removal"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Groups */}
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              {sectionHeader('Microsoft Groups', profile.ms_groups?.length || 0, 'group')}
              {(profile.ms_groups || []).length === 0 ? (
                <p style={{ color: '#45B6E4', fontSize: '13px' }}>No groups found. Sync profile first.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(profile.ms_groups || []).map((grp: string) => (
                    <div key={grp} style={{ padding: '8px 12px', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>👥</span>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#156082', flex: 1 }}>{grp}</span>
                      <button onClick={() => setRequestTarget({ kind: 'group', action: 'delete', itemName: grp })} title="Request removal"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Roles */}
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              {sectionHeader('Microsoft Roles', profile.ms_roles?.length || 0, 'role')}
              {(profile.ms_roles || []).length === 0 ? (
                <p style={{ color: '#45B6E4', fontSize: '13px' }}>No roles assigned.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(profile.ms_roles || []).map((role: string) => (
                    <div key={role} style={{ padding: '8px 12px', background: '#ECFDF5', borderRadius: '8px', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>🔐</span>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#059669', flex: 1 }}>{role}</span>
                      <button onClick={() => setRequestTarget({ kind: 'role', action: 'delete', itemName: role })} title="Request removal"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {requestTarget && (
          <RequestTaskModal target={requestTarget} msOwner={msOwner} onClose={() => setRequestTarget(null)} onSent={requestSent} />
        )}
      </div>
    </ProfileLayout>
  )
}
