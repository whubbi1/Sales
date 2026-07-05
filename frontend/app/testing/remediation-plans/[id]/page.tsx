'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { TestingLayout, useTestingPerm } from '@/components/TestingLayout'
import { testingAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const CRITICALITY_COLOR: Record<string, { bg: string; color: string }> = {
  Blocking: { bg: '#FEF2F2', color: '#991B1B' }, Critical: { bg: '#FEF2F2', color: '#DC2626' },
  High: { bg: '#FFF7ED', color: '#D97706' }, Medium: { bg: '#FFFBEB', color: '#B45309' }, Low: { bg: '#F1F5F9', color: '#64748B' },
}
const PLAN_STATUS_LABEL: Record<string, string> = { new: 'New', open: 'Open', in_progress: 'In Progress', closed: 'Closed' }
const PLAN_STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  new: { bg: '#F1F5F9', color: '#475569' }, open: { bg: '#EFF6FF', color: '#156082' },
  in_progress: { bg: '#FFF7ED', color: '#D97706' }, closed: { bg: '#ECFDF5', color: '#059669' },
}
const ACTION_STATUS_LABEL: Record<string, string> = { new: 'New', in_progress: 'In Progress', closed: 'Closed' }
const ACTION_STATUS_NEXT: Record<string, string> = { new: 'in_progress', in_progress: 'closed', closed: 'new' }

const card: React.CSSProperties = { background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px 22px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const lbl: React.CSSProperties = { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '6px' }
const inp: React.CSSProperties = { fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white' }
const btn: React.CSSProperties = { padding: '7px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }

function ActionRow({ action, users, onChanged }: any) {
  const [comment, setComment] = useState(action.comment || '')
  const me = getStoredUser()?.email || ''

  const setOwner = async (email: string) => {
    const u = users.find((u: any) => u.email === email)
    await testingAPI.updateRemediationAction(action.id, { owner_email: email, owner_name: u?.display_name || (u ? `${u.first_name} ${u.last_name}` : ''), acting_email: me })
    onChanged()
  }
  const cycleStatus = async () => {
    await testingAPI.updateRemediationAction(action.id, { status: ACTION_STATUS_NEXT[action.status], acting_email: me })
    onChanged()
  }
  const saveComment = async () => {
    await testingAPI.updateRemediationAction(action.id, { comment, acting_email: me })
    onChanged()
  }

  return (
    <div style={{ border: '1px solid #EDF2F7', borderRadius: '8px', padding: '12px 14px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#156082' }}>{action.title}</span>
          {action.criticality && <span style={{ marginLeft: '8px', background: CRITICALITY_COLOR[action.criticality]?.bg, color: CRITICALITY_COLOR[action.criticality]?.color, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{action.criticality}</span>}
        </div>
        <button onClick={cycleStatus} style={{ ...btn, background: action.status === 'closed' ? '#ECFDF5' : action.status === 'in_progress' ? '#FFF7ED' : '#F1F5F9', color: action.status === 'closed' ? '#059669' : action.status === 'in_progress' ? '#D97706' : '#475569' }}>
          {ACTION_STATUS_LABEL[action.status]}
        </button>
      </div>
      {action.description && <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{action.description}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label style={lbl}>Owner</label>
          <select style={{ ...inp, width: '100%' }} value={action.owner_email || ''} onChange={e => setOwner(e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Comment</label>
          <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={comment} onChange={e => setComment(e.target.value)} onBlur={saveComment} placeholder="Optional comment…" />
        </div>
      </div>
    </div>
  )
}

function RemediationPlanDetailContent() {
  const { id } = useParams()
  const router = useRouter()
  const { level } = useTestingPerm('remediation')
  const [plan, setPlan] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try { setPlan(await testingAPI.getRemediationPlan(id as string)) }
    catch { router.push('/testing/remediation-plans') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    fetch(`${API}/settings/users`).then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [id])

  if (level === 'loading' || loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )
  if (!plan) return <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>Remediation plan not found.</div>

  const setPlanOwner = async (email: string) => {
    const u = users.find((u: any) => u.email === email)
    await testingAPI.updateRemediationPlan(plan.id, { owner_email: email, owner_name: u?.display_name || (u ? `${u.first_name} ${u.last_name}` : ''), acting_email: getStoredUser()?.email || '' })
    load()
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: '900px' }}>
      <button onClick={() => router.push('/testing/remediation-plans')} style={{ background: 'none', border: 'none', color: '#45B6E4', fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: 0, marginBottom: '14px' }}>← Back to Remediation Plans</button>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: '11px', fontWeight: '700' }}>{plan.plan_number}</span>
            <h1 style={{ fontSize: '19px', fontWeight: '800', color: '#156082', margin: '4px 0 6px' }}>Remediation for {plan.campaign_title}</h1>
            <a href={`/testing/test-campaigns/${plan.campaign_id}`} style={{ fontSize: '11px', color: '#156082' }}>View source campaign ({plan.campaign_number}) →</a>
          </div>
          <span style={{ background: PLAN_STATUS_COLOR[plan.status]?.bg, color: PLAN_STATUS_COLOR[plan.status]?.color, padding: '4px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: '700' }}>{PLAN_STATUS_LABEL[plan.status]}</span>
        </div>
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9', maxWidth: '260px' }}>
          <label style={lbl}>Owner</label>
          <select style={{ ...inp, width: '100%' }} value={plan.owner_email || ''} onChange={e => setPlanOwner(e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
          </select>
          <p style={{ fontSize: '10px', color: '#94A3B8', marginTop: '6px' }}>Status is computed automatically: new → open (owner assigned) → in progress (every action has an owner) → closed (every action closed).</p>
        </div>
      </div>

      <div style={card}>
        <div style={lbl}>Remediation Actions ({(plan.actions || []).length})</div>
        {(plan.actions || []).length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No actions on this plan.</p>
        ) : (
          plan.actions.map((a: any) => <ActionRow key={a.id} action={a} users={users} onChanged={load} />)
        )}
      </div>
    </div>
  )
}

export default function RemediationPlanDetailPage() {
  return <TestingLayout><RemediationPlanDetailContent /></TestingLayout>
}
