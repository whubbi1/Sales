'use client'
// app/dashboard/page.tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'

export default function DashboardPage() {
  const router = useRouter()
  const [stats] = useState([
    { label: 'Companies', value: '—', icon: '🏢', href: '/companies', color: '#144766' },
    { label: 'Contacts', value: '—', icon: '👥', href: '/contacts', color: '#219BD6' },
    { label: 'Opportunities', value: '—', icon: '💼', href: '/opportunities', color: '#e97132' },
    { label: 'Tasks', value: '—', icon: '✓', href: '/tasks', color: '#059669' },
  ])

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '32px 36px' }}>

          {/* Header */}
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#144766', marginBottom: '4px', fontFamily: 'Montserrat, sans-serif' }}>
              Welcome to WHUBBI
            </h1>
            <p style={{ fontSize: '13px', color: '#9B9B9B', fontFamily: 'Montserrat, sans-serif' }}>
              Your commercial management platform
            </p>
          </div>

          {/* Stats cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
            {stats.map(stat => (
              <div key={stat.label} onClick={() => router.push(stat.href)} style={{
                background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7',
                padding: '20px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'box-shadow 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ fontSize: '28px' }}>{stat.icon}</div>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: stat.color }} />
                </div>
                <div style={{ fontSize: '28px', fontWeight: '800', color: stat.color, fontFamily: 'Montserrat, sans-serif', marginBottom: '4px' }}>{stat.value}</div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#9B9B9B', fontFamily: 'Montserrat, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#144766', marginBottom: '16px', fontFamily: 'Montserrat, sans-serif' }}>Quick Actions</h2>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {[
                { label: 'New Company', href: '/companies', color: '#144766' },
                { label: 'New Contact', href: '/contacts', color: '#219BD6' },
                { label: 'New Opportunity', href: '/opportunities', color: '#e97132' },
              ].map(action => (
                <button key={action.label} onClick={() => router.push(action.href)} style={{
                  padding: '9px 18px', borderRadius: '8px', border: 'none',
                  background: action.color, color: 'white',
                  fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif',
                  cursor: 'pointer', transition: 'opacity 0.12s'
                }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  + {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
