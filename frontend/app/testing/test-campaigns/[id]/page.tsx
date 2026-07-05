'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { TestingLayout, useTestingPerm } from '@/components/TestingLayout'
import { testingAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const CRITICALITIES = ['Blocking', 'Critical', 'High', 'Medium', 'Low']
const CRITICALITY_COLOR: Record<string, { bg: string; color: string }> = {
  Blocking: { bg: '#FEF2F2', color: '#991B1B' }, Critical: { bg: '#FEF2F2', color: '#DC2626' },
  High: { bg: '#FFF7ED', color: '#D97706' }, Medium: { bg: '#FFFBEB', color: '#B45309' }, Low: { bg: '#F1F5F9', color: '#64748B' },
}
const RESULT_OPTIONS = ['pass', 'fail', 'blocked']
const RESULT_COLOR: Record<string, { bg: string; color: string }> = {
  pass: { bg: '#ECFDF5', color: '#059669' }, fail: { bg: '#FEF2F2', color: '#DC2626' }, blocked: { bg: '#FFF7ED', color: '#D97706' },
}
const STATUS_LABEL: Record<string, string> = { planned: 'Planned', in_execution: 'In Execution', in_review: 'In Review', completed: 'Completed' }
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  planned: { bg: '#F1F5F9', color: '#475569' }, in_execution: { bg: '#FFF7ED', color: '#D97706' },
  in_review: { bg: '#EFF6FF', color: '#156082' }, completed: { bg: '#ECFDF5', color: '#059669' },
}

