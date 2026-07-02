'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TrainingLayout from '@/components/TrainingLayout'

const API = 'https://api.whubbi.wcomply.com'

export default function TrainingDashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/training/dashboard-stats`).then(r => r.json()).then(setStats).finally(() => setLoading(false))
  }, [])

  const tiles = [
    { label: 'Assigned Trainings', value: stats?.assigned_count || 0, icon: '📌', color: '#156082', href: '/training/assignments' },
    { label: 'Executed Trainings (last year)', value: stats?.executed_count || 0, icon: '✅', color: '#059669', href: '/training/execution' },
    { label: 'Late Trainings', value: stats?.late_count || 0, icon: '⏰', color: '#DC2626', href: '/training/execution' },
    { label: 'Available Trainings', value: stats?.available_count || 0, icon: '📚', color: '#7C3AED', href: '/training/catalogue' },
  ]

  return (
    <TrainingLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Dashboard</h1>
          <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>Training module overview</p>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px' }}>
            {tiles.map(t => (
              <div key={t.label} onClick={() => router.push(t.href)}
                style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderTop: `3px solid ${t.color}` }}>
                <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '8px' }}>{t.icon} {t.label}</div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: t.color }}>{t.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </TrainingLayout>
  )
}
