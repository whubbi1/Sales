'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GRCLayout, useGRCPerm } from '@/components/GRCLayout'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, ColumnResizeHandle, SortArrow, Pagination } from '@/components/it/ReportBuilder'
import { grcAccessReviewAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

const REVIEW_TYPE_LABEL: Record<string, string> = { annual: 'Annual Review Cycle', quarterly: 'Quarterly', monthly: 'Monthly', adhoc: 'Ad-Hoc' }
const STATUS_LABEL: Record<string, string> = { open: 'Open', in_progress: 'In Progress', closed: 'Closed' }
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  open: { bg: '#F1F5F9', color: '#475569' }, in_progress: { bg: '#FFF7ED', color: '#D97706' }, closed: { bg: '#ECFDF5', color: '#059669' },
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
  { key: 'cycle_number', label: 'Cycle #', filterable: 'text' },
  { key: 'cycle_name', label: 'Name', filterable: 'text' },
  { key: 'review_type_label', label: 'Type', filterable: 'select', options: Object.values(REVIEW_TYPE_LABEL) },
  { key: 'owner_display', label: 'Owner', filterable: 'text' },
  { key: 'status', label: 'Status', filterable: 'select', options: Object.keys(STATUS_LABEL) },
  { key: 'due_date', label: 'Due Date' },
  { key: 'scope_count', label: 'Scope' },
  { key: 'tasks_open', label: 'Tasks Open' },
]

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  cycle_number: 110, cycle_name: 220, review_type_label: 160, owner_display: 160,
  status: 120, due_date: 130, scope_count: 100, tasks_open: 120,
}

function fmtDate(d: string) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

function LaunchModal({ onClose, onLaunched }: { onClose: () => void; onLaunched: (id: string) => void }) {
  const [reviewType, setReviewType] = useState('adhoc')
  const [cycleName, setCycleName] = useState('')
  const [cycleDescription, setCycleDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!cycleName.trim()) { setError('Cycle name is required'); return }
    setSaving(true); setError('')
    try {
      const me = getStoredUser()
      const r = await grcAccessReviewAPI.create({ review_type: reviewType, cycle_name: cycleName.trim(), cycle_description: cycleDescription, created_by_email: me?.email || '' })
      onLaunched(r.id)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '480px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>Launch Access Review Cycle</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Review Type *</label>
            <select style={{ ...inp, width: '100%' }} value={reviewType} onChange={e => setReviewType(e.target.value)}>
              {Object.entries(REVIEW_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Cycle Name *</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder="e.g. Q3 2026 Access Review" value={cycleName} onChange={e => setCycleName(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Cycle Description</label>
            <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '70px', resize: 'vertical' }} value={cycleDescription} onChange={e => setCycleDescription(e.target.value)} />
          </div>
          <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>Owner, scope, and everything else are set on the review's own page once it's launched.</p>
          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
            <button onClick={submit} disabled={saving} style={{ padding: '9px 18px', background: saving ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              {saving ? 'Launching…' : 'Launch'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AccessReviewContent() {
  const router = useRouter()
  const { level, canEdit } = useGRCPerm('access_review')
  const [cycles, setCycles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showLaunch, setShowLaunch] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    load()
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  const rb = useReportBuilder('grc_access_review', COLUMNS, userEmail)

  const load = async () => {
    setLoading(true)
    try {
      const d = await grcAccessReviewAPI.list()
      setCycles(d.cycles || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
      <p style={{ fontSize: '13px' }}>You don't have permission to access the Access Review functionality. Ask HR to grant it via WHUBBI Permissions.</p>
    </div>
  )

  const withDisplay = cycles.map(c => ({ ...c, owner_display: c.owner_name || c.owner_email, review_type_label: REVIEW_TYPE_LABEL[c.review_type] || c.review_type }))
  const searched = withDisplay.filter(c => !search || `${c.cycle_name} ${c.cycle_number}`.toLowerCase().includes(search.toLowerCase()))
  const reported = applyReport(searched, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const pageRows = reported.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>🔑 Access Review</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{reported.length} cycle{reported.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => router.push('/grc/access-review/requirements')} style={{ padding: '9px 18px', background: 'white', color: '#156082', border: '1px solid #156082', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
            📐 Requirements
          </button>
          <ReportPanel columns={COLUMNS} rb={rb} />
          {canEdit && (
            <button onClick={() => setShowLaunch(true)} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              + Launch Review Cycle
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <input style={{ ...inp, width: '260px' }} placeholder="Search cycle name or number…" value={search} onChange={e => setSearch(e.target.value)} />
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
              <tr><td colSpan={COLUMNS.length} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No review cycles yet.</td></tr>
            ) : pageRows.map(c => (
              <tr key={c.id} onClick={() => router.push(`/grc/access-review/${c.id}`)} style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {isVisible('cycle_number') && <td style={{ padding: '10px 12px', color: '#94A3B8', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'nowrap' }}>{c.cycle_number}</td>}
                {isVisible('cycle_name') && <td style={{ padding: '10px 12px', minWidth: '200px', fontWeight: '700', color: '#156082' }}>{c.cycle_name}</td>}
                {isVisible('review_type_label') && <td style={{ padding: '10px 12px' }}><span style={{ background: '#F1F5F9', color: '#3F3F3F', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{c.review_type_label}</span></td>}
                {isVisible('owner_display') && <td style={{ padding: '10px 12px', color: '#3F3F3F' }}>{c.owner_display || '—'}</td>}
                {isVisible('status') && <td style={{ padding: '10px 12px' }}><span style={{ background: STATUS_COLOR[c.status]?.bg, color: STATUS_COLOR[c.status]?.color, padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{STATUS_LABEL[c.status]}</span></td>}
                {isVisible('due_date') && <td style={{ padding: '10px 12px', color: '#64748B' }}>{fmtDate(c.due_date)}</td>}
                {isVisible('scope_count') && <td style={{ padding: '10px 12px', color: '#64748B' }}>{c.scope_count || 0}</td>}
                {isVisible('tasks_open') && <td style={{ padding: '10px 12px', color: '#64748B' }}>{c.tasks_open > 0 ? `${c.tasks_open}/${c.tasks_total}` : (c.tasks_total > 0 ? `0/${c.tasks_total}` : '—')}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={rb.page} setPage={rb.setPage} total={reported.length} />
      </div>

      {showLaunch && (
        <LaunchModal onClose={() => setShowLaunch(false)} onLaunched={id => { setShowLaunch(false); router.push(`/grc/access-review/${id}`) }} />
      )}
    </div>
  )
}

export default function AccessReviewPage() {
  return <GRCLayout><AccessReviewContent /></GRCLayout>
}
