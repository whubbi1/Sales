'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { getStoredUser, clearStoredUser } from '@/lib/auth'
import { lookupPerm, ModulePerms, PermLevel, useModulePerms } from '@/lib/permissions'
import { EasyAccessMenu } from '@/components/shared/EasyAccessMenu'

const NAV = [
  { href: '/operations/projects', icon: '📁', label: 'Contract Management', submodule: 'projects' },
  { href: '/operations/project-management', icon: '🗂️', label: 'Project Management', submodule: 'project_management' },
  { href: '/operations/internal-projects', icon: '🏠', label: 'Internal Projects', submodule: 'internal_projects' },
  { href: '/operations/licenses', icon: '🔑', label: 'License Management', submodule: 'licenses' },
  { href: '/operations/staffing', icon: '👥', label: 'Staffing', submodule: 'staffing' },
  { href: '/operations/timesheets', icon: '🕒', label: 'Timesheets', submodule: 'timesheets' },
  { href: '/operations/project-defaults', icon: '⚙️', label: 'Project Defaults', submodule: 'project_defaults' },
]

type OperationsPerms = ModulePerms

export function useOperationsPerm(submodule: string): { level: PermLevel; canEdit: boolean } {
  const perms = useModulePerms('operations')
  return lookupPerm(perms, submodule)
}

export function OperationsLayout({ children }: { children: React.ReactNode }) {
  const router      = useRouter()
  const path        = usePathname()
  const redirecting = useRef(false)
  const [userEmail, setUserEmail] = useState('')
  const [userName,  setUserName]  = useState('')
  const perms = useModulePerms('operations')

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
      <div style={{ width: '220px', background: '#156082', position: 'fixed', top: 0, left: 0, height: '100vh', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px' }}>
            <span style={{ fontSize: '18px' }}>🛠️</span>
            <span style={{ color: 'white', fontSize: '13px', fontWeight: '800', letterSpacing: '0.05em' }}>OPERATIONS</span>
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '500' }}>Projects, licenses & staffing</div>
        </div>

        <div style={{ padding: '10px 8px 6px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <EasyAccessMenu />
        </div>

        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          {NAV.filter(item => lookupPerm(perms, item.submodule).level !== 'none').map(item => {
            const active = path === item.href || path.startsWith(item.href + '/')
            return (
              <button key={item.href} onClick={() => router.push(item.href)} style={btnStyle(active)}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>{item.icon}</span>
                {item.label}
                {active && <div style={{ marginLeft: 'auto', width: '4px', height: '4px', borderRadius: '50%', background: '#45B6E4', flexShrink: 0 }} />}
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
          <OperationsRouteGate perms={perms} path={path}>{children}</OperationsRouteGate>
      </main>
    </div>
  )
}

function OperationsRouteGate({ perms, path, children }: { perms: OperationsPerms; path: string; children: React.ReactNode }) {
  const matched = NAV
    .filter(item => path === item.href || path.startsWith(item.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]
  if (!matched) return <>{children}</>
  const { level } = lookupPerm(perms, matched.submodule)
  if (level === 'loading') {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4', fontSize: '13px' }}>Loading…</div>
  }
  if (level === 'none') {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🚫</div>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#3F3F3F', marginBottom: '4px' }}>Access Denied</div>
        <div style={{ fontSize: '12px', color: '#94A3B8' }}>You don't have access to this section. Contact your administrator if you believe this is a mistake.</div>
      </div>
    )
  }
  return <>{children}</>
}
