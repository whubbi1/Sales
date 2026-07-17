'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { reportingAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { ReportChart } from '@/components/reporting/ReportChart'

const API = 'https://api.whubbi.wcomply.com'
const OPERATORS = [
  { value: '=', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: '>', label: 'greater than' },
  { value: '<', label: 'less than' },
  { value: '>=', label: 'at least' },
  { value: '<=', label: 'at most' },
  { value: 'contains', label: 'contains' },
  { value: 'in', label: 'is one of (comma-separated)' },
  { value: 'is_null', label: 'is empty' },
  { value: 'is_not_null', label: 'is not empty' },
]
const AGGREGATE_FUNCTIONS = ['count', 'sum', 'avg', 'min', 'max']
const CHART_TYPES = [
  { value: 'table', label: '📋 Table' },
  { value: 'bar', label: '📊 Bar' },
  { value: 'line', label: '📈 Line' },
  { value: 'pie', label: '🥧 Pie' },
]

function FormField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

export function ReportBuilderForm({ report }: { report?: any }) {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [entities, setEntities] = useState<any[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const [name, setName] = useState(report?.name || '')
  const [sharedWith, setSharedWith] = useState<string[]>(report?.shared_with?.filter((s: string) => s !== '*') || [])
  const [shareAll, setShareAll] = useState(report?.shared_with?.includes('*') || false)

  const [spec, setSpec] = useState<any>(report?.spec || {
    entity: '', columns: [], filters: [], group_by: [], aggregates: [], sort: null, chart_type: 'table',
  })

  useEffect(() => {
    reportingAPI.getSchema().then(d => setEntities(d.entities || [])).catch(() => {})
    fetch(`${API}/settings/users`).then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  const entityCfg = entities.find(e => e.entity === spec.entity)
  const columns = entityCfg?.columns || []
  const employeeName = (u: any) => u.display_name || `${u.first_name} ${u.last_name}`

  const selectEntity = (entity: string) => {
    setSpec({ entity, columns: [], filters: [], group_by: [], aggregates: [], sort: null, chart_type: 'table' })
    setRows([])
  }

  const toggleColumn = (col: string) => {
    setSpec((p: any) => ({ ...p, columns: p.columns.includes(col) ? p.columns.filter((c: string) => c !== col) : [...p.columns, col] }))
  }
  const toggleGroupBy = (col: string) => {
    setSpec((p: any) => ({ ...p, group_by: p.group_by.includes(col) ? p.group_by.filter((c: string) => c !== col) : [...p.group_by, col] }))
  }

  const addFilter = () => setSpec((p: any) => ({ ...p, filters: [...p.filters, { column: columns[0]?.key || '', operator: '=', value: '' }] }))
  const updateFilter = (i: number, fields: any) => setSpec((p: any) => ({ ...p, filters: p.filters.map((f: any, idx: number) => idx === i ? { ...f, ...fields } : f) }))
  const removeFilter = (i: number) => setSpec((p: any) => ({ ...p, filters: p.filters.filter((_: any, idx: number) => idx !== i) }))

  const addAggregate = () => setSpec((p: any) => ({ ...p, aggregates: [...p.aggregates, { column: columns[0]?.key || '', function: 'count' }] }))
  const updateAggregate = (i: number, fields: any) => setSpec((p: any) => ({ ...p, aggregates: p.aggregates.map((a: any, idx: number) => idx === i ? { ...a, ...fields } : a) }))
  const removeAggregate = (i: number) => setSpec((p: any) => ({ ...p, aggregates: p.aggregates.filter((_: any, idx: number) => idx !== i) }))

  const buildRunnableSpec = () => ({
    ...spec,
    filters: spec.filters.map((f: any) => ({
      ...f,
      value: f.operator === 'in' ? String(f.value).split(',').map((v: string) => v.trim()).filter(Boolean) : f.value,
    })),
  })

  const runPreview = async () => {
    if (!spec.entity) return
    setRunning(true); setRunError('')
    try {
      const d = await reportingAPI.runAdHoc(buildRunnableSpec())
      setRows(d.rows || [])
    } catch (e: any) { setRunError(e.message); setRows([]) }
    finally { setRunning(false) }
  }

  const askClaude = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true); setAiError('')
    try {
      const d = await reportingAPI.aiDraft(aiPrompt.trim())
      setSpec({
        entity: d.spec.entity, columns: d.spec.columns || [], filters: d.spec.filters || [],
        group_by: d.spec.group_by || [], aggregates: d.spec.aggregates || [],
        sort: d.spec.sort || null, chart_type: d.spec.chart_type || 'table',
      })
      setRows([])
    } catch (e: any) { setAiError(e.message) }
    finally { setAiLoading(false) }
  }

  const save = async () => {
    if (!name.trim()) { setSaveError('Give the report a name first'); return }
    if (!spec.entity) { setSaveError('Pick an entity first'); return }
    setSaving(true); setSaveError('')
    try {
      const payload = { name: name.trim(), owner_email: report?.owner_email || userEmail, spec: buildRunnableSpec(), chart_type: spec.chart_type, shared_with: shareAll ? ['*'] : sharedWith }
      if (report) await reportingAPI.updateReport(report.id, payload)
      else await reportingAPI.createReport(payload)
      router.push('/reporting/reports')
    } catch (e: any) { setSaveError(e.message) }
    finally { setSaving(false) }
  }

  const toggleShare = (email: string) => setSharedWith(p => p.includes(email) ? p.filter(e => e !== email) : [...p, email])
  const sortedUsers = [...users].sort((a, b) => employeeName(a).localeCompare(employeeName(b))).filter(u => u.email !== userEmail)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', alignItems: 'start' }}>
      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <p className="section-label" style={{ marginBottom: '8px' }}>Ask Claude</p>
        <textarea className="form-input" rows={3} style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box', marginBottom: '8px' }}
          placeholder="e.g. Show total opportunity amount by status for the last year"
          value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
        <button className="btn-primary" onClick={askClaude} disabled={aiLoading || !aiPrompt.trim()} style={{ width: '100%', marginBottom: '18px' }}>{aiLoading ? 'Thinking…' : '✨ Draft with Claude'}</button>
        {aiError && <p style={{ color: '#DC2626', fontSize: '12px', marginTop: '-10px', marginBottom: '14px' }}>{aiError}</p>}

        <p className="section-label" style={{ marginBottom: '8px' }}>Entity</p>
        <select className="form-input" style={{ width: '100%', marginBottom: '18px' }} value={spec.entity} onChange={e => selectEntity(e.target.value)}>
          <option value="">Select entity…</option>
          {entities.map(e => <option key={e.entity} value={e.entity}>{e.label}</option>)}
        </select>

        {spec.entity && (
          <>
            <p className="section-label" style={{ marginBottom: '8px' }}>Columns</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '18px', maxHeight: '160px', overflowY: 'auto' }}>
              {columns.map((c: any) => (
                <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <input type="checkbox" checked={spec.columns.includes(c.key)} onChange={() => toggleColumn(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>

            <p className="section-label" style={{ marginBottom: '8px' }}>Filters</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
              {spec.filters.map((f: any, i: number) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <select className="form-input" style={{ fontSize: '11px', padding: '3px 4px', flex: 1 }} value={f.column} onChange={e => updateFilter(i, { column: e.target.value })}>
                      {columns.map((c: any) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    <button onClick={() => removeFilter(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '14px', padding: '0 4px' }}>×</button>
                  </div>
                  <select className="form-input" style={{ fontSize: '11px', padding: '3px 4px' }} value={f.operator} onChange={e => updateFilter(i, { operator: e.target.value })}>
                    {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {!['is_null', 'is_not_null'].includes(f.operator) && (
                    <input className="form-input" style={{ fontSize: '11px', padding: '3px 6px' }} placeholder="Value…" value={f.value} onChange={e => updateFilter(i, { value: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
            <button className="btn-secondary" onClick={addFilter} style={{ width: '100%', marginBottom: '18px', fontSize: '12px' }}>+ Add Filter</button>

            <p className="section-label" style={{ marginBottom: '8px' }}>Group By</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '18px', maxHeight: '120px', overflowY: 'auto' }}>
              {columns.map((c: any) => (
                <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <input type="checkbox" checked={spec.group_by.includes(c.key)} onChange={() => toggleGroupBy(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>

            <p className="section-label" style={{ marginBottom: '8px' }}>Aggregates</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
              {spec.aggregates.map((a: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <select className="form-input" style={{ fontSize: '11px', padding: '3px 4px', width: '70px' }} value={a.function} onChange={e => updateAggregate(i, { function: e.target.value })}>
                    {AGGREGATE_FUNCTIONS.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                  </select>
                  <select className="form-input" style={{ fontSize: '11px', padding: '3px 4px', flex: 1 }} value={a.column} onChange={e => updateAggregate(i, { column: e.target.value })}>
                    {columns.map((c: any) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <button onClick={() => removeAggregate(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '14px', padding: '0 4px' }}>×</button>
                </div>
              ))}
            </div>
            <button className="btn-secondary" onClick={addAggregate} style={{ width: '100%', marginBottom: '18px', fontSize: '12px' }}>+ Add Aggregate</button>

            <p className="section-label" style={{ marginBottom: '8px' }}>Chart Type</p>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '18px' }}>
              {CHART_TYPES.map(ct => (
                <button key={ct.value} onClick={() => setSpec((p: any) => ({ ...p, chart_type: ct.value }))}
                  style={{ flex: 1, padding: '6px 4px', borderRadius: '6px', border: 'none', background: spec.chart_type === ct.value ? '#7C3AED' : '#F1F5F9', color: spec.chart_type === ct.value ? 'white' : '#64748B', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                  {ct.label}
                </button>
              ))}
            </div>

            <button className="btn-primary" onClick={runPreview} disabled={running} style={{ width: '100%' }}>{running ? 'Running…' : '▶ Run Preview'}</button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', minHeight: '320px' }}>
          <p className="section-label" style={{ marginBottom: '12px' }}>Preview</p>
          {runError && <p style={{ color: '#DC2626', fontSize: '12px', marginBottom: '10px' }}>{runError}</p>}
          {!spec.entity ? (
            <p style={{ color: '#9B9B9B', fontSize: '13px' }}>Pick an entity and click Run Preview to see results.</p>
          ) : rows.length === 0 && !running ? (
            <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No results yet — click Run Preview.</p>
          ) : (
            <ReportChart rows={rows} spec={spec} />
          )}
        </div>

        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p className="section-label" style={{ marginBottom: '10px' }}>Save Report</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            <FormField label="Report Name">
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Pipeline by status" />
            </FormField>
            <FormField label="Share with">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginBottom: '8px' }}>
                <input type="checkbox" checked={shareAll} onChange={e => setShareAll(e.target.checked)} />
                Everyone in WHUBBI
              </label>
              {!shareAll && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '90px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px' }}>
                  {sortedUsers.map((u: any) => (
                    <label key={u.email} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '3px 8px', borderRadius: '6px', background: sharedWith.includes(u.email) ? '#F5F3FF' : '#F8FAFC', cursor: 'pointer' }}>
                      <input type="checkbox" checked={sharedWith.includes(u.email)} onChange={() => toggleShare(u.email)} />
                      {employeeName(u)}
                    </label>
                  ))}
                </div>
              )}
            </FormField>
            {saveError && <p style={{ color: '#DC2626', fontSize: '12px' }}>{saveError}</p>}
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : report ? 'Save Changes' : 'Save Report'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
