'use client'
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getStoredUser, clearStoredUser } from '@/lib/auth'
import { EasyAccessMenu } from '@/components/shared/EasyAccessMenu'

const API = 'https://api.whubbi.wcomply.com'

type PermLevel = 'loading' | 'none' | 'view' | 'edit'

interface TrainingPermCtx { canEdit: boolean }
export const TrainingPermContext = createContext<TrainingPermCtx>({ canEdit: false })
export const useTrainingPerm = () => useContext(TrainingPermContext)

const NAV_ITEMS = [
  { href: '/training',             label: 'Dashboard',            icon: '🏠' },
  { href: '/training/catalogue',   label: 'Training Catalogue',   icon: '📚' },
  { href: '/training/plans',       label: 'Training Plans',       icon: '🗂️' },
  { href: '/training/assignments', label: 'Training Assignments', icon: '📋' },
  { href: '/training/execution',   label: 'Training Execution',   icon: '✅' },
]

export default function TrainingLayout({ children }: { children: React.ReactNode }) {
  const router      = useRouter()
  const pathname    = usePathname()
  const redirecting = useRef(false)
  const [permLevel, setPermLevel] = useState<PermLevel>('loading')
  const [userName,  setUserName]  = useState('')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    const user = getStoredUser()
    if (!user) {
      if (redirecting.current) return
      redirecting.current = true
      localStorage.setItem('redirectAfterLogin', window.location.pathname)
      router.push('/auth/login')
      return
    }
    setUserName(user.name || user.email)
    setUserEmail(user.email)

    fetch(`${API}/settings/permissions/${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(d => {
        const p = d.permissions?.training?.manager
        setPermLevel((p?.access_mode as PermLevel) || 'none')
      })
      .catch(() => setPermLevel('none'))
  }, [])

  const handleSignOut = () => { clearStoredUser(); router.push('/auth/login') }
  const isActive = (href: string) => pathname === href || (href !== '/training' && pathname.startsWith(href + '/'))

  const sidebar = (
    <aside style={{ width: '220px', minHeight: '100vh', background: '#156082', position: 'fixed', left: 0, top: 0, zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '16px' }}>🎓</span>
          <span style={{ color: 'white', fontSize: '12px', fontWeight: '800', letterSpacing: '0.05em' }}>TRAINING</span>
        </div>
      </div>

      <div style={{ padding: '8px 8px 4px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <EasyAccessMenu />
      </div>

      <nav style={{ flex: 1, padding: '8px' }}>
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href)
          return (
            <button key={item.href} onClick={() => router.push(item.href)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 11px', borderRadius: '6px', marginBottom: '1px', color: active ? 'white' : 'rgba(255,255,255,0.55)', background: active ? 'rgba(255,255,255,0.12)' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: active ? '600' : '400', fontFamily: 'Montserrat, sans-serif', textAlign: 'left' as const }}>
              <span style={{ fontSize: '14px', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </nav>

      <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {userEmail && (
          <div style={{ padding: '8px 12px', marginBottom: '6px', borderRadius: '8px', background: 'rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
          </div>
        )}
        <button onClick={() => router.push('/home')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 11px', borderRadius: '6px', color: 'rgba(255,255,255,0.45)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'Montserrat, sans-serif', textAlign: 'left' as const }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          All Modules
        </button>
        <button onClick={handleSignOut} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 11px', borderRadius: '6px', color: 'rgba(255,255,255,0.45)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'Montserrat, sans-serif', textAlign: 'left' as const }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </button>
      </div>
    </aside>
  )

  if (permLevel === 'loading') return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Montserrat, sans-serif' }}>
      {sidebar}
      <main style={{ marginLeft: '220px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F7FA' }}>
        <div style={{ color: '#156082', fontSize: '14px' }}>Loading…</div>
      </main>
    </div>
  )

  if (permLevel === 'none') return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Montserrat, sans-serif' }}>
      {sidebar}
      <main style={{ marginLeft: '220px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F7FA' }}>
        <div style={{ textAlign: 'center', color: '#94A3B8' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
          <p style={{ fontSize: '13px', margin: '0 0 20px' }}>You don't have permission to access the Training module. Ask a Training Manager to grant access via HR Permissions.</p>
          <button onClick={() => router.push('/home')} style={{ padding: '10px 24px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontWeight: '700', fontSize: '13px' }}>
            Go Home
          </button>
        </div>
      </main>
    </div>
  )

  return (
    <TrainingPermContext.Provider value={{ canEdit: permLevel === 'edit' }}>
      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Montserrat, sans-serif' }}>
        {sidebar}
        <main style={{ marginLeft: '220px', flex: 1, minHeight: '100vh', background: '#F5F7FA' }}>
          {children}
        </main>
      </div>
    </TrainingPermContext.Provider>
  )
}
