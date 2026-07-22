'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { OperationsLayout, useOperationsPerm } from '@/components/OperationsLayout'
import { projectsAPI, taskManagerAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { PropertyRow, SidebarSection, SidebarCard, TabNav } from '@/components/shared/RecordLayout'
import { TaskModal } from '@/components/tasks/TaskModal'
import { ProjectStaffingSheet } from '@/components/projects/ProjectStaffingSheet'

const API = 'https://api.whubbi.wcomply.com'
const TASK_DONE_STATUSES = ['resolved', 'closed']

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined
const fmtDateTime = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

function EditableCell({ display, editing, onStartEdit, children }: any) {
  return editing ? children : (
    <div onClick={onStartEdit} title="Click to edit"
      style={{ fontSize: '13px', color: '#3F3F3F', cursor: 'pointer', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {display || <span style={{ color: '#94A3B8' }}>—</span>}
    </div>
  )
}

function ProjectDetailContent() {
  const { id } = useParams()
  const router = useRouter()
  const { level } = useOperationsPerm('projects')

  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')
  const [users, setUsers] = useState<any[]>([])
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')

  const [editingNameField, setEditingNameField] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)

  const [activityLog, setActivityLog] = useState<any[]>([])
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [salesDocs, setSalesDocs] = useState<any[]>([])
  const [projectDocs, setProjectDocs] = useState<any[]>([])
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocUrl, setNewDocUrl] = useState('')

  const [tasks, setTasks] = useState<any[]>([])
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<any>(null)

  const [expenses, setExpenses] = useState<any[]>([])
  const [expenseDate, setExpenseDate] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseDescription, setExpenseDescription] = useState('')

  const load = async () => {
    try {
      const p = await projectsAPI.get(id as string)
      setProject(p)
      const [log, cmts, sales, proj, tks, exps] = await Promise.all([
        projectsAPI.getActivityLog(id as string),
        projectsAPI.getComments(id as string),
        projectsAPI.getDocuments(id as string, 'sales'),
        projectsAPI.getDocuments(id as string, 'project'),
        taskManagerAPI.list({ entity_type: 'project', entity_id: id, source: 'operations' }),
        projectsAPI.getExpenses(id as string),
      ])
      setActivityLog(log)
      setComments(cmts)
      setSalesDocs(sales)
      setProjectDocs(proj)
      setTasks(tks.tasks || tks || [])
      setExpenses(exps)
    } catch {
      router.push('/operations/projects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    fetch(`${API}/settings/users`).then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
    const u = getStoredUser()
    if (u) { setUserEmail(u.email); setUserName(u.name) }
  }, [])

  const patchProject = async (fields: any) => {
    const updated = await projectsAPI.update(project.id, { ...fields, changed_by_email: userEmail, changed_by_name: userName })
    setProject(updated)
  }

  const saveName = async (name: string) => {
    setEditingNameField(false)
    if (!name.trim() || name === project.project_name) return
    await patchProject({ project_name: name.trim() })
  }

  const addComment = async () => {
    if (!newComment.trim()) return
    await projectsAPI.addComment(project.id, { author_email: userEmail, author_name: userName, comment: newComment.trim() })
    setNewComment('')
    setComments(await projectsAPI.getComments(project.id))
  }
  const deleteComment = async (c: any) => {
    if (!confirm('Delete this comment?')) return
    await projectsAPI.deleteComment(project.id, c.id)
    setComments(await projectsAPI.getComments(project.id))
  }

  const addDoc = async (category: 'sales' | 'project') => {
    if (!newDocTitle.trim() || !newDocUrl.trim()) return
    await projectsAPI.addDocument(project.id, { category, title: newDocTitle.trim(), url: newDocUrl.trim(), created_by: userEmail })
    setNewDocTitle(''); setNewDocUrl('')
    if (category === 'sales') setSalesDocs(await projectsAPI.getDocuments(project.id, 'sales'))
    else setProjectDocs(await projectsAPI.getDocuments(project.id, 'project'))
  }
  const deleteDoc = async (category: 'sales' | 'project', doc: any) => {
    if (!confirm(`Delete "${doc.title}"?`)) return
    await projectsAPI.deleteDocument(project.id, doc.id)
    if (category === 'sales') setSalesDocs(await projectsAPI.getDocuments(project.id, 'sales'))
    else setProjectDocs(await projectsAPI.getDocuments(project.id, 'project'))
  }

  const addExpense = async () => {
    if (!expenseDate || !expenseAmount) return
    await projectsAPI.addExpense(project.id, { expense_date: expenseDate, amount: parseFloat(expenseAmount), description: expenseDescription.trim() || null, created_by: userEmail })
    setExpenseDate(''); setExpenseAmount(''); setExpenseDescription('')
    setExpenses(await projectsAPI.getExpenses(project.id))
  }
  const deleteExpense = async (e: any) => {
    if (!confirm('Delete this expense?')) return
    await projectsAPI.deleteExpense(project.id, e.id)
    setExpenses(await projectsAPI.getExpenses(project.id))
  }

  const reloadTasks = async () => setTasks((await taskManagerAPI.list({ entity_type: 'project', entity_id: id, source: 'operations' })).tasks || [])
  const toggleTaskDone = async (task: any) => {
    const done = TASK_DONE_STATUSES.includes(task.status)
    try { await taskManagerAPI.setStatus(task.id, { acting_email: userEmail, status: done ? 'new' : 'resolved' }) }
    catch (e: any) { alert(e.message) }
    reloadTasks()
  }
  const deleteTask = async (task: any) => {
    if (!confirm(`Delete task "${task.title}"?`)) return
    try { await taskManagerAPI.delete(task.id, userEmail) } catch (e: any) { alert(e.message); return }
    reloadTasks()
  }

  if (loading || level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )
  if (!project) return null

  const startDate = project.is_internal ? project.start_date : project.opportunity?.contract_start_date
  const endDate = project.is_internal ? project.end_date : project.opportunity?.contract_end_date
  const clientName = project.company?.name
  const isLicenseProject = project.opportunity?.project_status === 'Software Licenses'
  const toDateInput = (d?: string) => d ? d.slice(0, 10) : ''

  const dateRow = (label: string, field: string) => (
    <PropertyRow label={label} value={
      <EditableCell display={fmt(project[field])} editing={editingField === field} onStartEdit={() => setEditingField(field)}>
        <input autoFocus type="date" className="form-input" style={{ fontSize: '13px', padding: '4px 6px' }} defaultValue={toDateInput(project[field])}
          onBlur={e => { setEditingField(null); patchProject({ [field]: e.target.value || null }) }} />
      </EditableCell>
    } />
  )
  const textRow = (label: string, field: string, placeholder?: string) => (
    <PropertyRow label={label} value={
      <EditableCell display={project[field]} editing={editingField === field} onStartEdit={() => setEditingField(field)}>
        <input autoFocus className="form-input" style={{ fontSize: '13px' }} defaultValue={project[field] || ''} placeholder={placeholder}
          onBlur={e => { setEditingField(null); patchProject({ [field]: e.target.value || null }) }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
      </EditableCell>
    } />
  )
  const numberRow = (label: string, field: string) => (
    <PropertyRow label={label} value={
      <EditableCell display={project[field] != null ? project[field].toLocaleString('en-US') : null} editing={editingField === field} onStartEdit={() => setEditingField(field)}>
        <input autoFocus type="number" className="form-input" style={{ fontSize: '13px' }} defaultValue={project[field] ?? ''}
          onBlur={e => { setEditingField(null); patchProject({ [field]: e.target.value ? parseFloat(e.target.value) : null }) }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
      </EditableCell>
    } />
  )
  const projectManagerRow = (
    <PropertyRow label="Project Manager" value={
      <EditableCell display={project.project_manager_name || project.project_manager_email} editing={editingField === 'project_manager'} onStartEdit={() => setEditingField('project_manager')}>
        <select autoFocus className="form-input" style={{ fontSize: '13px' }} defaultValue={project.project_manager_email || ''}
          onChange={e => {
            const u = users.find((uu: any) => uu.email === e.target.value)
            setEditingField(null)
            patchProject({ project_manager_email: e.target.value || null, project_manager_name: u ? (u.display_name || `${u.first_name} ${u.last_name}`) : null })
          }}
          onBlur={() => setEditingField(null)}>
          <option value="">Unassigned</option>
          {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
        </select>
      </EditableCell>
    } />
  )
  const selectRow = (label: string, field: string, options: string[]) => (
    <PropertyRow label={label} value={
      <EditableCell display={project[field]} editing={editingField === field} onStartEdit={() => setEditingField(field)}>
        <select autoFocus className="form-input" style={{ fontSize: '13px' }} defaultValue={project[field] || ''}
          onChange={e => { setEditingField(null); patchProject({ [field]: e.target.value || null }) }} onBlur={() => setEditingField(null)}>
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </EditableCell>
    } />
  )

  const docsSection = (category: 'sales' | 'project', docs: any[]) => (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <input className="form-input" style={{ flex: 1 }} placeholder="Title…" value={newDocTitle} onChange={e => setNewDocTitle(e.target.value)} />
        <input className="form-input" style={{ flex: 2 }} placeholder="Link (SharePoint, etc.)…" value={newDocUrl} onChange={e => setNewDocUrl(e.target.value)} />
        <button className="btn-primary" onClick={() => addDoc(category)}>+ Add</button>
      </div>
      {docs.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No documents listed yet.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {docs.map((d: any) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', color: '#144766', fontSize: '13px' }}>{d.title}</div>
                <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6', fontSize: '11px' }}>🔗 Open</a>
              </div>
              <button onClick={() => deleteDoc(category, d)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '11px', color: '#9B9B9B' }}>
        <button onClick={() => router.push('/operations/projects')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontWeight: '600', fontSize: '11px', padding: 0 }}>Projects</button>
        <span>/</span><span style={{ color: '#3F3F3F', fontWeight: '600' }}>{project.project_name}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'start' }}>
        <div>
          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: project.is_internal ? '#7C3AED' : '#144766', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '800', flexShrink: 0 }}>
                {project.is_internal ? '🏠' : '📁'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  {editingNameField ? (
                    <input autoFocus className="form-input" style={{ fontSize: '16px', fontWeight: '800', maxWidth: '360px' }} defaultValue={project.project_name}
                      onBlur={e => saveName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                  ) : (
                    <h1 onClick={() => setEditingNameField(true)} title="Click to rename" style={{ fontSize: '18px', fontWeight: '800', color: '#144766', margin: 0, cursor: 'pointer' }}>{project.project_name}</h1>
                  )}
                  <span style={{ background: '#F1F5F9', color: '#64748B', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{project.project_number}</span>
                  {project.is_internal && <span style={{ background: '#F5F3FF', color: '#7C3AED', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>INTERNAL</span>}
                </div>
                <p style={{ color: '#9B9B9B', fontSize: '12px', margin: 0 }}>
                  {clientName ? `Client: ${clientName}` : project.is_internal ? 'Internal project' : 'No client'}
                  {project.partner?.name && ` · Partner: ${project.partner.name}`}
                </p>
              </div>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '0 20px', background: '#FAFBFC', borderBottom: '2px solid #E2E8F0' }}>
              <TabNav tabs={['Overview', 'Tasks', 'Sales Documentation', 'Project Documentation', 'Notes', 'Expenses', 'Staffing']} active={tab} onChange={setTab} />
            </div>
            <div style={{ padding: '20px' }}>
              {tab === 'Overview' && (
                <div>
                  {!project.is_internal && (
                    <div style={{ marginBottom: '18px' }}>
                      <PropertyRow label="Linked Opportunity" value={project.opportunity ? <a href={`/opportunities/${project.opportunity_id}`} style={{ color: '#219BD6', fontWeight: '600' }}>{project.opportunity.deal_name} ↗</a> : null} />
                    </div>
                  )}
                  {project.is_internal && <PropertyRow label="Description" value={project.description} />}
                  <PropertyRow label="Project Start" value={fmt(startDate)} />
                  <PropertyRow label="Project End" value={fmt(endDate)} />

                  {isLicenseProject ? (
                    <>
                      <p className="section-label" style={{ marginTop: '18px', marginBottom: '8px' }}>License</p>
                      {dateRow('Revised License Start', 'revised_license_start_date')}
                      {dateRow('Revised License End', 'revised_license_end_date')}
                      {dateRow('Actual License Start', 'actual_license_start_date')}
                      {dateRow('Actual License End', 'actual_license_end_date')}
                      {selectRow('Invoicing Frequency', 'invoicing_frequency', ['Monthly', 'Yearly'])}
                      {numberRow('Total Contract Value', 'total_contract_value')}
                      {selectRow('Invoicing Start', 'invoicing_start', ['Upfront', 'Other'])}
                      {numberRow('Invoicing Amount per Unit', 'invoicing_amount_per_unit')}
                    </>
                  ) : (
                    <>
                      <p className="section-label" style={{ marginTop: '18px', marginBottom: '8px' }}>Planning</p>
                      {dateRow('Revised Project Start', 'revised_start_date')}
                      {dateRow('Revised Project End', 'revised_end_date')}
                      {dateRow('Actual Project Start', 'actual_start_date')}
                      {dateRow('Actual Project End', 'actual_end_date')}
                    </>
                  )}

                  <p className="section-label" style={{ marginTop: '18px', marginBottom: '8px' }}>Management</p>
                  {projectManagerRow}
                  {textRow('Karanext Reference', 'karanext_reference', 'e.g. KX-00123')}

                  <p className="section-label" style={{ marginTop: '20px', marginBottom: '8px' }}>Change History</p>
                  {activityLog.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No changes logged yet.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {activityLog.map((a: any) => (
                        <div key={a.id} style={{ fontSize: '12px', padding: '8px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                          <span style={{ fontWeight: '700', color: '#144766' }}>{a.field_name}</span>
                          <span style={{ color: '#9B9B9B' }}> changed from </span>
                          <span style={{ color: '#DC2626' }}>{a.old_value || '—'}</span>
                          <span style={{ color: '#9B9B9B' }}> to </span>
                          <span style={{ color: '#059669' }}>{a.new_value || '—'}</span>
                          <div style={{ color: '#9B9B9B', fontSize: '10px', marginTop: '2px' }}>{a.changed_by_name || a.changed_by_email} · {fmtDateTime(a.changed_at)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'Tasks' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                    <button className="btn-primary" onClick={() => { setEditingTask(null); setShowTaskModal(true) }}>+ New Task</button>
                  </div>
                  {tasks.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No tasks yet.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {tasks.map((t: any) => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                          <input type="checkbox" checked={TASK_DONE_STATUSES.includes(t.status)} onChange={() => toggleTaskDone(t)} style={{ accentColor: '#219BD6', width: '15px', height: '15px', cursor: 'pointer' }} />
                          <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { setEditingTask(t); setShowTaskModal(true) }}>
                            <div style={{ fontWeight: '700', color: TASK_DONE_STATUSES.includes(t.status) ? '#9B9B9B' : '#144766', fontSize: '13px', textDecoration: TASK_DONE_STATUSES.includes(t.status) ? 'line-through' : 'none' }}>{t.title}</div>
                            <div style={{ fontSize: '11px', color: '#9B9B9B' }}>{t.owner_name || t.owner_email || 'Unassigned'}{t.due_date && ` · Due ${fmt(t.due_date)}`}</div>
                          </div>
                          <button onClick={() => deleteTask(t)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'Sales Documentation' && docsSection('sales', salesDocs)}
              {tab === 'Project Documentation' && docsSection('project', projectDocs)}

              {tab === 'Notes' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <input className="form-input" style={{ flex: 1 }} placeholder="Add a note…" value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} />
                    <button className="btn-primary" onClick={addComment}>+ Add</button>
                  </div>
                  {comments.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No notes yet.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {comments.map((c: any) => (
                        <div key={c.id} style={{ padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: '700', color: '#144766', fontSize: '12px' }}>{c.author_name || c.author_email}</span>
                            <button onClick={() => deleteComment(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                          </div>
                          <p style={{ fontSize: '13px', color: '#3F3F3F', margin: '4px 0' }}>{c.comment}</p>
                          <div style={{ fontSize: '10px', color: '#9B9B9B' }}>{fmtDateTime(c.created_at)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'Expenses' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'flex-end' }}>
                    <div>
                      <label className="form-label">Date</label>
                      <input type="date" className="form-input" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Amount</label>
                      <input type="number" className="form-input" style={{ width: '120px' }} placeholder="0.00" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Description</label>
                      <input className="form-input" style={{ width: '100%' }} placeholder="Description…" value={expenseDescription} onChange={e => setExpenseDescription(e.target.value)} onKeyDown={e => e.key === 'Enter' && addExpense()} />
                    </div>
                    <button className="btn-primary" onClick={addExpense}>+ Add</button>
                  </div>
                  {expenses.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No expenses yet.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {expenses.map((e: any) => (
                        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#9B9B9B', width: '90px', flexShrink: 0 }}>{fmt(e.expense_date)}</div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#144766', width: '100px', flexShrink: 0 }}>€{e.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                          <div style={{ flex: 1, fontSize: '13px', color: '#3F3F3F' }}>{e.description || '—'}</div>
                          <button onClick={() => deleteExpense(e)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '13px', fontWeight: '700', color: '#144766', padding: '8px 14px' }}>
                        Total: €{expenses.reduce((sum: number, e: any) => sum + e.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'Staffing' && (
                <ProjectStaffingSheet projectId={project.id} startDate={startDate} endDate={endDate} users={users} />
              )}
            </div>
          </div>
        </div>

        <div>
          <SidebarSection title="Client">
            {project.company ? (
              <SidebarCard title={project.company.name} subtitle="Client" href={`/companies/${project.company.id}`} color="#144766" />
            ) : <p style={{ fontSize: '12px', color: '#9B9B9B' }}>{project.is_internal ? 'Internal project — no client.' : 'No client.'}</p>}
          </SidebarSection>
          {project.partner && (
            <SidebarSection title="Partner">
              <SidebarCard title={project.partner.name} subtitle="Partner" href={`/partners/${project.partner.id}`} color="#7C3AED" />
            </SidebarSection>
          )}
          {!project.is_internal && project.opportunity && (
            <SidebarSection title="Opportunity">
              <SidebarCard title={project.opportunity.deal_name} subtitle={project.opportunity.deal_status} href={`/opportunities/${project.opportunity_id}`} color="#219BD6" />
            </SidebarSection>
          )}
          <SidebarSection title="Timeline">
            <PropertyRow label="Start" value={fmt(startDate)} />
            <PropertyRow label="End" value={fmt(endDate)} />
          </SidebarSection>
        </div>
      </div>

      {showTaskModal && (
        <TaskModal
          task={editingTask}
          entityType="project"
          entityId={project.id}
          entityLabel={project.project_name}
          source="operations"
          onClose={() => setShowTaskModal(false)}
          onSave={() => { setShowTaskModal(false); reloadTasks() }}
        />
      )}
    </div>
  )
}

export default function OperationsProjectDetailPage() {
  return <OperationsLayout><ProjectDetailContent /></OperationsLayout>
}
