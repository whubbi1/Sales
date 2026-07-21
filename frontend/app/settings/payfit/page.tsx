'use client'
import { useState, useEffect } from 'react'
import ProfileLayout from '@/components/ProfileLayout'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  synced:       { bg: '#ECFDF5', text: '#059669' },
  pending_push: { bg: '#FFF7ED', text: '#D97706' },
  error:        { bg: '#FEF2F2', text: '#DC2626' },
}

export default function PayfitProfilePage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const user = getStoredUser()
    if (user?.email) { setEmail(user.email); load(user.email) }
    else setLoading(false)
  }, [])

  const load = (email: string) => {
    setLoading(true)
    fetch(`${API}/payfit/my/${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ linked: false, collaborator: null, absences: [] }))
      .finally(() => setLoading(false))
  }

  return (
    <ProfileLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>💰 PayFit</h1>
          <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>Your PayFit data, matched by email ({email})</p>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>}

        {!loading && !data?.linked && (
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '48px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>🔍</div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#3F3F3F', marginBottom: '6px' }}>No PayFit record found for {email}</div>
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>
              This shows up once HR has synced collaborators from PayFit and PayFit has a matching email on file for you.
            </p>
          </div>
        )}

        {!loading && data?.linked && (
          <div>
            {/* Identity card */}
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '20px 24px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#156082' }}>{data.collaborator.first_name} {data.collaborator.last_name}</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
                {data.collaborator.email || '—'} · PayFit ID {data.collaborator.payfit_id}
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px' }}>
                Last synced {data.collaborator.synced_at ? new Date(data.collaborator.synced_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
              </div>
            </div>

            {/* Absences */}
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '14px 24px', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#156082' }}>Absences</span>
              </div>
              {data.absences.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>No absences on record.</div>
              ) : (
                data.absences.map((a: any, i: number) => {
                  const c = STATUS_COLOR[a.status] || STATUS_COLOR.error
                  return (
                    <div key={a.id} style={{ padding: '12px 24px', borderTop: i === 0 ? 'none' : '1px solid #F9FAFB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#3F3F3F' }}>{a.absence_type} · {a.start_date} → {a.end_date}</div>
                        {a.error_detail && <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '2px' }}>{a.error_detail}</div>}
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: '700', background: c.bg, color: c.text, padding: '3px 9px', borderRadius: '10px', flexShrink: 0 }}>{a.status}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </ProfileLayout>
  )
}
