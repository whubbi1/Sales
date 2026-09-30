'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredPortalUser, clearStoredPortalUser } from '@/lib/portalAuth'
import { portalCognitoSignOut } from '@/lib/portalCognitoAuth'
import { getRecentPortalPages } from '@/lib/portalRecentPages'
import { pmAPI } from '@/lib/api'

interface RecentEntry { href: string; label: string; visitedAt: number }

function fmtRelative(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default function PortalHomePage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [recent, setRecent] = useState<RecentEntry[]>([])
  // Both Operations and Helpdesk are gated on the same signal: does this contact have
  // any PMMember-derived project at all (pmAPI.listProjects() already returns exactly
  // that set for a portal caller).
  const [hasProjectAccess, setHasProjectAccess] = useState(false)

  useEffect(() => {
    const user = getStoredPortalUser()
    if (!user) {
      router.replace('/portal/login')
      return
    }
    if (!user.terms_accepted_at) {
      router.replace('/portal/terms')
      return
    }
    setUserName(user.name || user.email)
    setRecent(getRecentPortalPages(user.email))
    pmAPI.listProjects().then((projects: any[]) => setHasProjectAccess(projects.length > 0)).catch(() => {})
  }, [router])

  // Clears Amplify's own Cognito session too, not just our stored token — otherwise a
  // native email/password user's next sign-in attempt hits UserAlreadyAuthenticatedException.
  const handleSignOut = async () => {
    clearStoredPortalUser()
    await portalCognitoSignOut()
    router.push('/portal/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ background: '#156082', padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: 'white', fontSize: '17px', fontWeight: 800, letterSpacing: '0.04em' }}>WCOMPLY PORTAL</div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', marginTop: '2px' }}>Welcome back{userName ? `, ${userName}` : ''}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <img src="/wcomply-logo.png" alt="WCOMPLY" style={{ height: '40px', objectFit: 'contain' }} />
          <button onClick={handleSignOut}
            style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: '220px 1fr', gap: '28px', alignItems: 'center' }}>

        {/* Last Used — left column, same position/style as the employee home page's Company Links block */}
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'sticky', top: '24px', justifySelf: 'start' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #EDF2F7', background: '#F8FAFC' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4' }}>🕘 Last Used</div>
          </div>
          <div style={{ padding: '8px' }}>
            {recent.length === 0 ? (
              <div style={{ padding: '16px 12px', fontSize: '11px', color: '#94A3B8', textAlign: 'center' as const }}>Nothing visited yet.</div>
            ) : recent.map(entry => (
              <button key={entry.href} onClick={() => router.push(entry.href)}
                style={{ display: 'flex', width: '100%', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', padding: '9px 12px', borderRadius: '8px', textDecoration: 'none', color: '#3F3F3F', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', textAlign: 'left' as const }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F0F7FF')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{entry.label}</span>
                <span style={{ fontSize: '10px', color: '#94A3B8' }}>{fmtRelative(entry.visitedAt)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Modules grid */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 16px' }}>Select a tile to get started.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '18px', maxWidth: '260px' }}>
            <div onClick={() => router.push('/portal/profile')}
              style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#156082' }} />
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#45B6E418', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '14px' }}>⚙️</div>
              <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#156082', margin: '0 0 6px' }}>MyWHUBBI</h2>
              <p style={{ fontSize: '11px', color: '#45B6E4', margin: 0, lineHeight: 1.6 }}>Manage your personal profile information.</p>
              <a href="/portal/terms" onClick={e => e.stopPropagation()} style={{ display: 'inline-block', marginTop: '10px', fontSize: '10px', color: '#156082', fontWeight: 700 }}>Terms &amp; Conditions →</a>
            </div>

            {hasProjectAccess && (
              <div onClick={() => router.push('/portal/operations/project-management')}
                style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#156082' }} />
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#45B6E418', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '14px' }}>🗂️</div>
                <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#156082', margin: '0 0 6px' }}>Operations</h2>
                <p style={{ fontSize: '11px', color: '#45B6E4', margin: 0, lineHeight: 1.6 }}>Project Management for your project(s).</p>
              </div>
            )}

            {hasProjectAccess && (
              <div onClick={() => router.push('/portal/helpdesk')}
                style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#156082' }} />
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#45B6E418', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '14px' }}>🎫</div>
                <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#156082', margin: '0 0 6px' }}>Helpdesk</h2>
                <p style={{ fontSize: '11px', color: '#45B6E4', margin: 0, lineHeight: 1.6 }}>Get support for your project(s).</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
