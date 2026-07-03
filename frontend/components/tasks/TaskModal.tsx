'use client'
// components/tasks/TaskModal.tsx
import { useState, useEffect } from 'react'
import { tasksAPI, companiesAPI, contactsAPI, opportunitiesAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { createOutlookTask, isMsalConfigured } from '@/lib/msalTasks'

const ENTITY_TYPES = [
  { value: 'company', label: 'Customer (Company)' },
  { value: 'contact', label: 'Contact' },
  { value: 'opportunity', label: 'Opportunity' },
]

function FormField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

interface TaskModalProps {
  task?: any
  entityType?: string
  entityId?: string
  entityLabel?: string
  onClose: () => void
  onSave: () => void
}

export function TaskModal({ task, entityType, entityId, entityLabel, onClose, onSave }: TaskModalProps) {
  const locked = !!entityType && !!entityId
  const [users, setUsers] = useState<any[]>([])
  const [entityOptions, setEntityOptions] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [outlookStatus, setOutlookStatus] = useState('')

  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    due_date: task?.due_date ? task.due_date.slice(0, 10) : '',
    owner_email: task?.owner_email || '',
    owner_name: task?.owner_name || '',
    status: task?.status || 'todo',
    entity_type: task?.entity_type || entityType || 'company',
    entity_id: task?.entity_id || entityId || '',
    sync_to_outlook: task?.sync_to_outlook || false,
  })

  useEffect(() => {
    fetch('https://api.whubbi.wcomply.com/settings/users').then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (locked) return
    const loader = form.entity_type === 'company' ? companiesAPI.list({}) : form.entity_type === 'contact' ? contactsAPI.list({}) : opportunitiesAPI.list({})
    loader.then((rows: any[]) => setEntityOptions(rows)).catch(() => setEntityOptions([]))
  }, [form.entity_type, locked])

  const entityDisplayName = (e: any) => form.entity_type === 'company' ? e.name : form.entity_type === 'contact' ? `${e.first_name} ${e.last_name}` : e.deal_name

  const handleOwnerChange = (email: string) => {
    const u = users.find((uu: any) => uu.email === email)
    setForm(p => ({ ...p, owner_email: email, owner_name: u?.display_name || (u ? `${u.first_name} ${u.last_name}` : '') }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.entity_id) { setError('Please select what this task is linked to'); return }
    setSaving(true); setError(''); setOutlookStatus('')
    try {
      const currentUser = getStoredUser()
      const payload = {
        ...form,
        due_date: form.due_date || null,
        created_by_email: currentUser?.email || '',
      }
      let saved
      if (task) { saved = await tasksAPI.update(task.id, payload) }
      else { saved = await tasksAPI.create(payload) }

      if (form.sync_to_outlook && !saved.outlook_task_id) {
        setOutlookStatus('Signing in to Microsoft…')
        try {
          const outlookId = await createOutlookTask({ title: form.title, description: form.description, dueDate: form.due_date })
          await tasksAPI.update(saved.id, { outlook_task_id: outlookId })
          setOutlookStatus('')
        } catch (e: any) {
          setOutlookStatus('')
          setError(`Task saved, but Outlook sync failed: ${e.message}`)
          setSaving(false)
          return
        }
      }
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>{task ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormField label="Title *" full>
            <input className="form-input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Follow up on proposal" />
          </FormField>
          <FormField label="Description" full>
            <textarea className="form-input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} style={{ resize: 'vertical' }} />
          </FormField>

          {locked ? (
            <FormField label="Linked To" full>
              <input className="form-input" value={entityLabel || ''} disabled />
            </FormField>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
              <FormField label="Assign To Type">
                <select className="form-input" value={form.entity_type} onChange={e => setForm(p => ({ ...p, entity_type: e.target.value, entity_id: '' }))}>
                  {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </FormField>
              <FormField label={ENTITY_TYPES.find(t => t.value === form.entity_type)?.label || 'Record'}>
                <select className="form-input" value={form.entity_id} onChange={e => setForm(p => ({ ...p, entity_id: e.target.value }))}>
                  <option value="">Select…</option>
                  {entityOptions.map((e: any) => <option key={e.id} value={e.id}>{entityDisplayName(e)}</option>)}
                </select>
              </FormField>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <FormField label="Due Date">
              <input className="form-input" type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
            </FormField>
            <FormField label="Owner">
              <select className="form-input" value={form.owner_email} onChange={e => handleOwnerChange(e.target.value)}>
                <option value="">Unassigned</option>
                {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
              </select>
            </FormField>
          </div>

          {task && (
            <FormField label="Status">
              <select className="form-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </FormField>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#3F3F3F', cursor: isMsalConfigured() ? 'pointer' : 'not-allowed' }}>
            <input type="checkbox" checked={form.sync_to_outlook} disabled={!isMsalConfigured()} onChange={e => setForm(p => ({ ...p, sync_to_outlook: e.target.checked }))} style={{ accentColor: '#219BD6', width: '14px', height: '14px' }} />
            Also create this as an Outlook task {!isMsalConfigured() && '(Microsoft sign-in not configured)'}
          </label>
          {task?.outlook_task_id && <p style={{ fontSize: '11px', color: '#059669', margin: 0 }}>✓ Already synced to Outlook</p>}
          {outlookStatus && <p style={{ fontSize: '11px', color: '#219BD6', margin: 0 }}>{outlookStatus}</p>}

          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : task ? 'Save Changes' : 'Create Task'}</button>
        </div>
      </div>
    </div>
  )
}
