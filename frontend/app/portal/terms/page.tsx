'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredPortalUser, setStoredPortalUser, portalApiFetch, portalApiJson } from '@/lib/portalAuth'

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}

export default function PortalTermsPage() {
  const router = useRouter()
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getStoredPortalUser()
    if (!user) {
      router.replace('/portal/login')
      return
    }
    setAcceptedAt(user.terms_accepted_at)
    setLoading(false)
  }, [router])

  const accept = async () => {
    setAccepting(true)
    setError('')
    try {
      const res = await portalApiJson<{ terms_accepted_at: string }>('/portal/partner/accept-terms', { method: 'POST' })
      const user = getStoredPortalUser()
      if (user) setStoredPortalUser({ ...user, terms_accepted_at: res.terms_accepted_at })
      router.replace('/portal/home')
    } catch {
      setError('Could not record your acceptance. Please try again.')
      setAccepting(false)
    }
  }

  const downloadPdf = async () => {
    setDownloading(true)
    try {
      const res = await portalApiFetch('/portal/partner/terms/pdf')
      if (!res.ok) throw new Error()
      downloadBlob(await res.blob(), 'WCOMPLY_Portal_Terms_and_Conditions.pdf')
    } catch {
      setError('Could not download the PDF.')
    }
    setDownloading(false)
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontFamily: 'Montserrat, sans-serif', fontSize: '13px' }}>Loading…</div>
  }

  const mandatory = !acceptedAt

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ background: '#156082', padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: 'white', fontSize: '15px', fontWeight: 800 }}>WCOMPLY PORTAL</div>
        <img src="/wcomply-logo.png" alt="WCOMPLY" style={{ height: '40px', objectFit: 'contain' }} />
      </div>

      <div style={{ padding: '32px 40px', maxWidth: '640px', margin: '0 auto' }}>
        {!mandatory && (
          <button onClick={() => router.push('/portal/home')}
            style={{ background: 'none', border: 'none', color: '#156082', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: '16px' }}>
            ← Back
          </button>
        )}

        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#156082', margin: '0 0 4px' }}>Terms and Conditions of Use</h1>
          {acceptedAt && <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 20px' }}>Accepted on {new Date(acceptedAt).toLocaleDateString()}</p>}

          <div style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.7, margin: acceptedAt ? '0 0 20px' : '20px 0' }}>
            This document is being prepared.
          </div>

          {error && (
            <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, background: '#FEF2F2', color: '#DC2626' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={downloadPdf} disabled={downloading}
              style={{ padding: '11px 22px', background: 'white', color: '#156082', border: '1.5px solid #156082', borderRadius: '10px', fontSize: '13px', fontWeight: 700, fontFamily: 'Montserrat, sans-serif', cursor: downloading ? 'not-allowed' : 'pointer' }}>
              {downloading ? 'Downloading…' : '⬇ Download PDF'}
            </button>
            {mandatory && (
              <button onClick={accept} disabled={accepting}
                style={{ padding: '11px 22px', background: accepting ? '#F5F7FA' : '#156082', color: accepting ? '#848EA5' : 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, fontFamily: 'Montserrat, sans-serif', cursor: accepting ? 'not-allowed' : 'pointer' }}>
                {accepting ? 'Saving…' : 'I Accept'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
