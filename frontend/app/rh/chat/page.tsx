'use client'
import { useState, useEffect } from 'react'
import { HRLayout } from '@/components/HRLayout'

const API = 'https://api.whubbi.wcomply.com'

const MODULE_LABELS: Record<string, string> = {
  sales: '💼 Sales', finance: '💰 Finance', hr: '👥 HR',
  grc: '🛡️ GRC', it: '🖥️ IT', helpdesk: '🎧 Helpdesk', admin: '🔧 Admin',
}

const RECURRENCE_OPTIONS = [
  { value: 'once', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

type User = {
  email: string
  first_name?: string
  last_name?: string
  display_name?: string
  job_title?: string
  department?: string
}

type Group = { module: string; member_count: number }

type ChatMessage = {
  id: string
  sender_email: string
  message: string
  recipients: string[] | string
  status: string
  schedule_type?: string
  scheduled_at?: string
  recurrence?: { type?: string; weekday?: string; day?: string }
  sent_at?: string
  sent_count: number
  created_at: string
}

function userName(u: User): string {
  return u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1.5px solid #EDF2F7',
  borderRadius: '7px', fontFamily: 'Montserrat, sans-serif',
  fontSize: '12px', outline: 'none', boxSizing: 'border-box', color: '#1E293B',
  background: 'white',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700',
  textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  color: '#45B6E4', marginBottom: '6px',
}

const pillBtn = (active: boolean): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: '20px',
  border: `2px solid ${active ? '#156082' : '#EDF2F7'}`,
  cursor: 'pointer', fontSize: '11px', fontWeight: '700',
  fontFamily: 'Montserrat, sans-serif',
  background: active ? '#EFF6FF' : 'white',
  color: active ? '#156082' : '#94A3B8',
})

function formatDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function ChatPage() {
  const [users, setUsers] = useState<User[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [groupMembers, setGroupMembers] = useState<string[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)

  const [mode, setMode] = useState<'instant' | 'scheduled'>('instant')
  const [recipientMode, setRecipientMode] = useState<'all' | 'select' | 'group'>('all')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [sendError, setSendError] = useState('')

  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [recurrence, setRecurrence] = useState('once')
  const [weekday, setWeekday] = useState('Monday')
  const [monthDay, setMonthDay] = useState('1')

  const [history, setHistory] = useState<ChatMessage[]>([])
  const [historyTab, setHistoryTab] = useState<'sent' | 'scheduled'>('sent')
  const [loadingHistory, setLoadingHistory] = useState(true)

  const loadUsers = () => {
    setLoadingUsers(true)
    fetch(`${API}/settings/users`)
      .then(r => r.json())
      .then(d => setUsers(d.users || []))
      .catch(() => {})
      .finally(() => setLoadingUsers(false))
  }

  const loadGroups = () => {
    fetch(`${API}/hr/chat/groups`)
      .then(r => r.json())
      .then(d => setGroups(d.groups || []))
      .catch(() => {})
  }

  const loadHistory = () => {
    setLoadingHistory(true)
    fetch(`${API}/hr/chat/history`)
      .then(r => r.json())
      .then(d => setHistory(d.messages || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }

  useEffect(() => {
    loadUsers()
    loadGroups()
    loadHistory()
  }, [])

  useEffect(() => {
    if (recipientMode === 'group' && selectedGroup) {
      fetch(`${API}/hr/chat/group-members?module=${selectedGroup}`)
        .then(r => r.json())
        .then(d => setGroupMembers((d.members || []).map((m: { user_email: string }) => m.user_email)))
        .catch(() => setGroupMembers([]))
    } else {
      setGroupMembers([])
    }
  }, [selectedGroup, recipientMode])

  const recipients: string[] = (() => {
    if (recipientMode === 'all') return users.map(u => u.email)
    if (recipientMode === 'select') return selectedUsers
    if (recipientMode === 'group') return groupMembers
    return []
  })()

  const toggleUser = (email: string) => {
    setSelectedUsers(us =>
      us.includes(email) ? us.filter(e => e !== email) : [...us, email]
    )
  }

  const filteredUsers = users.filter(u => {
    if (!userSearch) return true
    const q = userSearch.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      (u.display_name || '').toLowerCase().includes(q) ||
      `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(q)
    )
  })

  const canSend = message.trim().length > 0 && recipients.length > 0 &&
    (mode === 'instant' || (mode === 'scheduled' && scheduleDate.length > 0))

  const handleSend = async () => {
    if (!canSend || sending) return
    setSending(true)
    setSendError('')
    try {
      if (mode === 'instant') {
        const r = await fetch(`${API}/hr/chat/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, recipients }),
        })
        if (!r.ok) throw new Error('Send failed')
      } else {
        const recurrenceData =
          recurrence === 'weekly' ? { type: recurrence, weekday } :
          recurrence === 'monthly' ? { type: recurrence, day: monthDay } :
          { type: recurrence }
        const r = await fetch(`${API}/hr/chat/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message, recipients,
            schedule_type: recurrence,
            scheduled_at: `${scheduleDate}T${scheduleTime}:00`,
            recurrence: recurrenceData,
          }),
        })
        if (!r.ok) throw new Error('Schedule failed')
      }
      setSendSuccess(true)
      setMessage('')
      setSelectedUsers([])
      setTimeout(() => setSendSuccess(false), 3000)
      loadHistory()
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : 'Error sending message')
    } finally {
      setSending(false)
    }
  }

  const cancelScheduled = async (id: string) => {
    await fetch(`${API}/hr/chat/scheduled/${id}`, { method: 'DELETE' })
    loadHistory()
  }

  const sentMessages = history.filter(m => m.status === 'sent')
  const scheduledMessages = history.filter(m => m.status === 'scheduled')

  const recipientList = (m: ChatMessage): string[] => {
    if (Array.isArray(m.recipients)) return m.recipients
    try { return JSON.parse(m.recipients as string) } catch { return [] }
  }

  return (
    <HRLayout>
      <div style={{ padding: '28px 32px', fontFamily: 'Montserrat, sans-serif' }}>
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#156082', margin: 0 }}>
            💬 WHUBBI Chat
          </h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: '4px 0 0' }}>
            Send Teams messages to wcomply.com employees
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>

          {/* ── Compose panel ── */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>

            {/* Mode toggle */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #EDF2F7', background: '#FAFBFC', display: 'flex', gap: '4px' }}>
              {([['instant', '⚡ Send Now'], ['scheduled', '🗓 Schedule']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setMode(v)}
                  style={{ padding: '8px 20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', borderRadius: '8px', background: mode === v ? '#156082' : 'transparent', color: mode === v ? 'white' : '#45B6E4' }}>
                  {l}
                </button>
              ))}
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Recipients */}
              <div>
                <label style={labelStyle}>Recipients</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <button onClick={() => setRecipientMode('all')} style={pillBtn(recipientMode === 'all')}>
                    All employees ({users.length})
                  </button>
                  <button onClick={() => setRecipientMode('select')} style={pillBtn(recipientMode === 'select')}>
                    Select users
                  </button>
                  <button onClick={() => setRecipientMode('group')} style={pillBtn(recipientMode === 'group')}>
                    By permission group
                  </button>
                </div>

                {/* User multi-select */}
                {recipientMode === 'select' && (
                  <div>
                    <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                      placeholder="Search employees by name or email…"
                      style={{ ...inputStyle, marginBottom: '8px' }} />
                    <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                      {loadingUsers ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>Loading…</div>
                      ) : filteredUsers.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>No employees found</div>
                      ) : filteredUsers.map(u => (
                        <div key={u.email} onClick={() => toggleUser(u.email)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #F9FAFB', background: selectedUsers.includes(u.email) ? '#EFF6FF' : 'white' }}>
                          <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${selectedUsers.includes(u.email) ? '#156082' : '#CBD5E1'}`, background: selectedUsers.includes(u.email) ? '#156082' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {selectedUsers.includes(u.email) && (
                              <span style={{ color: 'white', fontSize: '10px', fontWeight: '900', lineHeight: '1' }}>✓</span>
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#1E293B' }}>{userName(u)}</div>
                            <div style={{ fontSize: '10px', color: '#94A3B8' }}>{u.email}{u.job_title ? ` · ${u.job_title}` : ''}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedUsers.length > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>{selectedUsers.length} selected:</span>
                        {selectedUsers.slice(0, 4).map(e => (
                          <span key={e} style={{ fontSize: '10px', background: '#EFF6FF', color: '#156082', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                            {e.split('@')[0]}
                          </span>
                        ))}
                        {selectedUsers.length > 4 && (
                          <span style={{ fontSize: '10px', color: '#94A3B8' }}>+{selectedUsers.length - 4} more</span>
                        )}
                        <button onClick={() => setSelectedUsers([])}
                          style={{ fontSize: '10px', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontFamily: 'Montserrat, sans-serif' }}>
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Group select */}
                {recipientMode === 'group' && (
                  <div>
                    <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="">— Select a permission group —</option>
                      {groups.map(g => (
                        <option key={g.module} value={g.module}>
                          {MODULE_LABELS[g.module] || g.module} ({g.member_count} members)
                        </option>
                      ))}
                    </select>
                    {selectedGroup && groupMembers.length > 0 && (
                      <div style={{ marginTop: '8px', padding: '8px 12px', background: '#EFF6FF', borderRadius: '8px', fontSize: '11px', color: '#156082' }}>
                        {groupMembers.length} user{groupMembers.length !== 1 ? 's' : ''} in the <strong>{MODULE_LABELS[selectedGroup] || selectedGroup}</strong> group
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Message */}
              <div>
                <label style={labelStyle}>Message</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Type your Teams message here…" rows={6}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '130px' }} />
                <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '3px', textAlign: 'right' }}>
                  {message.length} characters
                </div>
              </div>

              {/* Schedule options */}
              {mode === 'scheduled' && (
                <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ ...labelStyle, marginBottom: '4px' }}>Date *</label>
                      <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, marginBottom: '4px' }}>Time</label>
                      <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, marginBottom: '6px' }}>Recurrence</label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {RECURRENCE_OPTIONS.map(opt => (
                        <button key={opt.value} onClick={() => setRecurrence(opt.value)}
                          style={pillBtn(recurrence === opt.value)}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {recurrence === 'weekly' && (
                    <div>
                      <label style={{ ...labelStyle, marginBottom: '6px' }}>Day of week</label>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {WEEKDAYS.map(d => (
                          <button key={d} onClick={() => setWeekday(d)}
                            style={{ padding: '4px 10px', borderRadius: '20px', border: `1.5px solid ${weekday === d ? '#156082' : '#EDF2F7'}`, cursor: 'pointer', fontSize: '10px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', background: weekday === d ? '#156082' : 'white', color: weekday === d ? 'white' : '#94A3B8' }}>
                            {d.slice(0, 3)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {recurrence === 'monthly' && (
                    <div>
                      <label style={{ ...labelStyle, marginBottom: '4px' }}>Day of month</label>
                      <select value={monthDay} onChange={e => setMonthDay(e.target.value)}
                        style={{ ...inputStyle, width: '100px' }}>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {sendError && (
                <div style={{ padding: '8px 12px', background: '#FEF2F2', color: '#DC2626', borderRadius: '8px', fontSize: '12px' }}>
                  {sendError}
                </div>
              )}

              {/* Send button row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', color: recipients.length > 0 ? '#156082' : '#94A3B8', fontWeight: '600' }}>
                  {recipients.length > 0
                    ? `📤 ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`
                    : 'No recipients selected'}
                </div>
                <button onClick={handleSend} disabled={!canSend || sending}
                  style={{ padding: '9px 24px', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: canSend && !sending ? 'pointer' : 'not-allowed', fontFamily: 'Montserrat, sans-serif', opacity: sending ? 0.7 : 1, transition: 'background 0.2s',
                    background: !canSend ? '#F1F5F9' : sendSuccess ? '#059669' : '#156082',
                    color: !canSend ? '#94A3B8' : 'white' }}>
                  {sending ? 'Sending…' : sendSuccess ? '✅ Done!' : mode === 'instant' ? `💬 Send to ${recipients.length}` : '🗓 Schedule'}
                </button>
              </div>
            </div>
          </div>

          {/* ── History panel ── */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #EDF2F7' }}>
              {([['sent', `Sent (${sentMessages.length})`], ['scheduled', `Scheduled (${scheduledMessages.length})`]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setHistoryTab(v)}
                  style={{ flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', background: historyTab === v ? '#156082' : 'transparent', color: historyTab === v ? 'white' : '#45B6E4' }}>
                  {l}
                </button>
              ))}
            </div>

            <div style={{ padding: '12px', maxHeight: '620px', overflowY: 'auto' }}>
              {loadingHistory && (
                <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>Loading…</div>
              )}

              {/* Sent tab */}
              {!loadingHistory && historyTab === 'sent' && (
                <>
                  {sentMessages.length === 0 && (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                      No messages sent yet.
                    </div>
                  )}
                  {sentMessages.map(m => (
                    <div key={m.id} style={{ border: '1px solid #EDF2F7', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#94A3B8' }}>{formatDate(m.sent_at || m.created_at)}</span>
                        <span style={{ fontSize: '10px', background: '#ECFDF5', color: '#059669', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                          ✓ {m.sent_count} sent
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#1E293B', margin: 0, lineHeight: '1.5', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                        {m.message}
                      </p>
                      <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '6px' }}>
                        {recipientList(m).length} recipient{recipientList(m).length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Scheduled tab */}
              {!loadingHistory && historyTab === 'scheduled' && (
                <>
                  {scheduledMessages.length === 0 && (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                      No scheduled messages.
                    </div>
                  )}
                  {scheduledMessages.map(m => (
                    <div key={m.id} style={{ border: '1px solid #EDF2F7', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#156082' }}>
                            {formatDate(m.scheduled_at)}
                          </span>
                          {m.schedule_type && m.schedule_type !== 'once' && (
                            <span style={{ fontSize: '10px', background: '#EFF6FF', color: '#156082', padding: '2px 7px', borderRadius: '10px', fontWeight: '600', width: 'fit-content' }}>
                              🔄 {m.schedule_type}
                              {m.recurrence?.weekday ? ` · ${m.recurrence.weekday}` : ''}
                              {m.recurrence?.day ? ` · day ${m.recurrence.day}` : ''}
                            </span>
                          )}
                        </div>
                        <button onClick={() => cancelScheduled(m.id)}
                          style={{ fontSize: '10px', background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontWeight: '600', flexShrink: 0, marginLeft: '8px' }}>
                          Cancel
                        </button>
                      </div>
                      <p style={{ fontSize: '12px', color: '#1E293B', margin: '0 0 6px', lineHeight: '1.5', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                        {m.message}
                      </p>
                      <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                        {recipientList(m).length} recipient{recipientList(m).length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </HRLayout>
  )
}
