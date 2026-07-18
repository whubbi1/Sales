'use client'
import { useState, useEffect } from 'react'
import { companiesAPI } from '@/lib/api'
import { EmptyState, StatusBadge } from '@/components/shared/RecordLayout'

const P_COLOR: Record<string,string> = { low:'#16A34A', medium:'#D97706', high:'#DC2626' }
const P_BG: Record<string,string> = { low:'#F0FDF4', medium:'#FFFBEB', high:'#FEF2F2' }
const S_NEXT: Record<string,string> = { todo:'in_progress', in_progress:'done', done:'todo' }
const S_LABEL: Record<string,string> = { todo:'To do', in_progress:'In progress', done:'Done' }

export function CompanyTasks({ companyId, onChange }: { companyId: string; onChange?: () => void }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', due_date: '', priority: 'medium', status: 'todo', assigned_to: '' })
  const load = async () => setTasks(await companiesAPI.getTasks(companyId))
  useEffect(() => { load() }, [companyId])
  const handleAdd = async () => {
    if (!form.title) return
    setSaving(true)
    try { await companiesAPI.createTask(companyId, form); setForm({ title: '', description: '', due_date: '', priority: 'medium', status: 'todo', assigned_to: '' }); setShowForm(false); load(); onChange?.() }
    finally { setSaving(false) }
  }
  const isOverdue = (d: string) => d && new Date(d) < new Date()
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B' }}>Tasks ({tasks.filter(t => t.status !== 'done').length} open)</span>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ New Task</button>
      </div>
      {showForm && (
        <div style={{ background: '#F5F7FA', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ gridColumn: '1/-1' }}><input className="form-input" placeholder="Task title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><label className="form-label">Due Date</label><input type="date" className="form-input" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
            <div><label className="form-label">Priority</label><select className="form-input" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
            <div><label className="form-label">Assigned To</label><input className="form-input" value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} /></div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}><button className="btn-primary" onClick={handleAdd} disabled={saving}>{saving ? 'Saving...' : 'Create Task'}</button><button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button></div>
          </div>
        </div>
      )}
      {tasks.length === 0 ? <EmptyState icon="✓" title="No tasks yet" description="Create a task to track actions" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {tasks.map(task => {
            const overdue = isOverdue(task.due_date) && task.status !== 'done'
            return (
              <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', border: `1px solid ${task.status === 'done' ? '#D1FAE5' : overdue ? '#FECACA' : '#E2E8F0'}`, borderRadius: '8px', background: 'white', opacity: task.status === 'done' ? 0.65 : 1 }}>
                <button onClick={() => companiesAPI.updateTask(companyId, task.id, { status: S_NEXT[task.status] }).then(load)} style={{ width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0, marginTop: '2px', border: `2px solid ${task.status === 'done' ? '#059669' : task.status === 'in_progress' ? '#2563EB' : '#CBD5E0'}`, background: task.status === 'done' ? '#059669' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: 'white' }}>{task.status === 'done' ? '✓' : ''}</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#3F3F3F', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</span>
                    <span style={{ background: P_BG[task.priority], color: P_COLOR[task.priority], padding: '1px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>{task.priority}</span>
                    <span style={{ background: '#F1F5F9', color: '#475569', padding: '1px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>{S_LABEL[task.status]}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '10px', color: overdue ? '#DC2626' : '#9B9B9B' }}>
                    {task.due_date && <span>Due {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{overdue ? ' · Overdue' : ''}</span>}
                    {task.assigned_to && <span>· {task.assigned_to}</span>}
                  </div>
                </div>
                <button onClick={() => companiesAPI.deleteTask(companyId, task.id).then(() => { load(); onChange?.() })} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9B9B9B', fontSize: '16px', lineHeight: 1 }}>×</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
