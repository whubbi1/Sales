'use client'
// components/clients/ClientTasks.tsx
import { useState, useEffect } from 'react'
import { clientsAPI } from '@/lib/api'

const P_BADGE: Record<string, string> = { low: 'badge-low', medium: 'badge-medium', high: 'badge-high' }
const S_BADGE: Record<string, string> = { todo: 'badge-todo', in_progress: 'badge-in_progress', done: 'badge-done' }
const S_LABEL: Record<string, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' }
const P_LABEL: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High' }
const S_NEXT:  Record<string, string> = { todo: 'in_progress', in_progress: 'done', done: 'todo' }

export function ClientTasks({ clientId }: { clientId: string }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', due_date: '', priority: 'medium', status: 'todo', assigned_to: '' })

  const load = async () => { setTasks(await clientsAPI.getTasks(clientId)) }
  useEffect(() => { load() }, [clientId])

  const handleAdd = async () => {
    if (!form.title) return
    setSaving(true)
    try {
      await clientsAPI.createTask(clientId, form)
      setForm({ title: '', description: '', due_date: '', priority: 'medium', status: 'todo', assigned_to: '' })
      setShowForm(false)
      load()
    } finally { setSaving(false) }
  }

  const isOverdue = (d: string) => d && new Date(d) < new Date()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <p className="section-title">Tasks ({tasks.filter(t => t.status !== 'done').length} open)</p>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ New Task</button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <input className="form-input" placeholder="Task title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <textarea className="form-input" placeholder="Description (optional)" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} style={{ resize: 'vertical' }} />
            </div>
            <div>
              <label className="form-label">Due Date</label>
              <input type="date" className="form-input" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Priority</label>
              <select className="form-input" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="form-label">Assigned To</label>
              <input className="form-input" placeholder="Name" value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <button className="btn-primary" onClick={handleAdd} disabled={saving}>{saving ? 'Saving...' : 'Create Task'}</button>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✓</div>
          <div className="empty-state-title">No tasks yet</div>
          <div className="empty-state-desc">Create a task to track actions for this client</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {tasks.map(task => {
            const overdue = isOverdue(task.due_date) && task.status !== 'done'
            return (
              <div key={task.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px',
                border: `1px solid ${task.status === 'done' ? '#D1FAE5' : overdue ? '#FECACA' : 'var(--border)'}`,
                borderRadius: '8px', background: 'white', opacity: task.status === 'done' ? 0.65 : 1
              }}>
                <button onClick={() => clientsAPI.updateTask(clientId, task.id, { status: S_NEXT[task.status] }).then(load)}
                  style={{
                    width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
                    border: `2px solid ${task.status === 'done' ? '#059669' : task.status === 'in_progress' ? '#2563EB' : '#CBD5E0'}`,
                    background: task.status === 'done' ? '#059669' : task.status === 'in_progress' ? '#EFF6FF' : 'white',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white'
                  }}>{task.status === 'done' ? '✓' : task.status === 'in_progress' ? '●' : ''}</button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</span>
                    <span className={`badge ${P_BADGE[task.priority]}`}>{P_LABEL[task.priority]}</span>
                    <span className={`badge ${S_BADGE[task.status]}`}>{S_LABEL[task.status]}</span>
                  </div>
                  {task.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{task.description}</p>}
                  <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: overdue ? '#DC2626' : 'var(--text-muted)' }}>
                    {task.due_date && <span>Due {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{overdue ? ' · Overdue' : ''}</span>}
                    {task.assigned_to && <span>· {task.assigned_to}</span>}
                  </div>
                </div>

                <button onClick={() => clientsAPI.deleteTask(clientId, task.id).then(load)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', flexShrink: 0, lineHeight: 1 }}>×</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
