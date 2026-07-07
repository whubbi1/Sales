'use client'
import { useState, useEffect } from 'react'

const API = 'https://api.whubbi.wcomply.com'

export interface ReportColumn {
  key: string
  label: string
  filterable?: 'text' | 'select'
  options?: string[]
}

// Single typographic style for every data cell in a report table — no per-column or per-value
// font/size/color variation (badges included), so the output reads as one consistent report.
export const REPORT_CELL_STYLE: React.CSSProperties = {
  fontFamily: 'Montserrat, sans-serif', fontSize: '12px', color: '#3F3F3F', fontWeight: 400,
}

function storageKeyFor(module: string, userEmail: string) {
  return userEmail ? `it_report_state_${module}_${userEmail}` : ''
}

export function useReportBuilder(module: string, columns: ReportColumn[], userEmail: string) {
  const allKeys = columns.map(c => c.key)
  const [visibleCols, setVisibleCols] = useState<string[]>(allKeys)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sortField, setSortField] = useState<string>(columns[0]?.key || '')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [savedViews, setSavedViews] = useState<any[]>([])
  const [activeViewId, setActiveViewId] = useState<string>('')
  const [restored, setRestored] = useState(false)

  const reload = () => {
    if (!userEmail) return
    fetch(`${API}/it/report-views?module=${encodeURIComponent(module)}&user_email=${encodeURIComponent(userEmail)}`)
      .then(r => r.json()).then(d => setSavedViews(d.views || [])).catch(() => {})
  }

  // Restore whatever report setup (saved view, columns, filters, sort, column widths) was active
  // when the user last left this page, so it doesn't silently reset to defaults on return.
  //
  // userEmail starts out as '' on first mount (the page resolves it from getStoredUser() in its
  // own effect, one render later), so this effect necessarily runs once with an empty key before
  // it runs again with the real email. `restored` must only flip to true on that second, real run —
  // flipping it early let the save-effect below fire in the same batch using the still-default
  // state (the restore's setState calls hadn't committed yet) and immediately clobber whatever
  // was in localStorage with those defaults, on every single page load.
  useEffect(() => {
    const key = storageKeyFor(module, userEmail)
    if (key) {
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const saved = JSON.parse(raw)
          if (Array.isArray(saved.visibleCols) && saved.visibleCols.length) setVisibleCols(saved.visibleCols)
          if (saved.filters) setFilters(saved.filters)
          if (saved.sortField) setSortField(saved.sortField)
          if (saved.sortDir) setSortDir(saved.sortDir)
          if (saved.columnWidths) setColumnWidths(saved.columnWidths)
          if (saved.activeViewId) setActiveViewId(saved.activeViewId)
        }
      } catch {}
      setRestored(true)
    }
    reload()
  }, [userEmail])

  useEffect(() => {
    if (!restored) return
    const key = storageKeyFor(module, userEmail)
    if (!key) return
    localStorage.setItem(key, JSON.stringify({ visibleCols, filters, sortField, sortDir, columnWidths, activeViewId }))
  }, [restored, module, userEmail, visibleCols, filters, sortField, sortDir, columnWidths, activeViewId])

  const toggleCol = (key: string) => {
    setVisibleCols(v => v.includes(key) ? v.filter(k => k !== key) : [...v, key])
  }

  const setFilter = (key: string, value: string) => {
    setFilters(f => ({ ...f, [key]: value }))
  }

  const setColumnWidth = (key: string, width: number) => {
    setColumnWidths(w => ({ ...w, [key]: Math.round(width) }))
  }

  const applyView = (view: any) => {
    setVisibleCols(view.columns && view.columns.length ? view.columns : allKeys)
    setFilters(view.filters || {})
    setSortField(view.sort_field || columns[0]?.key || '')
    setSortDir((view.sort_dir as any) || 'asc')
    setColumnWidths(view.column_widths || {})
    setActiveViewId(view.id)
  }

  const saveView = async (name: string) => {
    const payload = { user_email: userEmail, module, name, columns: visibleCols, filters, sort_field: sortField, sort_dir: sortDir, column_widths: columnWidths }
    await fetch(`${API}/it/report-views`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    reload()
  }

  const deleteView = async (id: string) => {
    await fetch(`${API}/it/report-views/${id}`, { method: 'DELETE' })
    if (activeViewId === id) setActiveViewId('')
    reload()
  }

  const resetToDefault = () => {
    setVisibleCols(allKeys); setFilters({}); setSortField(columns[0]?.key || ''); setSortDir('asc'); setColumnWidths({}); setActiveViewId('')
  }

  return {
    visibleCols, setVisibleCols, toggleCol,
    filters, setFilter,
    sortField, setSortField, sortDir, setSortDir,
    columnWidths, setColumnWidth,
    savedViews, activeViewId, applyView, saveView, deleteView, resetToDefault,
  }
}

