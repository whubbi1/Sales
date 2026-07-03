'use client'
// components/tasks/TaskModal.tsx
import { useState, useEffect } from 'react'
import { taskManagerAPI, companiesAPI, contactsAPI, opportunitiesAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { createOutlookTask, isMsalConfigured } from '@/lib/msalTasks'

const ENTITY_TYPES = [
  { value: 'company', label: 'Customer (Company)' },
  { value: 'contact', label: 'Contact' },
  { value: 'opportunity', label: 'Opportunity' },
]

const TOP_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]
const SUB_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
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
  source?: string
  parentTaskId?: string
  hideEntity?: boolean
  quick?: boolean
  onClose: () => void
  onSave: (id?: string) => void
}

export function TaskModal({ task, entityType, entityId, entityLabel, source, parentTaskId, hideEntity, quick, onClose, onSave }: TaskModalProps) {
  const locked = !!entityType && !!entityId
  const isSubtask = !!parentTaskId || !!task?.parent_task_id
  const showEntity = !hideEntity && !quick
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
    assignee_email: task?.assignee_email || '',
    assignee_name: task?.assignee_name || '',
    status: task?.status || 'new',
    entity_type: task?.entity_type || (showEntity ? (entityType || 'company') : ''),
    entity_id: task?.entity_id || (showEntity ? (entityId || '') : ''),
    sync_to_outlook: task?.sync_to_outlook || false,
  })

  useEffect(() => {
    fetch('https://api.whubbi.wcomply.com/settings/users').then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (locked || !showEntity) return
    const loader = form.entity_type === 'company' ? companiesAPI.list({}) : form.entity_type === 'contact' ? contactsAPI.list({}) : opportunitiesAPI.list({})
    loader.then((rows: any[]) => setEntityOptions(rows)).catch(() => setEntityOptions([]))
  }, [form.entity_type, locked, showEntity])

  const entityDisplayName = (e: any) => form.entity_type === 'company' ? e.name : form.entity_type === 'contact' ? `${e.first_name} ${e.last_name}` : e.deal_name

  const handleOwnerChange = (email: string) => {
    const u = users.find((uu: any) => uu.email === email)
    setForm(p => ({ ...p, owner_email: email, owner_name: u?.display_name || (u ? `${u.first_name} ${u.last_name}` : '') }))
  }
  const handleAssigneeChange = (email: string) => {
    const u = users.find((uu: any) => uu.email === email)
    setForm(p => ({ ...p, assignee_email: email, assignee_name: u?.display_name || (u ? `${u.first_name} ${u.last_name}` : '') }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!quick && !task && !form.owner_email) { setError('An owner is required'); return }
    if (showEntity && !form.entity_id) { setError('Please select what this task is linked to'); return }
    setSaving(true); setError(''); setOutlookStatus('')
    try {
      const currentUser = getStoredUser()
      const actingEmail = currentUser?.email || ''
      const ownerEmail = quick && !task ? actingEmail : form.owner_email
      const ownerName = quick && !task ? (currentUser?.name || actingEmail) : form.owner_name
      const payload = {
        ...form,
        owner_email: ownerEmail,
        owner_name: ownerName,
        assignee_email: quick && !task ? ownerEmail : form.assignee_email,
        assignee_name: quick && !task ? ownerName : form.assignee_name,
        entity_type: showEntity ? form.entity_type : undefined,
        entity_id: showEntity ? form.entity_id : undefined,
        due_date: form.due_date || null,
        source: source || task?.source || 'manual',
        created_by_email: actingEmail,
        acting_email: actingEmail,
      }
      let saved
      if (task) {
        saved = await taskManagerAPI.update(task.id, payload)
        if (form.status !== task.status) {
          try { await taskManagerAPI.setStatus(task.id, { acting_email: actingEmail, status: form.status }) }
          catch (e: any) { setError(e.message); setSaving(false); return }
        }
        if (form.assignee_email !== task.assignee_email) {
          try { await taskManagerAPI.reassign(task.id, { acting_email: actingEmail, new_assignee_email: form.assignee_email, new_assignee_name: form.assignee_name }) }
          catch (e: any) { setError(e.message); setSaving(false); return }
        }
        saved = { id: task.id, outlook_task_id: task.outlook_task_id }
      } else if (parentTaskId) {
        const r = await taskManagerAPI.createSubtask(parentTaskId, payload)
        saved = { id: r.id }
      } else {
        const r = await taskManagerAPI.create(payload)
        saved = { id: r.id }
      }

      if (form.sync_to_outlook && !saved.outlook_task_id) {
        setOutlookStatus('Signing in to Microsoft…')
        try {
          const outlookId = await createOutlookTask({ title: form.title, description: form.description, dueDate: form.due_date })
          await taskManagerAPI.update(saved.id, { acting_email: actingEmail, outlook_task_id: outlookId })
          setOutlookStatus('')
        } catch (e: any) {
          setOutlookStatus('')
          setError(`Task saved, but Outlook sync failed: ${e.message}`)
          setSaving(false)
          return
        }
      }
      onSave(saved.id)
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

          {showEntity && (locked ? (
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
          ))}

          {quick ? (
            <FormField label="Due Date" full>
              <input className="form-input" type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box' }} />
            </FormField>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <FormField label="Due Date">
                  <input className="form-input" type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
                </FormField>
                <FormField label={`Owner${task ? ' (stays responsible, cannot be changed)' : ''}`}>
                  <select className="form-input" value={form.owner_email} onChange={e => handleOwnerChange(e.target.value)} disabled={!!task}>
                    <option value="">Select owner…</option>
                    {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
                  </select>
                </FormField>
              </div>

              <FormField label="Assignee (who currently does the work)">
                <select className="form-input" value={form.assignee_email} onChange={e => handleAssigneeChange(e.target.value)}>
                  <option value="">Same as owner</option>
                  {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
                </select>
              </FormField>

              {task && (
                <FormField label="Status">
                  <select className="form-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                    {(isSubtask ? SUB_STATUSES : TOP_STATUSES).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </FormField>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#3F3F3F', cursor: isMsalConfigured() ? 'pointer' : 'not-allowed' }}>
                <input type="checkbox" checked={form.sync_to_outlook} disabled={!isMsalConfigured()} onChange={e => setForm(p => ({ ...p, sync_to_outlook: e.target.checked }))} style={{ accentColor: '#219BD6', width: '14px', height: '14px' }} />
                Also create this as an Outlook task {!isMsalConfigured() && '(Microsoft sign-in not configured)'}
              </label>
              {task?.outlook_task_id && <p style={{ fontSize: '11px', color: '#059669', margin: 0 }}>✓ Already synced to Outlook</p>}
              {outlookStatus && <p style={{ fontSize: '11px', color: '#219BD6', margin: 0 }}>{outlookStatus}</p>}
            </>
          )}

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
