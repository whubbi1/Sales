'use client'
import { useRouter, usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { getStoredUser, clearStoredUser } from '@/lib/auth'
import { EasyAccessMenu } from '@/components/shared/EasyAccessMenu'

const API = 'https://api.whubbi.wcomply.com'

const NAV = [
  { href: '/reporting/reports', icon: '📊', label: 'Reports' },
  { href: '/reporting/dashboards', icon: '🗂️', label: 'Dashboards' },
]

type PermLevel = 'loading' | 'none' | 'view' | 'edit'
type ReportingPerms = Record<string, { access_mode?: string; id?: string | null }> | null
const ReportingPermContext = createContext<ReportingPerms>(null)

export function useReportingPerm(submodule: string): { level: PermLevel; canEdit: boolean } {
  const perms = useContext(ReportingPermContext)
  if (perms === null) return { level: 'loading', canEdit: false }
  const p = perms[submodule]
  if (!p || p.id == null) return { level: 'edit', canEdit: true }
  const level = (p.access_mode as PermLevel) || 'none'
  return { level, canEdit: level === 'edit' }
}

export function ReportingLayout({ children }: { children: React.ReactNode }) {
  const router      = useRouter()
  const path        = usePathname()
  const redirecting = useRef(false)
  const [userEmail, setUserEmail] = useState('')
  const [userName,  setUserName]  = useState('')
  const [perms, setPerms]         = useState<ReportingPerms>(null)

  useEffect(() => {
    const user = getStoredUser()
    if (!user) {
      if (redirecting.current) return
      redirecting.current = true
      localStorage.setItem('redirectAfterLogin', window.location.pathname)
      router.push('/auth/login')
      return
    }
    setUserEmail(user.email)
    setUserName(user.name)

    fetch(`${API}/settings/permissions/${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(d => setPerms(d.permissions?.reporting || {}))
      .catch(() => setPerms({}))
  }, [])

  const handleSignOut = () => {
    clearStoredUser()
    router.push('/auth/login')
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
    padding: '9px 12px', borderRadius: '8px', marginBottom: '2px',
    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
    color: active ? 'white' : 'rgba(255,255,255,0.6)',
    fontSize: '12px', fontWeight: active ? '700' : '500',
    border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
    textAlign: 'left' as const,
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ width: '220px', background: '#3D2A6D', position: 'fixed', top: 0, left: 0, height: '100vh', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px' }}>
            <span style={{ fontSize: '18px' }}>📊</span>
            <span style={{ color: 'white', fontSize: '13px', fontWeight: '800', letterSpacing: '0.05em' }}>REPORTING</span>
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '500' }}>Reports & dashboards</div>
        </div>

        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          <EasyAccessMenu />
          {NAV.map(item => {
            const active = path === item.href || path.startsWith(item.href + '/')
            return (
              <button key={item.href} onClick={() => router.push(item.href)} style={btnStyle(active)}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>{item.icon}</span>
                {item.label}
                {active && <div style={{ marginLeft: 'auto', width: '4px', height: '4px', borderRadius: '50%', background: '#C4B5FD', flexShrink: 0 }} />}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {userEmail && (
            <div style={{ padding: '8px 12px', marginBottom: '6px', borderRadius: '8px', background: 'rgba(0,0,0,0.15)' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
            </div>
          )}
          <button onClick={() => router.push('/home')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', color: 'rgba(255,255,255,0.55)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'Montserrat, sans-serif', textAlign: 'left' }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            All Modules
          </button>
          <button onClick={handleSignOut}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', color: 'rgba(255,255,255,0.55)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'Montserrat, sans-serif', textAlign: 'left' }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign out
          </button>
        </div>
      </div>

      <main style={{ marginLeft: '220px', width: 'calc(100vw - 220px)', background: '#F5F7FA', minHeight: '100vh', overflowX: 'hidden' }}>
        <ReportingPermContext.Provider value={perms}>
          {children}
        </ReportingPermContext.Provider>
      </main>
    </div>
  )
}
