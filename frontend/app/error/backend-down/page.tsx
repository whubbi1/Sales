'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function BackendDownPage() {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)
  const [countdown, setCountdown] = useState(30)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { handleRetry(); return 30 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const res = await fetch('https://api.whubbi.wcomply.com/health', { signal: AbortSignal.timeout(5000) })
      if (res.ok) router.back()
    } catch {}
    setRetrying(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '48px', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(21,96,130,0.1)' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '32px' }}>🔌</div>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', marginBottom: '12px' }}>Backend Unavailable</h1>
        <p style={{ fontSize: '13px', color: '#848EA5', lineHeight: '1.7', marginBottom: '32px' }}>
          The WHUBBI backend service is currently unavailable. This may be due to a temporary outage or maintenance.
        </p>
        <div style={{ background: '#FEF2F2', borderRadius: '10px', padding: '14px', marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Service Status</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#DC2626' }} />
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#DC2626' }}>API — Offline</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button onClick={handleRetry} disabled={retrying} style={{ background: '#156082', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
            {retrying ? 'Checking...' : `Retry (${countdown}s)`}
          </button>
          <button onClick={() => router.push('/home')} style={{ background: 'white', color: '#156082', border: '1.5px solid #848EA5', padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
            Go Home
          </button>
        </div>
      </div>
    </div>
  )
}
