'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredPortalUser, clearStoredPortalUser } from '@/lib/portalAuth'

export default function PortalHomePage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const user = getStoredPortalUser()
    if (!user) {
      router.replace('/portal/login')
      return
    }
    setUserName(user.name || user.email)
  }, [router])

  const handleSignOut = () => {
    clearStoredPortalUser()
    router.push('/portal/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ background: '#156082', padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src="/logo.png" alt="WCOMPLY" style={{ height: '56px', objectFit: 'contain' }} />
          <div>
            <div style={{ color: 'white', fontSize: '17px', fontWeight: 800, letterSpacing: '0.04em' }}>WHUBBI PORTAL</div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', marginTop: '2px' }}>Welcome back{userName ? `, ${userName}` : ''}</div>
          </div>
        </div>
        <button onClick={handleSignOut}
          style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
          Sign out
        </button>
      </div>

      <div style={{ padding: '48px 40px', maxWidth: '1000px', margin: '0 auto' }}>
        <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 16px' }}>Select a tile to get started.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '18px', maxWidth: '260px' }}>
          <div onClick={() => router.push('/portal/profile')}
            style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#156082' }} />
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#45B6E418', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '14px' }}>⚙️</div>
            <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#156082', margin: '0 0 6px' }}>MyWHUBBI</h2>
            <p style={{ fontSize: '11px', color: '#45B6E4', margin: 0, lineHeight: 1.6 }}>Manage your personal profile information.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
