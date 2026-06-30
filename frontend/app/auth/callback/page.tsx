'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CallbackPage() {
  const router = useRouter()
  useEffect(() => {
    const timer = setTimeout(() => {
      const destination = localStorage.getItem('redirectAfterLogin') || '/home'
      localStorage.removeItem('redirectAfterLogin')
      router.push(destination)
    }, 2000)
    return () => clearTimeout(timer)
  }, [router])
  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#848EA5', fontSize: '13px', fontWeight: '500' }}>Signing in to WHUBBI...</p>
      </div>
    </div>
  )
}
