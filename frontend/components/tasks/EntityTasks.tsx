'use client'
// components/tasks/EntityTasks.tsx — generic "Tasks" tab for any Sales entity (Company,
// Contact, ...), backed by the unified Task Manager (source='sales') so tasks created here
// show up in /tasks and /task-manager, and vice versa. Mirrors the Opportunity/Lead pattern.
import { useState, useEffect } from 'react'
import { taskManagerAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { TaskModal } from '@/components/tasks/TaskModal'
import { EmptyState } from '@/components/shared/RecordLayout'

const STATUS_LABEL: Record<string, string> = { new: 'New', open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' }
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  new: { bg: '#F1F5F9', color: '#475569' }, open: { bg: '#EFF6FF', color: '#219BD6' },
  in_progress: { bg: '#FFF7ED', color: '#D97706' }, resolved: { bg: '#ECFDF5', color: '#059669' }, closed: { bg: '#F1F5F9', color: '#64748B' },
}
const DONE_STATUSES = ['resolved', 'closed']

export function EntityTasks({ entityType, entityId, entityLabel, onChange }: {
  entityType: string; entityId: string; entityLabel?: string; onChange?: () => void
}) {
  const [tasks, setTasks] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const user = getStoredUser()
  const userEmail = user?.email || ''
  const userName = user?.name || userEmail

  const load = async () => setTasks((await taskManagerAPI.list({ entity_type: entityType, entity_id: entityId, source: 'sales' })).tasks || [])
  useEffect(() => { load() }, [entityType, entityId])

  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined

  const toggleDone = async (task: any) => {
    const done = DONE_STATUSES.includes(task.status)
    try { await taskManagerAPI.setStatus(task.id, { acting_email: userEmail, acting_name: userName, status: done ? 'new' : 'resolved' }) }
    catch (e: any) { alert(e.message) }
    load(); onChange?.()
  }

  const deleteTask = async (task: any) => {
    if (!confirm(`Delete task "${task.title}"?`)) return
    try { await taskManagerAPI.delete(task.id, userEmail) } catch (e: any) { alert(e.message); return }
    load(); onChange?.()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>+ New Task</button>
      </div>
      {tasks.length === 0 ? <EmptyState icon="✓" title="No tasks yet" description="Create a task to track actions" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {tasks.map((t: any) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
              <input type="checkbox" checked={DONE_STATUSES.includes(t.status)} onChange={() => toggleDone(t)} style={{ accentColor: '#219BD6', width: '15px', height: '15px', cursor: 'pointer' }} />
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { setEditing(t); setShowModal(true) }}>
                <div style={{ fontWeight: '700', color: DONE_STATUSES.includes(t.status) ? '#9B9B9B' : '#144766', fontSize: '13px', textDecoration: DONE_STATUSES.includes(t.status) ? 'line-through' : 'none' }}>{t.title}</div>
                <div style={{ fontSize: '11px', color: '#9B9B9B' }}>
                  {t.owner_name || t.owner_email || 'Unassigned'}{t.due_date && ` · Due ${fmt(t.due_date)}`}{t.outlook_task_id && ' · ✓ Outlook'}
                </div>
              </div>
              <span style={{ background: STATUS_COLOR[t.status]?.bg, color: STATUS_COLOR[t.status]?.color, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{STATUS_LABEL[t.status]}</span>
              <button onClick={() => deleteTask(t)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}
      {showModal && (
        <TaskModal
          task={editing}
          entityType={entityType}
          entityId={entityId}
          entityLabel={entityLabel}
          source="sales"
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); load(); onChange?.() }}
        />
      )}
    </div>
  )
}
