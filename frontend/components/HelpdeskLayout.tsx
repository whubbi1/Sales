'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { getStoredUser, clearStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

interface NavItem { href: string; label: string; icon: string; roles: string[] }

const NAV_ITEMS: NavItem[] = [
  { href: '/helpdesk',                  label: 'Dashboard',       icon: '📊', roles: ['end_user','helpdesk_user','administrator'] },
  { href: '/helpdesk/tickets?mine=1',   label: 'My Tickets',      icon: '🎫', roles: ['end_user','helpdesk_user','administrator'] },
  { href: '/helpdesk/tickets',          label: 'All Tickets',     icon: '📂', roles: ['helpdesk_user','administrator'] },
  { href: '/helpdesk/tickets/assigned',   label: 'Assigned to Me',    icon: '👤', roles: ['helpdesk_user','administrator'] },
  { href: '/helpdesk/ticket-reporting',  label: 'Ticket Reporting',  icon: '📋', roles: ['end_user','helpdesk_user','administrator'] },
  { href: '/helpdesk/reporting',         label: 'Analytics',         icon: '📈', roles: ['helpdesk_user','administrator'] },
  { href: '/helpdesk/knowledge',        label: 'Knowledge Base',  icon: '📚', roles: ['end_user','helpdesk_user','administrator'] },
  { href: '/helpdesk/it-admin',         label: 'IT Admin Cockpit',icon: '🔧', roles: ['helpdesk_user','administrator'] },
  { href: '/helpdesk/admin',            label: 'Administration',  icon: '⚙️', roles: ['administrator'] },
]

interface Props { children: React.ReactNode }

export default function HelpdeskLayout({ children }: Props) {
  const router      = useRouter()
  const pathname    = usePathname()
  const redirecting = useRef(false)
  const [role,      setRole]      = useState<string>('end_user')
  const [userEmail, setUserEmail] = useState<string>('')
  const [userName,  setUserName]  = useState<string>('')

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
    fetch(`${API}/helpdesk/users/${encodeURIComponent(user.email)}/role`)
      .then(r => r.json())
      .then(d => setRole(d.role || 'end_user'))
      .catch(() => {})
  }, [])

  const handleSignOut = () => {
    clearStoredUser()
    router.push('/auth/login')
  }

  const visible = NAV_ITEMS.filter(item => item.roles.includes(role))
  const isActive = (href: string) => {
    const hrefPath = href.split('?')[0]
    return hrefPath === '/helpdesk' ? pathname === '/helpdesk' : pathname.startsWith(hrefPath)
  }

  const ROLE_LABEL: Record<string, { label: string; color: string }> = {
    end_user:      { label: 'End User',       color: '#45B6E4' },
    helpdesk_user: { label: 'Helpdesk Agent', color: '#156082' },
    administrator: { label: 'Administrator',  color: '#e97132' },
  }
  const roleInfo = ROLE_LABEL[role] || ROLE_LABEL.end_user

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Montserrat, sans-serif' }}>
      <aside style={{ width: '220px', minHeight: '100vh', background: '#156082', position: 'fixed', left: 0, top: 0, zIndex: 100, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <img src="/logo.png" alt="WHUBBI" style={{ width: '90px', height: '36px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '16px' }}>🎧</span>
            <span style={{ color: 'white', fontSize: '12px', fontWeight: '800', letterSpacing: '0.05em' }}>HELPDESK</span>
          </div>
        </div>


        <nav style={{ flex: 1, padding: '8px' }}>
          {visible.map(item => {
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

      <main style={{ marginLeft: '220px', flex: 1, minHeight: '100vh', background: '#F5F7FA' }}>
        {children}
      </main>
    </div>
  )
}
