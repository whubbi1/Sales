'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredPortalUser } from '@/lib/portalAuth'

export default function PortalIndexPage() {
  const router = useRouter()

  useEffect(() => {
    const user = getStoredPortalUser()
    router.replace(user ? '/portal/home' : '/portal/login')
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '28px', height: '28px', border: '3px solid #EDF2F7', borderTop: '3px solid #156082', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
