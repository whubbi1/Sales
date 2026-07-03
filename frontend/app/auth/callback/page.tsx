'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAccessExcluded } from '@/lib/auth'

function decodeJwtPayload(token: string): Record<string, any> {
  const b64 = token.split('.')[1] ?? ''
  const padded = b64 + '=='.slice(0, (4 - (b64.length % 4)) % 4)
  return JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')))
}

export default function CallbackPage() {
  const router = useRouter()
  const done   = useRef(false)
  const [status, setStatus] = useState('Signing in to WHUBBI...')

  useEffect(() => {
    if (done.current) return
    done.current = true

    const urlParams = new URLSearchParams(window.location.search)
    const code  = urlParams.get('code')
    const error = urlParams.get('error')

    if (error) {
      setStatus(`Authentication error: ${decodeURIComponent(error)}. Redirecting…`)
      setTimeout(() => router.push('/auth/login'), 2500)
      return
    }

    if (!code) {
      // Direct navigation to /auth/callback — send to home
      router.push('/home')
      return
    }

    const exchange = async () => {
      const domain     = process.env.NEXT_PUBLIC_COGNITO_DOMAIN!
      const clientId   = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!
      const redirectUri = `${window.location.origin}/auth/callback`
      const verifier   = sessionStorage.getItem('pkce_verifier') || ''

      const body = new URLSearchParams({
        grant_type:   'authorization_code',
        client_id:    clientId,
        code,
        redirect_uri: redirectUri,
      })
      if (verifier) body.set('code_verifier', verifier)

      try {
        const res    = await fetch(`${domain}/oauth2/token`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    body.toString(),
        })
        const tokens = await res.json()

        if (tokens.id_token) {
          sessionStorage.removeItem('pkce_verifier')

          const payload = decodeJwtPayload(tokens.id_token)
          const email   = payload.email || ''
          const name    = (
            payload.name ||
            `${payload.given_name || ''} ${payload.family_name || ''}`.trim() ||
            payload['cognito:username'] ||
            email
          )

          if (email && await isAccessExcluded(email)) {
            setStatus('Your access to WHUBBI has been revoked. Contact your administrator.')
            setTimeout(() => router.push('/auth/login'), 3500)
            return
          }

          localStorage.setItem('whubbi_user', JSON.stringify({
            email,
            name,
            exp: payload.exp,
          }))

          const dest = localStorage.getItem('redirectAfterLogin') || '/home'
          localStorage.removeItem('redirectAfterLogin')
          router.push(dest)
        } else {
          setStatus(`Sign-in failed: ${tokens.error_description || tokens.error || 'Unknown error'}. Redirecting…`)
          setTimeout(() => router.push('/auth/login'), 3000)
        }
      } catch (err: any) {
        setStatus(`Network error during sign-in. Redirecting…`)
        setTimeout(() => router.push('/auth/login'), 3000)
      }
    }

    exchange()
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #EDF2F7', borderTop: '3px solid #156082', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ color: '#848EA5', fontSize: '13px', fontWeight: '500' }}>{status}</p>
      </div>
    </div>
  )
}
