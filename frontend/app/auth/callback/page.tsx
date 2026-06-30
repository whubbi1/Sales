'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchUserAttributes } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'

export default function CallbackPage() {
  const router    = useRouter()
  const done      = useRef(false)
  const [status, setStatus] = useState('Signing in to WHUBBI...')

  useEffect(() => {
    const redirect = () => {
      if (done.current) return
      done.current = true
      const destination = localStorage.getItem('redirectAfterLogin') || '/home'
      localStorage.removeItem('redirectAfterLogin')
      router.push(destination)
    }

    // Listen for Amplify's 'signedIn' event — fires when the OAuth code exchange completes
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn') redirect()
    })

    // Also poll: in case the event already fired before this listener was attached
    let attempts = 0
    const poll = async () => {
      try {
        await fetchUserAttributes()
        redirect()
      } catch {
        attempts++
        if (attempts < 20) {
          setTimeout(poll, 500) // retry for up to 10 seconds
        } else {
          setStatus('Session could not be confirmed. Redirecting to home…')
          setTimeout(() => router.push('/home'), 1500)
        }
      }
    }
    setTimeout(poll, 500)

    return () => unsubscribe()
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
