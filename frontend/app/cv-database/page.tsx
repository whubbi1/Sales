'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { getStoredUser } from '@/lib/auth'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, ColumnResizeHandle, SortArrow, Pagination } from '@/components/it/ReportBuilder'
import { PageHeader } from '@/components/shared/RecordLayout'

const API = 'https://api.whubbi.wcomply.com'

const COLUMNS: ReportColumn[] = [
  { key: 'employee_name', label: 'Employee', filterable: 'text' },
  { key: 'cv_title', label: 'Title', filterable: 'text' },
  { key: 'department', label: 'Department', filterable: 'text' },
  { key: 'cv_status', label: 'CV', filterable: 'select', options: ['Complete', 'Not started'] },
  { key: 'experience_count', label: 'Experiences' },
]

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  employee_name: 200, cv_title: 200, department: 160, cv_status: 130, experience_count: 110,
}

function ShortCvModal({ user, onClose }: any) {
  const [cv, setCv] = useState<any>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/cv/${encodeURIComponent(user.email)}`).then(r => r.json()).then(d => { setCv(d.cv); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  const download = () => {
    const url = `${API}/cv/${encodeURIComponent(user.email)}/export/word?experience_ids=${selected.join(',')}`
    window.open(url, '_blank')
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>Short CV — {user.display_name || user.email}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#45B6E4' }}>Loading…</div>
          ) : !cv?.experiences?.length ? (
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>This person has no experiences on their CV yet.</p>
          ) : (
            <>
              <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px' }}>Select the experiences to include in this curated CV.</p>
              <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #EDF2F7', borderRadius: '8px', marginBottom: '14px' }}>
                {cv.experiences.map((exp: any) => (
                  <label key={exp.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selected.includes(exp.id)} onChange={() => toggle(exp.id)} style={{ marginTop: '3px' }} />
                    <div>
                      <div style={{ fontWeight: '700', color: '#156082' }}>{exp.job_title} · {exp.company}</div>
                      <div style={{ color: '#94A3B8', fontSize: '11px' }}>{exp.start_date || '—'} → {exp.end_date || 'Present'}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
                <button onClick={download} disabled={selected.length === 0}
                  style={{ padding: '9px 18px', background: selected.length === 0 ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
                  Generate & Download ({selected.length})
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CvDatabaseContent() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [shortCvUser, setShortCvUser] = useState<any>(null)
  const [userEmail, setUserEmail] = useState('')

  const rb = useReportBuilder('cv_database', COLUMNS, userEmail)

  useEffect(() => {
    fetch(`${API}/cv`).then(r => r.json()).then(d => { setUsers(d.users || []); setLoading(false) }).catch(() => setLoading(false))
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  const searched = users.filter(u => !search || `${u.display_name} ${u.email} ${u.department}`.toLowerCase().includes(search.toLowerCase()))
  const withDisplay = searched.map(u => ({
    ...u,
    employee_name: u.display_name || `${u.first_name} ${u.last_name}`,
    cv_status: u.has_cv ? 'Complete' : 'Not started',
  }))
  const reported = applyReport(withDisplay, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const pageRows = reported.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader
        title="📇 CV Database"
        count={reported.length}
        search={{ value: search, onChange: setSearch }}
        action={<ReportPanel columns={COLUMNS} rb={rb} />}
      />

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {COLUMNS.filter(c => isVisible(c.key)).map(c => (
                <th key={c.key} onClick={() => rb.toggleSort(c.key)} style={{ position: 'relative', padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: `${rb.columnWidths[c.key] || DEFAULT_COLUMN_WIDTHS[c.key] || 150}px`, cursor: 'pointer', userSelect: 'none' }}>
                  {c.label}<SortArrow active={rb.sortField === c.key} dir={rb.sortDir} />
                  <ColumnResizeHandle colKey={c.key} rb={rb} />
                </th>
              ))}
              <th style={{ padding: '10px 16px', borderBottom: '1px solid #EDF2F7', width: '160px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '32px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : reported.length === 0 ? (
              <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>No employees found.</td></tr>
            ) : pageRows.map(u => (
              <tr key={u.email} style={{ borderBottom: '1px solid #F1F5F9' }}>
                {isVisible('employee_name') && <td style={{ padding: '10px 16px', fontWeight: '700', color: '#156082' }}>{u.employee_name}</td>}
                {isVisible('cv_title') && <td style={{ padding: '10px 16px', color: '#3F3F3F' }}>{u.cv_title || '—'}</td>}
                {isVisible('department') && <td style={{ padding: '10px 16px', color: '#64748B' }}>{u.department || '—'}</td>}
                {isVisible('cv_status') && (
                  <td style={{ padding: '10px 16px' }}>
                    {u.has_cv ? <span style={{ background: '#ECFDF5', color: '#059669', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>Complete</span> : <span style={{ background: '#F1F5F9', color: '#94A3B8', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>Not started</span>}
                  </td>
                )}
                {isVisible('experience_count') && <td style={{ padding: '10px 16px' }}>{u.experience_count}</td>}
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <a href={`${API}/cv/${encodeURIComponent(u.email)}/export/word`} style={{ padding: '5px 10px', background: '#EFF6FF', borderRadius: '6px', fontSize: '11px', color: '#3B82F6', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', textDecoration: 'none' }}>Word</a>
                    <a href={`${API}/cv/${encodeURIComponent(u.email)}/export/pptx`} style={{ padding: '5px 10px', background: '#F5F3FF', borderRadius: '6px', fontSize: '11px', color: '#7C3AED', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', textDecoration: 'none' }}>PPT</a>
                    {u.experience_count > 0 && (
                      <button onClick={() => setShortCvUser(u)} style={{ padding: '5px 10px', background: '#FFF7ED', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#D97706', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Short CV</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={rb.page} setPage={rb.setPage} total={reported.length} />
      </div>

      {shortCvUser && <ShortCvModal user={shortCvUser} onClose={() => setShortCvUser(null)} />}
    </div>
  )
}

export default function CvDatabasePage() {
  const router = useRouter()
  const [permLevel, setPermLevel] = useState<'loading' | 'none' | 'ok'>('loading')

  useEffect(() => {
    const user = getStoredUser()
    if (!user) { router.push('/auth/login'); return }
    fetch(`${API}/settings/permissions/${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(d => {
        const p = d.permissions?.sales?.cv_database
        setPermLevel(!!p && p.access_mode !== 'none' ? 'ok' : 'none')
      })
      .catch(() => setPermLevel('none'))
  }, [])

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        {permLevel === 'loading' && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
        )}
        {permLevel === 'none' && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
            <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
            <p style={{ fontSize: '13px' }}>You don't have permission to access the CV Database. Ask an admin to grant it via HR Permissions.</p>
          </div>
        )}
        {permLevel === 'ok' && <CvDatabaseContent />}
      </main>
    </div>
  )
}
