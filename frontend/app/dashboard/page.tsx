'use client'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { BackendCheck } from '@/components/BackendCheck'

export default function DashboardPage() {
  const router = useRouter()
  return (
    <div style={{ display: 'flex' }}>
      <BackendCheck />
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '32px 36px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#156082', marginBottom: '4px', fontFamily: 'Montserrat, sans-serif' }}>Sales Dashboard</h1>
              <p style={{ fontSize: '13px', color: '#848EA5', fontFamily: 'Montserrat, sans-serif' }}>Commercial management</p>
            </div>
            <button onClick={() => router.push('/home')} style={{ background: 'white', color: '#156082', border: '1.5px solid #848EA5', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
              ← All Modules
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {[
              { label: 'Companies', icon: '🏢', href: '/companies', color: '#156082' },
              { label: 'Contacts', icon: '👤', href: '/contacts', color: '#848EA5' },
              { label: 'Opportunities', icon: '💼', href: '/opportunities', color: '#e97132' },
            ].map(item => (
              <div key={item.label} onClick={() => router.push(item.href)}
                style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.15s', borderTop: `3px solid ${item.color}` }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(21,96,130,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>{item.icon}</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: item.color, fontFamily: 'Montserrat, sans-serif' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
