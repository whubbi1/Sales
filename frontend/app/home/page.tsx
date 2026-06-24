'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const MODULES = [
  {
    id: 'sales',
    title: 'Sales',
    description: 'Manage companies, contacts and opportunities. Track your pipeline and commercial activity.',
    icon: '💼',
    href: '/dashboard',
    color: '#144766',
    available: true,
  },
  {
    id: 'rh',
    title: 'Human Resources',
    description: 'Manage employees, contracts, onboarding and HR processes.',
    icon: '👥',
    href: '/rh',
    color: '#7C3AED',
    available: false,
  },
  {
    id: 'grc',
    title: 'GRC',
    description: 'Governance, Risk and Compliance. Manage audits, risks and regulatory frameworks.',
    icon: '🛡️',
    href: '/grc',
    color: '#059669',
    available: false,
  },
  {
    id: 'it',
    title: 'IT',
    description: 'IT asset management, incidents, access control and infrastructure monitoring.',
    icon: '🖥️',
    href: '/it',
    color: '#0284C7',
    available: false,
  },
  {
    id: 'admin',
    title: 'Admin Cockpit',
    description: 'Service health, cost tracking, error logs and system administration.',
    icon: '⚙️',
    href: '/admin',
    color: '#e97132',
    available: false,
  },
]

export default function HomePage() {
  const router = useRouter()
  const [backendStatus, setBackendStatus] = useState<'checking' | 'up' | 'down'>('checking')

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('https://api.whubbi.wcomply.com/health', { signal: AbortSignal.timeout(5000) })
        setBackendStatus(res.ok ? 'up' : 'down')
      } catch {
        setBackendStatus('down')
      }
    }
    checkBackend()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#144766', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src="/logo.png" alt="WHUBBI" style={{ height: '36px', objectFit: 'contain' }} />
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '20px' }}>|</span>
          <span style={{ color: 'white', fontSize: '13px', fontWeight: '600', letterSpacing: '0.05em' }}>PLATFORM</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: backendStatus === 'up' ? '#10B981' : backendStatus === 'down' ? '#EF4444' : '#F59E0B' }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
            {backendStatus === 'up' ? 'All systems operational' : backendStatus === 'down' ? 'Backend unavailable' : 'Checking...'}
          </span>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #0d3352 0%, #144766 100%)', padding: '48px 40px', color: 'white' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', margin: 0, marginBottom: '8px', letterSpacing: '-0.01em' }}>Welcome to WHUBBI</h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', margin: 0 }}>Select a module to get started</p>
      </div>

      {/* Module cards */}
      <div style={{ padding: '40px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {MODULES.map(mod => (
            <div
              key={mod.id}
              onClick={() => mod.available && router.push(mod.href)}
              style={{
                background: 'white',
                borderRadius: '14px',
                border: `1px solid ${mod.available ? '#EDF2F7' : '#F1F5F9'}`,
                padding: '28px',
                cursor: mod.available ? 'pointer' : 'default',
                opacity: mod.available ? 1 : 0.65,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'all 0.15s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => { if (mod.available) { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)' }}}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none' }}
            >
              {/* Color accent bar */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: mod.color, borderRadius: '14px 14px 0 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: mod.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                  {mod.icon}
                </div>
                {!mod.available && (
                  <span style={{ background: '#F1F5F9', color: '#9B9B9B', padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Coming Soon
                  </span>
                )}
                {mod.available && (
                  <span style={{ background: mod.color + '15', color: mod.color, padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Active
                  </span>
                )}
              </div>

              <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#144766', margin: '0 0 8px', letterSpacing: '-0.01em' }}>{mod.title}</h2>
              <p style={{ fontSize: '12px', color: '#9B9B9B', margin: 0, lineHeight: '1.6' }}>{mod.description}</p>

              {mod.available && (
                <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '6px', color: mod.color, fontSize: '12px', fontWeight: '700' }}>
                  Open module
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
