'use client'
import { useRouter, usePathname } from 'next/navigation'
import { clearStoredPortalUser } from '@/lib/portalAuth'

export interface PortalNavItem { href: string; label: string; icon: string }

interface Props {
  moduleLabel: string
  moduleIcon: string
  navItems: PortalNavItem[]
  children: React.ReactNode
}

export default function PortalModuleLayout({ moduleLabel, moduleIcon, navItems, children }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const handleSignOut = () => {
    clearStoredPortalUser()
    router.push('/portal/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Montserrat, sans-serif' }}>
      <aside style={{ width: '220px', minHeight: '100vh', background: '#156082', position: 'fixed', left: 0, top: 0, zIndex: 100, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <img src="/logo.png" alt="WHUBBI" style={{ width: '90px', height: '36px', objectFit: 'contain', filter: 'brightness(0) invert(1)', marginBottom: '10px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '16px' }}>{moduleIcon}</span>
            <span style={{ color: 'white', fontSize: '12px', fontWeight: 800, letterSpacing: '0.05em' }}>{moduleLabel.toUpperCase()}</span>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '8px' }}>
          {navItems.map(item => {
            const active = isActive(item.href)
            return (
              <button key={item.href} onClick={() => router.push(item.href)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 11px', borderRadius: '6px', marginBottom: '1px', color: active ? 'white' : 'rgba(255,255,255,0.55)', background: active ? 'rgba(255,255,255,0.12)' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: active ? 600 : 400, fontFamily: 'Montserrat, sans-serif', textAlign: 'left' as const }}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button onClick={() => router.push('/portal/home')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 11px', borderRadius: '6px', color: 'rgba(255,255,255,0.45)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'Montserrat, sans-serif', textAlign: 'left' as const }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
            All Modules
          </button>
          <button onClick={handleSignOut} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 11px', borderRadius: '6px', color: 'rgba(255,255,255,0.45)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'Montserrat, sans-serif', textAlign: 'left' as const }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            Sign out
          </button>
        </div>
      </aside>

      <div style={{ marginLeft: '220px', flex: 1, minHeight: '100vh', background: '#F5F7FA' }}>
        <div style={{ background: '#156082', padding: '12px 32px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <img src="/wcomply-logo.png" alt="WCOMPLY" style={{ height: '24px', objectFit: 'contain' }} />
        </div>
        <main>{children}</main>
      </div>
    </div>
  )
}
