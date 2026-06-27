'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { BackendCheck } from '@/components/BackendCheck'

const API = 'https://api.whubbi.wcomply.com'

const MODULES_META: Record<string, { label: string; icon: string; color: string }> = {
  sales:    { label: 'Sales',            icon: '💼', color: '#156082' },
  finance:  { label: 'Finance',          icon: '💰', color: '#e97132' },
  hr:       { label: 'Human Resources',  icon: '👥', color: '#45B6E4' },
  grc:      { label: 'GRC',              icon: '🛡️', color: '#45B6E4' },
  it:       { label: 'IT',               icon: '🖥️', color: '#45B6E4' },
  helpdesk: { label: 'Helpdesk',         icon: '🎧', color: '#45B6E4' },
  admin:    { label: 'Admin',            icon: '🔧', color: '#45B6E4' },
}

const DATA_SCOPES  = ['none', 'own', 'team', 'company']
const ACCESS_MODES = ['none', 'view', 'edit']

const SCOPE_LABEL: Record<string, string> = { none: 'No Access', own: 'Own Data', team: 'Team Data', company: 'All Company' }
const MODE_LABEL:  Record<string, string> = { none: 'None', view: 'View Only', edit: 'View & Edit' }

const SCOPE_COLOR: Record<string, string> = { none: '#F1F5F9', own: '#EFF6FF', team: '#FFF7ED', company: '#ECFDF5' }
const SCOPE_TEXT:  Record<string, string> = { none: '#848EA5', own: '#156082', team: '#D97706', company: '#059669' }

