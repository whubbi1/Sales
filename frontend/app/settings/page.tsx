'use client'
import ProfileLayout from '@/components/ProfileLayout'

export default function ProfileDashboardPage() {
  return (
    <ProfileLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Dashboard</h1>
          <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>Your personal overview</p>
        </div>
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '60px 28px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚧</div>
          <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#156082', margin: '0 0 6px' }}>Under construction</h2>
          <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>Your personal dashboard is coming soon.</p>
        </div>
      </div>
    </ProfileLayout>
  )
}
