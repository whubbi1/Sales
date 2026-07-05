'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { HRLayout, useHRPerm } from '@/components/HRLayout'
import { hrChecklistAPI, taskManagerAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const KIND_META: Record<string, { title: string; icon: string }> = {
  onboarding: { title: 'Onboarding', icon: '🎒' },
  offboarding: { title: 'Offboarding', icon: '📤' },
}

const TASK_STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  new: { bg: '#F1F5F9', color: '#475569' }, open: { bg: '#EFF6FF', color: '#156082' },
  in_progress: { bg: '#FFF7ED', color: '#D97706' }, resolved: { bg: '#ECFDF5', color: '#059669' }, closed: { bg: '#F1F5F9', color: '#64748B' },
}

const card: React.CSSProperties = { background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px 22px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const lbl: React.CSSProperties = { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '6px' }
const inp: React.CSSProperties = { fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white' }
const btn: React.CSSProperties = { padding: '7px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }

function fmtDateTime(d: string) {
  return d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
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

function TaskRow({ task, onValidated }: { task: any; onValidated: () => void }) {
  const router = useRouter()
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const me = getStoredUser()?.email || ''
  const done = task.status === 'resolved' || task.status === 'closed'

  const validate = async () => {
    setSaving(true); setError('')
    try {
      if (comment.trim()) {
        const meUser = getStoredUser()
        await taskManagerAPI.addComment(task.id, { author_email: me, author_name: meUser?.name || me, content: comment.trim() })
      }
      await taskManagerAPI.setStatus(task.id, { acting_email: me, status: 'resolved' })
      setShowComment(false); setComment('')
      onValidated()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ border: '1px solid #EDF2F7', borderRadius: '8px', padding: '12px 14px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => router.push(`/task-manager/${task.id}`)}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#156082' }}>{task.title}</div>
          <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
            {task.task_number} · Assigned to {task.assignee_name || task.assignee_email || '—'}
          </div>
        </div>
        <span style={{ background: TASK_STATUS_COLOR[task.status]?.bg, color: TASK_STATUS_COLOR[task.status]?.color, padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>{task.status}</span>
      </div>
      {!done && (
        <div style={{ marginTop: '10px' }}>
          {!showComment ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowComment(true)} style={{ ...btn, background: '#ECFDF5', color: '#059669' }}>✓ Validate</button>
              <button onClick={() => router.push(`/task-manager/${task.id}`)} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Open Task</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input style={{ ...inp, flex: 1 }} placeholder="Optional comment / evidence…" value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') validate() }} />
              <button onClick={validate} disabled={saving} style={{ ...btn, background: '#156082', color: 'white' }}>{saving ? 'Saving…' : 'Confirm'}</button>
              <button onClick={() => { setShowComment(false); setComment('') }} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
            </div>
          )}
          {error && <div style={{ marginTop: '8px', background: '#FEF2F2', color: '#DC2626', padding: '8px 12px', borderRadius: '6px', fontSize: '11px' }}>{error}</div>}
        </div>
      )}
    </div>
  )
}

function EquipmentCard({ caseData, canEdit, onChanged }: any) {
  const [equipments, setEquipments] = useState<any[]>([])
  const [allEquipments, setAllEquipments] = useState<any[]>([])
  const [addId, setAddId] = useState('')
  const [error, setError] = useState('')
  const closed = caseData.status === 'closed'

  const load = async () => {
    try {
      const d = await hrChecklistAPI.getCaseEquipments(caseData.id)
      setEquipments(d.equipments || [])
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    load()
    fetch(`${API}/it/equipments`).then(r => r.json()).then(d => setAllEquipments(d.equipments || [])).catch(() => {})
  }, [caseData.id])

  const assign = async () => {
    if (!addId) return
    setError('')
    try {
      await hrChecklistAPI.assignEquipment(caseData.id, addId)
      setAddId('')
      load(); onChanged?.()
    } catch (e: any) { setError(e.message) }
  }
  const unassign = async (equipmentId: string) => {
    setError('')
    try { await hrChecklistAPI.unassignEquipment(caseData.id, equipmentId); load(); onChanged?.() }
    catch (e: any) { setError(e.message) }
  }

  const assignedIds = new Set(equipments.map((e: any) => e.id))
  const available = allEquipments.filter((e: any) => !assignedIds.has(e.id))

  return (
    <div style={card}>
      <div style={lbl}>Equipment ({equipments.length})</div>
      {equipments.length === 0 ? (
        <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 10px' }}>No equipment assigned yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
          {equipments.map((e: any) => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#156082' }}>{e.name}</span>
                {e.serial_number && <span style={{ fontSize: '10px', color: '#94A3B8', marginLeft: '8px' }}>{e.serial_number}</span>}
              </div>
              {canEdit && !closed && <button onClick={() => unassign(e.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
            </div>
          ))}
        </div>
      )}
      {canEdit && !closed && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <select style={{ ...inp, flex: 1 }} value={addId} onChange={e => setAddId(e.target.value)}>
            <option value="">Select equipment to assign…</option>
            {available.map((e: any) => <option key={e.id} value={e.id}>{e.name}{e.assigned_name ? ` (currently: ${e.assigned_name})` : ''}</option>)}
          </select>
          <button onClick={assign} disabled={!addId} style={{ ...btn, background: '#156082', color: 'white' }}>+ Assign</button>
        </div>
      )}
      {closed && <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>This case is closed — equipment can no longer be changed.</p>}
      {error && <div style={{ marginTop: '10px', background: '#FEF2F2', color: '#DC2626', padding: '8px 12px', borderRadius: '6px', fontSize: '11px' }}>{error}</div>}
    </div>
  )
}

function ChecklistCaseContent() {
  const { id } = useParams()
  const router = useRouter()
  const onboardPerm = useHRPerm('onboarding')
  const offboardPerm = useHRPerm('offboarding')
  const [caseData, setCaseData] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingResponsible, setEditingResponsible] = useState(false)
  const [closing, setClosing] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const c = await hrChecklistAPI.getCase(id as string)
      setCaseData(c)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])
  useEffect(() => { fetch(`${API}/settings/users`).then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {}) }, [])

  const updateResponsible = async (email: string) => {
    const u = users.find((u: any) => u.email === email)
    try {
      await hrChecklistAPI.updateCase(id as string, {
        responsible_email: email, responsible_name: u?.display_name || (u ? `${u.first_name} ${u.last_name}` : ''),
        acting_email: getStoredUser()?.email || '',
      })
      setEditingResponsible(false)
      load()
    } catch (e: any) { setError(e.message) }
  }

  const closeCase = async () => {
    if (!confirm('Close this case? Equipment can no longer be changed once closed.')) return
    setClosing(true)
    try { await hrChecklistAPI.closeCase(id as string); load() }
    catch (e: any) { setError(e.message) }
    finally { setClosing(false) }
  }

  const perm = caseData?.kind === 'offboarding' ? offboardPerm : onboardPerm

  if (loading || perm.level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (perm.level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )
  if (error || !caseData) return <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>{error || 'Case not found.'}</div>

  const meta = KIND_META[caseData.kind] || { title: caseData.kind, icon: '📋' }
  const tasks = caseData.tasks || []
  const doneCount = tasks.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length

  return (
    <div style={{ padding: '24px 28px', maxWidth: '800px' }}>
      <button onClick={() => router.push(caseData.kind === 'offboarding' ? '/rh/offboarding-checklist' : '/rh/onboarding-checklist')}
        style={{ background: 'none', border: 'none', color: '#45B6E4', fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: 0, marginBottom: '14px' }}>
        ← Back to {meta.title}
      </button>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#7C3AED', background: '#F5F3FF', display: 'inline-block', padding: '2px 9px', borderRadius: '10px' }}>{meta.icon} {meta.title}</div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: caseData.status === 'closed' ? '#64748B' : '#059669', background: caseData.status === 'closed' ? '#F1F5F9' : '#ECFDF5', display: 'inline-block', padding: '2px 9px', borderRadius: '10px', textTransform: 'uppercase' as const }}>
                {caseData.status === 'closed' ? 'Closed' : 'Ongoing'}
              </div>
            </div>
            <h1 style={{ fontSize: '19px', fontWeight: '800', color: '#156082', margin: '0 0 6px' }}>{caseData.user_name || caseData.user_email}</h1>
            <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>{caseData.user_email}</p>
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#156082' }}>{doneCount}/{tasks.length}</div>
            <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '10px' }}>tasks done</div>
            {perm.canEdit && caseData.status !== 'closed' && (
              <button onClick={closeCase} disabled={closing} style={{ ...btn, background: '#FEF2F2', color: '#DC2626' }}>{closing ? 'Closing…' : 'Close Case'}</button>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
          <div><div style={lbl}>Location</div><div style={{ fontSize: '12px', color: '#3F3F3F' }}>{caseData.location_name || '—'}</div></div>
          <div><div style={lbl}>Started By</div><div style={{ fontSize: '12px', color: '#3F3F3F' }}>{caseData.started_by_email || '—'}</div></div>
          <div><div style={lbl}>Started</div><div style={{ fontSize: '12px', color: '#3F3F3F' }}>{fmtDateTime(caseData.created_at)}</div></div>
          <div>
            <div style={lbl}>Responsible Person</div>
            <EditableCell display={caseData.responsible_name || caseData.responsible_email} editing={editingResponsible} canEdit={perm.canEdit && caseData.status !== 'closed'} onStartEdit={() => setEditingResponsible(true)}>
              <select autoFocus style={inp} defaultValue={caseData.responsible_email || ''} onChange={e => updateResponsible(e.target.value)} onBlur={() => setEditingResponsible(false)}>
                <option value="">Unassigned</option>
                {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
              </select>
            </EditableCell>
          </div>
        </div>
        {caseData.status === 'closed' && caseData.closed_at && (
          <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '10px', marginBottom: 0 }}>Closed {fmtDateTime(caseData.closed_at)}</p>
        )}
        {error && <div style={{ marginTop: '12px', background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
      </div>

      <div style={card}>
        <div style={lbl}>Tasks ({tasks.length})</div>
        {tasks.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No tasks were generated for this case.</p>
        ) : (
          tasks.map((t: any) => <TaskRow key={t.id} task={t} onValidated={load} />)
        )}
      </div>

      <EquipmentCard caseData={caseData} canEdit={perm.canEdit} onChanged={load} />
    </div>
  )
}

export default function ChecklistCaseDetailPage() {
  return <HRLayout><ChecklistCaseContent /></HRLayout>
}
