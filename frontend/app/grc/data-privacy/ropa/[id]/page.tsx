'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { GRCLayout, useGRCPerm } from '@/components/GRCLayout'
import { ropaAPI, taskManagerAPI, itAPI } from '@/lib/api'
import { TaskModal } from '@/components/tasks/TaskModal'
import { getStoredUser } from '@/lib/auth'

const card: React.CSSProperties = { background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px 22px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const lbl: React.CSSProperties = { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '6px' }
const inp: React.CSSProperties = { fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white' }
const btn: React.CSSProperties = { padding: '7px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }

const TASK_STATUS_LABEL: Record<string, string> = { new: 'New', open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' }
const TASK_STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  new: { bg: '#F1F5F9', color: '#475569' }, open: { bg: '#EFF6FF', color: '#156082' },
  in_progress: { bg: '#FFF7ED', color: '#D97706' }, resolved: { bg: '#ECFDF5', color: '#059669' }, closed: { bg: '#F1F5F9', color: '#64748B' },
}
const TASK_DONE_STATUSES = ['resolved', 'closed']

const CORE_FIELDS: { key: string; label: string; textarea?: boolean; select?: boolean }[] = [
  { key: 'objective', label: 'Objectif', textarea: true },
  { key: 'legal_base', label: 'Legal Base', textarea: true },
  { key: 'application', label: 'Application', select: true },
  { key: 'data_subject_categories', label: 'Categories of Data Subjects', textarea: true },
  { key: 'data_categories', label: 'Categories of Data Processed', textarea: true },
  { key: 'data_source', label: 'Data Source', textarea: true },
  { key: 'internal_recipients', label: 'Internal Recipients', textarea: true },
  { key: 'external_recipients', label: 'External Recipients / Processors', textarea: true },
  { key: 'transfers_outside_eu', label: 'Transfers Outside the EU', textarea: true },
  { key: 'retention_period', label: 'Retention Period' },
]

const ADDITIONAL_FIELDS: { key: string; label: string }[] = [
  { key: 'security_measures', label: 'Security Measures' },
  { key: 'data_subject_rights', label: 'Rights of Data Subjects' },
  { key: 'legitimate_interest_test', label: 'Legitimate Interest Balancing Test' },
  { key: 'prospecting_disclosure_notice', label: 'Disclosure Notice to Include in Prospecting Emails' },
]

function fmtDate(d: string) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}
function fmtDateTime(d: string) {
  return d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}

function EditableCell({ display, editing, canEdit, onStartEdit, children }: any) {
  return editing ? children : (
    <div onClick={() => canEdit && onStartEdit()} title={canEdit ? 'Click to edit' : undefined}
      style={{ fontSize: '12px', color: '#3F3F3F', cursor: canEdit ? 'pointer' : 'default', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px', whiteSpace: 'pre-wrap' }}
      onMouseEnter={e => canEdit && (e.currentTarget.style.background = '#F1F5F9')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {display || <span style={{ color: '#94A3B8' }}>—</span>}
    </div>
  )
}

function ROPADetailContent() {
  const { id } = useParams()
  const router = useRouter()
  const { level, canEdit } = useGRCPerm('ropa')
  const [record, setRecord] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingField, setEditingField] = useState<string | null>(null)

  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')

  const [revisions, setRevisions] = useState<any[]>([])
  const [showAddRevision, setShowAddRevision] = useState(false)
  const [revDate, setRevDate] = useState(new Date().toISOString().slice(0, 10))
  const [revContent, setRevContent] = useState('')

  const [files, setFiles] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [tasks, setTasks] = useState<any[]>([])
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<any>(null)

  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [applications, setApplications] = useState<any[]>([])

  const me = getStoredUser()

  const load = async () => {
    setLoading(true)
    try {
      const r = await ropaAPI.get(id as string)
      setRecord(r)
      setTasks(r.tasks || [])
      const [c, rev, f] = await Promise.all([ropaAPI.getComments(id as string), ropaAPI.getRevisions(id as string), ropaAPI.getFiles(id as string)])
      setComments(c.comments || [])
      setRevisions(rev.revisions || [])
      setFiles(f.files || [])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])
  useEffect(() => { itAPI.listApplications().then(d => setApplications(d.applications || [])).catch(() => {}) }, [])

  if (level === 'loading' || loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )
  if (!record) return <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>ROPA record not found.</div>

  const updateField = async (fields: any) => {
    setError('')
    try {
      await ropaAPI.update(record.id, fields)
      setEditingField(null)
      load()
    } catch (e: any) { setError(e.message) }
  }

  const addComment = async () => {
    if (!newComment.trim()) return
    await ropaAPI.addComment(record.id, { author_email: me?.email || '', author_name: me?.name || '', comment: newComment.trim() })
    setNewComment('')
    load()
  }
  const deleteComment = async (commentId: string) => {
    await ropaAPI.deleteComment(record.id, commentId)
    load()
  }

  const addRevision = async () => {
    if (!revContent.trim() || !revDate) return
    await ropaAPI.addRevision(record.id, { revision_date: revDate, owner_email: me?.email || '', owner_name: me?.name || '', content: revContent.trim() })
    setRevContent(''); setShowAddRevision(false)
    load()
  }
  const deleteRevision = async (revisionId: string) => {
    await ropaAPI.deleteRevision(record.id, revisionId)
    load()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try { await ropaAPI.uploadFile(record.id, file, me?.email || ''); load() }
    catch (err: any) { setError(err.message) }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }
  const deleteFile = async (fileId: string) => {
    await ropaAPI.deleteFile(record.id, fileId)
    load()
  }

  const reloadTasks = async () => setTasks((await taskManagerAPI.list({ entity_type: 'ropa_record', entity_id: id })).tasks || [])
  const toggleTaskDone = async (task: any) => {
    const done = TASK_DONE_STATUSES.includes(task.status)
    try { await taskManagerAPI.setStatus(task.id, { acting_email: me?.email || '', status: done ? 'new' : 'resolved' }) }
    catch (e: any) { alert(e.message) }
    reloadTasks()
  }
  const deleteTask = async (task: any) => {
    if (!confirm(`Delete task "${task.title}"?`)) return
    try { await taskManagerAPI.delete(task.id, me?.email || '') } catch (e: any) { alert(e.message); return }
    reloadTasks()
  }

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try { await ropaAPI.delete(record.id); router.push('/grc/data-privacy') }
    catch (e: any) { setError(e.message); setDeleting(false) }
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <button onClick={() => router.push('/grc/data-privacy')} style={{ background: 'none', border: 'none', color: '#45B6E4', fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: 0 }}>← Back to Data & Privacy</button>
        {canEdit && <button onClick={() => { setDeleteConfirm(''); setShowDelete(true) }} style={{ ...btn, background: 'white', color: '#DC2626', border: '1.5px solid #FCA5A5' }}>Delete Record</button>}
      </div>

      <div style={card}>
        <EditableCell display={<h1 style={{ fontSize: '19px', fontWeight: '800', color: '#156082', margin: '0 0 6px' }}>{record.name}</h1>}
          editing={editingField === 'name'} canEdit={canEdit} onStartEdit={() => setEditingField('name')}>
          <input autoFocus style={{ ...inp, fontSize: '15px', fontWeight: '700', width: '100%', boxSizing: 'border-box' as const }} defaultValue={record.name}
            onBlur={e => updateField({ name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
        </EditableCell>
        <p style={{ fontSize: '11px', color: '#94A3B8', margin: '6px 0 0' }}>Created {fmtDate(record.created_at)}{record.created_by ? ` by ${record.created_by}` : ''}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
          {CORE_FIELDS.map(f => (
            <div key={f.key}>
              <div style={lbl}>{f.label}</div>
              <EditableCell display={record[f.key]} editing={editingField === f.key} canEdit={canEdit} onStartEdit={() => setEditingField(f.key)}>
                {f.select ? (
                  <select autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} defaultValue={record[f.key] || ''}
                    onChange={e => updateField({ [f.key]: e.target.value })} onBlur={() => setEditingField(null)}>
                    <option value="">Select an application…</option>
                    {record[f.key] && !applications.some((a: any) => a.name === record[f.key]) && (
                      <option value={record[f.key]}>{record[f.key]} (not in inventory)</option>
                    )}
                    {applications.map((a: any) => <option key={a.id} value={a.name}>{a.name}</option>)}
                  </select>
                ) : f.textarea ? (
                  <textarea autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '54px', resize: 'vertical' as const }} defaultValue={record[f.key] || ''}
                    onBlur={e => updateField({ [f.key]: e.target.value })} />
                ) : (
                  <input autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} defaultValue={record[f.key] || ''}
                    onBlur={e => updateField({ [f.key]: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                )}
              </EditableCell>
            </div>
          ))}
        </div>
        {error && <div style={{ marginTop: '12px', background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
      </div>

      <div style={card}>
        <div style={lbl}>Additional Information</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
          {ADDITIONAL_FIELDS.map(f => (
            <div key={f.key}>
              <div style={lbl}>{f.label}</div>
              <EditableCell display={record[f.key]} editing={editingField === f.key} canEdit={canEdit} onStartEdit={() => setEditingField(f.key)}>
                <textarea autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '60px', resize: 'vertical' as const }} defaultValue={record[f.key] || ''}
                  onBlur={e => updateField({ [f.key]: e.target.value })} />
              </EditableCell>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={lbl}>Revision History ({revisions.length})</div>
          {canEdit && !showAddRevision && <button onClick={() => setShowAddRevision(true)} style={{ ...btn, background: '#EFF6FF', color: '#156082' }}>+ Add Revision</button>}
        </div>
        {showAddRevision && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px', padding: '12px', background: '#FAFBFC', borderRadius: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div>
                <div style={lbl}>Revision Date</div>
                <input type="date" style={inp} value={revDate} onChange={e => setRevDate(e.target.value)} />
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>Owner: {me?.name || me?.email}</div>
            </div>
            <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '60px', resize: 'vertical' as const }} placeholder="What changed in this revision…" value={revContent} onChange={e => setRevContent(e.target.value)} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAddRevision(false); setRevContent('') }} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
              <button onClick={addRevision} style={{ ...btn, background: '#156082', color: 'white' }}>Save Revision</button>
            </div>
          </div>
        )}
        {revisions.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No revisions recorded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {revisions.map((r: any) => (
              <div key={r.id} style={{ padding: '10px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#156082' }}>{fmtDate(r.revision_date)} · {r.owner_name || r.owner_email || 'Unknown'}</span>
                  {canEdit && <button onClick={() => deleteRevision(r.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
                </div>
                <p style={{ fontSize: '12px', color: '#3F3F3F', margin: 0, whiteSpace: 'pre-wrap' }}>{r.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={lbl}>Tasks ({tasks.length})</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
          {canEdit && <button onClick={() => { setEditingTask(null); setShowTaskModal(true) }} style={{ ...btn, background: '#EFF6FF', color: '#156082' }}>+ New Task</button>}
        </div>
        {tasks.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No tasks yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {tasks.map((t: any) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                <input type="checkbox" checked={TASK_DONE_STATUSES.includes(t.status)} onChange={() => toggleTaskDone(t)} style={{ accentColor: '#156082', width: '14px', height: '14px', cursor: 'pointer' }} />
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { setEditingTask(t); setShowTaskModal(true) }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: TASK_DONE_STATUSES.includes(t.status) ? '#94A3B8' : '#156082', textDecoration: TASK_DONE_STATUSES.includes(t.status) ? 'line-through' : 'none' }}>{t.title}</div>
                  <div style={{ fontSize: '10px', color: '#94A3B8' }}>{t.owner_name || t.owner_email || 'Unassigned'}{t.due_date && ` · Due ${fmtDate(t.due_date)}`}</div>
                </div>
                <span style={{ background: TASK_STATUS_COLOR[t.status]?.bg, color: TASK_STATUS_COLOR[t.status]?.color, padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{TASK_STATUS_LABEL[t.status]}</span>
                {canEdit && <button onClick={() => deleteTask(t)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={lbl}>Files ({files.length})</div>
          {canEdit && (
            <>
              <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ ...btn, background: '#EFF6FF', color: '#156082' }}>{uploading ? 'Uploading…' : '+ Add File'}</button>
            </>
          )}
        </div>
        {files.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No files attached yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {files.map((f: any) => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                <a href={f.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#156082', fontWeight: '600', textDecoration: 'none' }}>📎 {f.filename}</a>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '10px', color: '#94A3B8' }}>{fmtDateTime(f.uploaded_at)}</span>
                  {canEdit && <button onClick={() => deleteFile(f.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={lbl}>Comments ({comments.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', marginBottom: '12px' }}>
          {comments.map((c: any) => (
            <div key={c.id} style={{ padding: '10px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#156082' }}>{c.author_name || c.author_email}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: '#94A3B8' }}>{fmtDateTime(c.created_at)}</span>
                  <button onClick={() => deleteComment(c.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                </div>
              </div>
              <p style={{ fontSize: '12px', color: '#3F3F3F', margin: 0, whiteSpace: 'pre-wrap' }}>{c.comment}</p>
            </div>
          ))}
          {comments.length === 0 && <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No comments yet.</p>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <textarea style={{ ...inp, flex: 1, minHeight: '40px', resize: 'vertical' as const }} placeholder="Add a comment…" value={newComment} onChange={e => setNewComment(e.target.value)} />
          <button onClick={addComment} style={{ ...btn, background: '#156082', color: 'white', alignSelf: 'flex-end' }}>Post</button>
        </div>
      </div>

      {showTaskModal && (
        <TaskModal
          task={editingTask}
          entityType="ropa_record"
          entityId={record.id}
          entityLabel={`ROPA: ${record.name}`}
          source="grc"
          onClose={() => setShowTaskModal(false)}
          onSave={() => { setShowTaskModal(false); reloadTasks() }}
        />
      )}

      {showDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowDelete(false) }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#DC2626', margin: 0 }}>Delete ROPA Record</h2>
              <button onClick={() => setShowDelete(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: '#3F3F3F', margin: 0 }}>You are about to permanently delete <strong>{record.name}</strong>, including its comments, files, and revision history. This cannot be undone.</p>
              <div>
                <div style={lbl}>Type DELETE to confirm</div>
                <input autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleDelete() }} placeholder="DELETE" />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowDelete(false)} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
                <button onClick={handleDelete} disabled={deleteConfirm !== 'DELETE' || deleting}
                  style={{ ...btn, background: deleteConfirm === 'DELETE' ? '#DC2626' : '#FCA5A5', color: 'white', cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'not-allowed' }}>
                  {deleting ? 'Deleting…' : 'Delete Record'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ROPADetailPage() {
  return <GRCLayout><ROPADetailContent /></GRCLayout>
}
