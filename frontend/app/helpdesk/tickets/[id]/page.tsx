'use client'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { API, STATUS_STYLE, PRIORITY_STYLE, BTN } from '../../constants'

export default function TicketDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [ticket, setTicket] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [ef, setEf] = useState<any>({})

  const load = async () => {
    const [tr, gr] = await Promise.all([
      fetch(`${API}/helpdesk/tickets/${id}`).then(r => r.json()),
      fetch(`${API}/helpdesk/groups`).then(r => r.json()),
    ])
    setTicket(tr.ticket); setComments(tr.comments || [])
    setGroups(gr.groups || [])
    setEf({ status: tr.ticket?.status, assignee_email: tr.ticket?.assignee_email || '', assignee_name: tr.ticket?.assignee_name || '', resolution: tr.ticket?.resolution || '', group_id: tr.ticket?.group_id || '' })
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const addComment = async () => {
    if (!comment.trim()) return
    setSubmitting(true)
    await fetch(`${API}/helpdesk/tickets/${id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: comment, is_internal: isInternal, author_email: 'admin@wcomply.com', author_name: 'Admin' })
    })
    setComment(''); setSubmitting(false); load()
  }

  const save = async () => {
    await fetch(`${API}/helpdesk/tickets/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ef)
    })
    setEditing(false); load()
  }

  if (loading) return <div style={{ display: 'flex' }}><Sidebar /><main style={{ marginLeft: '220px', padding: '48px', color: '#45B6E4', fontFamily: 'Montserrat, sans-serif' }}>Loading...</main></div>
  if (!ticket) return null

  const s = STATUS_STYLE[ticket.status] || STATUS_STYLE.new
  const p = PRIORITY_STYLE[ticket.priority] || PRIORITY_STYLE.medium
  const breached = ticket.sla_deadline && new Date(ticket.sla_deadline) < new Date() && !['resolved','closed'].includes(ticket.status)
  const selectedGroup = groups.find((g: any) => g.id === (ef.group_id || ticket.group_id))

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
        <div style={{ padding: '22px 28px' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '14px', fontSize: '11px' }}>
            <button onClick={() => router.push('/helpdesk')} style={{ border: 'none', background: 'none', color: '#45B6E4', cursor: 'pointer', fontWeight: '600', fontFamily: 'Montserrat, sans-serif', fontSize: '11px', padding: 0 }}>Helpdesk</button>
            <span style={{ color: '#45B6E4' }}>/</span>
            <button onClick={() => router.push('/helpdesk/tickets')} style={{ border: 'none', background: 'none', color: '#45B6E4', cursor: 'pointer', fontWeight: '600', fontFamily: 'Montserrat, sans-serif', fontSize: '11px', padding: 0 }}>Tickets</button>
            <span style={{ color: '#45B6E4' }}>/</span>
            <span style={{ color: '#156082', fontWeight: '700' }}>{ticket.ticket_number}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: '18px', alignItems: 'start' }}>
            {/* Left */}
            <div>
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '22px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#45B6E4' }}>{ticket.ticket_number}</span>
                      <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>{s.label}</span>
                      <span style={{ background: p.bg, color: p.color, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', textTransform: 'capitalize' }}>{ticket.priority}</span>
                      {ticket.category_name && <span style={{ background: (ticket.category_color||'#45B6E4')+'20', color: ticket.category_color||'#45B6E4', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{ticket.category_icon} {ticket.category_name}</span>}
                      {ticket.subcategory_name && <span style={{ background: '#F1F5F9', color: '#45B6E4', padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{ticket.subcategory_name}</span>}
                    </div>
                    <h1 style={{ fontSize: '17px', fontWeight: '800', color: '#156082', margin: 0 }}>{ticket.title}</h1>
                  </div>
                  <button onClick={() => setEditing(!editing)} style={{ ...BTN.secondary, flexShrink: 0, marginLeft: '12px', background: editing ? '#FEF2F2' : 'white', color: editing ? '#DC2626' : '#156082', borderColor: editing ? '#FECACA' : '#45B6E4' }}>
                    {editing ? '✕ Cancel' : '✎ Edit'}
                  </button>
                </div>
                {ticket.description && <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '14px', fontSize: '13px', color: '#3F3F3F', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{ticket.description}</div>}

                {editing && (
                  <div style={{ marginTop: '14px', padding: '16px', background: '#F0F9FF', borderRadius: '10px', border: '1px solid #BAE6FD', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label className="form-label">Status</label>
                        <select className="form-input" value={ef.status} onChange={e => setEf((p: any) => ({ ...p, status: e.target.value }))}>
                          {Object.entries(STATUS_STYLE).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Assign to Group</label>
                        <select className="form-input" value={ef.group_id} onChange={e => setEf((p: any) => ({ ...p, group_id: e.target.value }))}>
                          <option value="">No group</option>
                          {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      </div>
                      {selectedGroup?.members?.length > 0 && (
                        <div>
                          <label className="form-label">Assign to Person</label>
                          <select className="form-input" value={ef.assignee_name} onChange={e => {
                            const m = selectedGroup.members.find((mm: any) => mm.user_name === e.target.value)
                            setEf((p: any) => ({ ...p, assignee_name: e.target.value, assignee_email: m?.user_email || '' }))
                          }}>
                            <option value="">Select person...</option>
                            {selectedGroup.members.map((m: any) => <option key={m.user_email} value={m.user_name}>{m.user_name} {m.is_responsible ? '⭐' : ''}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                    {['resolved','closed'].includes(ef.status) && (
                      <div>
                        <label className="form-label">Resolution</label>
                        <textarea className="form-input" value={ef.resolution} onChange={e => setEf((p: any) => ({ ...p, resolution: e.target.value }))} rows={3} placeholder="How was this resolved?" />
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={save} style={BTN.primary}>Save Changes</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Comments */}
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '18px' }}>Activity & Comments ({comments.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
                  {comments.length === 0 && <p style={{ color: '#45B6E4', fontSize: '13px' }}>No comments yet.</p>}
                  {comments.map((c: any) => (
                    <div key={c.id} style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: c.is_internal ? '#FFF7ED' : '#EFF6FF', color: c.is_internal ? '#D97706' : '#156082', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', flexShrink: 0 }}>
                        {c.author_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#156082' }}>{c.author_name || c.author_email}</span>
                          <span style={{ fontSize: '11px', color: '#45B6E4' }}>{new Date(c.created_at).toLocaleString()}</span>
                          {c.is_internal && <span style={{ background: '#FFF7ED', color: '#D97706', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: '700' }}>🔒 Internal</span>}
                        </div>
                        <div style={{ background: c.is_internal ? '#FFFBEB' : '#F8FAFC', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#3F3F3F', lineHeight: '1.6', border: `1px solid ${c.is_internal ? '#FDE68A' : '#EDF2F7'}`, whiteSpace: 'pre-wrap' }}>{c.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid #EDF2F7', paddingTop: '14px' }}>
                  <textarea className="form-input" value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a reply or note..." rows={3} style={{ marginBottom: '10px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#45B6E4', fontWeight: '600' }}>
                      <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} /> Internal note only
                    </label>
                    <button onClick={addComment} disabled={submitting || !comment.trim()} style={{ ...BTN.primary, opacity: (submitting || !comment.trim()) ? 0.6 : 1 }}>
                      {submitting ? 'Sending...' : isInternal ? '🔒 Add Note' : '💬 Reply'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: breached ? '#FEF2F2' : 'white', borderRadius: '12px', border: `1px solid ${breached ? '#FECACA' : '#EDF2F7'}`, padding: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: breached ? '#DC2626' : '#45B6E4', marginBottom: '6px' }}>SLA Status</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: breached ? '#DC2626' : '#059669' }}>{breached ? '⚠️ SLA Breached' : '✅ Within SLA'}</div>
                {ticket.sla_deadline && <div style={{ fontSize: '11px', color: '#45B6E4', marginTop: '4px' }}>Deadline: {new Date(ticket.sla_deadline).toLocaleString()}</div>}
              </div>

              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '10px' }}>Assignment</div>
                <div style={{ fontSize: '12px', color: '#3F3F3F', marginBottom: '4px' }}>
                  <span style={{ color: '#45B6E4', fontSize: '10px' }}>GROUP</span><br />
                  <strong>{ticket.group_name || '—'}</strong>
                </div>
                {ticket.responsible_name && (
                  <div style={{ fontSize: '12px', color: '#3F3F3F', marginBottom: '4px', marginTop: '8px' }}>
                    <span style={{ color: '#45B6E4', fontSize: '10px' }}>RESPONSIBLE</span><br />
                    <strong>⭐ {ticket.responsible_name}</strong>
                  </div>
                )}
                <div style={{ fontSize: '12px', color: '#3F3F3F', marginTop: '8px' }}>
                  <span style={{ color: '#45B6E4', fontSize: '10px' }}>ASSIGNEE</span><br />
                  <strong>{ticket.assignee_name || ticket.assignee_email || 'Unassigned'}</strong>
                </div>
              </div>

              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '10px' }}>Ticket Details</div>
                {[
                  { label: 'Requester', value: ticket.requester_name || ticket.requester_email },
                  { label: 'Email', value: ticket.requester_email },
                  { label: 'Type', value: ticket.requester_type === 'internal' ? '🏢 Internal' : '🌐 External' },
                  { label: 'Created', value: new Date(ticket.created_at).toLocaleString() },
                  { label: 'Updated', value: new Date(ticket.updated_at).toLocaleString() },
                  { label: 'Resolved', value: ticket.resolved_at ? new Date(ticket.resolved_at).toLocaleString() : '—' },
                ].map(item => (
                  <div key={item.label} style={{ padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '2px' }}>{item.label}</div>
                    <div style={{ fontSize: '12px', color: '#3F3F3F', fontWeight: '500' }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {ticket.resolution && (
                <div style={{ background: '#ECFDF5', borderRadius: '12px', border: '1px solid #A7F3D0', padding: '14px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#059669', marginBottom: '6px' }}>Resolution</div>
                  <p style={{ fontSize: '12px', color: '#3F3F3F', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>{ticket.resolution}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
