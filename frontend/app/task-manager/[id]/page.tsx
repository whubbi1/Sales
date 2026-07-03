'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import TasksLayout from '@/components/TasksLayout'
import { taskManagerAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { TaskModal } from '@/components/tasks/TaskModal'

const API = 'https://api.whubbi.wcomply.com'

const TOP_STATUSES = ['new', 'open', 'in_progress', 'resolved', 'closed']
const SUB_STATUSES = ['new', 'in_progress', 'resolved']
const STATUS_LABEL: Record<string, string> = { new: 'New', open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' }
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
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
function fmtDateTime(d: string) {
  return d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
}

function TaskDetailContent() {
  const { id } = useParams()
  const router = useRouter()
  const [task, setTask] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showSubtaskModal, setShowSubtaskModal] = useState(false)
  const [reassignTo, setReassignTo] = useState('')
  const [watcherEmail, setWatcherEmail] = useState('')
  const [comment, setComment] = useState('')
  const [teamsInfo, setTeamsInfo] = useState<{ has_chat: boolean; chat_url?: string }>({ has_chat: false })
  const me = getStoredUser()?.email || ''

  const load = async () => {
    setLoading(true)
    try {
      const t = await taskManagerAPI.get(id as string)
      setTask(t)
      setReassignTo(t.assignee_email || '')
      taskManagerAPI.getTeamsInfo(id as string).then(setTeamsInfo).catch(() => {})
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    fetch(`${API}/settings/users`).then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [id])

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (!task) return <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>Task not found.</div>

  const isSubtask = !!task.parent_task_id
  const isOwner = me === task.owner_email
  const isAssignee = me === task.assignee_email
  const isSubtaskOwnerHere = !isSubtask && (task.subtasks || []).some((s: any) => s.owner_email === me)
  const canAct = isOwner || isAssignee || isSubtaskOwnerHere
  const statuses = isSubtask ? SUB_STATUSES : TOP_STATUSES

  const setStatus = async (status: string) => {
    setError('')
    try { await taskManagerAPI.setStatus(task.id, { acting_email: me, status }); load() }
    catch (e: any) { setError(e.message) }
  }

  const reassign = async () => {
    if (!reassignTo || reassignTo === task.assignee_email) return
    const u = users.find(u => u.email === reassignTo)
    try { await taskManagerAPI.reassign(task.id, { acting_email: me, new_assignee_email: reassignTo, new_assignee_name: u?.display_name || '' }); load() }
    catch (e: any) { setError(e.message) }
  }

  const addWatcher = async () => {
    if (!watcherEmail) return
    const u = users.find(u => u.email === watcherEmail)
    await taskManagerAPI.addWatcher(task.id, { acting_email: me, user_email: watcherEmail, user_name: u?.display_name || '' })
    setWatcherEmail('')
    load()
  }
  const removeWatcher = async (email: string) => {
    await taskManagerAPI.removeWatcher(task.id, email, me)
    load()
  }

  const addComment = async () => {
    if (!comment.trim()) return
    const meUser = getStoredUser()
    await taskManagerAPI.addComment(task.id, { author_email: me, author_name: meUser?.name || me, content: comment.trim() })
    setComment('')
    load()
  }

  const syncTeams = async () => { await taskManagerAPI.syncTeams(task.id); load() }

  return (
    <div style={{ padding: '24px 28px', maxWidth: '900px' }}>
      <button onClick={() => router.push('/task-manager')} style={{ background: 'none', border: 'none', color: '#45B6E4', fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: 0, marginBottom: '14px' }}>← Back to My Tasks</button>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ background: '#F1F5F9', color: '#3F3F3F', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', textTransform: 'capitalize' }}>{task.source}</span>
              {isSubtask && <span style={{ background: '#EEF2FF', color: '#156082', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>Subtask</span>}
            </div>
            <h1 style={{ fontSize: '19px', fontWeight: '800', color: '#156082', margin: '0 0 6px' }}>{task.title}</h1>
            <p style={{ fontSize: '12px', color: '#64748B', margin: 0, whiteSpace: 'pre-wrap' }}>{task.description || 'No description.'}</p>
          </div>
          <span style={{ background: STATUS_COLOR[task.status]?.bg, color: STATUS_COLOR[task.status]?.color, padding: '4px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>{STATUS_LABEL[task.status]}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
          <div><div style={lbl}>Owner</div><div style={{ fontSize: '12px', color: '#3F3F3F' }}>{task.owner_name || task.owner_email}</div></div>
          <div><div style={lbl}>Assignee</div><div style={{ fontSize: '12px', color: '#3F3F3F' }}>{task.assignee_name || task.assignee_email || '—'}</div></div>
          <div><div style={lbl}>Due Date</div><div style={{ fontSize: '12px', color: '#3F3F3F' }}>{fmtDate(task.due_date)}</div></div>
        </div>

        {canAct && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
            <div style={lbl}>Change Status</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {statuses.map(s => (
                <button key={s} onClick={() => setStatus(s)} disabled={s === task.status}
                  style={{ ...btn, background: s === task.status ? STATUS_COLOR[s]?.bg : '#F8FAFC', color: s === task.status ? STATUS_COLOR[s]?.color : '#64748B', cursor: s === task.status ? 'default' : 'pointer' }}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            {!isOwner && <p style={{ fontSize: '10px', color: '#94A3B8', marginTop: '6px' }}>Only the task owner can close it{!isSubtask ? ', and resolving requires all subtasks to be resolved first' : ''}.</p>}
          </div>
        )}
        {error && <div style={{ marginTop: '12px', background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
      </div>

      {(isOwner || isAssignee) && (
        <div style={card}>
          <div style={lbl}>Reassign</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select style={{ ...inp, flex: 1 }} value={reassignTo} onChange={e => setReassignTo(e.target.value)}>
              <option value="">Select a person…</option>
              {users.map(u => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
            </select>
            <button onClick={reassign} style={{ ...btn, background: '#156082', color: 'white' }}>Reassign</button>
          </div>
        </div>
      )}

      {!isSubtask && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={lbl}>Subtasks ({(task.subtasks || []).length})</div>
            {(isOwner || isAssignee) && <button onClick={() => setShowSubtaskModal(true)} style={{ ...btn, background: '#EFF6FF', color: '#156082' }}>+ Add Subtask</button>}
          </div>
          {(task.subtasks || []).length === 0 ? (
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No subtasks yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {task.subtasks.map((s: any) => (
                <div key={s.id} onClick={() => router.push(`/task-manager/${s.id}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', border: '1px solid #EDF2F7', borderRadius: '8px', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#156082' }}>{s.title}</div>
                    <div style={{ fontSize: '10px', color: '#94A3B8' }}>Owned by {s.owner_name || s.owner_email}</div>
                  </div>
                  <span style={{ background: STATUS_COLOR[s.status]?.bg, color: STATUS_COLOR[s.status]?.color, padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{STATUS_LABEL[s.status]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={lbl}>Watchers — view-only, informed of progress ({(task.watchers || []).length})</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: (isOwner || isAssignee) ? '10px' : 0 }}>
          {(task.watchers || []).map((w: any) => (
            <span key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '4px 10px', fontSize: '11px', color: '#3F3F3F' }}>
              {w.user_name || w.user_email}
              {(isOwner || isAssignee || w.user_email === me) && (
                <button onClick={() => removeWatcher(w.user_email)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '13px', padding: 0, lineHeight: 1 }}>×</button>
              )}
            </span>
          ))}
          {(task.watchers || []).length === 0 && <span style={{ fontSize: '11px', color: '#94A3B8' }}>No watchers.</span>}
        </div>
        {(isOwner || isAssignee) && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <select style={{ ...inp, flex: 1 }} value={watcherEmail} onChange={e => setWatcherEmail(e.target.value)}>
              <option value="">Add a watcher…</option>
              {users.map(u => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
            </select>
            <button onClick={addWatcher} style={{ ...btn, background: '#156082', color: 'white' }}>Add</button>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={lbl}>Teams</div>
          {teamsInfo.has_chat && <button onClick={syncTeams} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Sync from Teams</button>}
        </div>
        {teamsInfo.has_chat ? (
          <a href={teamsInfo.chat_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#156082', fontWeight: '700', textDecoration: 'none' }}>💬 Open Teams chat →</a>
        ) : (
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No Teams chat for this task (owner and assignee must be different people).</p>
        )}
      </div>

      <div style={card}>
        <div style={lbl}>Activity</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px', maxHeight: '320px', overflowY: 'auto' }}>
          {(task.comments || []).length === 0 && <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No activity yet.</p>}
          {(task.comments || []).map((c: any) => (
            <div key={c.id} style={{ padding: '8px 12px', background: c.source === 'teams' ? '#EFF6FF' : '#F8FAFC', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94A3B8', marginBottom: '3px' }}>
                <span style={{ fontWeight: '700', color: '#3F3F3F' }}>{c.source === 'teams' ? '💬 ' : ''}{c.author_name || c.author_email}</span>
                <span>{fmtDateTime(c.created_at)}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#3F3F3F', whiteSpace: 'pre-wrap' }}>{c.content}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input style={{ ...inp, flex: 1 }} placeholder="Add a comment…" value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addComment() }} />
          <button onClick={addComment} style={{ ...btn, background: '#156082', color: 'white' }}>Post</button>
        </div>
      </div>

      {showSubtaskModal && (
        <TaskModal hideEntity parentTaskId={task.id} source={task.source} onClose={() => setShowSubtaskModal(false)} onSave={() => { setShowSubtaskModal(false); load() }} />
      )}
    </div>
  )
}

export default function TaskDetailPage() {
  return <TasksLayout><TaskDetailContent /></TasksLayout>
}
