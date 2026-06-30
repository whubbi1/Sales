'use client'
import { Amplify } from 'aws-amplify'
import { fetchUserAttributes } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { getAmplifyConfig } from '@/lib/amplifyConfig'
import { useEffect, useState } from 'react'

Amplify.configure(getAmplifyConfig())

interface UserInfo { name: string; email: string }

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

export function AmplifyProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)

  const loadUser = async () => {
    try {
      const a = await fetchUserAttributes()
      const email = a.email || ''
      const name  = (a.name || `${a.given_name || ''} ${a.family_name || ''}`.trim()) || email.split('@')[0] || email
      const info  = { name, email }
      setUser(info)
      localStorage.setItem('whubbi_user', JSON.stringify(info))
    } catch {
      // Not authenticated — clear cache but don't redirect here (layouts handle that)
      localStorage.removeItem('whubbi_user')
      setUser(null)
    }
  }

  useEffect(() => {
    // Show cached name instantly while we validate
    const cached = localStorage.getItem('whubbi_user')
    if (cached) {
      try { setUser(JSON.parse(cached)) } catch {}
    }

    loadUser()

    // Refresh user state whenever auth changes (login / logout / token refresh)
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn' || payload.event === 'tokenRefresh') loadUser()
      if (payload.event === 'signedOut') { setUser(null); localStorage.removeItem('whubbi_user') }
    })

    return () => unsubscribe()
  }, [])

  return (
    <>
      {children}
      {user && (
        <div style={{
          position: 'fixed', top: '12px', right: '16px', zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '24px',
          padding: '5px 12px 5px 6px',
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
            {initials(user.name)}
          </div>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#1E293B', whiteSpace: 'nowrap' }}>
            {user.name}
          </span>
        </div>
      )}
    </>
  )
}