export function applyReport(data: any[], columns: ReportColumn[], filters: Record<string, string>, sortField: string, sortDir: 'asc' | 'desc') {
  let result = data.filter(row => {
    return Object.entries(filters).every(([key, val]) => {
      if (!val) return true
      const col = columns.find(c => c.key === key)
      const cellVal = row[key]
      if (col?.filterable === 'select') return String(cellVal ?? '') === val
      return String(cellVal ?? '').toLowerCase().includes(val.toLowerCase())
    })
  })
  if (sortField) {
    result = [...result].sort((a, b) => {
      const av = a[sortField] ?? ''
      const bv = b[sortField] ?? ''
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }
  return result
}

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '6px 10px', border: '1px solid #E2E8F0',
  borderRadius: '7px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}

const MIN_COLUMN_WIDTH = 60

// Drag handle for the right edge of a <th> — place it inside a `<th style={{position:'relative'}}>`.
// Give the table `style={{ tableLayout: 'fixed' }}` so widths set on header cells actually stick.
export function ColumnResizeHandle({ colKey, rb }: { colKey: string; rb: ReturnType<typeof useReportBuilder> }) {
  const startResize = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const th = (e.currentTarget.parentElement as HTMLElement)
    const startWidth = rb.columnWidths[colKey] || th?.offsetWidth || 120
    const startX = e.clientX
    const onMove = (ev: MouseEvent) => {
      rb.setColumnWidth(colKey, Math.max(MIN_COLUMN_WIDTH, startWidth + (ev.clientX - startX)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <span onMouseDown={startResize} onClick={e => e.stopPropagation()} title="Drag to resize"
      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '8px', cursor: 'col-resize', userSelect: 'none' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(21,96,130,0.15)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} />
  )
}

export function ReportPanel({ columns, rb }: { columns: ReportColumn[]; rb: ReturnType<typeof useReportBuilder> }) {
  const [open, setOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

  const activeCount = Object.values(rb.filters).filter(Boolean).length

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ padding: '9px 16px', background: open ? '#156082' : 'white', color: open ? 'white' : '#156082', border: '1px solid #156082', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', display: 'flex', alignItems: 'center', gap: '6px' }}>
        📊 Report{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: '380px', maxHeight: '70vh', overflow: 'auto', background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 999, padding: '16px' }}>

            {rb.savedViews.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#45B6E4', marginBottom: '6px' }}>Saved Views</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {rb.savedViews.map((v: any) => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button onClick={() => rb.applyView(v)}
                        style={{ flex: 1, textAlign: 'left', padding: '6px 10px', background: rb.activeViewId === v.id ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${rb.activeViewId === v.id ? '#156082' : '#E2E8F0'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#3F3F3F', fontFamily: 'Montserrat, sans-serif' }}>
                        {v.name}
                      </button>
                      <button onClick={() => rb.deleteView(v.id)} title="Delete view"
                        style={{ padding: '5px 8px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#EF4444', fontFamily: 'Montserrat, sans-serif' }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#45B6E4', marginBottom: '6px' }}>Columns</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {columns.map(c => (
                  <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: rb.visibleCols.includes(c.key) ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${rb.visibleCols.includes(c.key) ? '#156082' : '#E2E8F0'}`, borderRadius: '14px', fontSize: '11px', cursor: 'pointer', color: rb.visibleCols.includes(c.key) ? '#156082' : '#64748B' }}>
                    <input type="checkbox" checked={rb.visibleCols.includes(c.key)} onChange={() => rb.toggleCol(c.key)} style={{ margin: 0 }} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#45B6E4', marginBottom: '6px' }}>Filters</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {columns.filter(c => c.filterable).map(c => (
                  <div key={c.key}>
                    <label style={{ fontSize: '10px', color: '#94A3B8', display: 'block', marginBottom: '2px' }}>{c.label}</label>
                    {c.filterable === 'select' ? (
                      <select style={{ ...inp, width: '100%' }} value={rb.filters[c.key] || ''} onChange={e => rb.setFilter(c.key, e.target.value)}>
                        <option value="">Any</option>
                        {(c.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={rb.filters[c.key] || ''} onChange={e => rb.setFilter(c.key, e.target.value)} placeholder={`Filter by ${c.label.toLowerCase()}…`} />
                    )}
                  </div>
                ))}
                {columns.filter(c => c.filterable).length === 0 && <span style={{ fontSize: '11px', color: '#94A3B8' }}>No filterable fields.</span>}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#45B6E4', marginBottom: '6px' }}>Sort</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <select style={{ ...inp, flex: 1 }} value={rb.sortField} onChange={e => rb.setSortField(e.target.value)}>
                  {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
                <select style={inp} value={rb.sortDir} onChange={e => rb.setSortDir(e.target.value as any)}>
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <input style={{ ...inp, flex: 1, boxSizing: 'border-box' as const }} placeholder="Save as…" value={saveName} onChange={e => setSaveName(e.target.value)} />
              <button onClick={() => { if (saveName.trim()) { rb.saveView(saveName.trim()); setSaveName('') } }} disabled={!saveName.trim()}
                style={{ padding: '6px 14px', background: saveName.trim() ? '#156082' : '#94A3B8', color: 'white', border: 'none', borderRadius: '7px', cursor: saveName.trim() ? 'pointer' : 'default', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Save</button>
            </div>
            <button onClick={rb.resetToDefault} style={{ width: '100%', padding: '6px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', fontFamily: 'Montserrat, sans-serif' }}>Reset to Default</button>
          </div>
        </>
      )}
    </div>
  )
}
