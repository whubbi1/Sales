'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { signOut } from 'aws-amplify/auth'
import { getStoredUser } from '@/lib/auth'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { href: '/companies', label: 'Companies', icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { href: '/contacts', label: 'Contacts', icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { href: '/opportunities', label: 'Opportunities', icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
  { href: '/partners', label: 'Partners', icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 3.87 3.72"/><path d="M22 21v-2a4 4 0 0 0-2.24-3.6"/><circle cx="18" cy="7" r="3"/></svg> },
  { href: '/tasks', label: 'Tasks', icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
  { href: '/staffing', label: 'Staffing', icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></svg> },
  { href: '/cv-database', label: 'CV Database', icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const redirecting = useRef(false)

  // getStoredUser() returns null both when nobody's logged in and when the session's JWT has
  // expired (it silently clears the stored session in that case) — without this redirect, pages
  // using this sidebar kept rendering with an empty userEmail forever, breaking every feature
  // keyed on it (e.g. per-user report view persistence) with no indication anything was wrong.
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
  }, [])

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth/login')
  }

  return (
    <aside style={{ width: '220px', minHeight: '100vh', background: '#156082', position: 'fixed', left: 0, top: 0, zIndex: 100, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Module label */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)' }}>Sales</span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 8px' }}>
        {navItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 11px', borderRadius: '6px', marginBottom: '1px', color: active ? 'white' : 'rgba(255,255,255,0.55)', background: active ? 'rgba(255,255,255,0.12)' : 'transparent', textDecoration: 'none', fontSize: '12.5px', fontWeight: active ? '600' : '400', transition: 'all 0.12s', letterSpacing: '0.01em' }}>
              {item.icon}{item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: user info, All Modules, Sign out */}
      <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {userEmail && (
          <div style={{ padding: '8px 12px', marginBottom: '6px', borderRadius: '8px', background: 'rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
          </div>
        )}
        <button onClick={() => router.push('/home')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 11px', borderRadius: '6px', color: 'rgba(255,255,255,0.45)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontFamily: 'Montserrat, sans-serif' }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          All Modules
        </button>
        <button onClick={handleSignOut} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 11px', borderRadius: '6px', color: 'rgba(255,255,255,0.45)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontFamily: 'Montserrat, sans-serif' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </button>
      </div>
    </aside>
  )
}
