'use client'
import { useState, useEffect } from 'react'
import { projectsAPI, timesheetsAPI } from '@/lib/api'
import { StaffingDrilldownModal } from '@/components/shared/StaffingDrilldownModal'

function mondayOf(d: Date) {
  const dt = new Date(d)
  const day = dt.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  dt.setDate(dt.getDate() + diff)
  dt.setHours(0, 0, 0, 0)
  return dt
}

function weeksBetween(start?: string, end?: string): { key: string; label: string }[] {
  if (!start || !end) return []
  const weeks: { key: string; label: string }[] = []
  let cur = mondayOf(new Date(start))
  const last = new Date(end)
  while (cur <= last) {
    weeks.push({ key: cur.toISOString().split('T')[0], label: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })
    cur = new Date(cur)
    cur.setDate(cur.getDate() + 7)
  }
  return weeks
}

function monthsBetween(start?: string, end?: string): { key: string; label: string }[] {
  if (!start || !end) return []
  const s = new Date(start), e = new Date(end)
  const months: { key: string; label: string }[] = []
  let cur = new Date(s.getFullYear(), s.getMonth(), 1)
  const last = new Date(e.getFullYear(), e.getMonth(), 1)
  while (cur <= last) {
    months.push({ key: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-01`, label: cur.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) })
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }
  return months
}

export function ProjectStaffingSheet({ projectId, startDate, endDate, users }: { projectId: string; startDate?: string; endDate?: string; users: any[] }) {
  const [planType, setPlanType] = useState<'initial' | 'current'>('current')
  const [granularity, setGranularity] = useState<'week' | 'month'>('month')
  const [tasks, setTasks] = useState<any[]>([])
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskResource, setNewTaskResource] = useState('')
  const [drilldown, setDrilldown] = useState<{ email: string; resource: string; monthKey: string; monthLabel: string } | null>(null)

  const load = async () => {
    setLoading(true)
    const [t, e] = await Promise.all([
      projectsAPI.getStaffing(projectId, planType),
      timesheetsAPI.list({ project_id: projectId }),
    ])
    setTasks(t); setEntries(e); setLoading(false)
  }
  useEffect(() => { load() }, [projectId, planType])

  const periods = granularity === 'week' ? weeksBetween(startDate, endDate) : monthsBetween(startDate, endDate)
  const months = monthsBetween(startDate, endDate)

  const employeeName = (u: any) => u.display_name || `${u.first_name} ${u.last_name}`
  const sortedUsers = [...users].sort((a, b) => employeeName(a).localeCompare(employeeName(b)))
  const isReadOnly = planType === 'initial'

  const addTask = async () => {
    if (!newTaskTitle.trim()) return
    const u = users.find((uu: any) => uu.email === newTaskResource)
    await projectsAPI.addStaffing(projectId, { plan_type: 'current', title: newTaskTitle.trim(), resource_email: newTaskResource || null, resource_name: u ? employeeName(u) : null, position: tasks.length })
    setNewTaskTitle(''); setNewTaskResource('')
    load()
  }
  const deleteTask = async (task: any) => {
    if (!confirm(`Delete task "${task.title}"?`)) return
    await projectsAPI.deleteStaffing(projectId, task.id)
    load()
  }
  const patchTaskResource = async (task: any, email: string) => {
    const u = users.find((uu: any) => uu.email === email)
    await projectsAPI.updateStaffing(projectId, task.id, { resource_email: email || null, resource_name: u ? employeeName(u) : null })
    load()
  }

  const dayFor = (task: any, periodKey: string) =>
    (task.allocations || []).find((a: any) => a.period_type === granularity && a.period_start.slice(0, 10) === periodKey)?.days || ''

  const saveAllocation = async (task: any, periodKey: string, days: number) => {
    const current = (task.allocations || []).filter((a: any) => a.period_type === granularity)
    const next = current.filter((a: any) => a.period_start.slice(0, 10) !== periodKey)
    if (days > 0) next.push({ period_start: periodKey, period_type: granularity, days })
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, allocations: [...(t.allocations || []).filter((a: any) => a.period_type !== granularity), ...next] } : t))
    await projectsAPI.setStaffingAllocations(projectId, task.id, next)
  }

  // Actuals — rolled up live from timesheet entries (hours converted to days at 8h/day).
  const daysOf = (e: any) => e.unit === 'days' ? e.amount : e.amount / 8
  const actualsResources = new Map<string, string>()
  entries.forEach((e: any) => actualsResources.set(e.user_email, e.user_name || e.user_email))
  const actualsRows = [...actualsResources.entries()].sort((a, b) => a[1].localeCompare(b[1]))

  const actualDaysFor = (email: string, monthKey: string) =>
    entries.filter((e: any) => e.user_email === email && e.entry_date.slice(0, 7) === monthKey.slice(0, 7))
      .reduce((s: number, e: any) => s + daysOf(e), 0)

  const drilldownRows = drilldown
    ? entries
        .filter((e: any) => e.user_email === drilldown.email && e.entry_date.slice(0, 7) === drilldown.monthKey.slice(0, 7))
        .map((e: any) => ({ label: new Date(e.entry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), sublabel: e.description || undefined, days: Math.round(daysOf(e) * 100) / 100 }))
    : []

  if (loading) return <p style={{ color: '#9B9B9B', fontSize: '13px' }}>Loading…</p>

  if (!startDate || !endDate) {
    return <p style={{ color: '#D97706', fontSize: '12px' }}>No start/end dates set for this project yet — the timeline can't be built.</p>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '3px', background: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
          {(['initial', 'current'] as const).map(p => (
            <button key={p} onClick={() => setPlanType(p)} style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: planType === p ? '#156082' : 'transparent', color: planType === p ? 'white' : '#64748B', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', textTransform: 'capitalize' as const }}>{p === 'initial' ? 'Initial Plan' : 'Current Plan'}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '3px', background: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
          {(['week', 'month'] as const).map(g => (
            <button key={g} onClick={() => setGranularity(g)} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: granularity === g ? '#156082' : 'transparent', color: granularity === g ? 'white' : '#64748B', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', textTransform: 'capitalize' as const }}>{g}s</button>
          ))}
        </div>
      </div>

      {isReadOnly && <p style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '10px' }}>🔒 Frozen baseline copied from the quotation — switch to Current Plan to make adjustments.</p>}

      {!isReadOnly && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <input className="form-input" style={{ flex: 1 }} placeholder="Task name…" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} />
          <select className="form-input" style={{ width: '200px' }} value={newTaskResource} onChange={e => setNewTaskResource(e.target.value)}>
            <option value="">No resource yet…</option>
            {sortedUsers.map((u: any) => <option key={u.email} value={u.email}>{employeeName(u)}</option>)}
          </select>
          <button className="btn-primary" onClick={addTask} disabled={!newTaskTitle.trim()}>+ Add Task</button>
        </div>
      )}

      {tasks.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No tasks in this plan yet.</p> : (
        <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '12px', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>Task</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>Resource</th>
                {periods.map(p => <th key={p.key} style={{ textAlign: 'center', padding: '8px 6px', fontSize: '10px', fontWeight: '700', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{p.label}</th>)}
                <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: '10px', fontWeight: '700', color: '#144766', borderBottom: '1px solid #E2E8F0' }}>Total</th>
                {!isReadOnly && <th style={{ borderBottom: '1px solid #E2E8F0' }} />}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t: any) => {
                const total = (t.allocations || []).filter((a: any) => a.period_type === granularity).reduce((s: number, a: any) => s + a.days, 0)
                return (
                  <tr key={t.id}>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9', fontWeight: '700', color: '#144766', whiteSpace: 'nowrap' }}>{t.title}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9' }}>
                      {isReadOnly ? (t.resource_name || t.resource_email || '—') : (
                        <select className="form-input" style={{ fontSize: '11px', padding: '3px 6px' }} value={t.resource_email || ''} onChange={e => patchTaskResource(t, e.target.value)}>
                          <option value="">Unassigned</option>
                          {sortedUsers.map((u: any) => <option key={u.email} value={u.email}>{employeeName(u)}</option>)}
                        </select>
                      )}
                    </td>
                    {periods.map(p => (
                      <td key={p.key} style={{ padding: '4px', borderBottom: '1px solid #F1F5F9', textAlign: 'center' }}>
                        {isReadOnly ? (dayFor(t, p.key) || '—') : (
                          <input type="number" min={0} step={0.5} defaultValue={dayFor(t, p.key)} placeholder="0"
                            onBlur={e => saveAllocation(t, p.key, Number(e.target.value) || 0)}
                            style={{ width: '52px', textAlign: 'center', fontSize: '12px', padding: '4px', border: '1px solid #E2E8F0', borderRadius: '5px' }} />
                        )}
                      </td>
                    ))}
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9', textAlign: 'center', fontWeight: '700', color: '#144766' }}>{total || '—'}</td>
                    {!isReadOnly && (
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9' }}>
                        <button onClick={() => deleteTask(t)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="section-label" style={{ marginBottom: '8px' }}>Actuals (from Timesheets)</p>
      {actualsRows.length === 0 ? (
        <p style={{ color: '#9B9B9B', fontSize: '12px' }}>No timesheet entries logged against this project yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '12px', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>Resource</th>
                {months.map(m => <th key={m.key} style={{ textAlign: 'center', padding: '8px 6px', fontSize: '10px', fontWeight: '700', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{m.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {actualsRows.map(([email, name]) => (
                <tr key={email}>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9', fontWeight: '700', color: '#144766', whiteSpace: 'nowrap' }}>{name}</td>
                  {months.map(m => {
                    const days = Math.round(actualDaysFor(email, m.key) * 100) / 100
                    return (
                      <td key={m.key} onClick={() => days > 0 && setDrilldown({ email, resource: name, monthKey: m.key, monthLabel: m.label })}
                        style={{ padding: '4px 12px', textAlign: 'center', fontWeight: '600', color: days > 0 ? '#059669' : '#CBD5E0', cursor: days > 0 ? 'pointer' : 'default' }}>
                        {days || '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {drilldown && (
        <StaffingDrilldownModal
          title={`${drilldown.resource} — Timesheet Entries`}
          subtitle={drilldown.monthLabel}
          rows={drilldownRows}
          onClose={() => setDrilldown(null)}
        />
      )}
    </div>
  )
}
