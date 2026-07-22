'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { projectsAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, ColumnResizeHandle, REPORT_CELL_STYLE, SortArrow, Pagination } from '@/components/it/ReportBuilder'
import { PageHeader } from '@/components/shared/RecordLayout'
import { InternalProjectModal } from '@/components/projects/InternalProjectModal'

const STATUS_OPTIONS = ['New', 'Planned', 'In Progress', 'Finished']
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  New: { bg: '#F1F5F9', color: '#475569' }, Planned: { bg: '#EFF6FF', color: '#156082' },
  'In Progress': { bg: '#FFF7ED', color: '#D97706' }, Finished: { bg: '#ECFDF5', color: '#059669' },
}
const HEALTH_COLOR: Record<string, string> = { red: '#DC2626', orange: '#D97706', green: '#059669' }

const COLUMNS: ReportColumn[] = [
  { key: 'project_number', label: 'Project ID', filterable: 'text' },
  { key: 'project_name', label: 'Project Name', filterable: 'text' },
  { key: 'client_name', label: 'Client/Partner', filterable: 'text' },
  { key: 'start_date', label: 'Start' },
  { key: 'end_date', label: 'End' },
  { key: 'status', label: 'Status', filterable: 'select', options: STATUS_OPTIONS },
  { key: 'status_color', label: 'Health', filterable: 'select', options: ['red', 'orange', 'green'] },
  { key: 'progress', label: 'Progress' },
]

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  project_number: 120, project_name: 260, client_name: 200, start_date: 130, end_date: 130,
  status: 130, status_color: 100, progress: 110,
}

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export function OperationsProjectList({ mode }: { mode: 'customer' | 'internal' | 'license' }) {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [search, setSearch] = useState('')
  const [showInternalModal, setShowInternalModal] = useState(false)

  const rb = useReportBuilder(
    mode === 'internal' ? 'operations_internal_projects' : mode === 'license' ? 'operations_licenses' : 'operations_projects',
    COLUMNS, userEmail
  )

  const load = () => projectsAPI.list({ is_internal: mode === 'internal' }).then(setProjects).catch(() => {}).finally(() => setLoading(false))

  useEffect(() => {
    load()
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [mode])

  // Software Licenses deals get their own Project too, but live under the Licenses nav
  // item instead of Projects — split on the linked Opportunity's project_status.
  const scoped = mode === 'license'
    ? projects.filter((p: any) => p.opportunity?.project_status === 'Software Licenses')
    : mode === 'customer'
    ? projects.filter((p: any) => p.opportunity?.project_status !== 'Software Licenses')
    : projects

  const withDisplay = scoped.map((p: any) => ({
    ...p,
    client_name: p.company?.name || p.partner?.name || '',
    start_date: p.is_internal ? p.start_date : p.opportunity?.contract_start_date,
    end_date: p.is_internal ? p.end_date : p.opportunity?.contract_end_date,
  }))
  const searched = withDisplay.filter(p => !search.trim() || p.project_name.toLowerCase().includes(search.trim().toLowerCase()) || (p.project_number || '').toLowerCase().includes(search.trim().toLowerCase()))
  const reported = applyReport(searched, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const pageRows = reported.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader
        title={mode === 'internal' ? '🏠 Internal Projects' : mode === 'license' ? '🔑 Licenses' : '📁 Projects'}
        count={reported.length}
        search={{ value: search, onChange: setSearch }}
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            {mode === 'internal' && <button className="btn-primary" onClick={() => setShowInternalModal(true)}>+ Internal Project</button>}
            <ReportPanel columns={COLUMNS} rb={rb} />
          </div>
        }
      />

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {COLUMNS.filter(c => isVisible(c.key)).map(c => (
                <th key={c.key} onClick={() => rb.toggleSort(c.key)} style={{ position: 'relative', textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: `${rb.columnWidths[c.key] || DEFAULT_COLUMN_WIDTHS[c.key] || 150}px`, cursor: 'pointer', userSelect: 'none' }}>
                  {c.label}<SortArrow active={rb.sortField === c.key} dir={rb.sortDir} />
                  <ColumnResizeHandle colKey={c.key} rb={rb} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLUMNS.length} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Loading...</td></tr>
            ) : reported.length === 0 ? (
              <tr><td colSpan={COLUMNS.length} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Nothing here yet.</td></tr>
            ) : pageRows.map(p => (
              <tr key={p.id} onClick={() => router.push(`/operations/projects/${p.id}`)} style={{ cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                {isVisible('project_number') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE, fontWeight: 700, color: '#64748B' }}>{p.project_number || '—'}</td>}
                {isVisible('project_name') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE, fontWeight: 600, color: '#144766' }}>{p.project_name}</td>}
                {isVisible('client_name') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{p.client_name || '—'}</td>}
                {isVisible('start_date') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{fmt(p.start_date)}</td>}
                {isVisible('end_date') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{fmt(p.end_date)}</td>}
                {isVisible('status') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>
                  {p.status ? <span style={{ background: STATUS_COLOR[p.status]?.bg, color: STATUS_COLOR[p.status]?.color, padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{p.status}</span> : '—'}
                </td>}
                {isVisible('status_color') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>
                  {p.status_color ? <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: HEALTH_COLOR[p.status_color] }} title={p.status_color} /> : '—'}
                </td>}
                {isVisible('progress') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{p.progress != null ? `${p.progress}%` : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={rb.page} setPage={rb.setPage} total={reported.length} />
      </div>

      {showInternalModal && (
        <InternalProjectModal onClose={() => setShowInternalModal(false)} onSave={() => { setShowInternalModal(false); load() }} />
      )}
    </div>
  )
}
