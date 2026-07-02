'use client'
import { useState } from 'react'

async function buildAuthUrl(): Promise<string> {
  const domain   = process.env.NEXT_PUBLIC_COGNITO_DOMAIN!
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!
  const redirect = `${window.location.origin}/auth/callback`

  // PKCE: generate code verifier + challenge
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32))
  const verifier = btoa(String.fromCharCode(...verifierBytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const hashBuf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hashBuf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  sessionStorage.setItem('pkce_verifier', verifier)

  const url = new URL(`${domain}/oauth2/authorize`)
  url.searchParams.set('client_id',             clientId)
  url.searchParams.set('response_type',         'code')
  url.searchParams.set('scope',                 'email openid profile')
  url.searchParams.set('redirect_uri',          redirect)
  url.searchParams.set('identity_provider',     'Microsoft')
  url.searchParams.set('code_challenge',        challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleMicrosoftSSO = async () => {
    setLoading(true)
    setError('')
    try {
      window.location.href = await buildAuthUrl()
    } catch (err: any) {
      setError(`SSO error: ${err?.message || 'Unknown error. Please try again.'}`)
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Montserrat, sans-serif', background: 'linear-gradient(135deg, #0a2d40 0%, #156082 100%)' }}>
      {/* Left panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '48px', color: 'white' }}>
        <div style={{ maxWidth: '400px', width: '100%' }}>
          <img src="/logo.png" alt="WHUBBI" style={{ width: '140px', height: 'auto', objectFit: 'contain', marginBottom: '32px' }} />
          <h1 style={{ fontSize: '40px', fontWeight: '900', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '16px', color: 'white' }}>WHUBBI</h1>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.65)', lineHeight: '1.7', fontWeight: '400' }}>
            Your all-in-one business platform. Sales, Finance, HR, GRC and IT — all in one place.
          </p>
          <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { icon: '💼', title: 'Sales',   desc: 'Pipeline & commercial management' },
              { icon: '💰', title: 'Finance', desc: 'Budgets & financial tracking' },
              { icon: '🛡️', title: 'GRC',    desc: 'Governance, Risk & Compliance' },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700' }}>{item.title}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ width: '420px', background: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 40px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#156082', marginBottom: '6px', letterSpacing: '-0.01em' }}>Sign in to WHUBBI</h2>
          <p style={{ fontSize: '12px', color: '#848EA5' }}>Use your WCOMPLY Microsoft account.</p>
        </div>

        <button onClick={handleMicrosoftSSO} disabled={loading}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '13px 20px', background: loading ? '#F5F7FA' : '#156082', color: loading ? '#848EA5' : 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}>
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

        {error && (
          <div style={{ marginTop: '14px', background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '500' }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: '40px', padding: '16px', background: '#F5F7FA', borderRadius: '10px' }}>
          <p style={{ fontSize: '11px', color: '#848EA5', lineHeight: '1.5', textAlign: 'center' }}>
            By signing in, you agree to WCOMPLY's internal use policies. Your session is secured via AWS Cognito.
          </p>
        </div>
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '10px', color: '#848EA5' }}>WHUBBI · Powered by WCOMPLY</p>
        </div>
      </div>
    </div>
  )
}
