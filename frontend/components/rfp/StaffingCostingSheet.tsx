'use client'
import { useState, useEffect } from 'react'
import { rfpAPI } from '@/lib/api'

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

export function StaffingCostingSheet({ rfpId, opportunities, users }: { rfpId: string; opportunities: any[]; users: any[] }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [rates, setRates] = useState<any[]>([])
  const [granularity, setGranularity] = useState<'week' | 'month'>('month')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskResource, setNewTaskResource] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [t, r] = await Promise.all([rfpAPI.getStaffingTasks(rfpId), rfpAPI.getStaffingRates(rfpId)])
    setTasks(t); setRates(r); setLoading(false)
  }
  useEffect(() => { load() }, [rfpId])

  // Timeline = earliest contract_start_date to latest contract_end_date across every
  // Opportunity linked to this RFP.
  const starts = opportunities.map(o => o.contract_start_date).filter(Boolean)
  const ends = opportunities.map(o => o.contract_end_date).filter(Boolean)
  const timelineStart = starts.length ? starts.reduce((a, b) => a < b ? a : b) : undefined
  const timelineEnd = ends.length ? ends.reduce((a, b) => a > b ? a : b) : undefined
  const periods = granularity === 'week' ? weeksBetween(timelineStart, timelineEnd) : monthsBetween(timelineStart, timelineEnd)

  const employeeName = (u: any) => u.display_name || `${u.first_name} ${u.last_name}`
  const sortedUsers = [...users].sort((a, b) => employeeName(a).localeCompare(employeeName(b)))

  const addTask = async () => {
    if (!newTaskTitle.trim()) return
    const u = users.find((uu: any) => uu.email === newTaskResource)
    await rfpAPI.addStaffingTask(rfpId, { title: newTaskTitle.trim(), resource_email: newTaskResource || null, resource_name: u ? employeeName(u) : null, position: tasks.length })
    setNewTaskTitle(''); setNewTaskResource('')
    load()
  }
  const deleteTask = async (task: any) => {
    if (!confirm(`Delete task "${task.title}"?`)) return
    await rfpAPI.deleteStaffingTask(rfpId, task.id)
    load()
  }
  const patchTaskResource = async (task: any, email: string) => {
    const u = users.find((uu: any) => uu.email === email)
    await rfpAPI.updateStaffingTask(rfpId, task.id, { resource_email: email || null, resource_name: u ? employeeName(u) : null })
    load()
  }

  const dayFor = (task: any, periodKey: string) =>
    (task.allocations || []).find((a: any) => a.period_type === granularity && a.period_start.slice(0, 10) === periodKey)?.days || ''

  const saveAllocation = async (task: any, periodKey: string, days: number) => {
    const current = (task.allocations || []).filter((a: any) => a.period_type === granularity)
    const next = current.filter((a: any) => a.period_start.slice(0, 10) !== periodKey)
    if (days > 0) next.push({ period_start: periodKey, period_type: granularity, days })
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, allocations: [...(t.allocations || []).filter((a: any) => a.period_type !== granularity), ...next] } : t))
    await rfpAPI.setStaffingAllocations(rfpId, task.id, next)
  }

  // Resource summary — total days (in the currently viewed granularity) and sales cost.
  const resourceMap = new Map<string, { email: string; name: string; days: number }>()
  tasks.forEach(t => {
    if (!t.resource_email) return
    const days = (t.allocations || []).filter((a: any) => a.period_type === granularity).reduce((s: number, a: any) => s + a.days, 0)
    const entry = resourceMap.get(t.resource_email) || { email: t.resource_email, name: t.resource_name || t.resource_email, days: 0 }
    entry.days += days
    resourceMap.set(t.resource_email, entry)
  })
  const resourceRows = [...resourceMap.values()].sort((a, b) => a.name.localeCompare(b.name))
  const rateFor = (email: string) => rates.find(r => r.resource_email === email)?.day_rate || 0
  const saveRate = async (email: string, name: string, rate: number) => {
    setRates(prev => {
      const exists = prev.find(r => r.resource_email === email)
      return exists ? prev.map(r => r.resource_email === email ? { ...r, day_rate: rate } : r) : [...prev, { resource_email: email, resource_name: name, day_rate: rate }]
    })
    await rfpAPI.setStaffingRate(rfpId, { resource_email: email, resource_name: name, day_rate: rate })
  }
  const totalCost = resourceRows.reduce((sum, r) => sum + r.days * rateFor(r.email), 0)

  if (loading) return <p style={{ color: '#9B9B9B', fontSize: '13px' }}>Loading…</p>

  if (!timelineStart || !timelineEnd) {
    return <p style={{ color: '#D97706', fontSize: '12px' }}>Set Contract Start and Contract End on at least one linked Opportunity (in the sidebar) to build the timeline.</p>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <p className="section-label" style={{ margin: 0 }}>Resources & Sales Cost</p>
        <div style={{ display: 'flex', gap: '3px', background: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
          {(['week', 'month'] as const).map(g => (
            <button key={g} onClick={() => setGranularity(g)} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: granularity === g ? '#156082' : 'transparent', color: granularity === g ? 'white' : '#64748B', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', textTransform: 'capitalize' as const }}>{g}s</button>
          ))}
        </div>
      </div>

      {resourceRows.length === 0 ? (
        <p style={{ color: '#9B9B9B', fontSize: '12px', marginBottom: '18px' }}>Assign a resource to a task below to see them here.</p>
      ) : (
        <div style={{ marginBottom: '18px', overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0' }}>Resource</th>
                <th style={{ textAlign: 'center', padding: '6px 10px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0' }}>Total Days</th>
                <th style={{ textAlign: 'center', padding: '6px 10px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0' }}>Sales Day-Rate (€)</th>
                <th style={{ textAlign: 'center', padding: '6px 10px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0' }}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {resourceRows.map(r => (
                <tr key={r.email}>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9', fontWeight: '700', color: '#144766' }}>{r.name}</td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9', textAlign: 'center' }}>{r.days}</td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9', textAlign: 'center' }}>
                    <input type="number" min={0} defaultValue={rateFor(r.email) || ''} placeholder="0"
                      onBlur={e => saveRate(r.email, r.name, Number(e.target.value) || 0)}
                      style={{ width: '80px', textAlign: 'center', fontSize: '12px', padding: '4px', border: '1px solid #E2E8F0', borderRadius: '5px' }} />
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9', textAlign: 'center', fontWeight: '700', color: '#059669' }}>€{(r.days * rateFor(r.email)).toLocaleString('en-US')}</td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '8px 10px', fontWeight: '800', color: '#144766' }}>Total</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: '#144766' }}>{resourceRows.reduce((s, r) => s + r.days, 0)}</td>
                <td />
                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: '#059669' }}>€{totalCost.toLocaleString('en-US')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="section-label">Tasks</p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <input className="form-input" style={{ flex: 1 }} placeholder="Task name…" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} />
        <select className="form-input" style={{ width: '200px' }} value={newTaskResource} onChange={e => setNewTaskResource(e.target.value)}>
          <option value="">No resource yet…</option>
          {sortedUsers.map((u: any) => <option key={u.email} value={u.email}>{employeeName(u)}</option>)}
        </select>
        <button className="btn-primary" onClick={addTask} disabled={!newTaskTitle.trim()}>+ Add Task</button>
      </div>

      {tasks.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No tasks yet.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '12px', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>Task</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>Resource</th>
                {periods.map(p => <th key={p.key} style={{ textAlign: 'center', padding: '8px 6px', fontSize: '10px', fontWeight: '700', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{p.label}</th>)}
                <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: '10px', fontWeight: '700', color: '#144766', borderBottom: '1px solid #E2E8F0' }}>Total</th>
                <th style={{ borderBottom: '1px solid #E2E8F0' }} />
              </tr>
            </thead>
            <tbody>
              {tasks.map((t: any) => {
                const total = (t.allocations || []).filter((a: any) => a.period_type === granularity).reduce((s: number, a: any) => s + a.days, 0)
                return (
                  <tr key={t.id}>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9', fontWeight: '700', color: '#144766', whiteSpace: 'nowrap' }}>{t.title}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9' }}>
                      <select className="form-input" style={{ fontSize: '11px', padding: '3px 6px' }} value={t.resource_email || ''} onChange={e => patchTaskResource(t, e.target.value)}>
                        <option value="">Unassigned</option>
                        {sortedUsers.map((u: any) => <option key={u.email} value={u.email}>{employeeName(u)}</option>)}
                      </select>
                    </td>
                    {periods.map(p => (
                      <td key={p.key} style={{ padding: '4px', borderBottom: '1px solid #F1F5F9', textAlign: 'center' }}>
                        <input type="number" min={0} step={0.5} defaultValue={dayFor(t, p.key)} placeholder="0"
                          onBlur={e => saveAllocation(t, p.key, Number(e.target.value) || 0)}
                          style={{ width: '52px', textAlign: 'center', fontSize: '12px', padding: '4px', border: '1px solid #E2E8F0', borderRadius: '5px' }} />
                      </td>
                    ))}
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9', textAlign: 'center', fontWeight: '700', color: '#144766' }}>{total || '—'}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9' }}>
                      <button onClick={() => deleteTask(t)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
