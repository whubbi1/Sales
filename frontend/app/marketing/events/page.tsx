'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MarketingLayout, useMarketingPerm } from '@/components/MarketingLayout'
import { marketingAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, ColumnResizeHandle, SortArrow, Pagination } from '@/components/it/ReportBuilder'

const TYPE_LABEL: Record<string, string> = { webinar: 'Webinar', physical: 'Physical Event', mailing: 'Mailing', other: 'Other' }
const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  webinar: { bg: '#EFF6FF', color: '#156082' }, physical: { bg: '#ECFDF5', color: '#059669' },
  mailing: { bg: '#FFF7ED', color: '#D97706' }, other: { bg: '#F1F5F9', color: '#475569' },
}
const EVENT_STATUSES = ['To be planned', 'Planned', 'Under preparation', 'Closed']
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  'To be planned': { bg: '#F1F5F9', color: '#475569' }, 'Planned': { bg: '#EFF6FF', color: '#156082' },
  'Under preparation': { bg: '#FFF7ED', color: '#D97706' }, 'Closed': { bg: '#F1F5F9', color: '#64748B' },
}

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

const COLUMNS: ReportColumn[] = [
  { key: 'title', label: 'Title', filterable: 'text' },
  { key: 'event_type_label', label: 'Type', filterable: 'select', options: Object.values(TYPE_LABEL) },
  { key: 'status', label: 'Status', filterable: 'select', options: EVENT_STATUSES },
  { key: 'event_date', label: 'Start Date' },
  { key: 'end_date', label: 'End Date' },
  { key: 'location', label: 'Location', filterable: 'text' },
  { key: 'owner_display', label: 'Owner', filterable: 'text' },
]

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  title: 260, event_type_label: 150, status: 160, event_date: 130, end_date: 130, location: 170, owner_display: 170,
}

function fmtDate(d: string) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

function NewEventModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [eventType, setEventType] = useState('other')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true); setError('')
    try {
      const me = getStoredUser()
      const e = await marketingAPI.createEvent({ title: title.trim(), event_date: eventDate, end_date: endDate, event_type: eventType, created_by_email: me?.email || '' })
      onCreated(e.id)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>New Event</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Title *</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. SAP GRC Webinar" />
          </div>
          <div>
            <label style={lbl}>Type</label>
            <select style={{ ...inp, width: '100%' }} value={eventType} onChange={e => setEventType(e.target.value)}>
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Start Date</label>
              <input type="date" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>End Date</label>
              <input type="date" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={endDate} onChange={e => setEndDate(e.target.value)} placeholder="Same as start" />
            </div>
          </div>
          <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>Leave End Date blank for a single-day event. Description, status, location, owner, contributors, contacts and URLs are set on the event's own page once created.</p>
          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
            <button onClick={submit} disabled={saving} style={{ padding: '9px 18px', background: saving ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              {saving ? 'Creating…' : 'Create Event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EventsContent() {
  const router = useRouter()
  const { level, canEdit } = useMarketingPerm('events')
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  const rb = useReportBuilder('marketing_event', COLUMNS, userEmail)

  const load = async () => {
    setLoading(true)
    try {
      const d = await marketingAPI.listEvents()
      setEvents(d.events || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  if (level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )

  const withDisplay = events.map((e: any) => ({
    ...e,
    event_type_label: TYPE_LABEL[e.event_type] || e.event_type,
    status: e.status || 'To be planned',
    owner_display: e.owner_name || e.owner_email || '',
  }))
  const searched = withDisplay.filter((e: any) => !search || e.title.toLowerCase().includes(search.toLowerCase()))
  const reported = applyReport(searched, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const pageRows = reported.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>🎪 Events</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{reported.length} event{reported.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ReportPanel columns={COLUMNS} rb={rb} />
          {canEdit && (
            <button onClick={() => setShowNew(true)} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              + New Event
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <input style={{ ...inp, width: '260px' }} placeholder="Search event title…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflowX: 'auto', overflowY: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', maxWidth: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {COLUMNS.filter(c => isVisible(c.key)).map(c => (
                <th key={c.key} onClick={() => rb.toggleSort(c.key)} style={{ position: 'relative', padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: `${rb.columnWidths[c.key] || DEFAULT_COLUMN_WIDTHS[c.key] || 150}px`, cursor: 'pointer', userSelect: 'none' }}>
                  {c.label}<SortArrow active={rb.sortField === c.key} dir={rb.sortDir} />
                  <ColumnResizeHandle colKey={c.key} rb={rb} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLUMNS.length} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : reported.length === 0 ? (
              <tr><td colSpan={COLUMNS.length} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No events yet.</td></tr>
            ) : pageRows.map((e: any) => (
              <tr key={e.id} onClick={() => router.push(`/marketing/events/${e.id}`)} style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                onMouseEnter={ev => (ev.currentTarget.style.background = '#FAFBFC')} onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
                {isVisible('title') && <td style={{ padding: '10px 12px', fontWeight: '700', color: '#156082', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</td>}
                {isVisible('event_type_label') && <td style={{ padding: '10px 12px' }}><span style={{ background: TYPE_COLOR[e.event_type]?.bg, color: TYPE_COLOR[e.event_type]?.color, padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{e.event_type_label}</span></td>}
                {isVisible('status') && <td style={{ padding: '10px 12px' }}><span style={{ background: STATUS_COLOR[e.status]?.bg, color: STATUS_COLOR[e.status]?.color, padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{e.status}</span></td>}
                {isVisible('event_date') && <td style={{ padding: '10px 12px', color: '#64748B' }}>{fmtDate(e.event_date)}</td>}
                {isVisible('end_date') && <td style={{ padding: '10px 12px', color: '#64748B' }}>{fmtDate(e.end_date)}</td>}
                {isVisible('location') && <td style={{ padding: '10px 12px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.location || '—'}</td>}
                {isVisible('owner_display') && <td style={{ padding: '10px 12px', color: '#3F3F3F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.owner_display || '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={rb.page} setPage={rb.setPage} total={reported.length} />
      </div>

      {showNew && <NewEventModal onClose={() => setShowNew(false)} onCreated={id => { setShowNew(false); router.push(`/marketing/events/${id}`) }} />}
    </div>
  )
}

export default function EventsPage() {
  return <MarketingLayout><EventsContent /></MarketingLayout>
}
