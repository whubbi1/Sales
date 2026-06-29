'use client'
import { useState, useEffect, useCallback } from 'react'
import { HRLayout } from '@/components/HRLayout'
import { fetchUserAttributes } from 'aws-amplify/auth'

const API = 'https://api.whubbi.wcomply.com'

const MODULE_LABELS: Record<string, string> = {
  sales: '💼 Sales', finance: '💰 Finance', hr: '👥 HR',
  grc: '🛡️ GRC', it: '🖥️ IT', helpdesk: '🎧 Helpdesk', admin: '🔧 Admin',
}

const RECURRENCE_OPTIONS = [
  { value: 'once',    label: 'One-time' },
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]
const WEEKDAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

type Tab = 'compose' | 'scheduled' | 'history'
type RecipientMode = 'all' | 'select' | 'group'
type DeliveryMode = 'instant' | 'scheduled'

type User = { email: string; first_name?: string; last_name?: string; display_name?: string; job_title?: string }
type Group = { module: string; member_count: number }
type ChatMsg = {
  id: string
  sender_email: string
  sender_name?: string
  message: string
  recipients: string[] | string
  status: string
  schedule_type?: string
  scheduled_at?: string
  recurrence?: { type?: string; weekday?: string; day?: string }
  sent_at?: string
  sent_count: number
  delivered_count?: number
  delivery_errors?: string
  created_at: string
}

/* ── helpers ── */
function uName(u: User) {
  return u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email
}
function recpList(m: ChatMsg): string[] {
  if (Array.isArray(m.recipients)) return m.recipients
  try { return JSON.parse(m.recipients as string) } catch { return [] }
}
function fmtDate(iso?: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}

