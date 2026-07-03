'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { GRCLayout, useGRCPerm } from '@/components/GRCLayout'
import { grcAccessReviewAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const REVIEW_TYPE_LABEL: Record<string, string> = { annual: 'Annual Review Cycle', quarterly: 'Quarterly', monthly: 'Monthly', adhoc: 'Ad-Hoc' }
const STATUSES = ['open', 'in_progress', 'closed']
const STATUS_LABEL: Record<string, string> = { open: 'Open', in_progress: 'In Progress', closed: 'Closed' }
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  open: { bg: '#F1F5F9', color: '#475569' }, in_progress: { bg: '#FFF7ED', color: '#D97706' }, closed: { bg: '#ECFDF5', color: '#059669' },
}
const TASK_STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  new: { bg: '#F1F5F9', color: '#475569' }, open: { bg: '#EFF6FF', color: '#156082' },
  in_progress: { bg: '#FFF7ED', color: '#D97706' }, resolved: { bg: '#ECFDF5', color: '#059669' }, closed: { bg: '#F1F5F9', color: '#64748B' },
}

const card: React.CSSProperties = { background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px 22px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const lbl: React.CSSProperties = { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '6px' }
const inp: React.CSSProperties = { fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white' }
const btn: React.CSSProperties = { padding: '7px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }

function fmtDate(d: string) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

function EditableCell({ display, editing, canEdit, onStartEdit, children }: any) {
  return editing ? children : (
    <div onClick={() => canEdit && onStartEdit()} title={canEdit ? 'Click to edit' : undefined}
      style={{ fontSize: '12px', color: '#3F3F3F', cursor: canEdit ? 'pointer' : 'default', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px' }}
      onMouseEnter={e => canEdit && (e.currentTarget.style.background = '#F1F5F9')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {display || <span style={{ color: '#94A3B8' }}>—</span>}
    </div>
  )
}

function scopeKey(type: string, id: string) { return `${type}:${id}` }

function AccessReviewDetailContent() {
  const { id } = useParams()
  const router = useRouter()
  const { level, canEdit } = useGRCPerm('access_review')
  const [cycle, setCycle] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [softwareList, setSoftwareList] = useState<any[]>([])
  const [requirements, setRequirements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editingField, setEditingField] = useState<string | null>(null)
  const [selectedScope, setSelectedScope] = useState<Set<string>>(new Set())
  const [showAddLink, setShowAddLink] = useState(false)
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const me = getStoredUser()?.email || ''

  const load = async () => {
    setLoading(true)
    try {
      const c = await grcAccessReviewAPI.get(id as string)
      setCycle(c)
      setSelectedScope(new Set((c.scope || []).map((e: any) => scopeKey(e.type, e.id))))
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    fetch(`${API}/settings/users`).then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
    fetch(`${API}/it/applications`).then(r => r.json()).then(d => setApplications(d.applications || [])).catch(() => {})
    fetch(`${API}/it/software`).then(r => r.json()).then(d => setSoftwareList(d.software || [])).catch(() => {})
    grcAccessReviewAPI.requirements(true).then(d => setRequirements(d.requirements || [])).catch(() => {})
  }, [id])

  if (level === 'loading' || loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )
  if (!cycle) return <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>Review cycle not found.</div>

  const updateField = async (fields: any) => {
    setError('')
    try {
      await grcAccessReviewAPI.update(cycle.id, {
        cycle_name: cycle.cycle_name, cycle_description: cycle.cycle_description, review_type: cycle.review_type,
        owner_email: cycle.owner_email, owner_name: cycle.owner_name, due_date: cycle.due_date, requirement_id: cycle.requirement_id,
        ...fields,
      })
      setEditingField(null)
      load()
    } catch (e: any) { setError(e.message) }
  }

  const setStatus = async (status: string) => {
    setError('')
    try { await grcAccessReviewAPI.setStatus(cycle.id, { status }); load() }
    catch (e: any) { setError(e.message) }
  }

  const toggleScope = (type: string, appOrSw: any) => {
    setSelectedScope(prev => {
      const next = new Set(prev)
      const key = scopeKey(type, appOrSw.id)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const saveScope = async () => {
    if (!cycle.owner_email) { setError('Set a review owner before saving scope'); return }
    setError(''); setNotice('')
    const scope = Array.from(selectedScope).map(key => {
      const [type, entityId] = key.split(':')
      const source = type === 'application' ? applications : softwareList
      const entity = source.find((e: any) => e.id === entityId)
      return {
        type, id: entityId, name: entity?.name || '',
        owner_email: entity?.owner_email || '', owner_name: entity?.owner_name || '',
      }
    })
    try {
      const r = await grcAccessReviewAPI.setScope(cycle.id, { scope })
      let msg = `Scope saved. ${r.created_task_ids?.length || 0} new task(s) created.`
      if (r.warnings?.length) msg += ` ${r.warnings.length} item(s) skipped (no owner set in IT): ${r.warnings.join('; ')}`
      setNotice(msg)
      load()
    } catch (e: any) { setError(e.message) }
  }

  const addLink = async () => {
    if (!linkLabel.trim() || !linkUrl.trim()) return
    await grcAccessReviewAPI.addLink(cycle.id, { label: linkLabel.trim(), url: linkUrl.trim(), added_by_email: me })
    setLinkLabel(''); setLinkUrl(''); setShowAddLink(false)
    load()
  }
  const removeLink = async (linkId: string) => {
    await grcAccessReviewAPI.removeLink(cycle.id, linkId)
    load()
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: '900px' }}>
      <button onClick={() => router.push('/grc/access-review')} style={{ background: 'none', border: 'none', color: '#45B6E4', fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: 0, marginBottom: '14px' }}>← Back to Access Review</button>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: '11px', fontWeight: '700' }}>{cycle.cycle_number}</span>
              <EditableCell display={<span style={{ background: '#F1F5F9', color: '#3F3F3F', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{REVIEW_TYPE_LABEL[cycle.review_type]}</span>}
                editing={editingField === 'review_type'} canEdit={canEdit} onStartEdit={() => setEditingField('review_type')}>
                <select autoFocus style={inp} defaultValue={cycle.review_type} onChange={e => updateField({ review_type: e.target.value })} onBlur={() => setEditingField(null)}>
                  {Object.entries(REVIEW_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </EditableCell>
            </div>
            <EditableCell display={<h1 style={{ fontSize: '19px', fontWeight: '800', color: '#156082', margin: '0 0 6px' }}>{cycle.cycle_name}</h1>}
              editing={editingField === 'cycle_name'} canEdit={canEdit} onStartEdit={() => setEditingField('cycle_name')}>
              <input autoFocus style={{ ...inp, fontSize: '15px', fontWeight: '700', width: '100%', boxSizing: 'border-box' as const, marginBottom: '6px' }} defaultValue={cycle.cycle_name}
                onBlur={e => updateField({ cycle_name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
            </EditableCell>
            <EditableCell display={<p style={{ fontSize: '12px', color: '#64748B', margin: 0, whiteSpace: 'pre-wrap' }}>{cycle.cycle_description || 'No description.'}</p>}
              editing={editingField === 'cycle_description'} canEdit={canEdit} onStartEdit={() => setEditingField('cycle_description')}>
              <textarea autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '60px', resize: 'vertical' as const }} defaultValue={cycle.cycle_description}
                onBlur={e => updateField({ cycle_description: e.target.value })} />
            </EditableCell>
          </div>
          <span style={{ background: STATUS_COLOR[cycle.status]?.bg, color: STATUS_COLOR[cycle.status]?.color, padding: '4px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>{STATUS_LABEL[cycle.status]}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
          <div>
            <div style={lbl}>Owner {!cycle.owner_email && <span style={{ color: '#DC2626' }}>(required)</span>}</div>
            <EditableCell display={cycle.owner_name || cycle.owner_email || <span style={{ color: '#DC2626', fontWeight: 700 }}>Not set</span>} editing={editingField === 'owner'} canEdit={canEdit} onStartEdit={() => setEditingField('owner')}>
              <select autoFocus style={inp} defaultValue={cycle.owner_email || ''}
                onChange={e => {
                  const email = e.target.value
                  const u = users.find((u: any) => u.email === email)
                  updateField({ owner_email: email, owner_name: u?.display_name || (u ? `${u.first_name} ${u.last_name}` : '') })
                }}
                onBlur={() => setEditingField(null)}>
                <option value="">Select owner…</option>
                {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
              </select>
            </EditableCell>
          </div>
          <div>
            <div style={lbl}>Linked Requirement</div>
            <EditableCell display={requirements.find((r: any) => r.id === cycle.requirement_id)?.reference_code || requirements.find((r: any) => r.id === cycle.requirement_id)?.requirement_text?.slice(0, 40) || '—'}
              editing={editingField === 'requirement'} canEdit={canEdit} onStartEdit={() => setEditingField('requirement')}>
              <select autoFocus style={inp} defaultValue={cycle.requirement_id || ''} onChange={e => updateField({ requirement_id: e.target.value })} onBlur={() => setEditingField(null)}>
                <option value="">None</option>
                {requirements.map((r: any) => <option key={r.id} value={r.id}>{r.framework_name} — {r.reference_code || r.requirement_text?.slice(0, 40)}</option>)}
              </select>
            </EditableCell>
          </div>
          <div>
            <div style={lbl}>Due Date</div>
            <EditableCell display={fmtDate(cycle.due_date)} editing={editingField === 'due_date'} canEdit={canEdit} onStartEdit={() => setEditingField('due_date')}>
              <input autoFocus type="date" style={inp} defaultValue={cycle.due_date ? cycle.due_date.slice(0, 10) : ''} onBlur={e => updateField({ due_date: e.target.value })} />
            </EditableCell>
          </div>
        </div>

        {canEdit && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
            <div style={lbl}>Change Status</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {STATUSES.map(s => (
                <button key={s} onClick={() => setStatus(s)} disabled={s === cycle.status}
                  style={{ ...btn, background: s === cycle.status ? STATUS_COLOR[s]?.bg : '#F8FAFC', color: s === cycle.status ? STATUS_COLOR[s]?.color : '#64748B', cursor: s === cycle.status ? 'default' : 'pointer' }}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '10px', color: '#94A3B8', marginTop: '6px' }}>All tasks generated for this review's scope must be resolved or closed before the cycle can be closed.</p>
          </div>
        )}
        {error && <div style={{ marginTop: '12px', background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
        {notice && <div style={{ marginTop: '12px', background: '#ECFDF5', color: '#059669', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{notice}</div>}
      </div>

      <div style={card}>
        <div style={lbl}>Review Scope — applications & software at WCOMPLY</div>
        <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 12px' }}>Selecting an item creates a task for its owner asking them to review access and provide evidence. Removing an item stops it counting toward the close-gate, but its task is never deleted.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#156082', marginBottom: '8px' }}>Applications ({applications.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '260px', overflowY: 'auto' }}>
              {applications.map((a: any) => {
                const key = scopeKey('application', a.id)
                const existing = (cycle.scope || []).find((e: any) => e.type === 'application' && e.id === a.id)
                return (
                  <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', background: selectedScope.has(key) ? '#EFF6FF' : 'transparent', fontSize: '12px', cursor: canEdit ? 'pointer' : 'default' }}>
                    <input type="checkbox" checked={selectedScope.has(key)} disabled={!canEdit} onChange={() => toggleScope('application', a)} />
                    <span style={{ flex: 1 }}>{a.name}</span>
                    <span style={{ fontSize: '10px', color: a.owner_email ? '#94A3B8' : '#DC2626' }}>{a.owner_name || a.owner_email || 'no owner'}</span>
                    {existing?.task_id && <span title="Task already generated" style={{ fontSize: '10px' }}>✅</span>}
                  </label>
                )
              })}
              {applications.length === 0 && <p style={{ fontSize: '11px', color: '#94A3B8' }}>No applications found in IT.</p>}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#156082', marginBottom: '8px' }}>Software ({softwareList.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '260px', overflowY: 'auto' }}>
              {softwareList.map((s: any) => {
                const key = scopeKey('software', s.id)
                const existing = (cycle.scope || []).find((e: any) => e.type === 'software' && e.id === s.id)
                return (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', background: selectedScope.has(key) ? '#EFF6FF' : 'transparent', fontSize: '12px', cursor: canEdit ? 'pointer' : 'default' }}>
                    <input type="checkbox" checked={selectedScope.has(key)} disabled={!canEdit} onChange={() => toggleScope('software', s)} />
                    <span style={{ flex: 1 }}>{s.name}</span>
                    <span style={{ fontSize: '10px', color: s.owner_email ? '#94A3B8' : '#DC2626' }}>{s.owner_name || s.owner_email || 'no owner'}</span>
                    {existing?.task_id && <span title="Task already generated" style={{ fontSize: '10px' }}>✅</span>}
                  </label>
                )
              })}
              {softwareList.length === 0 && <p style={{ fontSize: '11px', color: '#94A3B8' }}>No software found in IT.</p>}
            </div>
          </div>
        </div>
        {canEdit && (
          <button onClick={saveScope} style={{ ...btn, marginTop: '14px', background: '#156082', color: 'white' }}>Save Scope</button>
        )}
      </div>

      <div style={card}>
        <div style={lbl}>Generated Tasks ({(cycle.tasks || []).length})</div>
        {(cycle.tasks || []).length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No tasks yet — save a scope above to generate them.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {cycle.tasks.map((t: any) => (
              <div key={t.id} onClick={() => router.push(`/task-manager/${t.id}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', border: '1px solid #EDF2F7', borderRadius: '8px', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#156082' }}>{t.title}</div>
                  <div style={{ fontSize: '10px', color: '#94A3B8' }}>{t.task_number} · Owned by {t.owner_name || t.owner_email}</div>
                </div>
                <span style={{ background: TASK_STATUS_COLOR[t.status]?.bg, color: TASK_STATUS_COLOR[t.status]?.color, padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{t.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={lbl}>Documents & Links ({(cycle.links || []).length})</div>
          {canEdit && !showAddLink && <button onClick={() => setShowAddLink(true)} style={{ ...btn, background: '#EFF6FF', color: '#156082' }}>+ Add Link</button>}
        </div>
        {(cycle.links || []).length === 0 && !showAddLink ? (
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No documents or links attached yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: showAddLink ? '10px' : 0 }}>
            {(cycle.links || []).map((l: any) => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#156082', fontWeight: '600', textDecoration: 'none' }}>🔗 {l.label}</a>
                {canEdit && <button onClick={() => removeLink(l.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
              </div>
            ))}
          </div>
        )}
        {showAddLink && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input style={{ ...inp, width: '160px' }} placeholder="Label…" value={linkLabel} onChange={e => setLinkLabel(e.target.value)} />
            <input style={{ ...inp, flex: 1 }} placeholder="https://…" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addLink() }} />
            <button onClick={addLink} style={{ ...btn, background: '#156082', color: 'white' }}>Add</button>
            <button onClick={() => { setShowAddLink(false); setLinkLabel(''); setLinkUrl('') }} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AccessReviewDetailPage() {
  return <GRCLayout><AccessReviewDetailContent /></GRCLayout>
}
