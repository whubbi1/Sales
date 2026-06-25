'use client'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'

interface Props { role?: string }

export default function HelpdeskSidebar({ role = 'end_user' }: Props) {
  const router = useRouter()
  const path = usePathname()

  const items = [
    { href: '/helpdesk/tickets/new', label: '+ Create Ticket', icon: '✏️', roles: ['end_user','helpdesk_user','administrator'] },
    { href: '/helpdesk/tickets',     label: 'My Tickets',      icon: '🎫', roles: ['end_user','helpdesk_user','administrator'] },
    { href: '/helpdesk/tickets/all', label: 'All Tickets',     icon: '📂', roles: ['helpdesk_user','administrator'] },
    { href: '/helpdesk/tickets/assigned', label: 'Assigned to Me', icon: '👤', roles: ['helpdesk_user','administrator'] },
    { href: '/helpdesk/knowledge',   label: 'Knowledge Base',  icon: '📚', roles: ['end_user','helpdesk_user','administrator'] },
    { href: '/helpdesk/reporting',   label: 'Reports',         icon: '📊', roles: ['helpdesk_user','administrator'] },
    { href: '/helpdesk/admin',       label: 'Administration',  icon: '⚙️', roles: ['administrator'] },
  ]

  const visible = items.filter(i => i.roles.includes(role))

  return (
    <div style={{ width: '200px', minHeight: '100vh', background: '#0f3a52', position: 'fixed', left: '220px', top: 0, zIndex: 90, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ padding: '16px 14px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🎧</span>
          <span style={{ color: 'white', fontSize: '12px', fontWeight: '800', fontFamily: 'Montserrat, sans-serif' }}>Helpdesk</span>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '8px 8px' }}>
        {visible.map(item => {
          const active = path === item.href || path.startsWith(item.href + '/')
          return (
            <button key={item.href} onClick={() => router.push(item.href)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', marginBottom: '1px', color: active ? 'white' : 'rgba(255,255,255,0.55)', background: active ? 'rgba(255,255,255,0.12)' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: active ? '600' : '400', fontFamily: 'Montserrat, sans-serif', textAlign: 'left' as const }}>
              <span style={{ fontSize: '14px' }}>{item.icon}</span>{item.label}
            </button>
          )
        })}
      </nav>
      <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => router.push('/home')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '6px', color: 'rgba(255,255,255,0.45)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '11px', fontFamily: 'Montserrat, sans-serif' }}>
          ← All Modules
        </button>
      </div>
    </div>
  )
}
