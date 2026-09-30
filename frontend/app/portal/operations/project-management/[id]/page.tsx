'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getStoredPortalUser } from '@/lib/portalAuth'
import { recordPortalPageVisit } from '@/lib/portalRecentPages'
import { ProjectManagementContent } from '@/app/operations/project-management/[id]/page'

export default function PortalProjectManagementDetailPage() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!getStoredPortalUser()) router.replace('/portal/login')
  }, [router])

  const handleProjectLoaded = (name: string) => {
    const user = getStoredPortalUser()
    if (user) recordPortalPageVisit(user.email, pathname, `Project: ${name}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA' }}>
      <div style={{ background: '#156082', padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: 'white', fontSize: '15px', fontWeight: 800, fontFamily: 'Montserrat, sans-serif' }}>Operations · Project Management</div>
        <img src="/wcomply-logo.png" alt="WCOMPLY" style={{ height: '40px', objectFit: 'contain' }} />
      </div>
      <ProjectManagementContent backHref="/portal/operations/project-management" onProjectLoaded={handleProjectLoaded} />
    </div>
  )
}