const card: React.CSSProperties = { background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px 22px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const lbl: React.CSSProperties = { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '6px' }
const inp: React.CSSProperties = { fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white' }
const btn: React.CSSProperties = { padding: '7px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }

function fmtDate(d: string) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

// ─── Execute mode: one step at a time ──────────────────────────────────────────
function ExecuteWizard({ campaign, onChanged }: any) {
  const steps = campaign.steps || []
  const firstUnexecuted = steps.findIndex((s: any) => !s.executed_at)
  const [index, setIndex] = useState(firstUnexecuted >= 0 ? firstUnexecuted : 0)
  const step = steps[index]
  const [result, setResult] = useState(step?.result || '')
  const [deviation, setDeviation] = useState(step?.deviation || '')
  const [remediation, setRemediation] = useState(step?.remediation || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setResult(step?.result || ''); setDeviation(step?.deviation || ''); setRemediation(step?.remediation || '')
  }, [index, step?.id])

  if (!step) return <p style={{ fontSize: '12px', color: '#94A3B8' }}>No steps in this campaign.</p>

  const save = async (andAdvance: boolean) => {
    setSaving(true)
    try {
      await testingAPI.executeStep(campaign.id, step.id, { result, deviation, remediation })
      await onChanged()
      if (andAdvance && index < steps.length - 1) setIndex(index + 1)
    } finally { setSaving(false) }
  }

  const uploadScreenshot = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await fetch(`${API}/testing/campaigns/${campaign.id}/steps/${step.id}/screenshot`, { method: 'POST', body: fd })
      await onChanged()
    } finally { setUploading(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', color: '#94A3B8' }}>Step {index + 1} of {steps.length}</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setIndex((i: number) => Math.max(0, i - 1))} disabled={index === 0} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>← Prev</button>
          <button onClick={() => setIndex((i: number) => Math.min(steps.length - 1, i + 1))} disabled={index === steps.length - 1} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Next →</button>
        </div>
      </div>
      <div style={{ border: '1px solid #EDF2F7', borderRadius: '10px', padding: '16px' }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#156082', marginBottom: '4px' }}>{step.title}</div>
        {step.details && <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px', whiteSpace: 'pre-wrap' }}>{step.details}</div>}
        {step.expected_result && <div style={{ fontSize: '12px', color: '#059669', marginBottom: '8px', whiteSpace: 'pre-wrap' }}><b>Expected:</b> {step.expected_result}</div>}
        {step.url && <div style={{ marginBottom: '12px' }}><a href={step.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#156082' }}>🔗 {step.url}</a></div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
          <div>
            <label style={lbl}>Result</label>
            <select style={{ ...inp, width: '100%' }} value={result} onChange={e => setResult(e.target.value)}>
              <option value="">Not executed</option>
              {RESULT_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Screenshot</label>
            <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadScreenshot(f) }} disabled={uploading} style={{ fontSize: '11px' }} />
            {step.screenshot_url && <div style={{ fontSize: '10px', color: '#059669', marginTop: '4px' }}>✓ Screenshot attached</div>}
          </div>
        </div>
        <div style={{ marginTop: '10px' }}>
          <label style={lbl}>Deviation (if any)</label>
          <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '50px', resize: 'vertical' }} value={deviation} onChange={e => setDeviation(e.target.value)} placeholder="Describe what went wrong, if anything…" />
        </div>
        <div style={{ marginTop: '10px' }}>
          <label style={lbl}>Suggested Remediation</label>
          <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '50px', resize: 'vertical' }} value={remediation} onChange={e => setRemediation(e.target.value)} placeholder="Optional — how could this be fixed?" />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          <button onClick={() => save(false)} disabled={saving} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>{saving ? 'Saving…' : 'Save'}</button>
          <button onClick={() => save(true)} disabled={saving} style={{ ...btn, background: '#156082', color: 'white' }}>{saving ? 'Saving…' : 'Save & Next →'}</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px', marginTop: '12px', flexWrap: 'wrap' }}>
        {steps.map((s: any, i: number) => (
          <button key={s.id} onClick={() => setIndex(i)} title={s.title}
            style={{ width: '26px', height: '26px', borderRadius: '6px', border: i === index ? '2px solid #156082' : '1px solid #E2E8F0', background: s.executed_at ? (RESULT_COLOR[s.result]?.bg || '#ECFDF5') : 'white', color: '#3F3F3F', fontSize: '10px', cursor: 'pointer', fontWeight: '700' }}>
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Review mode: flat editable table ──────────────────────────────────────────
function ReviewTable({ campaign, onChanged }: any) {
  const [saving, setSaving] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)

  const saveStep = async (step: any, fields: any) => {
    setSaving(step.id)
    try { await testingAPI.reviewStep(campaign.id, step.id, fields); await onChanged() }
    finally { setSaving(null) }
  }

  const completeReview = async () => {
    if (!confirm('Complete review? This generates a Remediation Plan for every step with a deviation and locks the campaign.')) return
    setCompleting(true)
    try {
      const me = getStoredUser()
      await testingAPI.completeReview(campaign.id, { acting_email: me?.email || '' })
      await onChanged()
    } finally { setCompleting(false) }
  }

  return (
    <div>
      <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: 0 }}>Only deviation, remediation, and criticality can be changed during review.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        {(campaign.steps || []).map((s: any) => (
          <div key={s.id} style={{ border: '1px solid #EDF2F7', borderRadius: '8px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#156082' }}>{s.title}</span>
              {s.result && <span style={{ background: RESULT_COLOR[s.result]?.bg, color: RESULT_COLOR[s.result]?.color, padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{s.result}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '10px' }}>
              <div>
                <label style={lbl}>Deviation</label>
                <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '50px', resize: 'vertical' }} defaultValue={s.deviation}
                  onBlur={e => saveStep(s, { deviation: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>Remediation</label>
                <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '50px', resize: 'vertical' }} defaultValue={s.remediation}
                  onBlur={e => saveStep(s, { remediation: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>Criticality</label>
                <select style={{ ...inp, width: '100%' }} defaultValue={s.criticality || ''} onChange={e => saveStep(s, { criticality: e.target.value })}>
                  <option value="">—</option>
                  {CRITICALITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {saving === s.id && <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>Saving…</div>}
          </div>
        ))}
      </div>
      <button onClick={completeReview} disabled={completing} style={{ ...btn, padding: '10px 20px', background: completing ? '#94A3B8' : '#156082', color: 'white' }}>
        {completing ? 'Completing…' : 'Complete Review'}
      </button>
    </div>
  )
}

function TestCampaignDetailContent() {
  const { id } = useParams()
  const router = useRouter()
  const { level, canEdit } = useTestingPerm('campaigns')
  const [campaign, setCampaign] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try { setCampaign(await testingAPI.getCampaign(id as string)) }
    catch { router.push('/testing/test-campaigns') }
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
  if (!campaign) return <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>Test campaign not found.</div>

  return (
    <div style={{ padding: '24px 28px', maxWidth: '900px' }}>
      <button onClick={() => router.push('/testing/test-campaigns')} style={{ background: 'none', border: 'none', color: '#45B6E4', fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: 0, marginBottom: '14px' }}>← Back to Test Campaigns</button>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: '11px', fontWeight: '700' }}>{campaign.campaign_number}</span>
            <h1 style={{ fontSize: '19px', fontWeight: '800', color: '#156082', margin: '4px 0 6px' }}>{campaign.title}</h1>
          </div>
          <span style={{ background: STATUS_COLOR[campaign.status]?.bg, color: STATUS_COLOR[campaign.status]?.color, padding: '4px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: '700' }}>{STATUS_LABEL[campaign.status]}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
          <div><div style={lbl}>Execution Date</div><div style={{ fontSize: '12px', color: '#3F3F3F' }}>{fmtDate(campaign.execution_date)}</div></div>
          <div><div style={lbl}>Owner</div><div style={{ fontSize: '12px', color: '#3F3F3F' }}>{campaign.owner_name || campaign.owner_email || '—'}</div></div>
          <div><div style={lbl}>Reviewer</div><div style={{ fontSize: '12px', color: '#3F3F3F' }}>{campaign.reviewer_name || campaign.reviewer_email || '—'}</div></div>
        </div>
        {(campaign.plans || []).length > 0 && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
            <div style={lbl}>Included Plans</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {campaign.plans.map((p: any) => (
                <a key={p.id} href={`/testing/test-plans/${p.id}`} style={{ fontSize: '11px', color: '#156082', background: '#EFF6FF', padding: '3px 9px', borderRadius: '10px', textDecoration: 'none', fontWeight: '600' }}>{p.title}</a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={card}>
        {(campaign.status === 'planned' || campaign.status === 'in_execution') && <ExecuteWizard campaign={campaign} onChanged={load} />}
        {campaign.status === 'in_review' && <ReviewTable campaign={campaign} onChanged={load} />}
        {campaign.status === 'completed' && (
          <div>
            <p style={{ fontSize: '13px', color: '#059669', fontWeight: '700' }}>✓ Execution and review complete.</p>
            {campaign.remediation_plan ? (
              <a href={`/testing/remediation-plans/${campaign.remediation_plan.id}`} style={{ display: 'inline-block', ...btn, background: '#156082', color: 'white', textDecoration: 'none' }}>
                View Remediation Plan ({campaign.remediation_plan.plan_number}) →
              </a>
            ) : (
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>No deviations were recorded — no remediation plan was needed.</p>
            )}
            <div style={{ marginTop: '20px' }}>
              <div style={lbl}>Step Results</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {(campaign.steps || []).map((s: any) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#156082' }}>{s.title}</span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {s.criticality && <span style={{ background: CRITICALITY_COLOR[s.criticality]?.bg, color: CRITICALITY_COLOR[s.criticality]?.color, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{s.criticality}</span>}
                      {s.result && <span style={{ background: RESULT_COLOR[s.result]?.bg, color: RESULT_COLOR[s.result]?.color, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{s.result}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TestCampaignDetailPage() {
  return <TestingLayout><TestCampaignDetailContent /></TestingLayout>
}
