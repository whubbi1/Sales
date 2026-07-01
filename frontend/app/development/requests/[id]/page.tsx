'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import DevelopmentLayout, { useDevPerm } from '@/components/DevelopmentLayout'
import { getStoredUser } from '@/lib/auth'
import {
  API, APPLICATIONS, REQUEST_STATUSES, REQUEST_PRIORITIES,
  getRequestStatus, getRequestPriority
} from '../../constants'

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white', width: '100%', boxSizing: 'border-box' as const,
}
const label: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

function RequestDetailContent() {
  const router = useRouter()
  const { canEdit } = useDevPerm()
  const [req, setReq]         = useState<any>(null)
  const [activity, setActivity] = useState<any[]>([])
  const [pipelines, setPipelines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [comment, setComment] = useState('')
  const [addingComment, setAddingComment] = useState(false)
  const [form, setForm]       = useState<any>({})
  const user                  = useRef<any>(null)
  const activityEndRef        = useRef<HTMLDivElement>(null)

  const id = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : ''

  useEffect(() => {
    user.current = getStoredUser()
    loadData()
    fetch(`${API}/development/pipelines`).then(r => r.json()).then(d => setPipelines(d.pipelines || [])).catch(() => {})
  }, [])

  useEffect(() => {
    activityEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activity])

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    const d = await fetch(`${API}/development/requests/${id}`).then(r => r.json()).catch(() => null)
    if (d?.request) {
      setReq(d.request)
      setForm({
        title: d.request.title || '',
        status: d.request.status || 'new',
        priority: d.request.priority || 'medium',
        application: d.request.application || '',
        assignee_email: d.request.assignee_email || '',
        assignee_name: d.request.assignee_name || '',
        pipeline_id: d.request.pipeline_id || '',
      })
      setActivity(d.activity || [])
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!id) return
    setSaving(true)
    await fetch(`${API}/development/requests/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        pipeline_id: form.pipeline_id || null,
        updated_by: user.current?.email || '',
        updated_by_name: user.current?.name || user.current?.email || 'System',
      }),
    })
    setSaving(false)
    setEditing(false)
    loadData()
  }

  const handleAddComment = async () => {
    if (!comment.trim() || !id) return
    setAddingComment(true)
    await fetch(`${API}/development/requests/${id}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: comment,
        author_email: user.current?.email || '',
        author_name: user.current?.name || user.current?.email || '',
      }),
    })
    setComment('')
    setAddingComment(false)
    loadData()
  }

  if (loading) return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  )
  if (!req) return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>Request not found.</div>
  )

  const st = getRequestStatus(req.status)
  const pr = getRequestPriority(req.priority)

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button onClick={() => router.push('/development/requests')} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', fontSize: '12px', color: '#64748B', fontFamily: 'Montserrat, sans-serif', fontWeight: '600' }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#156082', margin: 0 }}>{req.request_number}</h1>
            <span style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700' }}>{st.label}</span>
            <span style={{ background: pr.bg, color: pr.color, padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700' }}>{pr.label}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>{req.title}</div>
        </div>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)} style={{ padding: '8px 16px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Edit</button>
        )}
        {editing && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setEditing(false); setForm({ title: req.title, status: req.status, priority: req.priority, application: req.application, assignee_email: req.assignee_email || '', assignee_name: req.assignee_name || '', pipeline_id: req.pipeline_id || '' }) }} style={{ padding: '8px 16px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', background: saving ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'wait' : 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>
        {/* Left: details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Description — always read-only */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#45B6E4', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Description</div>
            <div style={{ fontSize: '13px', color: '#3F3F3F', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{req.description || <span style={{ color: '#94A3B8' }}>No description provided.</span>}</div>
          </div>

          {/* Editable fields */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#45B6E4', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <span style={label}>Title</span>
                {editing ? <input style={inp} value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} /> : <div style={{ fontSize: '13px', color: '#3F3F3F' }}>{req.title}</div>}
              </div>
              <div>
                <span style={label}>Application</span>
                {editing ? (
                  <select style={inp} value={form.application} onChange={e => setForm((f: any) => ({ ...f, application: e.target.value }))}>
                    <option value="">Select…</option>
                    {APPLICATIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                ) : <div style={{ fontSize: '13px', color: '#3F3F3F' }}>{req.application || '—'}</div>}
              </div>
              <div>
                <span style={label}>Status</span>
                {editing ? (
                  <select style={inp} value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                    {REQUEST_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                ) : <span style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>{st.label}</span>}
              </div>
              <div>
                <span style={label}>Priority</span>
                {editing ? (
                  <select style={inp} value={form.priority} onChange={e => setForm((f: any) => ({ ...f, priority: e.target.value }))}>
                    {REQUEST_PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                ) : <span style={{ background: pr.bg, color: pr.color, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>{pr.label}</span>}
              </div>
              <div>
                <span style={label}>Pipeline</span>
                {editing ? (
                  <select style={inp} value={form.pipeline_id} onChange={e => setForm((f: any) => ({ ...f, pipeline_id: e.target.value }))}>
                    <option value="">None</option>
                    {pipelines.map((p: any) => <option key={p.id} value={p.id}>{p.pipeline_code} – {p.name}</option>)}
                  </select>
                ) : req.pipeline_code ? (
                  <span style={{ background: '#EFF6FF', color: '#3B82F6', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>{req.pipeline_code} – {req.pipeline_name}</span>
                ) : <div style={{ fontSize: '13px', color: '#94A3B8' }}>None</div>}
              </div>
              <div>
                <span style={label}>Assignee Email</span>
                {editing ? <input style={inp} placeholder="email@example.com" value={form.assignee_email} onChange={e => setForm((f: any) => ({ ...f, assignee_email: e.target.value }))} />
                  : <div style={{ fontSize: '13px', color: '#3F3F3F' }}>{req.assignee_email || '—'}</div>}
              </div>
              <div>
                <span style={label}>Assignee Name</span>
                {editing ? <input style={inp} placeholder="Full name" value={form.assignee_name} onChange={e => setForm((f: any) => ({ ...f, assignee_name: e.target.value }))} />
                  : <div style={{ fontSize: '13px', color: '#3F3F3F' }}>{req.assignee_name || '—'}</div>}
              </div>
            </div>
          </div>

          {/* Meta */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '12px' }}>
              <div><span style={label}>Requester</span><div style={{ color: '#3F3F3F' }}>{req.requester_name || req.requester_email || '—'}</div></div>
              <div><span style={label}>Created</span><div style={{ color: '#3F3F3F' }}>{req.created_at ? new Date(req.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div></div>
              <div><span style={label}>Last Updated</span><div style={{ color: '#3F3F3F' }}>{req.updated_at ? new Date(req.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div></div>
            </div>
          </div>
        </div>

        {/* Right: activity */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', maxHeight: '75vh' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #EDF2F7', fontSize: '11px', fontWeight: '700', color: '#45B6E4', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Activity Log
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activity.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '12px', padding: '20px 0' }}>No activity yet.</div>
            ) : activity.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: a.is_system ? '#F1F5F9' : '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>
                  {a.is_system ? '⚙️' : '💬'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '2px' }}>
                    <span style={{ fontWeight: '700', color: '#156082' }}>{a.author_name || a.author_email || 'System'}</span>
                    {' · '}
                    {new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                    {' '}
                    {new Date(a.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ fontSize: '12px', color: a.is_system ? '#94A3B8' : '#3F3F3F', fontStyle: a.is_system ? 'italic' : 'normal', lineHeight: '1.5' }}>{a.content}</div>
                </div>
              </div>
            ))}
            <div ref={activityEndRef} />
          </div>
          {canEdit && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid #EDF2F7' }}>
              <textarea
                style={{ ...inp, minHeight: '64px', resize: 'vertical', fontSize: '12px' }}
                placeholder="Add a comment…"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
              <button onClick={handleAddComment} disabled={!comment.trim() || addingComment}
                style={{ marginTop: '8px', width: '100%', padding: '8px', background: !comment.trim() || addingComment ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
                {addingComment ? 'Posting…' : 'Post Comment'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DevRequestDetailPage() {
  return <DevelopmentLayout><RequestDetailContent /></DevelopmentLayout>
}
