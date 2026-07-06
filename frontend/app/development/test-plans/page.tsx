'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DevelopmentLayout, { useDevPerm } from '@/components/DevelopmentLayout'
import { testingAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

function NewPlanModal({ applications, onClose, onCreated }: any) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [applicationId, setApplicationId] = useState('')
  const [submodules, setSubmodules] = useState<any[]>([])
  const [submoduleId, setSubmoduleId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!applicationId) { setSubmodules([]); setSubmoduleId(''); return }
    fetch(`${API}/it/applications/${applicationId}/submodules`).then(r => r.json()).then(d => setSubmodules(d.submodules || [])).catch(() => {})
  }, [applicationId])

  const submit = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true); setError('')
    try {
      const me = getStoredUser()
      const r = await testingAPI.createPlan({
        title: title.trim(), description, application_id: applicationId, submodule_id: submoduleId,
        created_by_email: me?.email || '',
      })
      onCreated(r.id)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>New Test Plan</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Title *</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Login flow regression test" />
          </div>
          <div>
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '70px', resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Application</label>
            <select style={{ ...inp, width: '100%' }} value={applicationId} onChange={e => setApplicationId(e.target.value)}>
              <option value="">Select an application…</option>
              {applications.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          {applicationId && (
            <div>
              <label style={lbl}>Submodule (optional)</label>
              <select style={{ ...inp, width: '100%' }} value={submoduleId} onChange={e => setSubmoduleId(e.target.value)}>
                <option value="">Whole application</option>
                {submodules.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>Test scripts (steps) are added on the plan's own page once created.</p>
          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
            <button onClick={submit} disabled={saving} style={{ padding: '9px 18px', background: saving ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              {saving ? 'Creating…' : 'Create Plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TestPlansContent() {
  const router = useRouter()
  const { level, canEdit } = useDevPerm('test_plans')
  const [plans, setPlans] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await testingAPI.listPlans()
      setPlans(d.plans || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    fetch(`${API}/it/applications`).then(r => r.json()).then(d => setApplications(d.applications || [])).catch(() => {})
  }, [])

  if (level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )

  const filtered = plans.filter((p: any) => !search || p.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>📋 Test Plans</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{filtered.length} plan{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowNew(true)} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
            + New Test Plan
          </button>
        )}
      </div>

      <div style={{ marginBottom: '14px' }}>
        <input style={{ ...inp, width: '260px' }} placeholder="Search plan title…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {['Plan #', 'Title', 'Application', 'Submodule', 'Scripts'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No test plans yet.</td></tr>
            ) : filtered.map((p: any) => (
              <tr key={p.id} onClick={() => router.push(`/development/test-plans/${p.id}`)} style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '10px 12px', color: '#94A3B8', fontFamily: 'monospace', fontSize: '11px' }}>{p.plan_number}</td>
                <td style={{ padding: '10px 12px', fontWeight: '700', color: '#156082' }}>{p.title}</td>
                <td style={{ padding: '10px 12px', color: '#3F3F3F' }}>{p.application_name || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#64748B' }}>{p.submodule_name || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#64748B' }}>{p.script_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && <NewPlanModal applications={applications} onClose={() => setShowNew(false)} onCreated={(id: string) => { setShowNew(false); router.push(`/development/test-plans/${id}`) }} />}
    </div>
  )
}

export default function TestPlansPage() {
  return <DevelopmentLayout><TestPlansContent /></DevelopmentLayout>
}
