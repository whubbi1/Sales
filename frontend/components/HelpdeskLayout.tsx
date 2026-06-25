'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { signOut } from 'aws-amplify/auth'
import { fetchUserAttributes } from 'aws-amplify/auth'

const API = 'https://api.whubbi.wcomply.com'

interface NavItem {
  href: string
  label: string
  icon: string
  roles: string[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/helpdesk',                label: 'Dashboard',       icon: '📊', roles: ['end_user','helpdesk_user','administrator'] },
  { href: '/helpdesk/tickets/new',    label: 'Create Ticket',   icon: '✏️', roles: ['end_user','helpdesk_user','administrator'] },
  { href: '/helpdesk/tickets/mine',   label: 'My Tickets',      icon: '🎫', roles: ['end_user','helpdesk_user','administrator'] },
  { href: '/helpdesk/tickets',        label: 'All Tickets',     icon: '📂', roles: ['helpdesk_user','administrator'] },
  { href: '/helpdesk/tickets/assigned', label: 'Assigned to Me', icon: '👤', roles: ['helpdesk_user','administrator'] },
  { href: '/helpdesk/reporting',      label: 'Reporting',       icon: '📈', roles: ['helpdesk_user','administrator'] },
  { href: '/helpdesk/knowledge',      label: 'Knowledge Base',  icon: '📚', roles: ['end_user','helpdesk_user','administrator'] },
  { href: '/helpdesk/admin',          label: 'Administration',  icon: '⚙️', roles: ['administrator'] },
]

interface Props { children: React.ReactNode }

export default function HelpdeskLayout({ children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [role, setRole] = useState<string>('end_user')
  const [userEmail, setUserEmail] = useState<string>('')
  const [userName, setUserName] = useState<string>('')

  useEffect(() => {
    const init = async () => {
      try {
        const attrs = await fetchUserAttributes()
        const email = attrs.email || ''
        const name  = attrs.name || `${attrs.given_name || ''} ${attrs.family_name || ''}`.trim()
        setUserEmail(email)
        setUserName(name || email.split('@')[0])

        // Get helpdesk role
        if (email) {
          const r = await fetch(`${API}/helpdesk/users/${encodeURIComponent(email)}/role`)
          const d = await r.json()
          setRole(d.role || 'end_user')
        }
      } catch {}
    }
    init()
  }, [])

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth/login')
  }

  const visible = NAV_ITEMS.filter(item => item.roles.includes(role))

  const isActive = (href: string) => {
    if (href === '/helpdesk') return pathname === '/helpdesk'
    return pathname.startsWith(href)
  }

  const ROLE_LABEL: Record<string,{label:string;color:string}> = {
    end_user:       { label: 'End User',       color: '#45B6E4' },
    helpdesk_user:  { label: 'Helpdesk Agent', color: '#156082' },
    administrator:  { label: 'Administrator',  color: '#e97132' },
  }
  const roleInfo = ROLE_LABEL[role] || ROLE_LABEL.end_user

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Montserrat, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{ width: '220px', minHeight: '100vh', background: '#156082', position: 'fixed', left: 0, top: 0, zIndex: 100, display: 'flex', flexDirection: 'column' }}>
        {/* Logo & module */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <img src="/logo.png" alt="WHUBBI" style={{ width: '90px', height: '36px', objectFit: 'contain' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '16px' }}>🎧</span>
            <span style={{ color: 'white', fontSize: '12px', fontWeight: '800', letterSpacing: '0.05em' }}>HELPDESK</span>
          </div>
        </div>

        {/* User info */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'white', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
          <span style={{ background: roleInfo.color + '30', color: roleInfo.color, padding: '2px 7px', borderRadius: '8px', fontSize: '10px', fontWeight: '700' }}>{roleInfo.label}</span>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '8px' }}>
          {visible.map(item => {
            const active = isActive(item.href)
            return (
              <button key={item.href} onClick={() => router.push(item.href)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 11px', borderRadius: '6px', marginBottom: '1px', color: active ? 'white' : 'rgba(255,255,255,0.55)', background: active ? 'rgba(255,255,255,0.12)' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: active ? '600' : '400', fontFamily: 'Montserrat, sans-serif', textAlign: 'left' as const, transition: 'all 0.12s' }}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Back to modules + sign out */}
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

      {/* Main content */}
      <main style={{ marginLeft: '220px', flex: 1, minHeight: '100vh', background: '#F5F7FA' }}>
        {children}
      </main>
    </div>
  )
}
