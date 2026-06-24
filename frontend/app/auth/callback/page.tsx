'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CallbackPage() {
  const router = useRouter()
  useEffect(() => {
    const timer = setTimeout(() => { router.push('/home') }, 2000)
    return () => clearTimeout(timer)
  }, [router])
  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#9B9B9B', fontSize: '13px' }}>Signing in to WHUBBI...</p>
      </div>
    </div>
  )
}
