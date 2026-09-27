'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { buildPortalAuthUrl } from '@/lib/portalAuth'
import { API_BASE } from '@/lib/apiClient'

interface InvitationInfo {
  valid: boolean
  expired: boolean
  already_accepted: boolean
  revoked?: boolean
  contact_first_name?: string
}

export default function PortalInvitePage() {
  const params = useParams()
  const token = params?.token as string

  const [info, setInfo] = useState<InvitationInfo | null>(null)
  const [loading, setLoading] = useState<'Microsoft' | 'Google' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/portal/invitations/by-token/${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(setInfo)
      .catch(() => setInfo({ valid: false, expired: false, already_accepted: false }))
  }, [token])

  const handleSignIn = async (provider: 'Microsoft' | 'Google') => {
    setLoading(provider)
    setError('')
    try {
      window.location.href = await buildPortalAuthUrl(provider, token)
    } catch (err: any) {
      setError(`Sign-in error: ${err?.message || 'Unknown error. Please try again.'}`)
      setLoading(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat, sans-serif', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxWidth: '420px', width: '100%', padding: '40px' }}>
        <img src="/logo.png" alt="WHUBBI" style={{ height: '48px', objectFit: 'contain', marginBottom: '20px' }} />

        {info === null && <p style={{ color: '#94A3B8', fontSize: '13px' }}>Checking your invitation…</p>}

        {info && !info.valid && (
          <>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#156082', margin: '0 0 8px' }}>
              {info.expired ? 'This invitation has expired' : info.already_accepted ? 'This invitation was already used' : info.revoked ? 'This invitation was revoked' : 'Invitation not found'}
            </h1>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.6 }}>
              {info.already_accepted
                ? 'You can sign in directly at the Portal login page.'
                : 'Contact your WCOMPLY representative for a new invitation link.'}
            </p>
            {info.already_accepted && (
              <a href="/portal/login" style={{ display: 'inline-block', marginTop: '16px', color: '#156082', fontSize: '13px', fontWeight: 700 }}>
                Go to sign-in →
              </a>
            )}
          </>
        )}

        {info && info.valid && (
          <>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#156082', margin: '0 0 6px' }}>
              Hi {info.contact_first_name || 'there'}, you've been invited
            </h1>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.6, marginBottom: '20px' }}>
              Connect your Microsoft or Google account to access the WHUBBI Portal.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => handleSignIn('Microsoft')} disabled={!!loading}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px 18px', background: loading ? '#F5F7FA' : '#156082', color: loading ? '#848EA5' : 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, fontFamily: 'Montserrat, sans-serif', cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading === 'Microsoft' ? 'Redirecting…' : 'Continue with Microsoft'}
              </button>
              <button onClick={() => handleSignIn('Google')} disabled={!!loading}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px 18px', background: loading ? '#F5F7FA' : 'white', color: loading ? '#848EA5' : '#3C4043', border: '1px solid #DADCE0', borderRadius: '10px', fontSize: '13px', fontWeight: 700, fontFamily: 'Montserrat, sans-serif', cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading === 'Google' ? 'Redirecting…' : 'Continue with Google'}
              </button>
            </div>

            {error && (
              <div style={{ marginTop: '14px', background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500 }}>
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
