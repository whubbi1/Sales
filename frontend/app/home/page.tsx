'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const MODULES = [
  { id: 'sales',    title: 'Sales',             description: 'Manage companies, contacts and opportunities. Track your commercial pipeline.',    icon: '💼', href: '/dashboard', color: '#156082', available: true  },
  { id: 'finance',  title: 'Finance',            description: 'Financial management, invoicing, budgets and cash flow monitoring.',               icon: '💰', href: '/finance',   color: '#e97132', available: false },
  { id: 'rh',       title: 'Human Resources',    description: 'Manage employees, contracts, onboarding and HR processes.',                        icon: '👥', href: '/rh',        color: '#45B6E4', available: false },
  { id: 'grc',      title: 'GRC',                description: 'Governance, Risk and Compliance. Manage audits, risks and regulatory frameworks.',  icon: '🛡️', href: '/grc',       color: '#45B6E4', available: false },
  { id: 'it',       title: 'IT',                 description: 'IT asset management, incidents, access control and infrastructure monitoring.',     icon: '🖥️', href: '/it',        color: '#45B6E4', available: false },
  { id: 'helpdesk', title: 'Helpdesk',           description: 'Support tickets, incident tracking and customer service management.',               icon: '🎧', href: '/helpdesk',  color: '#45B6E4', available: false },
  { id: 'settings', title: 'Personal Settings',  description: 'Manage your profile, preferences, notifications and account settings.',            icon: '⚙️', href: '/settings',  color: '#45B6E4', available: false },
  { id: 'admin',    title: 'Admin Cockpit',      description: 'Service health, cost tracking, error logs and system administration.',              icon: '🔧', href: '/admin',     color: '#45B6E4', available: false },
]

export default function HomePage() {
  const router = useRouter()
  const [backendStatus, setBackendStatus] = useState<'checking' | 'up' | 'down'>('checking')

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('https://api.whubbi.wcomply.com/health', { signal: AbortSignal.timeout(5000) })
        setBackendStatus(res.ok ? 'up' : 'down')
      } catch { setBackendStatus('down') }
    }
    check()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#156082', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src="/logo.png" alt="WHUBBI" style={{ height: '36px', objectFit: 'contain' }} />
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '20px' }}>|</span>
          <span style={{ color: 'white', fontSize: '13px', fontWeight: '700', letterSpacing: '0.08em' }}>PLATFORM</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: backendStatus === 'up' ? '#10B981' : backendStatus === 'down' ? '#EF4444' : '#F59E0B' }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: '500' }}>
            {backendStatus === 'up' ? 'All systems operational' : backendStatus === 'down' ? 'Backend unavailable' : 'Checking systems...'}
          </span>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #0a2d40 0%, #156082 100%)', padding: '48px 40px', color: 'white' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', margin: '0 0 8px', letterSpacing: '-0.01em', color: 'white' }}>Welcome to WHUBBI</h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', margin: 0, fontWeight: '400' }}>Select a module to get started</p>
      </div>

      {/* Module grid */}
      <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px' }}>
          {MODULES.map(mod => (
            <div key={mod.id} onClick={() => mod.available && router.push(mod.href)}
              style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', cursor: mod.available ? 'pointer' : 'default', opacity: mod.available ? 1 : 0.75, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.15s', position: 'relative', overflow: 'hidden' }}
              onMouseEnter={e => { if (mod.available) { e.currentTarget.style.boxShadow = '0 8px 24px rgba(21,96,130,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)' }}}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: mod.color }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: mod.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{mod.icon}</div>
                <span style={{ background: mod.available ? mod.color + '15' : '#F1F5F9', color: mod.available ? mod.color : '#45B6E4', padding: '2px 8px', borderRadius: '20px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {mod.available ? 'Active' : 'Soon'}
                </span>
              </div>
              <h2 style={{ fontSize: '13px', fontWeight: '800', color: '#156082', margin: '0 0 6px', letterSpacing: '-0.01em' }}>{mod.title}</h2>
              <p style={{ fontSize: '11px', color: '#45B6E4', margin: 0, lineHeight: '1.6' }}>{mod.description}</p>
              {mod.available && (
                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '5px', color: mod.color, fontSize: '11px', fontWeight: '700' }}>
                  Open
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
