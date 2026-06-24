'use client'
import { useRouter } from 'next/navigation'
export default function Page() {
  const router = useRouter()
  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', flexDirection: 'column', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ background: '#156082', padding: '0 40px', height: '64px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => router.push('/home')} style={{ border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontFamily: 'Montserrat, sans-serif', fontWeight: '600' }}>← Back</button>
        <span style={{ color: 'white', fontSize: '14px', fontWeight: '700' }}>WHUBBI — IT</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🖥️</div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#156082', marginBottom: '12px' }}>IT</h1>
          <p style={{ fontSize: '14px', color: '#848EA5' }}>This module is coming soon.</p>
          <button onClick={() => router.push('/home')} style={{ marginTop: '24px', background: '#156082', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>Back to Home</button>
        </div>
      </div>
    </div>
  )
}
