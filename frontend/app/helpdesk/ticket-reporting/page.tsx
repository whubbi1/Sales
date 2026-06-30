'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import HelpdeskLayout from '@/components/HelpdeskLayout'
import { getStoredUser } from '@/lib/auth'
import { API, STATUS_STYLE, PRIORITY_STYLE } from '../constants'

const TICKET_TYPE_LABELS: Record<string, string> = {
  incident_request:    '🚨 Incident',
  change_request:      '🔄 Change',
  information_request: 'ℹ️ Info',
}

const SCOPE_PRIORITY: Record<string, number> = { none: 0, own: 1, team: 2, company: 3 }

function resolveScope(permissions: any): { scope: string; accessMode: string } {
  const hdModule = permissions?.helpdesk
  if (!hdModule) return { scope: 'own', accessMode: 'view' }
  let bestScope = 'none'
  let bestMode = 'none'
  Object.values(hdModule).forEach((sub: any) => {
    if (!sub) return
    const sp = SCOPE_PRIORITY[sub.data_scope] ?? 0
    if (sp > (SCOPE_PRIORITY[bestScope] ?? 0)) bestScope = sub.data_scope
    if (sub.access_mode === 'edit' || (sub.access_mode === 'view' && bestMode === 'none')) bestMode = sub.access_mode
  })
  return { scope: bestScope, accessMode: bestMode }
}

