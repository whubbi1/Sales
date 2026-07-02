'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}

function ShortCvModal({ user, onClose }: any) {
  const [cv, setCv] = useState<any>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/cv/${encodeURIComponent(user.email)}`).then(r => r.json()).then(d => { setCv(d.cv); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  const download = () => {
    const url = `${API}/cv/${encodeURIComponent(user.email)}/export/word?experience_ids=${selected.join(',')}`
    window.open(url, '_blank')
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>Short CV — {user.display_name || user.email}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#45B6E4' }}>Loading…</div>
          ) : !cv?.experiences?.length ? (
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>This person has no experiences on their CV yet.</p>
          ) : (
            <>
              <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px' }}>Select the experiences to include in this curated CV.</p>
              <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #EDF2F7', borderRadius: '8px', marginBottom: '14px' }}>
                {cv.experiences.map((exp: any) => (
                  <label key={exp.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selected.includes(exp.id)} onChange={() => toggle(exp.id)} style={{ marginTop: '3px' }} />
                    <div>
                      <div style={{ fontWeight: '700', color: '#156082' }}>{exp.job_title} · {exp.company}</div>
                      <div style={{ color: '#94A3B8', fontSize: '11px' }}>{exp.start_date || '—'} → {exp.end_date || 'Present'}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
                <button onClick={download} disabled={selected.length === 0}
                  style={{ padding: '9px 18px', background: selected.length === 0 ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
                  Generate & Download ({selected.length})
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CvDatabaseContent() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [shortCvUser, setShortCvUser] = useState<any>(null)

  useEffect(() => {
    fetch(`${API}/cv`).then(r => r.json()).then(d => { setUsers(d.users || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const filtered = users.filter(u => !search || `${u.display_name} ${u.email} ${u.department}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>📇 CV Database</h1>
        <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{filtered.length} employee{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <input style={{ ...inp, width: '280px' }} placeholder="Search name, email, department…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {['Employee', 'Title', 'Department', 'CV', 'Experiences', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>No employees found.</td></tr>
            ) : filtered.map(u => (
              <tr key={u.email} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '10px 16px', fontWeight: '700', color: '#156082' }}>{u.display_name || `${u.first_name} ${u.last_name}`}</td>
                <td style={{ padding: '10px 16px', color: '#3F3F3F' }}>{u.cv_title || '—'}</td>
                <td style={{ padding: '10px 16px', color: '#64748B' }}>{u.department || '—'}</td>
                <td style={{ padding: '10px 16px' }}>
                  {u.has_cv ? <span style={{ background: '#ECFDF5', color: '#059669', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>Complete</span> : <span style={{ background: '#F1F5F9', color: '#94A3B8', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>Not started</span>}
                </td>
                <td style={{ padding: '10px 16px' }}>{u.experience_count}</td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <a href={`${API}/cv/${encodeURIComponent(u.email)}/export/word`} style={{ padding: '5px 10px', background: '#EFF6FF', borderRadius: '6px', fontSize: '11px', color: '#3B82F6', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', textDecoration: 'none' }}>Word</a>
                    <a href={`${API}/cv/${encodeURIComponent(u.email)}/export/pptx`} style={{ padding: '5px 10px', background: '#F5F3FF', borderRadius: '6px', fontSize: '11px', color: '#7C3AED', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', textDecoration: 'none' }}>PPT</a>
                    {u.experience_count > 0 && (
                      <button onClick={() => setShortCvUser(u)} style={{ padding: '5px 10px', background: '#FFF7ED', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#D97706', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Short CV</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shortCvUser && <ShortCvModal user={shortCvUser} onClose={() => setShortCvUser(null)} />}
    </div>
  )
}

export default function CvDatabasePage() {
  const router = useRouter()
  const [permLevel, setPermLevel] = useState<'loading' | 'none' | 'ok'>('loading')

  useEffect(() => {
    const user = getStoredUser()
    if (!user) { router.push('/auth/login'); return }
    fetch(`${API}/settings/permissions/${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(d => {
        const p = d.permissions?.sales?.cv_database
        setPermLevel(!!p && p.access_mode !== 'none' ? 'ok' : 'none')
      })
      .catch(() => setPermLevel('none'))
  }, [])

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        {permLevel === 'loading' && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
        )}
        {permLevel === 'none' && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
            <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
            <p style={{ fontSize: '13px' }}>You don't have permission to access the CV Database. Ask an admin to grant it via HR Permissions.</p>
          </div>
        )}
        {permLevel === 'ok' && <CvDatabaseContent />}
      </main>
    </div>
  )
}
