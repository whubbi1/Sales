'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredPortalUser, portalApiJson } from '@/lib/portalAuth'

interface PortalProfile {
  email: string
  first_name: string
  last_name: string
  mobile_phone: string | null
  job_name: string | null
  company_name: string | null
}

export default function PortalProfilePage() {
  const router = useRouter()

  const [profile, setProfile] = useState<PortalProfile | null>(null)
  const [form, setForm] = useState({ first_name: '', last_name: '', mobile_phone: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    const user = getStoredPortalUser()
    if (!user) {
      router.replace('/portal/login')
      return
    }
    portalApiJson<PortalProfile>('/portal/partner/me')
      .then(data => {
        setProfile(data)
        setForm({ first_name: data.first_name || '', last_name: data.last_name || '', mobile_phone: data.mobile_phone || '' })
      })
      .catch(() => setMessage({ text: 'Could not load your profile.', type: 'error' }))
      .finally(() => setLoading(false))
  }, [router])

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const updated = await portalApiJson<PortalProfile>('/portal/partner/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setProfile(updated)
      setMessage({ text: 'Profile updated.', type: 'success' })
    } catch {
      setMessage({ text: 'Could not save your changes.', type: 'error' })
    }
    setSaving(false)
    setTimeout(() => setMessage(null), 4000)
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontFamily: 'Montserrat, sans-serif', fontSize: '13px' }}>Loading…</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ background: '#156082', padding: '16px 40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <img src="/logo.png" alt="WCOMPLY" style={{ height: '48px', objectFit: 'contain' }} />
        <div style={{ color: 'white', fontSize: '15px', fontWeight: 800 }}>MyWHUBBI</div>
      </div>

      <div style={{ padding: '32px 40px', maxWidth: '560px', margin: '0 auto' }}>
        <button onClick={() => router.push('/portal/home')}
          style={{ background: 'none', border: 'none', color: '#156082', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: '16px' }}>
          ← Back
        </button>

        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#156082', margin: '0 0 4px' }}>Personal Profile</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 20px' }}>
            {profile?.company_name || 'Your account'} · {profile?.email}
          </p>

          {message && (
            <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, background: message.type === 'success' ? '#ECFDF5' : '#FEF2F2', color: message.type === 'success' ? '#059669' : '#DC2626' }}>
              {message.text}
            </div>
          )}

          <div style={{ display: 'grid', gap: '14px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>
              First name
              <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })}
                style={{ display: 'block', width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', fontFamily: 'Montserrat, sans-serif' }} />
            </label>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>
              Last name
              <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })}
                style={{ display: 'block', width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', fontFamily: 'Montserrat, sans-serif' }} />
            </label>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>
              Mobile phone
              <input value={form.mobile_phone} onChange={e => setForm({ ...form, mobile_phone: e.target.value })}
                style={{ display: 'block', width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', fontFamily: 'Montserrat, sans-serif' }} />
            </label>
            {profile?.job_name && (
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>Role: {profile.job_name}</div>
            )}
          </div>

          <button onClick={save} disabled={saving}
            style={{ marginTop: '20px', padding: '11px 22px', background: saving ? '#F5F7FA' : '#156082', color: saving ? '#848EA5' : 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, fontFamily: 'Montserrat, sans-serif', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