export default function SettingsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'profile' | 'licenses'>('profile')
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // For demo — use a hardcoded email (in production, get from Cognito session)
  const currentEmail = 'william.delcour@wcomply.com'

  useEffect(() => {
    loadProfile(currentEmail)
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

  const loadUsers = async () => {
    try {
      const res = await fetch(`${API}/settings/users`)
      const data = await res.json()
      setUsers(data.users || [])
    } catch (e) {}
  }

  const loadPermissions = async (email: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/settings/permissions/${email}`)
      const data = await res.json()
      setPermissions(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const syncProfile = async () => {
    setSyncing(true)
    try {
      const res = await fetch(`${API}/settings/profile/${currentEmail}/sync`, { method: 'POST' })
      const data = await res.json()
      if (!data.error) {
        setProfile(data)
        setMessage({ text: 'Profile synced from Microsoft!', type: 'success' })
      } else {
        setMessage({ text: data.error, type: 'error' })
      }
    } catch (e: any) { setMessage({ text: e.message, type: 'error' }) }
    setSyncing(false)
    setTimeout(() => setMessage(null), 4000)
  }

  const updatePermission = (module: string, submodule: string, field: string, value: string) => {
    setPermissions((p: any) => ({
      ...p,
      permissions: {
        ...p.permissions,
        [module]: {
          ...p.permissions[module],
          [submodule]: { ...p.permissions[module][submodule], [field]: value }
        }
      }
    }))
  }

  const savePermissions = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/settings/permissions/${selectedUser}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: permissions.permissions, granted_by: currentEmail })
      })
      const data = await res.json()
      if (data.status === 'ok') {
        setMessage({ text: `${data.updated} permissions saved!`, type: 'success' })
      }
    } catch (e: any) { setMessage({ text: e.message, type: 'error' }) }
    setSaving(false)
    setTimeout(() => setMessage(null), 4000)
  }

  const TABS = [
    { id: 'profile',     label: 'My Profile',        icon: '👤' },
    { id: 'licenses',    label: 'Licenses & Groups',  icon: '📋' },
  ]

  return (
    <div style={{ display: 'flex' }}>
      <BackendCheck />
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
        <div style={{ padding: '28px 32px' }}>

          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Personal Settings</h1>
            <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>Manage your profile and preferences</p>
          </div>

          {/* Message */}
          {message && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', background: message.type === 'success' ? '#ECFDF5' : '#FEF2F2', color: message.type === 'success' ? '#059669' : '#DC2626', fontSize: '13px', fontWeight: '600', border: `1px solid ${message.type === 'success' ? '#A7F3D0' : '#FECACA'}` }}>
              {message.type === 'success' ? '✅' : '❌'} {message.text}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '3px', marginBottom: '24px', background: 'white', padding: '4px', borderRadius: '10px', border: '1px solid #EDF2F7', width: 'fit-content' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', background: tab === t.id ? '#156082' : 'transparent', color: tab === t.id ? 'white' : '#45B6E4', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.12s' }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading...</div>}

          {/* ── Profile Tab ── */}
          {!loading && tab === 'profile' && (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
              {/* Profile card */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '28px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                {profile?.photo_url ? (
                  <img src={profile.photo_url} alt="Profile" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #45B6E4', marginBottom: '16px' }} />
                ) : (
                  <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#156082', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: '800', margin: '0 auto 16px' }}>
                    {profile?.first_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>
                  {profile?.display_name || 'Loading...'}
                </h2>
                <p style={{ fontSize: '13px', color: '#45B6E4', margin: '0 0 4px' }}>{profile?.job_title}</p>
                <p style={{ fontSize: '12px', color: '#848EA5', margin: '0 0 20px' }}>{profile?.department}</p>
                <button onClick={syncProfile} disabled={syncing} style={{ background: '#156082', color: 'white', border: 'none', padding: '9px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', width: '100%' }}>
                  {syncing ? '⏳ Syncing...' : '↻ Sync from Microsoft'}
                </button>
                {profile?.last_sync && (
                  <p style={{ fontSize: '10px', color: '#848EA5', marginTop: '8px' }}>
                    Last sync: {new Date(profile.last_sync).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Profile details */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '20px' }}>Personal Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {[
                    { label: 'First Name',    value: profile?.first_name },
                    { label: 'Last Name',     value: profile?.last_name },
                    { label: 'Email',         value: profile?.email },
                    { label: 'Mobile Phone',  value: profile?.mobile_phone || '—' },
                    { label: 'Office Phone',  value: profile?.office_phone || '—' },
                    { label: 'Job Title',     value: profile?.job_title || '—' },
                    { label: 'Department',    value: profile?.department || '—' },
                  ].map(field => (
                    <div key={field.label} style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '4px' }}>{field.label}</div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#3F3F3F' }}>{field.value || '—'}</div>
                    </div>
                  ))}
                </div>

                {/* Manager */}
                {profile?.manager_name && (
                  <div style={{ marginTop: '24px', padding: '16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #EDF2F7' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '8px' }}>Manager</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#156082', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '800' }}>
                        {profile.manager_name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#156082' }}>{profile.manager_name}</div>
                        <div style={{ fontSize: '11px', color: '#45B6E4' }}>{profile.manager_email}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Licenses & Groups Tab ── */}
          {!loading && tab === 'licenses' && profile && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              {/* Licenses */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '16px' }}>Microsoft Licenses ({profile.ms_licenses?.length || 0})</h3>
                {(profile.ms_licenses || []).length === 0 ? (
                  <p style={{ color: '#45B6E4', fontSize: '13px' }}>No licenses found. Sync profile first.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(profile.ms_licenses || []).map((lic: string) => (
                      <div key={lic} style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>📄</span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#3F3F3F' }}>{lic}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Groups */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '16px' }}>Microsoft Groups ({profile.ms_groups?.length || 0})</h3>
                {(profile.ms_groups || []).length === 0 ? (
                  <p style={{ color: '#45B6E4', fontSize: '13px' }}>No groups found. Sync profile first.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(profile.ms_groups || []).map((grp: string) => (
                      <div key={grp} style={{ padding: '8px 12px', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>👥</span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#156082' }}>{grp}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Roles */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '16px' }}>Microsoft Roles ({profile.ms_roles?.length || 0})</h3>
                {(profile.ms_roles || []).length === 0 ? (
                  <p style={{ color: '#45B6E4', fontSize: '13px' }}>No roles assigned.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(profile.ms_roles || []).map((role: string) => (
                      <div key={role} style={{ padding: '8px 12px', background: '#ECFDF5', borderRadius: '8px', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>🔐</span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#059669' }}>{role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
{users.length === 0 && <option value={currentEmail}>{currentEmail}</option>}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#45B6E4' }}>
                    <span style={{ background: SCOPE_COLOR.own, color: SCOPE_TEXT.own, padding: '2px 6px', borderRadius: '4px', marginRight: '4px' }}>Own</span>
                    <span style={{ background: SCOPE_COLOR.team, color: SCOPE_TEXT.team, padding: '2px 6px', borderRadius: '4px', marginRight: '4px' }}>Team</span>
                    <span style={{ background: SCOPE_COLOR.company, color: SCOPE_TEXT.company, padding: '2px 6px', borderRadius: '4px' }}>Company</span>
                  </div>
                  <button onClick={savePermissions} disabled={saving || !permissions} style={{ background: '#156082', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '7px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                    {saving ? '⏳ Saving...' : '💾 Save Permissions'}
                  </button>
                </div>
              </div>

              {!loading && permissions && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {Object.entries(permissions.permissions || {}).map(([module, submodules]: [string, any]) => {
                    const meta = MODULES_META[module] || { label: module, icon: '📦', color: '#45B6E4' }
                    return (
                      <div key={module} style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                        {/* Module header */}
                        <div style={{ padding: '14px 20px', background: meta.color + '10', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '18px' }}>{meta.icon}</span>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: meta.color }}>{meta.label}</span>
                          <span style={{ fontSize: '11px', color: '#45B6E4' }}>({Object.keys(submodules).length} submodules)</span>
                        </div>
                        {/* Submodules table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#FAFBFC' }}>
                              <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', width: '30%' }}>Submodule</th>
                              <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', width: '35%' }}>Data Scope</th>
                              <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', width: '35%' }}>Access Mode</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(submodules).map(([sub, perm]: [string, any]) => (
                              <tr key={sub} style={{ borderTop: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: '600', color: '#3F3F3F', textTransform: 'capitalize' }}>{sub}</td>
                                <td style={{ padding: '12px 20px' }}>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    {DATA_SCOPES.map(scope => (
                                      <button key={scope} onClick={() => updatePermission(module, sub, 'data_scope', scope)}
                                        style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', background: perm.data_scope === scope ? SCOPE_COLOR[scope] : '#F1F5F9', color: perm.data_scope === scope ? SCOPE_TEXT[scope] : '#848EA5', transition: 'all 0.12s' }}>
                                        {SCOPE_LABEL[scope]}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                                <td style={{ padding: '12px 20px' }}>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    {ACCESS_MODES.map(mode => (
                                      <button key={mode} onClick={() => updatePermission(module, sub, 'access_mode', mode)}
                                        style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', background: perm.access_mode === mode ? (mode === 'none' ? '#F1F5F9' : mode === 'view' ? '#EFF6FF' : '#ECFDF5') : '#F1F5F9', color: perm.access_mode === mode ? (mode === 'none' ? '#848EA5' : mode === 'view' ? '#156082' : '#059669') : '#848EA5', transition: 'all 0.12s' }}>
                                        {MODE_LABEL[mode]}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                </div>
              )}
              {!loading && !permissions && selectedUser && (
                <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>No permissions found. Select a user above.</div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
