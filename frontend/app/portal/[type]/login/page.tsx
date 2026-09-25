'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { buildPortalAuthUrl, type PortalType } from '@/lib/portalAuth'

const PORTAL_LABELS: Record<PortalType, string> = { customer: 'Customer Portal', partner: 'Partner Portal' }

export default function PortalLoginPage() {
  const params = useParams()
  const type = (params?.type as PortalType) || 'customer'
  const [loading, setLoading] = useState<'Microsoft' | 'Google' | null>(null)
  const [error, setError] = useState('')

  const handleSignIn = async (provider: 'Microsoft' | 'Google') => {
    setLoading(provider)
    setError('')
    try {
      window.location.href = await buildPortalAuthUrl(type, provider)
    } catch (err: any) {
      setError(`Sign-in error: ${err?.message || 'Unknown error. Please try again.'}`)
      setLoading(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Montserrat, sans-serif', background: 'linear-gradient(135deg, #0a2d40 0%, #156082 100%)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '48px', color: 'white' }}>
        <div style={{ maxWidth: '400px', width: '100%' }}>
          <img src="/logo.png" alt="WHUBBI" style={{ width: '140px', height: 'auto', objectFit: 'contain', marginBottom: '32px' }} />
          <h1 style={{ fontSize: '40px', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '16px', color: 'white' }}>WHUBBI</h1>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.65)', lineHeight: '1.7', fontWeight: 400 }}>
            {PORTAL_LABELS[type]} — sign in with your Microsoft or Google account.
          </p>
        </div>
      </div>

      <div style={{ width: '420px', background: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 40px', gap: '12px' }}>
        <button onClick={() => handleSignIn('Microsoft')} disabled={!!loading}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '13px 20px', background: loading ? '#F5F7FA' : '#156082', color: loading ? '#848EA5' : 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, fontFamily: 'Montserrat, sans-serif', cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading !== 'Microsoft' && (
            <svg width="18" height="18" viewBox="0 0 23 23">
              <path fill="#f3f3f3" d="M0 0h23v23H0z" /><path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" /><path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
          )}
          {loading === 'Microsoft' ? 'Redirecting to Microsoft...' : 'Continue with Microsoft'}
        </button>

        <button onClick={() => handleSignIn('Google')} disabled={!!loading}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '13px 20px', background: loading ? '#F5F7FA' : 'white', color: loading ? '#848EA5' : '#3C4043', border: '1px solid #DADCE0', borderRadius: '10px', fontSize: '13px', fontWeight: 700, fontFamily: 'Montserrat, sans-serif', cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading !== 'Google' && (
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.6 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.4C29.5 34.5 26.9 35.5 24 35.5c-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.6 39.6 16.3 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.8l6.5 5.4C41.5 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z"/>
            </svg>
          )}
          {loading === 'Google' ? 'Redirecting to Google...' : 'Continue with Google'}
        </button>

        {error && (
          <div style={{ marginTop: '2px', background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500 }}>
            {error}
          </div>
        )}

        <p style={{ marginTop: '8px', fontSize: '11px', color: '#94A3B8', lineHeight: 1.6 }}>
          Access to this portal is by invitation only. If you haven't received an invitation, contact your WCOMPLY representative.
        </p>
      </div>
    </div>
  )
}
