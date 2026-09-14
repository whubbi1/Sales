'use client'
import { useRouter, usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { getStoredUser, clearStoredUser } from '@/lib/auth'
import { apiFetch } from '@/lib/apiClient'
import { lookupPerm, ModulePerms, PermLevel } from '@/lib/permissions'
import { EasyAccessMenu } from '@/components/shared/EasyAccessMenu'

// Helpdesk has always had its own internal role tiers (end_user/helpdesk_user/
// administrator, from helpdesk_users.role) layered on top of — this keeps
// that UX distinction (an end_user shouldn't see "All Tickets") but ALSO now
// respects the whubbi_permissions module/submodule grant, same as every other
// module: an admin can revoke someone's helpdesk access entirely via the
// Permissions page even if their helpdesk role would otherwise show it.
interface NavItem { href: string; label: string; icon: string; roles: string[]; submodule: string }

const NAV_ITEMS: NavItem[] = [
  { href: '/helpdesk',                  label: 'Dashboard',       icon: '📊', roles: ['end_user','helpdesk_user','administrator'], submodule: 'tickets' },
  { href: '/helpdesk/tickets?mine=1',   label: 'My Tickets',      icon: '🎫', roles: ['end_user','helpdesk_user','administrator'], submodule: 'tickets' },
  { href: '/helpdesk/tickets',          label: 'All Tickets',     icon: '📂', roles: ['helpdesk_user','administrator'], submodule: 'tickets' },
  { href: '/helpdesk/tickets/assigned',   label: 'Assigned to Me',    icon: '👤', roles: ['helpdesk_user','administrator'], submodule: 'tickets' },
  { href: '/helpdesk/ticket-reporting',  label: 'Ticket Reporting',  icon: '📋', roles: ['end_user','helpdesk_user','administrator'], submodule: 'tickets' },
  { href: '/helpdesk/reporting',         label: 'Analytics',         icon: '📈', roles: ['helpdesk_user','administrator'], submodule: 'admin_cockpit' },
  { href: '/helpdesk/knowledge',        label: 'Knowledge Base',  icon: '📚', roles: ['end_user','helpdesk_user','administrator'], submodule: 'knowledge' },
  { href: '/helpdesk/it-admin',         label: 'Helpdesk Admin Cockpit', icon: '🔧', roles: ['helpdesk_user','administrator'], submodule: 'admin_cockpit' },
  { href: '/helpdesk/admin',            label: 'Administration',  icon: '⚙️', roles: ['administrator'], submodule: 'admin_cockpit' },
]

type HelpdeskPerms = ModulePerms
const HelpdeskPermContext = createContext<HelpdeskPerms>(null)

export function useHelpdeskPerm(submodule: string): { level: PermLevel; canEdit: boolean } {
  const perms = useContext(HelpdeskPermContext)
  return lookupPerm(perms, submodule)
}

interface Props { children: React.ReactNode }

export default function HelpdeskLayout({ children }: Props) {
  const router      = useRouter()
  const pathname    = usePathname()
  const redirecting = useRef(false)
  const [role,      setRole]      = useState<string>('end_user')
  const [userEmail, setUserEmail] = useState<string>('')
  const [userName,  setUserName]  = useState<string>('')
  const [perms,     setPerms]     = useState<HelpdeskPerms>(null)

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
    apiFetch(`/helpdesk/users/${encodeURIComponent(user.email)}/role`)
      .then(r => r.json())
      .then(d => setRole(d.role || 'end_user'))
      .catch(() => {})
    apiFetch(`/settings/permissions/${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(d => setPerms(d.permissions?.helpdesk || {}))
      .catch(() => setPerms({}))
  }, [])

  const handleSignOut = () => {
    clearStoredUser()
    router.push('/auth/login')
  }

  const visible = NAV_ITEMS.filter(item =>
    item.roles.includes(role) && lookupPerm(perms, item.submodule).level !== 'none'
  )
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


        <div style={{ padding: '8px 8px 4px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <EasyAccessMenu />
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

      <main style={{ marginLeft: '220px', flex: 1, minHeight: '100vh', background: '#F5F7FA' }}>
        <HelpdeskPermContext.Provider value={perms}>
          <HelpdeskRouteGate perms={perms} pathname={pathname}>{children}</HelpdeskRouteGate>
        </HelpdeskPermContext.Provider>
      </main>
    </div>
  )
}

function HelpdeskRouteGate({ perms, pathname, children }: { perms: HelpdeskPerms; pathname: string; children: React.ReactNode }) {
  const matched = NAV_ITEMS
    .map(item => ({ ...item, hrefPath: item.href.split('?')[0] }))
    .filter(item => pathname === item.hrefPath || pathname.startsWith(item.hrefPath + '/'))
    .sort((a, b) => b.hrefPath.length - a.hrefPath.length)[0]
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
