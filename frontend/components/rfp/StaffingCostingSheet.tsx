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
  const [roles, setRoles] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [rates, setRates] = useState<any[]>([])
  const [granularity, setGranularity] = useState<'week' | 'month'>('month')
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleResource, setNewRoleResource] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskRole, setNewTaskRole] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [rl, t, r] = await Promise.all([rfpAPI.getStaffingRoles(rfpId), rfpAPI.getStaffingTasks(rfpId), rfpAPI.getStaffingRates(rfpId)])
    setRoles(rl); setTasks(t); setRates(r); setLoading(false)
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
  const sortedRoles = [...roles].sort((a, b) => a.name.localeCompare(b.name))

  // ─── Roles — each holds one assigned resource; a resource can hold several roles ───
  const addRole = async () => {
    if (!newRoleName.trim()) return
    const u = users.find((uu: any) => uu.email === newRoleResource)
    try {
      await rfpAPI.addStaffingRole(rfpId, { name: newRoleName.trim(), resource_email: newRoleResource || null, resource_name: u ? employeeName(u) : null })
    } catch (e: any) { alert(e.message); return }
    setNewRoleName(''); setNewRoleResource('')
    load()
  }
  const patchRoleResource = async (role: any, email: string) => {
    const u = users.find((uu: any) => uu.email === email)
    try {
      await rfpAPI.updateStaffingRole(rfpId, role.id, { resource_email: email || null, resource_name: u ? employeeName(u) : null })
    } catch (e: any) { alert(e.message); return }
    load()
  }
  const deleteRole = async (role: any) => {
    if (!confirm(`Delete role "${role.name}"? Tasks using it will become unassigned.`)) return
    try { await rfpAPI.deleteStaffingRole(rfpId, role.id) } catch (e: any) { alert(e.message); return }
    load()
  }

  const addTask = async () => {
    if (!newTaskTitle.trim()) return
    try {
      await rfpAPI.addStaffingTask(rfpId, { title: newTaskTitle.trim(), role_id: newTaskRole || null, position: tasks.length })
    } catch (e: any) { alert(e.message); return }
    setNewTaskTitle(''); setNewTaskRole('')
    load()
  }
  const deleteTask = async (task: any) => {
    if (!confirm(`Delete task "${task.title}"?`)) return
    try { await rfpAPI.deleteStaffingTask(rfpId, task.id) } catch (e: any) { alert(e.message); return }
    load()
  }
  const patchTaskRole = async (task: any, roleId: string) => {
    try {
      await rfpAPI.updateStaffingTask(rfpId, task.id, { role_id: roleId || null })
    } catch (e: any) { alert(e.message); return }
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

  // Resource summary — total days (in the currently viewed granularity) and sales cost,
  // rolled up by PERSON (via each task's role), not by role — the same person can hold
  // several roles and their time should still sum into one line.
  const resourceMap = new Map<string, { email: string; name: string; days: number }>()
  tasks.forEach(t => {
    const email = t.role?.resource_email
    if (!email) return
    const days = (t.allocations || []).filter((a: any) => a.period_type === granularity).reduce((s: number, a: any) => s + a.days, 0)
    const entry = resourceMap.get(email) || { email, name: t.role?.resource_name || email, days: 0 }
    entry.days += days
    resourceMap.set(email, entry)
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
      <p className="section-label" style={{ marginBottom: '8px' }}>Roles</p>
      <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: 0, marginBottom: '10px' }}>Define the roles needed on this RFP and assign one person to each — a person can hold more than one role.</p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <input className="form-input" style={{ flex: 1 }} placeholder="Role name (e.g. Project Manager)…" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRole()} />
        <select className="form-input" style={{ width: '200px' }} value={newRoleResource} onChange={e => setNewRoleResource(e.target.value)}>
          <option value="">No one yet…</option>
          {sortedUsers.map((u: any) => <option key={u.email} value={u.email}>{employeeName(u)}</option>)}
        </select>
        <button className="btn-primary" onClick={addRole} disabled={!newRoleName.trim()}>+ Add Role</button>
      </div>
      {roles.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px', marginBottom: '18px' }}>No roles defined yet.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
          {sortedRoles.map((role: any) => (
            <div key={role.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
              <div style={{ flex: 1, fontWeight: '700', color: '#144766', fontSize: '13px' }}>{role.name}</div>
              <select className="form-input" style={{ fontSize: '11px', padding: '3px 6px', width: '200px' }} value={role.resource_email || ''} onChange={e => patchRoleResource(role, e.target.value)}>
                <option value="">Unassigned</option>
                {sortedUsers.map((u: any) => <option key={u.email} value={u.email}>{employeeName(u)}</option>)}
              </select>
              <button onClick={() => deleteRole(role)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <p className="section-label" style={{ margin: 0 }}>Resources & Sales Cost</p>
        <div style={{ display: 'flex', gap: '3px', background: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
          {(['week', 'month'] as const).map(g => (
            <button key={g} onClick={() => setGranularity(g)} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: granularity === g ? '#156082' : 'transparent', color: granularity === g ? 'white' : '#64748B', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', textTransform: 'capitalize' as const }}>{g}s</button>
          ))}
        </div>
      </div>

      {resourceRows.length === 0 ? (
        <p style={{ color: '#9B9B9B', fontSize: '12px', marginBottom: '18px' }}>Assign a role to a task below to see resources here.</p>
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
        <select className="form-input" style={{ width: '200px' }} value={newTaskRole} onChange={e => setNewTaskRole(e.target.value)}>
          <option value="">No role yet…</option>
          {sortedRoles.map((role: any) => <option key={role.id} value={role.id}>{role.name}{role.resource_name ? ` — ${role.resource_name}` : ''}</option>)}
        </select>
        <button className="btn-primary" onClick={addTask} disabled={!newTaskTitle.trim()}>+ Add Task</button>
      </div>

      {tasks.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No tasks yet.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '12px', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>Task</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>Role</th>
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
                      <select className="form-input" style={{ fontSize: '11px', padding: '3px 6px' }} value={t.role_id || ''} onChange={e => patchTaskRole(t, e.target.value)}>
                        <option value="">Unassigned</option>
                        {sortedRoles.map((role: any) => <option key={role.id} value={role.id}>{role.name}{role.resource_name ? ` — ${role.resource_name}` : ''}</option>)}
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
