'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { portalSignInWithPassword, portalConfirmTotpCode } from '@/lib/portalCognitoAuth'
import { finalizePortalSession } from '@/lib/portalAuth'
import { TotpQrCode } from '@/components/portal/TotpQrCode'

type Step = 'form' | 'mfa-code' | 'mfa-setup'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.3)',
  background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '14px', fontFamily: 'Montserrat, sans-serif',
  outline: 'none', boxSizing: 'border-box' as const,
}
const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.85)', display: 'block', marginBottom: '6px' }
const buttonStyle = (disabled: boolean): React.CSSProperties => ({
  width: '100%', padding: '13px 20px', background: disabled ? 'rgba(255,255,255,0.5)' : 'white', color: '#156082',
  border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, fontFamily: 'Montserrat, sans-serif',
  cursor: disabled ? 'not-allowed' : 'pointer',
})

export default function PortalSignInPage() {
  return (
    <Suspense fallback={null}>
      <PortalSignInForm />
    </Suspense>
  )
}

function PortalSignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite') || undefined

  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [totpInfo, setTotpInfo] = useState<{ sharedSecret: string; otpauthUri: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const finish = async (idToken: string) => {
    const result = await finalizePortalSession(idToken, inviteToken)
    if (!result.ok) { setError(result.error || 'Access denied.'); return }
    router.push('/portal/home')
  }

  const handleSignIn = async () => {
    setBusy(true); setError('')
    try {
      const outcome = await portalSignInWithPassword(email, password)
      if (outcome.status === 'DONE') {
        await finish(outcome.idToken)
      } else if (outcome.status === 'TOTP_CHALLENGE') {
        setStep('mfa-code')
      } else {
        // Confirmed account that never finished MFA enrollment (e.g. dropped off
        // mid-signup) — finish it here rather than dead-ending, since re-running
        // sign-up for an already-confirmed email would just fail as "already exists".
        setTotpInfo({ sharedSecret: outcome.sharedSecret, otpauthUri: outcome.otpauthUri })
        setStep('mfa-setup')
      }
    } catch (err: any) {
      setError(err?.message || 'Incorrect email or password.')
    }
    setBusy(false)
  }

  // Same handler for both steps — Amplify answers a first-time enrollment and a
  // returning user's code through the identical confirmSignIn call.
  const handleConfirmTotp = async () => {
    setBusy(true); setError('')
    try {
      const idToken = await portalConfirmTotpCode(code)
      await finish(idToken)
    } catch (err: any) {
      setError(err?.message || 'Incorrect code — please try again.')
    }
    setBusy(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat, sans-serif', background: '#156082', padding: '24px' }}>
      <div style={{ maxWidth: '400px', width: '100%', textAlign: 'center' as const, marginBottom: '28px' }}>
        <img src="/logo.png" alt="WHUBBI" style={{ width: '100px', height: 'auto', objectFit: 'contain', marginBottom: '18px' }} />
        <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'white', margin: '0 0 8px' }}>Sign in</h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>
          {step === 'form' && 'Sign in with your email and password.'}
          {step === 'mfa-code' && 'Enter the code from your authenticator app.'}
          {step === 'mfa-setup' && "Your account was confirmed but MFA setup wasn't finished — let's finish it now."}
        </p>
      </div>

      <div style={{ maxWidth: '360px', width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {step === 'form' && (
          <>
            <label style={labelStyle}>Email
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ ...inputStyle, marginTop: '6px' }} autoFocus />
            </label>
            <label style={labelStyle}>Password
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ ...inputStyle, marginTop: '6px' }}
                onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
            </label>
            <button onClick={handleSignIn} disabled={busy || !email || !password} style={buttonStyle(busy || !email || !password)}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </>
        )}

        {step === 'mfa-code' && (
          <>
            <label style={labelStyle}>6-digit code
              <input value={code} onChange={e => setCode(e.target.value)} style={{ ...inputStyle, marginTop: '6px' }} autoFocus
                onKeyDown={e => e.key === 'Enter' && handleConfirmTotp()} />
            </label>
            <button onClick={handleConfirmTotp} disabled={busy || code.length < 6} style={buttonStyle(busy || code.length < 6)}>
              {busy ? 'Verifying…' : 'Verify'}
            </button>
          </>
        )}

        {step === 'mfa-setup' && totpInfo && (
          <>
            <div style={{ background: 'white', borderRadius: '10px', padding: '12px' }}>
              <TotpQrCode otpauthUri={totpInfo.otpauthUri} />
            </div>
            <details style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>
              <summary style={{ cursor: 'pointer' }}>Can't scan it? Enter this key manually</summary>
              <div style={{ marginTop: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px', wordBreak: 'break-all' as const, fontFamily: 'monospace', color: 'white' }}>
                {totpInfo.sharedSecret}
              </div>
            </details>
            <label style={labelStyle}>6-digit code from your authenticator app
              <input value={code} onChange={e => setCode(e.target.value)} style={{ ...inputStyle, marginTop: '6px' }} autoFocus />
            </label>
            <button onClick={handleConfirmTotp} disabled={busy || code.length < 6} style={buttonStyle(busy || code.length < 6)}>
              {busy ? 'Verifying…' : 'Confirm & finish'}
            </button>
          </>
        )}

        {error && (
          <div style={{ background: 'rgba(220,38,38,0.15)', color: 'white', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500 }}>
            {error}
          </div>
        )}

        {step === 'form' && (
          <a href={inviteToken ? `/portal/create-account?invite=${inviteToken}` : '/portal/create-account'} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', textAlign: 'center' as const, marginTop: '8px' }}>
            Don't have an account? Create one
          </a>
        )}
      </div>
    </div>
  )
}
