'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { completePortalSignIn } from '@/lib/portalAuth'

export default function PortalCallbackPage() {
  const router = useRouter()
  const done = useRef(false)
  const [status, setStatus] = useState('Signing in…')

  useEffect(() => {
    if (done.current) return
    done.current = true

    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const error = urlParams.get('error')

    if (error) {
      setStatus(`Authentication error: ${decodeURIComponent(error)}. Redirecting…`)
      setTimeout(() => router.push('/portal/login'), 2500)
      return
    }
    if (!code) {
      router.push('/portal')
      return
    }

    completePortalSignIn(code).then(result => {
      if (result.ok) {
        router.push('/portal/home')
      } else {
        setStatus(`${result.error || 'Access denied'}. Redirecting…`)
        setTimeout(() => router.push('/portal/login'), 3500)
      }
    })
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #EDF2F7', borderTop: '3px solid #156082', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ color: '#848EA5', fontSize: '13px', fontWeight: 500 }}>{status}</p>
      </div>
    </div>
  )
}
