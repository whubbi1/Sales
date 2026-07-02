'use client'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import HelpdeskLayout from '@/components/HelpdeskLayout'
import { API, STATUS_STYLE, PRIORITY_STYLE, BTN } from '../../constants'

function EditableField({ label, display, editing, onStartEdit, children }: any) {
  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
      <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '2px' }}>{label}</div>
      {editing ? children : (
        <div
          onClick={onStartEdit}
          title="Click to edit"
          style={{ fontSize: '12px', color: '#3F3F3F', fontWeight: '500', cursor: 'pointer', padding: '3px 5px', margin: '-3px -5px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span>{display}</span>
          <span style={{ opacity: 0.35, fontSize: '10px' }}>✎</span>
        </div>
      )}
    </div>
  )
}

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
  const [categories, setCategories] = useState<any[]>([])
  const [editingField, setEditingField] = useState<string | null>(null)

  const TICKET_TYPE_LABELS: Record<string, string> = {
    incident_request: '🚨 Incident',
    change_request: '🔄 Change',
    information_request: 'ℹ️ Information',
    development_request: '💻 Development',
  }

  const load = async () => {
    const [tr, gr, ti, cr] = await Promise.all([
      fetch(`${API}/helpdesk/tickets/${id}`).then(r => r.json()),
      fetch(`${API}/helpdesk/groups`).then(r => r.json()),
      fetch(`${API}/helpdesk/tickets/${id}/teams`).then(r => r.json()).catch(() => ({has_chat:false})),
      fetch(`${API}/helpdesk/categories`).then(r => r.json()).catch(() => ({categories:[]})),
    ])
    setTicket(tr.ticket)
    setComments(tr.comments || [])
    setGroups(gr.groups || [])
    setTeamsInfo(ti)
    setCategories(cr.categories || [])
    setEf({
      status: tr.ticket?.status,
      priority: tr.ticket?.priority || '',
      ticket_type: tr.ticket?.ticket_type || '',
      category_id: tr.ticket?.category_id || '',
      subcategory_id: tr.ticket?.subcategory_id || '',
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
    const ok = await patch(ef, { silent: true })
    setSaving(false); setEditing(false)
    if (!ok) return
    setSaveMsg({ text: '✅ Ticket updated', type: 'success' })
    setTimeout(() => setSaveMsg(null), 5000)
  }

  // Single-field (or partial) inline save. Merges over the full ef payload since the
  // backend expects every field on every PUT. Returns true on success.
  const patch = async (fields: any, opts: { silent?: boolean } = {}) => {
    const payload = { ...ef, ...fields }
    setEf(payload)
    let r: Response
    try {
      r = await fetch(`${API}/helpdesk/tickets/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })
    } catch {
      setSaveMsg({ text: '⚠️ Could not reach the server. Change not saved.', type: 'error' })
      setTimeout(() => setSaveMsg(null), 6000)
      return false
    }
    if (!r.ok) {
      setSaveMsg({ text: '⚠️ Failed to save change. Please try again.', type: 'error' })
      setTimeout(() => setSaveMsg(null), 6000)
      return false
    }
    const d = await r.json()
    if (d.status && d.status !== 'ok') {
      setSaveMsg({ text: `⚠️ ${d.message || 'Failed to save change.'}`, type: 'error' })
      setTimeout(() => setSaveMsg(null), 6000)
      return false
    }
    if (!opts.silent) {
      if (d.teams?.status === 'created') {
        setSaveMsg({ text: '✅ Saved & Teams chat created!', type: 'success' })
      } else if (d.teams?.status === 'existing') {
        setSaveMsg({ text: '✅ Saved & requester added to Teams chat', type: 'success' })
      } else if (d.teams?.status === 'error') {
        setSaveMsg({ text: `⚠️ Saved but Teams error: ${d.teams.message}`, type: 'error' })
      } else {
        setSaveMsg({ text: '✅ Saved', type: 'success' })
      }
      setTimeout(() => setSaveMsg(null), 4000)
    }
    await load()
    return true
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
  const selectedCategory = categories.find((c: any) => c.id === (ef.category_id || ticket.category_id))
  const selectFieldStyle: React.CSSProperties = { fontSize: '12px', padding: '4px 6px', borderRadius: '5px', border: '1px solid #BAE6FD', width: '100%', fontFamily: 'Montserrat, sans-serif' }

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
                    💡 Priority, category, subcategory and assignment can be changed directly from the boxes on the right — just click a field.
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

            {/* Classification */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '14px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '10px' }}>Classification</div>

              <EditableField
                label="Priority"
                editing={editingField === 'priority'}
                onStartEdit={() => setEditingField('priority')}
                display={<span style={{ textTransform: 'capitalize' }}>{ticket.priority}</span>}
              >
                <select autoFocus style={selectFieldStyle} value={ef.priority}
                  onChange={e => { patch({ priority: e.target.value }); setEditingField(null) }}
                  onBlur={() => setEditingField(null)}>
                  {Object.keys(PRIORITY_STYLE).map(k => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}
                </select>
              </EditableField>

              <EditableField
                label="Category"
                editing={editingField === 'category'}
                onStartEdit={() => setEditingField('category')}
                display={ticket.category_name ? `${ticket.category_icon || ''} ${ticket.category_name}` : '—'}
              >
                <select autoFocus style={selectFieldStyle} value={ef.category_id}
                  onChange={e => { patch({ category_id: e.target.value || '__clear__', subcategory_id: '__clear__' }); setEditingField(null) }}
                  onBlur={() => setEditingField(null)}>
                  <option value="">No category</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </EditableField>

              {selectedCategory?.subcategories?.length > 0 && (
                <EditableField
                  label="Subcategory"
                  editing={editingField === 'subcategory'}
                  onStartEdit={() => setEditingField('subcategory')}
                  display={ticket.subcategory_name || '—'}
                >
                  <select autoFocus style={selectFieldStyle} value={ef.subcategory_id}
                    onChange={e => { patch({ subcategory_id: e.target.value || '__clear__' }); setEditingField(null) }}
                    onBlur={() => setEditingField(null)}>
                    <option value="">No subcategory</option>
                    {selectedCategory.subcategories.map((sc: any) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                  </select>
                </EditableField>
              )}
            </div>

            {/* Assignment */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '14px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '10px' }}>Assignment</div>

              <EditableField
                label="Group"
                editing={editingField === 'group'}
                onStartEdit={() => setEditingField('group')}
                display={ticket.group_name || '—'}
              >
                <select autoFocus style={selectFieldStyle} value={ef.group_id}
                  onChange={e => { patch({ group_id: e.target.value || '__clear__' }); setEditingField(null) }}
                  onBlur={() => setEditingField(null)}>
                  <option value="">No group</option>
                  {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </EditableField>

              <div style={{ padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '2px' }}>Responsible</div>
                <div style={{ fontSize: '12px', color: '#3F3F3F', fontWeight: '500' }}>{ticket.responsible_name ? `⭐ ${ticket.responsible_name}` : '—'}</div>
              </div>

              <EditableField
                label="Assignee 💬"
                editing={editingField === 'assignee'}
                onStartEdit={() => setEditingField('assignee')}
                display={ticket.assignee_name || ticket.assignee_email || 'Unassigned'}
              >
                {selectedGroup?.members?.length > 0 ? (
                  <select autoFocus style={selectFieldStyle} value={ef.assignee_name}
                    onChange={e => {
                      const m = selectedGroup.members.find((mm: any) => mm.user_name === e.target.value)
                      patch({ assignee_name: e.target.value, assignee_email: m?.user_email || '' })
                      setEditingField(null)
                    }}
                    onBlur={() => setEditingField(null)}>
                    <option value="">Select person...</option>
                    {selectedGroup.members.map((m: any) => <option key={m.user_email} value={m.user_name}>{m.user_name}{m.is_responsible ? ' ⭐' : ''}</option>)}
                  </select>
                ) : (
                  <input autoFocus style={selectFieldStyle} defaultValue={ef.assignee_email} placeholder="agent@wcomply.com"
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    onBlur={e => { const v = e.target.value.trim(); setEditingField(null); if (v && v !== ef.assignee_email) patch({ assignee_email: v }) }} />
                )}
              </EditableField>
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