/* ── shared styles ── */
const F: React.CSSProperties = { fontFamily: 'Montserrat, sans-serif' }
const inp: React.CSSProperties = { ...F, width:'100%', padding:'8px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontSize:'12px', outline:'none', boxSizing:'border-box', color:'#1E293B', background:'white' }
const lbl: React.CSSProperties = { ...F, display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em', color:'#45B6E4', marginBottom:'6px' }
const pill = (on: boolean): React.CSSProperties => ({ ...F, padding:'6px 14px', borderRadius:'20px', border:`2px solid ${on?'#156082':'#EDF2F7'}`, cursor:'pointer', fontSize:'11px', fontWeight:'700', background: on?'#EFF6FF':'white', color: on?'#156082':'#94A3B8' })
const card: React.CSSProperties = { border:'1px solid #EDF2F7', borderRadius:'10px', padding:'14px', marginBottom:'10px', background:'white' }

/* ══════════════════════════════════════════════════════════════════════
   COMPOSE TAB
══════════════════════════════════════════════════════════════════════ */
function ComposeTab({ users, groups, loadingUsers, onSent }: {
  users: User[]; groups: Group[]; loadingUsers: boolean; onSent: () => void
}) {
  const [delivery, setDelivery] = useState<DeliveryMode>('instant')
  const [rMode, setRMode] = useState<RecipientMode>('all')
  const [selUsers, setSelUsers] = useState<string[]>([])
  const [selGroup, setSelGroup] = useState('')
  const [groupMembers, setGroupMembers] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState('')
  const [senderInfo, setSenderInfo] = useState({ email: '', name: '' })

  // Schedule fields
  const [sDate, setSDate] = useState('')
  const [sTime, setSTime] = useState('09:00')
  const [recur, setRecur] = useState('once')
  const [weekday, setWeekday] = useState('Monday')
  const [monthDay, setMonthDay] = useState('1')

  useEffect(() => {
    fetchUserAttributes()
      .then(a => {
        const email = a.email || ''
        const name = (a.name || `${a.given_name || ''} ${a.family_name || ''}`.trim() || email.split('@')[0]).trim()
        setSenderInfo({ email, name })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (rMode === 'group' && selGroup) {
      fetch(`${API}/hr/chat/group-members?module=${selGroup}`)
        .then(r => r.json())
        .then(d => setGroupMembers((d.members || []).map((m: { user_email: string }) => m.user_email)))
        .catch(() => setGroupMembers([]))
    } else {
      setGroupMembers([])
    }
  }, [selGroup, rMode])

  const recipients = rMode === 'all' ? users.map(u => u.email)
    : rMode === 'select' ? selUsers
    : groupMembers

  const toggleUser = (email: string) =>
    setSelUsers(us => us.includes(email) ? us.filter(e => e !== email) : [...us, email])

  const filtered = users.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.email.toLowerCase().includes(q) ||
      (u.display_name || '').toLowerCase().includes(q) ||
      `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(q)
  })

  const canSend = message.trim().length > 0 && recipients.length > 0 &&
    (delivery === 'instant' || sDate.length > 0)

  const handleSend = async () => {
    if (!canSend || sending) return
    setSending(true); setErr('')
    try {
      if (delivery === 'instant') {
        const r = await fetch(`${API}/hr/chat/send`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, recipients, sender_email: senderInfo.email, sender_name: senderInfo.name }),
        })
        if (!r.ok) throw new Error('Send failed')
      } else {
        const recurrenceData =
          recur === 'weekly'  ? { type: recur, weekday } :
          recur === 'monthly' ? { type: recur, day: monthDay } :
          { type: recur }
        const r = await fetch(`${API}/hr/chat/schedule`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message, recipients,
            sender_email: senderInfo.email, sender_name: senderInfo.name,
            schedule_type: recur,
            scheduled_at: `${sDate}T${sTime}:00`,
            recurrence: recurrenceData,
          }),
        })
        if (!r.ok) throw new Error('Schedule failed')
      }
      setOk(true); setMessage(''); setSelUsers([])
      setTimeout(() => { setOk(false); onSent() }, 2000)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>

      {/* Recipients column */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <label style={lbl}>Recipients</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
          <button onClick={() => setRMode('all')} style={pill(rMode === 'all')}>All employees ({users.length})</button>
          <button onClick={() => setRMode('select')} style={pill(rMode === 'select')}>Select specific users</button>
          <button onClick={() => setRMode('group')} style={pill(rMode === 'group')}>By permission group</button>
        </div>

        {rMode === 'select' && (
          <div>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…" style={{ ...inp, marginBottom: '8px' }} />
            <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
              {loadingUsers ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>Loading…</div>
              ) : filtered.map(u => (
                <div key={u.email} onClick={() => toggleUser(u.email)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #F8FAFC', background: selUsers.includes(u.email) ? '#EFF6FF' : 'white' }}>
                  <div style={{ width: '15px', height: '15px', borderRadius: '3px', border: `2px solid ${selUsers.includes(u.email) ? '#156082' : '#CBD5E1'}`, background: selUsers.includes(u.email) ? '#156082' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {selUsers.includes(u.email) && <span style={{ color: 'white', fontSize: '9px', fontWeight: '900' }}>✓</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#1E293B' }}>{uName(u)}</div>
                    <div style={{ fontSize: '10px', color: '#94A3B8' }}>{u.email}</div>
                  </div>
                </div>
              ))}
            </div>
            {selUsers.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#94A3B8' }}>{selUsers.length} selected</span>
                <button onClick={() => setSelUsers([])} style={{ ...F, fontSize: '10px', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
              </div>
            )}
          </div>
        )}

        {rMode === 'group' && (
          <div>
            <select value={selGroup} onChange={e => setSelGroup(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
              <option value="">— Select a group —</option>
              {groups.map(g => (
                <option key={g.module} value={g.module}>{MODULE_LABELS[g.module] || g.module} ({g.member_count})</option>
              ))}
            </select>
            {selGroup && groupMembers.length > 0 && (
              <div style={{ marginTop: '8px', padding: '8px 10px', background: '#EFF6FF', borderRadius: '7px', fontSize: '11px', color: '#156082' }}>
                {groupMembers.length} user{groupMembers.length !== 1 ? 's' : ''} in <strong>{MODULE_LABELS[selGroup] || selGroup}</strong>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: '16px', padding: '10px 12px', background: recipients.length > 0 ? '#EFF6FF' : '#F8FAFC', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: '800', color: recipients.length > 0 ? '#156082' : '#CBD5E1' }}>{recipients.length}</div>
          <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recipients</div>
        </div>
      </div>

      {/* Message + options column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Delivery mode */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', gap: '4px' }}>
          {([['instant','⚡ Send Now'],['scheduled','🗓 Schedule']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setDelivery(v)}
              style={{ flex: 1, padding: '9px', border: 'none', cursor: 'pointer', borderRadius: '9px', ...F, fontSize: '12px', fontWeight: '700', background: delivery === v ? '#156082' : 'transparent', color: delivery === v ? 'white' : '#45B6E4' }}>
              {l}
            </button>
          ))}
        </div>

        {/* Message */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <label style={lbl}>Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Type your Teams message…" rows={7}
            style={{ ...inp, resize: 'vertical', minHeight: '140px' }} />
          <div style={{ fontSize: '10px', color: '#CBD5E1', textAlign: 'right', marginTop: '4px' }}>{message.length} chars</div>
        </div>

        {/* Schedule options */}
        {delivery === 'scheduled' && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <label style={lbl}>Schedule</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ ...lbl, marginBottom: '4px', fontSize: '9px' }}>Date *</label>
                <input type="date" value={sDate} onChange={e => setSDate(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ ...lbl, marginBottom: '4px', fontSize: '9px' }}>Time</label>
                <input type="time" value={sTime} onChange={e => setSTime(e.target.value)} style={inp} />
              </div>
            </div>
            <label style={{ ...lbl, marginBottom: '6px' }}>Recurrence</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {RECURRENCE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setRecur(opt.value)} style={pill(recur === opt.value)}>{opt.label}</button>
              ))}
            </div>
            {recur === 'weekly' && (
              <div style={{ marginTop: '10px' }}>
                <label style={{ ...lbl, marginBottom: '6px', fontSize: '9px' }}>Day of week</label>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {WEEKDAYS.map(d => (
                    <button key={d} onClick={() => setWeekday(d)}
                      style={{ ...F, padding: '4px 10px', borderRadius: '20px', border: `1.5px solid ${weekday===d?'#156082':'#EDF2F7'}`, cursor: 'pointer', fontSize: '10px', fontWeight: '700', background: weekday===d?'#156082':'white', color: weekday===d?'white':'#94A3B8' }}>
                      {d.slice(0,3)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {recur === 'monthly' && (
              <div style={{ marginTop: '10px' }}>
                <label style={{ ...lbl, marginBottom: '4px', fontSize: '9px' }}>Day of month</label>
                <select value={monthDay} onChange={e => setMonthDay(e.target.value)} style={{ ...inp, width: '90px' }}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Error / send */}
        {err && <div style={{ padding: '10px 14px', background: '#FEF2F2', color: '#DC2626', borderRadius: '8px', fontSize: '12px', ...F }}>{err}</div>}

        <button onClick={handleSend} disabled={!canSend || sending}
          style={{ padding: '12px', border: 'none', borderRadius: '10px', ...F, fontSize: '13px', fontWeight: '800', cursor: canSend && !sending ? 'pointer' : 'not-allowed', opacity: sending ? 0.7 : 1,
            background: !canSend ? '#F1F5F9' : ok ? '#059669' : delivery === 'instant' ? '#156082' : '#7C3AED',
            color: !canSend ? '#94A3B8' : 'white' }}>
          {sending ? 'Sending…' : ok ? '✅ Done!' : delivery === 'instant' ? `💬 Send to ${recipients.length} employee${recipients.length !== 1 ? 's' : ''}` : `🗓 Schedule message for ${recipients.length} employee${recipients.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   SCHEDULED TAB
══════════════════════════════════════════════════════════════════════ */
function ScheduledTab({ messages, onCancel, onRefresh }: {
  messages: ChatMsg[]; onCancel: (id: string) => void; onRefresh: () => void
}) {
  if (messages.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🗓</div>
        <div style={{ ...F, fontSize: '14px', fontWeight: '700' }}>No scheduled messages</div>
        <div style={{ ...F, fontSize: '12px', marginTop: '4px' }}>Create a scheduled message in the "New Message" tab.</div>
      </div>
    )
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button onClick={onRefresh} style={{ ...F, fontSize: '11px', color: '#45B6E4', background: 'none', border: '1px solid #EDF2F7', borderRadius: '7px', padding: '5px 12px', cursor: 'pointer' }}>↻ Refresh</button>
      </div>
      {messages.map(m => {
        const rl = recpList(m)
        const rec = m.recurrence
        return (
          <div key={m.id} style={{ ...card, display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'start' }}>
            <div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span style={{ ...F, fontSize: '13px', fontWeight: '800', color: '#156082' }}>{fmtDate(m.scheduled_at)}</span>
                {m.schedule_type && m.schedule_type !== 'once' && (
                  <span style={{ ...F, fontSize: '10px', background: '#EFF6FF', color: '#156082', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                    🔄 {m.schedule_type}{rec?.weekday ? ` · ${rec.weekday}` : ''}{rec?.day ? ` · day ${rec.day}` : ''}
                  </span>
                )}
              </div>
              <p style={{ ...F, fontSize: '13px', color: '#1E293B', margin: '0 0 8px', lineHeight: '1.55', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const }}>
                {m.message}
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ ...F, fontSize: '11px', color: '#94A3B8' }}>👤 {m.sender_name || m.sender_email}</span>
                <span style={{ ...F, fontSize: '11px', color: '#94A3B8' }}>📤 {rl.length} recipient{rl.length !== 1 ? 's' : ''}</span>
                <span style={{ ...F, fontSize: '10px', color: '#CBD5E1' }}>{fmtDate(m.created_at)}</span>
              </div>
            </div>
            <button onClick={() => onCancel(m.id)}
              style={{ ...F, fontSize: '11px', fontWeight: '700', background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '7px', padding: '7px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Cancel
            </button>
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   HISTORY TAB
══════════════════════════════════════════════════════════════════════ */
function HistoryTab({ messages, onRefresh }: { messages: ChatMsg[]; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (messages.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
        <div style={{ ...F, fontSize: '14px', fontWeight: '700' }}>No messages sent yet</div>
      </div>
    )
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ ...F, fontSize: '12px', color: '#94A3B8' }}>{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
        <button onClick={onRefresh} style={{ ...F, fontSize: '11px', color: '#45B6E4', background: 'none', border: '1px solid #EDF2F7', borderRadius: '7px', padding: '5px 12px', cursor: 'pointer' }}>↻ Refresh</button>
      </div>
      {messages.map(m => {
        const rl = recpList(m)
        const isExp = expanded === m.id
        const delivered = m.delivered_count ?? m.sent_count
        const hasErrors = m.delivery_errors && m.delivery_errors !== 'null'
        return (
          <div key={m.id} style={{ ...card, cursor: 'pointer' }} onClick={() => setExpanded(isExp ? null : m.id)}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ ...F, fontSize: '12px', fontWeight: '700', color: '#156082' }}>{fmtDate(m.sent_at || m.created_at)}</span>
                <span style={{ ...F, fontSize: '11px', color: '#475569' }}>by <strong>{m.sender_name || m.sender_email}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0, marginLeft: '8px' }}>
                <span style={{ ...F, fontSize: '10px', background: '#ECFDF5', color: '#059669', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                  ✓ {delivered}/{rl.length} delivered
                </span>
                {hasErrors && <span title="Some deliveries failed" style={{ fontSize: '12px' }}>⚠️</span>}
                <span style={{ color: '#CBD5E1', fontSize: '12px' }}>{isExp ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Message preview / full */}
            <p style={{ ...F, fontSize: '13px', color: '#1E293B', margin: '0 0 8px', lineHeight: '1.55', whiteSpace: 'pre-wrap', ...(isExp ? {} : { overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }) }}>
              {m.message}
            </p>

            {/* Meta row */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ ...F, fontSize: '11px', color: '#94A3B8' }}>📤 {rl.length} recipient{rl.length !== 1 ? 's' : ''}</span>
              {m.schedule_type && m.schedule_type !== 'once' && (
                <span style={{ ...F, fontSize: '10px', background: '#EFF6FF', color: '#156082', padding: '1px 7px', borderRadius: '8px', fontWeight: '600' }}>🔄 {m.schedule_type}</span>
              )}
            </div>

            {/* Expanded: recipient list + error info */}
            {isExp && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
                <div style={{ ...F, fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#45B6E4', marginBottom: '6px' }}>
                  Sent to
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {rl.map(e => (
                    <span key={e} style={{ ...F, fontSize: '10px', background: '#F8FAFC', color: '#475569', padding: '2px 8px', borderRadius: '8px', border: '1px solid #EDF2F7' }}>
                      {e}
                    </span>
                  ))}
                </div>
                {hasErrors && (
                  <div style={{ marginTop: '10px', padding: '8px 10px', background: '#FEF2F2', borderRadius: '7px' }}>
                    <div style={{ ...F, fontSize: '10px', fontWeight: '700', color: '#DC2626', marginBottom: '4px' }}>Delivery issues</div>
                    <div style={{ ...F, fontSize: '10px', color: '#DC2626' }}>
                      {(() => {
                        try {
                          const errs = JSON.parse(m.delivery_errors || '[]')
                          return Array.isArray(errs) ? errs.join(' · ') : m.delivery_errors
                        } catch { return m.delivery_errors }
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   PAGE ROOT
══════════════════════════════════════════════════════════════════════ */
export default function ChatPage() {
  const [tab, setTab] = useState<Tab>('compose')
  const [users, setUsers] = useState<User[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [history, setHistory] = useState<ChatMsg[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)

  const loadUsers = useCallback(() => {
    setLoadingUsers(true)
    fetch(`${API}/settings/users`)
      .then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
      .finally(() => setLoadingUsers(false))
  }, [])

  const loadGroups = useCallback(() => {
    fetch(`${API}/hr/chat/groups`)
      .then(r => r.json()).then(d => setGroups(d.groups || [])).catch(() => {})
  }, [])

  const loadHistory = useCallback(() => {
    setLoadingHistory(true)
    fetch(`${API}/hr/chat/history`)
      .then(r => r.json()).then(d => setHistory(d.messages || [])).catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [])

  useEffect(() => { loadUsers(); loadGroups(); loadHistory() }, [loadUsers, loadGroups, loadHistory])

  const sentMessages = history.filter(m => m.status === 'sent')
  const scheduledMessages = history.filter(m => m.status === 'scheduled')

  const cancelScheduled = async (id: string) => {
    await fetch(`${API}/hr/chat/scheduled/${id}`, { method: 'DELETE' })
    loadHistory()
  }

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'compose',   label: '💬 New Message' },
    { key: 'scheduled', label: '🗓 Scheduled', count: scheduledMessages.length },
    { key: 'history',   label: '📋 History',   count: sentMessages.length },
  ]

  return (
    <HRLayout>
      <div style={{ padding: '28px 32px', fontFamily: 'Montserrat, sans-serif' }}>

        {/* Page header */}
        <div style={{ marginBottom: '22px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#156082', margin: 0 }}>💬 WHUBBI Chat</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: '4px 0 0' }}>
            Broadcast Teams messages to wcomply.com employees
          </p>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '20px', background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '5px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', width: 'fit-content' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ ...F, padding: '8px 20px', border: 'none', cursor: 'pointer', borderRadius: '7px', fontSize: '12px', fontWeight: '700', background: tab === t.key ? '#156082' : 'transparent', color: tab === t.key ? 'white' : '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span style={{ background: tab === t.key ? 'rgba(255,255,255,0.25)' : '#EFF6FF', color: tab === t.key ? 'white' : '#156082', borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: '800' }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'compose' && (
          <ComposeTab users={users} groups={groups} loadingUsers={loadingUsers}
            onSent={() => { loadHistory(); setTab('history') }} />
        )}
        {tab === 'scheduled' && (
          <ScheduledTab messages={scheduledMessages} onCancel={cancelScheduled} onRefresh={loadHistory} />
        )}
        {tab === 'history' && (
          loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94A3B8', ...F, fontSize: '13px' }}>Loading history…</div>
          ) : (
            <HistoryTab messages={sentMessages} onRefresh={loadHistory} />
          )
        )}

      </div>
    </HRLayout>
  )
}
