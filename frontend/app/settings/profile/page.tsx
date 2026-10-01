'use client'
import { useState, useEffect } from 'react'
import ProfileLayout from '@/components/ProfileLayout'
import { getStoredUser } from '@/lib/auth'
import { apiFetch } from '@/lib/apiClient'
import { useAppSettings, DATE_FORMATS } from '@/lib/appSettings'
import { LANGUAGES, NUMBER_FORMATS, CURRENCIES } from '@/lib/contactOptions'

const sel: React.CSSProperties = { fontSize: '13px', padding: '8px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', background: 'white', width: '100%', boxSizing: 'border-box' as const }
const prefLbl: React.CSSProperties = { fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '4px', display: 'block' }

export default function PersonalProfilePage() {
  const { refresh: refreshAppSettings } = useAppSettings()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [email, setEmail] = useState('')
  const [prefs, setPrefs] = useState({ preferred_language: 'English', number_format: 'european', date_format: 'DD/MM/YYYY', currency: 'EUR' })

  useEffect(() => {
    const user = getStoredUser()
    if (user?.email) {
      setEmail(user.email)
      loadProfile(user.email)
    } else {
      setLoading(false)
    }
  }, [])

  const loadProfile = async (email: string) => {
    setLoading(true)
    try {
      const res = await apiFetch(`/settings/profile/${encodeURIComponent(email)}`)
      const data = await res.json()
      setProfile(data)
      setPrefs({
        preferred_language: data.preferred_language || 'English',
        number_format: data.number_format || 'european',
        date_format: data.date_format || 'DD/MM/YYYY',
        currency: data.currency || 'EUR',
      })
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const syncProfile = async () => {
    if (!email) return
    setSyncing(true)
    try {
      const res = await apiFetch(`/settings/profile/${encodeURIComponent(email)}/sync`, { method: 'POST' })
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

  const savePrefs = async () => {
    if (!email) return
    setSaving(true)
    try {
      await apiFetch(`/settings/profile/${encodeURIComponent(email)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prefs),
      })
      refreshAppSettings()
      setMessage({ text: 'Preferences saved.', type: 'success' })
    } catch (e: any) {
      setMessage({ text: e.message || 'Could not save preferences.', type: 'error' })
    }
    setSaving(false)
    setTimeout(() => setMessage(null), 4000)
  }

  return (
    <ProfileLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Personal Profile</h1>
          <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>Manage your profile and preferences</p>
        </div>

        {message && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', background: message.type === 'success' ? '#ECFDF5' : '#FEF2F2', color: message.type === 'success' ? '#059669' : '#DC2626', fontSize: '13px', fontWeight: '600', border: `1px solid ${message.type === 'success' ? '#A7F3D0' : '#FECACA'}` }}>
            {message.type === 'success' ? '✅' : '❌'} {message.text}
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading...</div>}

        {!loading && (
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

            {/* Default formatting preferences */}
            <div style={{ gridColumn: '1 / -1', background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '4px' }}>Default Preferences</h3>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 16px' }}>Applied across WHUBBI wherever a page uses the shared formatting helpers.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <label><span style={prefLbl}>Language</span>
                  <select style={sel} value={prefs.preferred_language} onChange={e => setPrefs(p => ({ ...p, preferred_language: e.target.value }))}>
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </label>
                <label><span style={prefLbl}>Number format</span>
                  <select style={sel} value={prefs.number_format} onChange={e => setPrefs(p => ({ ...p, number_format: e.target.value }))}>
                    {NUMBER_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </label>
                <label><span style={prefLbl}>Date format</span>
                  <select style={sel} value={prefs.date_format} onChange={e => setPrefs(p => ({ ...p, date_format: e.target.value }))}>
                    {DATE_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </label>
                <label><span style={prefLbl}>Currency</span>
                  <select style={sel} value={prefs.currency} onChange={e => setPrefs(p => ({ ...p, currency: e.target.value }))}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              </div>
              <button onClick={savePrefs} disabled={saving} style={{ marginTop: '18px', background: saving ? '#F5F7FA' : '#156082', color: saving ? '#848EA5' : 'white', border: 'none', padding: '9px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                {saving ? 'Saving…' : 'Save preferences'}
              </button>
            </div>
          </div>
        )}
      </div>
    </ProfileLayout>
  )
}
