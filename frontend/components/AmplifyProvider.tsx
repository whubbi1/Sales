'use client'
import { Amplify } from 'aws-amplify'
import { getAmplifyConfig } from '@/lib/amplifyConfig'
import { useEffect, useState } from 'react'
import { getStoredUser } from '@/lib/auth'

Amplify.configure(getAmplifyConfig())

function initials(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

export function AmplifyProvider({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => {
      const u = getStoredUser()
      setUserName(u ? u.name : null)
    }
    refresh()
    // Re-check whenever another tab writes to localStorage (e.g. after login)
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])

  return (
    <>
      {children}
      {userName && (
        <div style={{
          position: 'fixed', top: '12px', right: '16px', zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0,0,0,0.10)',
          borderRadius: '24px',
          padding: '5px 14px 5px 6px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
          fontFamily: 'Montserrat, sans-serif',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: '26px', height: '26px', borderRadius: '50%',
            background: '#156082', color: 'white',
            fontSize: '10px', fontWeight: '700',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {initials(userName)}
          </div>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#1E293B', whiteSpace: 'nowrap' }}>
            {userName}
          </span>
        </div>
      )}
    </>
  )
}