export default function TicketReportingPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [permLoading, setPermLoading] = useState(true)
  const [scope, setScope] = useState<string>('own')
  const [accessMode, setAccessMode] = useState<string>('view')
  const [userEmail, setUserEmail] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const emailRef = useRef('')

  useEffect(() => {
    const user = getStoredUser()
    if (!user) return
    emailRef.current = user.email
    setUserEmail(user.email)

    // Fetch permissions and then tickets
    setPermLoading(true)
    fetch(`${API}/settings/permissions/${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(perm => {
        const { scope: s, accessMode: m } = resolveScope(perm?.permissions)
        setScope(s)
        setAccessMode(m)
        loadTickets(s, user.email)
      })
      .catch(() => {
        // Permission fetch failed — fallback to own tickets
        setScope('own')
        loadTickets('own', user.email)
      })
      .finally(() => setPermLoading(false))
  }, [])

  const loadTickets = async (s: string, email: string) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (s === 'own') p.set('requester_email', email)
    // 'team' and 'company' load all tickets; 'none' — no data
    if (s === 'none') { setTickets([]); setLoading(false); return }
    const r = await fetch(`${API}/helpdesk/tickets?${p}`)
    const d = await r.json()
    setTickets(d.tickets || [])
    setLoading(false)
  }

  const reload = () => loadTickets(scope, emailRef.current)

  useEffect(() => {
    if (userEmail && !permLoading) reload()
  }, [search, statusFilter, priorityFilter, typeFilter])

  const filtered = tickets.filter(t => {
    if (statusFilter && t.status !== statusFilter) return false
    if (priorityFilter && t.priority !== priorityFilter) return false
    if (typeFilter && t.ticket_type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (t.title||'').toLowerCase().includes(q) ||
             (t.ticket_number||'').toLowerCase().includes(q) ||
             (t.requester_name||'').toLowerCase().includes(q) ||
             (t.requester_email||'').toLowerCase().includes(q)
    }
    return true
  })

  // Stats
  const statuses = ['new','open','in_progress','pending','resolved','closed']
  const byStatus = statuses.reduce((acc, s) => ({ ...acc, [s]: filtered.filter(t => t.status === s).length }), {} as Record<string, number>)

  const inp: React.CSSProperties = { fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white' }

  if (scope === 'none' && !permLoading) return (
    <HelpdeskLayout>
      <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontFamily: 'Montserrat, sans-serif' }}>
        <div style={{ fontSize: '40px', marginBottom: '14px' }}>🔒</div>
        <div style={{ fontSize: '16px', fontWeight: '700', color: '#156082', marginBottom: '8px' }}>No Access</div>
        <div style={{ fontSize: '13px' }}>You don't have permission to view ticket reports. Contact your HR manager to request access via the Permissions page.</div>
      </div>
    </HelpdeskLayout>
  )

  const SCOPE_LABEL: Record<string, string> = { own: 'Your tickets', team: 'Team tickets', company: 'All tickets' }

  return (
    <HelpdeskLayout>
      <div style={{ padding: '24px 28px' }}>
        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: 0 }}>📋 Ticket Reporting</h1>
            {!permLoading && (
              <span style={{ background: scope === 'company' || scope === 'team' ? '#ECFDF5' : '#EFF6FF', color: scope === 'company' || scope === 'team' ? '#059669' : '#156082', fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {SCOPE_LABEL[scope] || 'Limited'}
              </span>
            )}
          </div>
          <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, fontFamily: 'Montserrat, sans-serif' }}>
            Ticket report based on your permissions — {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* KPI row */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '20px' }}>
            {statuses.map(s => {
              const sv = STATUS_STYLE[s]
              return (
                <div key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
                  style={{ background: statusFilter === s ? sv.bg : 'white', borderRadius: '10px', border: `1.5px solid ${statusFilter === s ? sv.color : '#EDF2F7'}`, padding: '12px 14px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: sv.color, marginBottom: '4px' }}>{sv.label}</div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: sv.color }}>{byStatus[s] || 0}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...inp, width: '220px' }} placeholder="Search tickets…" value={search} onChange={e => setSearch(e.target.value)} />
          <select style={{ ...inp, width: '155px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{(v as any).label}</option>)}
          </select>
          <select style={{ ...inp, width: '140px' }} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="">All priorities</option>
            {['critical','high','medium','low'].map(p => <option key={p} value={p} style={{ textTransform: 'capitalize' }}>{p}</option>)}
          </select>
          <select style={{ ...inp, width: '175px' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="incident_request">Incident Request</option>
            <option value="change_request">Change Request</option>
            <option value="information_request">Information Request</option>
          </select>
          {(search || statusFilter || priorityFilter || typeFilter) && (
            <button onClick={() => { setSearch(''); setStatusFilter(''); setPriorityFilter(''); setTypeFilter('') }}
              style={{ ...inp, background: '#F1F5F9', color: '#64748B', cursor: 'pointer', border: '1px solid #E2E8F0' }}>× Clear</button>
          )}
        </div>

        {/* Table */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ background: '#FAFBFC' }}>
              <tr>
                {['#', 'Title', 'Type', 'Category', 'Priority', 'Status', 'Requester', 'Assignee', 'Group', 'Created', 'SLA'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading || permLoading ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>No tickets found.</td></tr>
              ) : filtered.map(t => {
                const p = PRIORITY_STYLE[t.priority] || PRIORITY_STYLE.medium
                const s = STATUS_STYLE[t.status] || STATUS_STYLE.new
                const breached = t.sla_deadline && new Date(t.sla_deadline) < new Date() && !['resolved','closed'].includes(t.status)
                return (
                  <tr key={t.id} onClick={() => router.push(`/helpdesk/tickets/${t.id}`)} style={{ cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <td style={{ padding: '9px 12px', fontWeight: '700', color: '#156082', whiteSpace: 'nowrap' }}>{t.ticket_number}</td>
                    <td style={{ padding: '9px 12px', color: '#3F3F3F', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                      {t.ticket_type && <span style={{ background: '#F1F5F9', color: '#45B6E4', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{TICKET_TYPE_LABELS[t.ticket_type] || t.ticket_type}</span>}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {t.category_name && <span style={{ background: (t.category_color||'#45B6E4')+'20', color: t.category_color||'#45B6E4', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{t.category_icon} {t.category_name}</span>}
                    </td>
                    <td style={{ padding: '9px 12px' }}><span style={{ background: p.bg, color: p.color, padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', textTransform: 'capitalize' }}>{t.priority}</span></td>
                    <td style={{ padding: '9px 12px' }}><span style={{ background: s.bg, color: s.color, padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{s.label}</span></td>
                    <td style={{ padding: '9px 12px', color: '#3F3F3F' }}>
                      <div style={{ fontWeight: '600' }}>{t.requester_name || t.requester_email}</div>
                      {t.requester_name && <div style={{ fontSize: '10px', color: '#94A3B8' }}>{t.requester_email}</div>}
                    </td>
                    <td style={{ padding: '9px 12px', color: '#3F3F3F', fontSize: '11px' }}>{t.assignee_name || '—'}</td>
                    <td style={{ padding: '9px 12px', color: '#45B6E4', fontSize: '11px' }}>{t.group_name || '—'}</td>
                    <td style={{ padding: '9px 12px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ color: breached ? '#DC2626' : '#059669', fontWeight: '700', fontSize: '11px' }}>{breached ? '⚠️ Breached' : '✅ OK'}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </HelpdeskLayout>
  )
}
