'use client'
// app/auth/login/page.tsx
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleMicrosoftSSO = () => {
    setLoading(true)
    setError('')
    const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID
    const redirect = `${window.location.origin}/auth/callback`
    if (domain && clientId) {
      window.location.href = `${domain}/oauth2/authorize?client_id=${clientId}&response_type=code&scope=email+openid+profile&redirect_uri=${encodeURIComponent(redirect)}&identity_provider=Microsoft`
    } else {
      setError('SSO configuration error. Please contact support.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'linear-gradient(135deg, #0d3352 0%, #144766 50%, #1a6089 100%)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '48px', color: 'white' }}>
        <div style={{ position: 'relative', maxWidth: '400px', width: '100%' }}>
          <img src="/logo.png" alt="WHUBBI" style={{ width: '140px', height: 'auto', objectFit: 'contain', marginBottom: '32px' }} />
          <h1 style={{ fontSize: '40px', fontWeight: '900', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '16px', fontFamily: 'Montserrat, sans-serif' }}>WHUBBI</h1>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.65)', lineHeight: '1.6', fontFamily: 'Montserrat, sans-serif' }}>
            Your commercial management platform. Track companies, contacts, and opportunities.
          </p>
          <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { icon: '🏢', title: 'Companies', desc: 'Manage your company hierarchy' },
              { icon: '👥', title: 'Contacts', desc: 'Track all your key contacts' },
              { icon: '💼', title: 'Opportunities', desc: 'Follow your pipeline in real-time' },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>{item.title}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontFamily: 'Montserrat, sans-serif' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ width: '420px', background: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 40px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#144766', marginBottom: '6px', fontFamily: 'Montserrat, sans-serif' }}>Sign in to WHUBBI</h2>
          <p style={{ fontSize: '12px', color: '#9B9B9B', fontFamily: 'Montserrat, sans-serif' }}>Use your Wcomply Microsoft account to sign in.</p>
        </div>
        <button onClick={handleMicrosoftSSO} disabled={loading} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '13px 20px', background: loading ? '#F5F7FA' : '#144766', color: loading ? '#9B9B9B' : 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', cursor: loading ? 'not-allowed' : 'pointer' }}>
          {!loading && (
            <svg width="18" height="18" viewBox="0 0 23 23">
              <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
              <path fill="#f35325" d="M1 1h10v10H1z"/>
              <path fill="#81bc06" d="M12 1h10v10H12z"/>
              <path fill="#05a6f0" d="M1 12h10v10H1z"/>
              <path fill="#ffba08" d="M12 12h10v10H12z"/>
            </svg>
          )}
          {loading ? 'Redirecting to Microsoft...' : 'Continue with Microsoft'}
        </button>
        {error && <div style={{ marginTop: '14px', background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
        <div style={{ marginTop: '40px', padding: '16px', background: '#F5F7FA', borderRadius: '10px' }}>
          <p style={{ fontSize: '11px', color: '#9B9B9B', fontFamily: 'Montserrat, sans-serif', lineHeight: '1.5', textAlign: 'center' }}>By signing in, you agree to Wcomply internal use policies.</p>
        </div>
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '10px', color: '#CBD5E0', fontFamily: 'Montserrat, sans-serif' }}>WHUBBI · Powered by Wcomply</p>
        </div>
      </div>
    </div>
  )
}
