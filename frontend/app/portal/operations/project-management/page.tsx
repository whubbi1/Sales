'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredPortalUser } from '@/lib/portalAuth'
import { pmAPI } from '@/lib/api'

export default function PortalOperationsPickerPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[] | null>(null)

  useEffect(() => {
    if (!getStoredPortalUser()) {
      router.replace('/portal/login')
      return
    }
    pmAPI.listProjects()
      .then((list: any[]) => {
        if (list.length === 0) { router.replace('/portal/home'); return }
        if (list.length === 1) { router.replace(`/portal/operations/project-management/${list[0].id}`); return }
        setProjects(list)
      })
      .catch(() => router.replace('/portal/home'))
  }, [router])

  if (!projects) {
    return <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontFamily: 'Montserrat, sans-serif', fontSize: '13px' }}>Loading…</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ background: '#156082', padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: 'white', fontSize: '15px', fontWeight: 800 }}>Operations</div>
        <img src="/wcomply-logo.png" alt="WCOMPLY" style={{ height: '40px', objectFit: 'contain' }} />
      </div>

      <div style={{ padding: '32px 40px', maxWidth: '640px', margin: '0 auto' }}>
        <button onClick={() => router.push('/portal/home')}
          style={{ background: 'none', border: 'none', color: '#156082', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: '16px' }}>
          ← Back
        </button>

        <div style={{ display: 'grid', gap: '12px' }}>
          {projects.map(p => (
            <button key={p.id} onClick={() => router.push(`/portal/operations/project-management/${p.id}`)}
              style={{ textAlign: 'left', background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '18px 20px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', fontFamily: 'Montserrat, sans-serif' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#156082' }}>{p.project_name}</div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>{p.project_number}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
