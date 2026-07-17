'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { projectsAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, ColumnResizeHandle, REPORT_CELL_STYLE, SortArrow, Pagination } from '@/components/it/ReportBuilder'
import { PageHeader } from '@/components/shared/RecordLayout'
import { InternalProjectModal } from '@/components/projects/InternalProjectModal'

const COLUMNS: ReportColumn[] = [
  { key: 'project_number', label: 'Project ID', filterable: 'text' },
  { key: 'project_name', label: 'Project Name', filterable: 'text' },
  { key: 'client_name', label: 'Client/Partner', filterable: 'text' },
  { key: 'type', label: 'Type', filterable: 'select', options: ['Customer', 'Internal'] },
  { key: 'start_date', label: 'Start' },
  { key: 'end_date', label: 'End' },
]

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  project_number: 120, project_name: 260, client_name: 180, type: 110, start_date: 120, end_date: 120,
}

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export function OperationsProjectList() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [search, setSearch] = useState('')
  const [showInternalModal, setShowInternalModal] = useState(false)

  const rb = useReportBuilder('operations_projects', COLUMNS, userEmail)

  const load = () => projectsAPI.list({}).then(setProjects).catch(() => {}).finally(() => setLoading(false))

  useEffect(() => {
    load()
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  const withDisplay = projects.map((p: any) => ({
    ...p,
    client_name: p.company?.name || p.partner?.name || '',
    type: p.is_internal ? 'Internal' : 'Customer',
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
        title="📁 Projects"
        count={reported.length}
        search={{ value: search, onChange: setSearch }}
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-primary" onClick={() => setShowInternalModal(true)}>+ Internal Project</button>
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
                {isVisible('type') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>
                  <span style={{ background: p.is_internal ? '#F5F3FF' : '#ECFDF5', color: p.is_internal ? '#7C3AED' : '#059669', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{p.type}</span>
                </td>}
                {isVisible('start_date') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{fmt(p.start_date)}</td>}
                {isVisible('end_date') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{fmt(p.end_date)}</td>}
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
