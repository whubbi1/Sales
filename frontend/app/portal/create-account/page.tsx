'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  portalSignUp, portalConfirmSignUp, portalResendConfirmationCode,
  portalSignInWithPassword, portalCompleteTotpSetup,
} from '@/lib/portalCognitoAuth'
import { finalizePortalSession } from '@/lib/portalAuth'

type Step = 'form' | 'confirm' | 'mfa-setup' | 'mfa-code'

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

export default function CreateAccountPage() {
  return (
    <Suspense fallback={null}>
      <CreateAccountForm />
    </Suspense>
  )
}

function CreateAccountForm() {
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

  const handleSignUp = async () => {
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setBusy(true); setError('')
    try {
      await portalSignUp(email, password)
      setStep('confirm')
    } catch (err: any) {
      setError(err?.message || 'Could not create the account.')
    }
    setBusy(false)
  }

  const handleConfirm = async () => {
    setBusy(true); setError('')
    try {
      await portalConfirmSignUp(email, code)
      setCode('')
      const outcome = await portalSignInWithPassword(email, password)
      if (outcome.status !== 'TOTP_SETUP_REQUIRED') {
        setError('Unexpected sign-in state after confirmation — please try signing in again.')
        setBusy(false)
        return
      }
      setTotpInfo({ sharedSecret: outcome.sharedSecret, otpauthUri: outcome.otpauthUri })
      setStep('mfa-setup')
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired code.')
    }
    setBusy(false)
  }

  const handleResend = async () => {
    setBusy(true); setError('')
    try {
      await portalResendConfirmationCode(email)
    } catch (err: any) {
      setError(err?.message || 'Could not resend the code.')
    }
    setBusy(false)
  }

  const handleVerifyTotp = async () => {
    setBusy(true); setError('')
    try {
      const idToken = await portalCompleteTotpSetup(code)
      const result = await finalizePortalSession(idToken, inviteToken)
      if (!result.ok) { setError(result.error || 'Access denied.'); setBusy(false); return }
      router.push('/portal/home')
    } catch (err: any) {
      setError(err?.message || 'Incorrect code — please try again.')
    }
    setBusy(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat, sans-serif', background: '#156082', padding: '24px' }}>
      <div style={{ maxWidth: '400px', width: '100%', textAlign: 'center' as const, marginBottom: '28px' }}>
        <img src="/logo.png" alt="WHUBBI" style={{ width: '100px', height: 'auto', objectFit: 'contain', marginBottom: '18px' }} />
        <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'white', margin: '0 0 8px' }}>Create your account</h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>
          {step === 'form' && 'Set an email and password to sign in without Microsoft or Google.'}
          {step === 'confirm' && `Enter the code we sent to ${email}.`}
          {step === 'mfa-setup' && 'Multi-factor authentication is required. Add this account to an authenticator app (Microsoft/Google Authenticator, Authy, etc.).'}
        </p>
      </div>

      <div style={{ maxWidth: '360px', width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {step === 'form' && (
          <>
            <label style={labelStyle}>Email
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ ...inputStyle, marginTop: '6px' }} autoFocus />
            </label>
            <label style={labelStyle}>Password (min. 8 characters)
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ ...inputStyle, marginTop: '6px' }} />
            </label>
            <button onClick={handleSignUp} disabled={busy || !email || !password} style={buttonStyle(busy || !email || !password)}>
              {busy ? 'Creating account…' : 'Continue'}
            </button>
          </>
        )}

        {step === 'confirm' && (
          <>
            <label style={labelStyle}>Verification code
              <input value={code} onChange={e => setCode(e.target.value)} style={{ ...inputStyle, marginTop: '6px' }} autoFocus />
            </label>
            <button onClick={handleConfirm} disabled={busy || !code} style={buttonStyle(busy || !code)}>
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button onClick={handleResend} disabled={busy} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', fontSize: '12px', cursor: 'pointer', padding: '4px' }}>
              Resend code
            </button>
          </>
        )}

        {step === 'mfa-setup' && totpInfo && (
          <>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px', wordBreak: 'break-all' as const }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Manual entry key</div>
              <div style={{ fontSize: '13px', color: 'white', fontFamily: 'monospace' }}>{totpInfo.sharedSecret}</div>
            </div>
            <a href={totpInfo.otpauthUri} style={{ fontSize: '12px', color: 'white', textAlign: 'center' as const }}>Open in authenticator app →</a>
            <label style={labelStyle}>6-digit code from your authenticator app
              <input value={code} onChange={e => setCode(e.target.value)} style={{ ...inputStyle, marginTop: '6px' }} autoFocus />
            </label>
            <button onClick={handleVerifyTotp} disabled={busy || code.length < 6} style={buttonStyle(busy || code.length < 6)}>
              {busy ? 'Verifying…' : 'Confirm & finish'}
            </button>
          </>
        )}

        {error && (
          <div style={{ background: 'rgba(220,38,38,0.15)', color: 'white', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500 }}>
            {error}
          </div>
        )}

        <a href={inviteToken ? `/portal/sign-in?invite=${inviteToken}` : '/portal/sign-in'} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', textAlign: 'center' as const, marginTop: '8px' }}>
          Already have an account? Sign in
        </a>
      </div>
    </div>
  )
}
