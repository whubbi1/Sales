'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DevelopmentLayout, { useDevPerm } from '@/components/DevelopmentLayout'
import { testingAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const STATUS_LABEL: Record<string, string> = { planned: 'Planned', in_execution: 'In Execution', in_review: 'In Review', completed: 'Completed' }
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  planned: { bg: '#F1F5F9', color: '#475569' }, in_execution: { bg: '#FFF7ED', color: '#D97706' },
  in_review: { bg: '#EFF6FF', color: '#156082' }, completed: { bg: '#ECFDF5', color: '#059669' },
}

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

function NewCampaignModal({ plans, users, onClose, onCreated }: any) {
  const [title, setTitle] = useState('')
  const [planIds, setPlanIds] = useState<string[]>([])
  const [executionDate, setExecutionDate] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [reviewerEmail, setReviewerEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const togglePlan = (id: string) => setPlanIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])

  const submit = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    if (planIds.length === 0) { setError('Select at least one test plan'); return }
    setSaving(true); setError('')
    try {
      const me = getStoredUser()
      const ou = users.find((u: any) => u.email === ownerEmail)
      const ru = users.find((u: any) => u.email === reviewerEmail)
      const r = await testingAPI.createCampaign({
        title: title.trim(), plan_ids: planIds, execution_date: executionDate,
        owner_email: ownerEmail, owner_name: ou?.display_name || (ou ? `${ou.first_name} ${ou.last_name}` : ''),
        reviewer_email: reviewerEmail, reviewer_name: ru?.display_name || (ru ? `${ru.first_name} ${ru.last_name}` : ''),
        created_by_email: me?.email || '',
      })
      onCreated(r.id)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '520px', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>New Test Campaign</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Title *</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Q3 Regression Campaign" />
          </div>
          <div>
            <label style={lbl}>Test Plans * ({planIds.length} selected)</label>
            <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px' }}>
              {plans.length === 0 ? <p style={{ fontSize: '11px', color: '#94A3B8', padding: '8px' }}>No test plans available — create one first.</p> : plans.map((p: any) => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', background: planIds.includes(p.id) ? '#EFF6FF' : 'transparent', cursor: 'pointer' }}>
                  <input type="checkbox" checked={planIds.includes(p.id)} onChange={() => togglePlan(p.id)} />
                  <span style={{ fontSize: '12px' }}>{p.title} {p.application_name ? `(${p.application_name})` : ''}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label style={lbl}>Execution Date</label>
            <input type="date" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={executionDate} onChange={e => setExecutionDate(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>Execution Owner</label>
              <select style={{ ...inp, width: '100%' }} value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)}>
                <option value="">Unassigned</option>
                {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Execution Reviewer</label>
              <select style={{ ...inp, width: '100%' }} value={reviewerEmail} onChange={e => setReviewerEmail(e.target.value)}>
                <option value="">Unassigned</option>
                {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
              </select>
            </div>
          </div>
          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
            <button onClick={submit} disabled={saving} style={{ padding: '9px 18px', background: saving ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              {saving ? 'Creating…' : 'Create Campaign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TestCampaignsContent() {
  const router = useRouter()
  const { level, canEdit } = useDevPerm('test_campaigns')
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await testingAPI.listCampaigns()
      setCampaigns(d.campaigns || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    testingAPI.listPlans().then((d: any) => setPlans(d.plans || [])).catch(() => {})
    fetch(`${API}/settings/users`).then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [])

  if (level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>🧪 Test Campaigns</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowNew(true)} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
            + New Campaign
          </button>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {['Campaign #', 'Title', 'Date', 'Owner', 'Reviewer', 'Status', 'Progress'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No test campaigns yet.</td></tr>
            ) : campaigns.map((c: any) => (
              <tr key={c.id} onClick={() => router.push(`/development/test-campaigns/${c.id}`)} style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '10px 12px', color: '#94A3B8', fontFamily: 'monospace', fontSize: '11px' }}>{c.campaign_number}</td>
                <td style={{ padding: '10px 12px', fontWeight: '700', color: '#156082' }}>{c.title}</td>
                <td style={{ padding: '10px 12px', color: '#64748B' }}>{c.execution_date ? new Date(c.execution_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                <td style={{ padding: '10px 12px', color: '#3F3F3F' }}>{c.owner_name || c.owner_email || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#3F3F3F' }}>{c.reviewer_name || c.reviewer_email || '—'}</td>
                <td style={{ padding: '10px 12px' }}><span style={{ background: STATUS_COLOR[c.status]?.bg, color: STATUS_COLOR[c.status]?.color, padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{STATUS_LABEL[c.status] || c.status}</span></td>
                <td style={{ padding: '10px 12px', color: '#64748B' }}>{c.steps_executed}/{c.steps_total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && <NewCampaignModal plans={plans} users={users} onClose={() => setShowNew(false)} onCreated={(id: string) => { setShowNew(false); router.push(`/development/test-campaigns/${id}`) }} />}
    </div>
  )
}

export default function TestCampaignsPage() {
  return <DevelopmentLayout><TestCampaignsContent /></DevelopmentLayout>
}
