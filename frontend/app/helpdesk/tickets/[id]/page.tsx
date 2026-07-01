'use client'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import HelpdeskLayout from '@/components/HelpdeskLayout'
import { API, STATUS_STYLE, PRIORITY_STYLE, BTN } from '../../constants'

export default function TicketDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [ticket, setTicket] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [teamsInfo, setTeamsInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [ef, setEf] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{text:string;type:'success'|'error'}|null>(null)

  const TICKET_TYPE_LABELS: Record<string, string> = {
    incident_request: '🚨 Incident',
    change_request: '🔄 Change',
    information_request: 'ℹ️ Information',
    development_request: '💻 Development',
  }

  const load = async () => {
    const [tr, gr, ti] = await Promise.all([
      fetch(`${API}/helpdesk/tickets/${id}`).then(r => r.json()),
      fetch(`${API}/helpdesk/groups`).then(r => r.json()),
      fetch(`${API}/helpdesk/tickets/${id}/teams`).then(r => r.json()).catch(() => ({has_chat:false})),
    ])
    setTicket(tr.ticket)
    setComments(tr.comments || [])
    setGroups(gr.groups || [])
    setTeamsInfo(ti)
    setEf({
      status: tr.ticket?.status,
      ticket_type: tr.ticket?.ticket_type || '',
      assignee_email: tr.ticket?.assignee_email || '',
      assignee_name: tr.ticket?.assignee_name || '',
      resolution: tr.ticket?.resolution || '',
      group_id: tr.ticket?.group_id || ''
    })
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
    setSaving(true)
    const r = await fetch(`${API}/helpdesk/tickets/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ef)
    })
    const d = await r.json()
    setSaving(false); setEditing(false)
    if (d.teams?.status === 'created') {
      setSaveMsg({ text: '✅ Ticket updated & Teams chat created!', type: 'success' })
    } else if (d.teams?.status === 'existing') {
      setSaveMsg({ text: '✅ Ticket updated & requester added to Teams chat', type: 'success' })
    } else if (d.teams?.status === 'error') {
      setSaveMsg({ text: `⚠️ Ticket saved but Teams error: ${d.teams.message}`, type: 'error' })
    } else {
      setSaveMsg({ text: '✅ Ticket updated', type: 'success' })
    }
    setTimeout(() => setSaveMsg(null), 5000)
    load()
  }

  const syncTeams = async () => {
    setSyncing(true)
    const r = await fetch(`${API}/helpdesk/tickets/${id}/teams/sync`, { method: 'POST' })
    const d = await r.json()
    setSyncing(false)
    if (d.status === 'ok') {
      setSaveMsg({ text: `✅ ${d.synced} message(s) synced from Teams`, type: 'success' })
      setTimeout(() => setSaveMsg(null), 4000)
      load()
    }
  }

  if (loading) return (
    <HelpdeskLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#45B6E4', fontFamily: 'Montserrat, sans-serif' }}>Loading...</div>
    </HelpdeskLayout>
  )
  if (!ticket) return null

  const s = STATUS_STYLE[ticket.status] || STATUS_STYLE.new
  const p = PRIORITY_STYLE[ticket.priority] || PRIORITY_STYLE.medium
  const breached = ticket.sla_deadline && new Date(ticket.sla_deadline) < new Date() && !['resolved', 'closed'].includes(ticket.status)
  const selectedGroup = groups.find((g: any) => g.id === (ef.group_id || ticket.group_id))

  return (
    <HelpdeskLayout>
      <div style={{ padding: '22px 28px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '14px', fontSize: '11px' }}>
          <button onClick={() => router.push('/helpdesk')} style={{ border: 'none', background: 'none', color: '#45B6E4', cursor: 'pointer', fontWeight: '600', fontFamily: 'Montserrat, sans-serif', fontSize: '11px', padding: 0 }}>Helpdesk</button>
          <span style={{ color: '#45B6E4' }}>/</span>
          <button onClick={() => router.push('/helpdesk/tickets')} style={{ border: 'none', background: 'none', color: '#45B6E4', cursor: 'pointer', fontWeight: '600', fontFamily: 'Montserrat, sans-serif', fontSize: '11px', padding: 0 }}>Tickets</button>
          <span style={{ color: '#45B6E4' }}>/</span>
          <span style={{ color: '#156082', fontWeight: '700' }}>{ticket.ticket_number}</span>
        </div>

        {/* Save message */}
        {saveMsg && (
          <div style={{ marginBottom: '14px', padding: '10px 16px', borderRadius: '8px', background: saveMsg.type === 'success' ? '#ECFDF5' : '#FFF7ED', color: saveMsg.type === 'success' ? '#059669' : '#D97706', fontSize: '13px', fontWeight: '600', border: `1px solid ${saveMsg.type === 'success' ? '#A7F3D0' : '#FDE68A'}` }}>
            {saveMsg.text}
          </div>
        )}

        {/* Teams chat banner */}
        {teamsInfo?.has_chat && (
          <div style={{ marginBottom: '14px', padding: '10px 16px', borderRadius: '8px', background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>💬</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#156082' }}>Teams chat active for this ticket</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={syncTeams} disabled={syncing} style={{ ...BTN.secondary, fontSize: '11px', padding: '5px 12px' }}>
                {syncing ? '⏳ Syncing...' : '↻ Sync Messages'}
              </button>
              <a href={teamsInfo.chat_url} target="_blank" rel="noopener noreferrer"
                style={{ ...BTN.primary, fontSize: '11px', padding: '5px 12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Open in Teams ↗
              </a>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: '18px', alignItems: 'start' }}>
          {/* Left */}
          <div>
            {/* Header */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '22px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#45B6E4' }}>{ticket.ticket_number}</span>
                    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>{s.label}</span>
                    <span style={{ background: p.bg, color: p.color, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', textTransform: 'capitalize' }}>{ticket.priority}</span>
                    {ticket.ticket_type && <span style={{ background: '#F1F5F9', color: '#3F3F3F', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{TICKET_TYPE_LABELS[ticket.ticket_type] || ticket.ticket_type}</span>}
                    {ticket.category_name && <span style={{ background: (ticket.category_color || '#45B6E4') + '20', color: ticket.category_color || '#45B6E4', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{ticket.category_icon} {ticket.category_name}</span>}
                    {ticket.subcategory_name && <span style={{ background: '#F1F5F9', color: '#45B6E4', padding: '3px 9px', borderRadius: '20px', fontSize: '11px' }}>{ticket.subcategory_name}</span>}
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
                  <div style={{ fontSize: '11px', color: '#156082', fontWeight: '600' }}>
                    💡 Setting an assignee will automatically create a Teams chat between the requester and assignee.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="form-label">Status</label>
                      <select className="form-input" value={ef.status} onChange={e => setEf((p: any) => ({ ...p, status: e.target.value }))}>
                        {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{(v as any).label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Ticket Type</label>
                      <select className="form-input" value={ef.ticket_type} onChange={e => setEf((p: any) => ({ ...p, ticket_type: e.target.value }))}>
                        <option value="incident_request">Incident Request</option>
                        <option value="change_request">Change Request</option>
                        <option value="information_request">Information Request</option>
                        <option value="development_request">Development Request</option>
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
                        <label className="form-label">Assign to Person 💬 Teams chat will be created</label>
                        <select className="form-input" value={ef.assignee_name} onChange={e => {
                          const m = selectedGroup.members.find((mm: any) => mm.user_name === e.target.value)
                          setEf((p: any) => ({ ...p, assignee_name: e.target.value, assignee_email: m?.user_email || '' }))
                        }}>
                          <option value="">Select person...</option>
                          {selectedGroup.members.map((m: any) => <option key={m.user_email} value={m.user_name}>{m.user_name}{m.is_responsible ? ' ⭐' : ''}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="form-label">Assignee Email</label>
                      <input className="form-input" value={ef.assignee_email} onChange={e => setEf((p: any) => ({ ...p, assignee_email: e.target.value }))} placeholder="agent@wcomply.com" />
                    </div>
                  </div>
                  {['resolved', 'closed'].includes(ef.status) && (
                    <div>
                      <label className="form-label">Resolution</label>
                      <textarea className="form-input" value={ef.resolution} onChange={e => setEf((p: any) => ({ ...p, resolution: e.target.value }))} rows={3} placeholder="How was this resolved?" />
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={save} disabled={saving} style={{ ...BTN.primary, opacity: saving ? 0.6 : 1 }}>
                      {saving ? '⏳ Saving...' : '💾 Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Comments / Activity */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', margin: 0 }}>
                  Activity & Comments ({comments.length})
                </h3>
                {teamsInfo?.has_chat && (
                  <button onClick={syncTeams} disabled={syncing} style={{ ...BTN.secondary, fontSize: '10px', padding: '4px 10px' }}>
                    {syncing ? '⏳' : '↻'} Sync Teams
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
                {comments.length === 0 && <p style={{ color: '#45B6E4', fontSize: '13px' }}>No comments yet.</p>}
                {comments.map((c: any) => {
                  const isTeams = c.author_name?.startsWith('[Teams]')
                  return (
                    <div key={c.id} style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: isTeams ? '#5059C9' : c.is_internal ? '#FFF7ED' : '#EFF6FF', color: isTeams ? 'white' : c.is_internal ? '#D97706' : '#156082', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isTeams ? '14px' : '12px', fontWeight: '800', flexShrink: 0 }}>
                        {isTeams ? '💬' : (c.author_name?.[0]?.toUpperCase() || '?')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: isTeams ? '#5059C9' : '#156082' }}>{c.author_name || c.author_email}</span>
                          <span style={{ fontSize: '11px', color: '#45B6E4' }}>{new Date(c.created_at).toLocaleString()}</span>
                          {c.is_internal && <span style={{ background: '#FFF7ED', color: '#D97706', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: '700' }}>🔒 Internal</span>}
                          {isTeams && <span style={{ background: '#EEF2FF', color: '#5059C9', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: '700' }}>Teams</span>}
                        </div>
                        <div style={{ background: isTeams ? '#F5F3FF' : c.is_internal ? '#FFFBEB' : '#F8FAFC', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#3F3F3F', lineHeight: '1.6', border: `1px solid ${isTeams ? '#DDD6FE' : c.is_internal ? '#FDE68A' : '#EDF2F7'}`, whiteSpace: 'pre-wrap' }}>
                          {c.content}
                        </div>
                      </div>
                    </div>
                  )
                })}
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
            {/* Teams */}
            <div style={{ background: teamsInfo?.has_chat ? '#EFF6FF' : 'white', borderRadius: '12px', border: `1px solid ${teamsInfo?.has_chat ? '#BFDBFE' : '#EDF2F7'}`, padding: '14px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '8px' }}>Teams Chat</div>
              {teamsInfo?.has_chat ? (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#156082', marginBottom: '8px' }}>💬 Chat Active</div>
                  <a href={teamsInfo.chat_url} target="_blank" rel="noopener noreferrer" style={{ ...BTN.primary, fontSize: '11px', padding: '5px 12px', textDecoration: 'none', display: 'inline-block' }}>Open in Teams ↗</a>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#45B6E4' }}>No Teams chat yet. Assign the ticket to create one automatically.</div>
              )}
            </div>

            {/* SLA */}
            <div style={{ background: breached ? '#FEF2F2' : 'white', borderRadius: '12px', border: `1px solid ${breached ? '#FECACA' : '#EDF2F7'}`, padding: '14px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: breached ? '#DC2626' : '#45B6E4', marginBottom: '6px' }}>SLA</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: breached ? '#DC2626' : '#059669' }}>{breached ? '⚠️ Breached' : '✅ OK'}</div>
              {ticket.sla_deadline && <div style={{ fontSize: '11px', color: '#45B6E4', marginTop: '4px' }}>{new Date(ticket.sla_deadline).toLocaleString()}</div>}
            </div>

            {/* Assignment */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '14px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '10px' }}>Assignment</div>
              {[
                { label: 'Group', value: ticket.group_name || '—' },
                { label: 'Responsible', value: ticket.responsible_name ? `⭐ ${ticket.responsible_name}` : '—' },
                { label: 'Assignee', value: ticket.assignee_name || ticket.assignee_email || 'Unassigned' },
              ].map(item => (
                <div key={item.label} style={{ padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '2px' }}>{item.label}</div>
                  <div style={{ fontSize: '12px', color: '#3F3F3F', fontWeight: '500' }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Details */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '14px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '10px' }}>Details</div>
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
    </HelpdeskLayout>
  )
}
