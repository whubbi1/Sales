'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { opportunitiesAPI, companiesAPI, contactsAPI, taskManagerAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { RecordLayout, PropertyRow, SidebarSection, SidebarCard, TabNav } from '@/components/shared/RecordLayout'
import { OpportunityModal } from '@/components/opportunities/OpportunityModal'
import { OpportunityLinksSection } from '@/components/opportunities/OpportunityLinksSection'
import { TaskModal } from '@/components/tasks/TaskModal'
import { EmailsTab } from '@/components/shared/EmailsTab'
import { PickerModal } from '@/components/shared/PickerModal'

// Click-to-edit date row, same interaction as the EditableCell pattern used across the
// IT/Training/GRC report pages — click the value, swap in a date input, save on blur.
function EditableDateRow({ label, value, editing, onStartEdit, onSave }: { label: string; value?: string; editing: boolean; onStartEdit: () => void; onSave: (v: string) => void }) {
  const toDateStr = (d?: string) => d ? new Date(d).toISOString().split('T')[0] : ''
  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
      <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '3px' }}>{label}</div>
      {editing ? (
        <input type="date" className="form-input" autoFocus defaultValue={toDateStr(value)} onBlur={e => onSave(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} style={{ fontSize: '13px', padding: '4px 6px' }} />
      ) : (
        <div onClick={onStartEdit} title="Click to edit" style={{ fontSize: '13px', color: '#3F3F3F', fontWeight: '500', cursor: 'pointer', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          {fmt(value) || <span style={{ color: '#45B6E4' }}>—</span>}
        </div>
      )}
    </div>
  )
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Presentation To Be Scheduled': { bg: '#EEF2FF', color: '#4F46E5' },
  'Presentation Done':            { bg: '#FFF7ED', color: '#D97706' },
  'Proposition Ongoing':          { bg: '#FFF7ED', color: '#EA580C' },
  'Proposition Accepted':         { bg: '#ECFDF5', color: '#059669' },
  'Contract Won':                 { bg: '#D1FAE5', color: '#047857' },
  'Contract Lost':                { bg: '#FEF2F2', color: '#DC2626' },
}
const STATUS_LABEL: Record<string, string> = { new: 'New', open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' }
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  new: { bg: '#F1F5F9', color: '#475569' }, open: { bg: '#EFF6FF', color: '#219BD6' },
  in_progress: { bg: '#FFF7ED', color: '#D97706' }, resolved: { bg: '#ECFDF5', color: '#059669' }, closed: { bg: '#F1F5F9', color: '#64748B' },
}
const TASK_DONE_STATUSES = ['resolved', 'closed']

// Every 1st-of-month between two dates (inclusive) — the staffing grid's columns.
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

export default function OpportunityDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [opp, setOpp] = useState<any>(null)
  const [companyDeals, setCompanyDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showDuplicate, setShowDuplicate] = useState(false)

  const [users, setUsers] = useState<any[]>([])
  const [staffing, setStaffing] = useState<any[]>([])
  const [addStaffEmail, setAddStaffEmail] = useState('')
  const [addStaffRole, setAddStaffRole] = useState('')

  const [checklist, setChecklist] = useState<any[]>([])
  const [newChecklistText, setNewChecklistText] = useState('')

  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')

  const [tasks, setTasks] = useState<any[]>([])
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<any>(null)

  const [showAddContact, setShowAddContact] = useState(false)

  const [editingDateField, setEditingDateField] = useState<string | null>(null)

  const [sharepointUrl, setSharepointUrl] = useState('')
  const [editingSharepoint, setEditingSharepoint] = useState(false)
  const [files, setFiles] = useState<any[]>([]);
  const [filesError, setFilesError] = useState('')
  const [filesLoading, setFilesLoading] = useState(false)

  const load = async () => {
    try {
      const o = await opportunitiesAPI.get(id as string)
      setOpp(o)
      setSharepointUrl(o.sharepoint_site_url || '')
      if (o.company_id) {
        const deals = await companiesAPI.getOpportunities(o.company_id)
        setCompanyDeals(deals.filter((d: any) => d.id !== id))
      }
      const [staffingRows, checklistRows, commentRows, taskRows, usersResp] = await Promise.all([
        opportunitiesAPI.getStaffing(id as string),
        opportunitiesAPI.getChecklist(id as string),
        opportunitiesAPI.getComments(id as string),
        taskManagerAPI.list({ entity_type: 'opportunity', entity_id: id, source: 'sales' }),
        fetch('https://api.whubbi.wcomply.com/settings/users').then(r => r.json()),
      ])
      setStaffing(staffingRows)
      setChecklist(checklistRows)
      setComments(commentRows)
      setTasks(taskRows.tasks || [])
      setUsers(usersResp.users || [])
    } catch {
      router.push('/opportunities')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const loadFiles = async () => {
    setFilesLoading(true); setFilesError('')
    try {
      const d = await opportunitiesAPI.getSharepointFiles(id as string)
      if (d.error) setFilesError(d.error)
      setFiles(d.files || [])
    } catch (e: any) { setFilesError(e.message) }
    finally { setFilesLoading(false) }
  }

  useEffect(() => { if (tab === 'Files' && opp?.sharepoint_site_url) loadFiles() }, [tab])

  if (loading) return (
    <RecordLayout
      leftColumn={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#9B9B9B' }}>Loading...</div>}
      rightColumn={<div />}
    />
  )

  if (!opp) return null

  const statusStyle = STATUS_COLORS[opp.deal_status] || { bg: '#F1F5F9', color: '#475569' }
  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  const saveDateField = async (field: string, value: string) => {
    await opportunitiesAPI.update(opp.id, { [field]: value || null })
    setOpp((o: any) => ({ ...o, [field]: value || null }))
    setEditingDateField(null)
  }

  const saveSharepointUrl = async () => {
    await opportunitiesAPI.update(opp.id, { sharepoint_site_url: sharepointUrl })
    setOpp((o: any) => ({ ...o, sharepoint_site_url: sharepointUrl }))
    setEditingSharepoint(false)
  }

  const addStaffing = async () => {
    if (!addStaffEmail) return
    const u = users.find((uu: any) => uu.email === addStaffEmail)
    try {
      await opportunitiesAPI.addStaffing(opp.id, { user_email: addStaffEmail, user_name: u?.display_name || `${u?.first_name} ${u?.last_name}`, role: addStaffRole })
    } catch (e: any) { alert(e.message); return }
    setAddStaffEmail(''); setAddStaffRole('')
    setStaffing(await opportunitiesAPI.getStaffing(opp.id))
  }
  const removeStaffing = async (sid: string) => {
    try { await opportunitiesAPI.removeStaffing(opp.id, sid) } catch (e: any) { alert(e.message); return }
    setStaffing(await opportunitiesAPI.getStaffing(opp.id))
  }

  const saveStaffingMonth = async (staffingRow: any, monthKey: string, days: number) => {
    const months = (staffingRow.months || []).filter((m: any) => m.month.slice(0, 10) !== monthKey)
    if (days > 0) months.push({ month: monthKey, days })
    setStaffing(prev => prev.map(s => s.id === staffingRow.id ? { ...s, months } : s))
    await opportunitiesAPI.setStaffingMonths(opp.id, staffingRow.id, months)
  }

  const addChecklistItem = async () => {
    if (!newChecklistText.trim()) return
    await opportunitiesAPI.addChecklistItem(opp.id, { text: newChecklistText.trim(), position: checklist.length })
    setNewChecklistText('')
    setChecklist(await opportunitiesAPI.getChecklist(opp.id))
  }
  const toggleChecklistItem = async (item: any) => {
    await opportunitiesAPI.updateChecklistItem(opp.id, item.id, { is_checked: !item.is_checked })
    setChecklist(await opportunitiesAPI.getChecklist(opp.id))
  }
  const deleteChecklistItem = async (item: any) => {
    await opportunitiesAPI.deleteChecklistItem(opp.id, item.id)
    setChecklist(await opportunitiesAPI.getChecklist(opp.id))
  }

  const postComment = async () => {
    if (!newComment.trim()) return
    const user = getStoredUser()
    await opportunitiesAPI.addComment(opp.id, { author_email: user?.email || '', author_name: user?.name || user?.email || '', comment: newComment.trim() })
    setNewComment('')
    setComments(await opportunitiesAPI.getComments(opp.id))
  }
  const deleteComment = async (c: any) => {
    await opportunitiesAPI.deleteComment(opp.id, c.id)
    setComments(await opportunitiesAPI.getComments(opp.id))
  }

  const unlinkContact = async (contactId: string) => { await opportunitiesAPI.unlinkContact(opp.id, contactId); load() }

  const reloadTasks = async () => setTasks((await taskManagerAPI.list({ entity_type: 'opportunity', entity_id: id, source: 'sales' })).tasks || [])
  const toggleTaskDone = async (task: any) => {
    const done = TASK_DONE_STATUSES.includes(task.status)
    try { await taskManagerAPI.setStatus(task.id, { acting_email: getStoredUser()?.email || '', status: done ? 'new' : 'resolved' }) }
    catch (e: any) { alert(e.message) }
    reloadTasks()
  }
  const deleteTask = async (task: any) => {
    if (!confirm(`Delete task "${task.title}"?`)) return
    try { await taskManagerAPI.delete(task.id, getStoredUser()?.email || '') } catch (e: any) { alert(e.message); return }
    reloadTasks()
  }

  const checkedCount = checklist.filter(c => c.is_checked).length

  const leftColumn = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '11px', color: '#9B9B9B' }}>
        <button onClick={() => router.push('/opportunities')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontWeight: '600', fontSize: '11px', padding: 0 }}>Opportunities</button>
        <span>/</span><span style={{ color: '#3F3F3F', fontWeight: '600' }}>{opp.deal_name}</span>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1 }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#219BD6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '800', flexShrink: 0 }}>
              {opp.deal_name[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#144766', margin: 0 }}>{opp.deal_name}</h1>
                <span style={{ background: statusStyle.bg, color: statusStyle.color, padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' as const }}>{opp.deal_status}</span>
                {opp.deal_type && <span style={{ background: '#EEF2FF', color: '#4F46E5', padding: '2px 9px', borderRadius: '12px', fontSize: '10px', fontWeight: '700' }}>{opp.deal_type}</span>}
              </div>
              <p style={{ color: '#9B9B9B', fontSize: '12px', margin: 0 }}>
                {opp.deal_id && `#${opp.deal_id} · `}
                {opp.company?.name || 'No company'}
                {opp.project_name && ` · ${opp.project_name}`}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '12px' }}>
                {opp.deal_amount && <div><div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '2px' }}>Amount</div><div style={{ fontSize: '20px', fontWeight: '800', color: '#059669' }}>€{opp.deal_amount.toLocaleString()}</div></div>}
                {opp.closing_date && <div><div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '2px' }}>Closing</div><div style={{ fontSize: '14px', fontWeight: '700', color: '#3F3F3F' }}>{fmt(opp.closing_date)}</div></div>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowEdit(true)} style={{ background: 'white', color: '#144766', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #CBD5E0', cursor: 'pointer' }}>Edit</button>
            <button onClick={() => setShowDuplicate(true)} style={{ background: 'white', color: '#144766', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #CBD5E0', cursor: 'pointer' }}>Duplicate</button>
            <button onClick={() => { setDeleteConfirm(''); setShowDelete(true) }} style={{ background: 'white', color: '#DC2626', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #FCA5A5', cursor: 'pointer' }}>Delete</button>
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '0 20px', background: '#FAFBFC', borderBottom: '2px solid #E2E8F0' }}>
          <TabNav tabs={['Overview', 'Notes', 'Staffing', 'Checklist', 'Files', 'Tasks', 'Emails']} active={tab} onChange={setTab} />
        </div>
        <div style={{ padding: '20px' }}>
          {tab === 'Overview' && (
            <div>
              <p style={{ color: opp.notes ? '#3F3F3F' : '#CBD5E0', fontSize: '13px', lineHeight: '1.8' }}>{opp.notes || 'No notes.'}</p>
              {opp.assigned_consultants?.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '8px' }}>Consultants</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {opp.assigned_consultants.map((c: any) => <span key={c.email || c} style={{ background: '#EFF6FF', color: '#2563EB', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>{c.name || c.email || c}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'Staffing' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <select className="form-input" style={{ width: '220px' }} value={addStaffEmail} onChange={e => setAddStaffEmail(e.target.value)}>
                  <option value="">Select employee…</option>
                  {[...users].sort((a, b) => (a.display_name || `${a.first_name} ${a.last_name}`).localeCompare(b.display_name || `${b.first_name} ${b.last_name}`)).map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
                </select>
                <input className="form-input" style={{ width: '180px' }} placeholder="Role (optional)" value={addStaffRole} onChange={e => setAddStaffRole(e.target.value)} />
                <button className="btn-primary" onClick={addStaffing} disabled={!addStaffEmail}>+ Add</button>
              </div>
              {staffing.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No one staffed on this opportunity yet.</p> : !opp.contract_start_date || !opp.contract_end_date ? (
                <div>
                  <p style={{ color: '#D97706', fontSize: '12px', marginBottom: '14px' }}>Set Contract Start and Contract End (in the sidebar) to allocate days per month.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[...staffing].sort((a, b) => (a.user_name || a.user_email).localeCompare(b.user_name || b.user_email)).map((s: any) => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                        <div>
                          <div style={{ fontWeight: '700', color: '#144766', fontSize: '13px' }}>{s.user_name || s.user_email}</div>
                          {s.role && <div style={{ fontSize: '11px', color: '#9B9B9B' }}>{s.role}</div>}
                        </div>
                        <button onClick={() => removeStaffing(s.id)} style={{ padding: '5px 10px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#DC2626', fontWeight: '700' }}>Remove</button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (() => {
                const months = monthsBetween(opp.contract_start_date, opp.contract_end_date)
                const sorted = [...staffing].sort((a, b) => (a.user_name || a.user_email).localeCompare(b.user_name || b.user_email))
                return (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: '12px', width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>Resource</th>
                          {months.map(m => <th key={m.key} style={{ textAlign: 'center', padding: '8px 8px', fontSize: '10px', fontWeight: '700', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{m.label}</th>)}
                          <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: '10px', fontWeight: '700', color: '#144766', borderBottom: '1px solid #E2E8F0' }}>Total</th>
                          <th style={{ borderBottom: '1px solid #E2E8F0' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((s: any) => {
                          const dayFor = (key: string) => (s.months || []).find((m: any) => m.month.slice(0, 10) === key)?.days || ''
                          const total = (s.months || []).reduce((sum: number, m: any) => sum + (m.days || 0), 0)
                          return (
                            <tr key={s.id}>
                              <td style={{ padding: '8px 10px', borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap' }}>
                                <div style={{ fontWeight: '700', color: '#144766' }}>{s.user_name || s.user_email}</div>
                                {s.role && <div style={{ fontSize: '10px', color: '#9B9B9B' }}>{s.role}</div>}
                              </td>
                              {months.map(m => (
                                <td key={m.key} style={{ padding: '4px', borderBottom: '1px solid #F1F5F9', textAlign: 'center' }}>
                                  <input type="number" min={0} step={0.5} defaultValue={dayFor(m.key)} placeholder="0"
                                    onBlur={e => saveStaffingMonth(s, m.key, Number(e.target.value) || 0)}
                                    style={{ width: '52px', textAlign: 'center', fontSize: '12px', padding: '4px', border: '1px solid #E2E8F0', borderRadius: '5px' }} />
                                </td>
                              ))}
                              <td style={{ padding: '8px 10px', borderBottom: '1px solid #F1F5F9', textAlign: 'center', fontWeight: '700', color: '#144766' }}>{total || '—'}</td>
                              <td style={{ padding: '8px 10px', borderBottom: '1px solid #F1F5F9' }}>
                                <button onClick={() => removeStaffing(s.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </div>
          )}

          {tab === 'Checklist' && (
            <div>
              <p style={{ fontSize: '11px', color: '#9B9B9B', marginBottom: '10px' }}>{checkedCount}/{checklist.length} done</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input className="form-input" style={{ flex: 1 }} placeholder="Add a checklist item…" value={newChecklistText} onChange={e => setNewChecklistText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addChecklistItem()} />
                <button className="btn-primary" onClick={addChecklistItem}>Add</button>
              </div>
              {checklist.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No checklist items yet.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {checklist.map((item: any) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '6px' }}>
                      <input type="checkbox" checked={item.is_checked} onChange={() => toggleChecklistItem(item)} style={{ accentColor: '#219BD6', width: '15px', height: '15px', cursor: 'pointer' }} />
                      <span style={{ flex: 1, fontSize: '13px', color: item.is_checked ? '#9B9B9B' : '#3F3F3F', textDecoration: item.is_checked ? 'line-through' : 'none' }}>{item.text}</span>
                      <button onClick={() => deleteChecklistItem(item)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'Notes' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <textarea className="form-input" style={{ flex: 1, resize: 'vertical' }} rows={2} placeholder="Write a comment…" value={newComment} onChange={e => setNewComment(e.target.value)} />
                <button className="btn-primary" onClick={postComment} style={{ alignSelf: 'flex-end' }}>Post</button>
              </div>
              {comments.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No comments yet.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {comments.map((c: any) => (
                    <div key={c.id} style={{ padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '700', color: '#144766', fontSize: '12px' }}>{c.author_name || c.author_email}</span>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', color: '#9B9B9B' }}>{new Date(c.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          <button onClick={() => deleteComment(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                        </div>
                      </div>
                      <p style={{ fontSize: '13px', color: '#3F3F3F', margin: 0, whiteSpace: 'pre-wrap' }}>{c.comment}</p>
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
            </div>
          )}

          {tab === 'Files' && (
            <div>
              <div style={{ marginBottom: '14px' }}>
                <p className="section-label" style={{ marginBottom: '6px' }}>SharePoint Link</p>
                {editingSharepoint ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="form-input" style={{ flex: 1 }} placeholder="https://wcomply.sharepoint.com/..." value={sharepointUrl} onChange={e => setSharepointUrl(e.target.value)} autoFocus />
                    <button className="btn-primary" onClick={saveSharepointUrl}>Save</button>
                    <button className="btn-secondary" onClick={() => { setSharepointUrl(opp.sharepoint_site_url || ''); setEditingSharepoint(false) }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {opp.sharepoint_site_url ? (
                      <a href={opp.sharepoint_site_url} target="_blank" rel="noopener noreferrer" style={{ color: '#219BD6', fontSize: '13px', fontWeight: '600' }}>Open in SharePoint ↗</a>
                    ) : <span style={{ color: '#9B9B9B', fontSize: '13px' }}>No SharePoint site linked yet.</span>}
                    <button onClick={() => setEditingSharepoint(true)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#156082', fontSize: '12px', fontWeight: '600', padding: 0 }}>{opp.sharepoint_site_url ? 'Edit' : '+ Link SharePoint'}</button>
                    {opp.sharepoint_site_url && <button onClick={loadFiles} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontSize: '12px', fontWeight: '600', padding: 0 }}>↻ Refresh</button>}
                  </div>
                )}
              </div>
              {opp.sharepoint_site_url && (
                filesLoading ? (
                  <p style={{ color: '#9B9B9B', fontSize: '13px' }}>Loading files…</p>
                ) : filesError ? (
                  <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{filesError}</div>
                ) : files.length === 0 ? (
                  <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No files found at this SharePoint link.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {files.map((f: any) => (
                      <a key={f.id} href={f.web_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid #EDF2F7', borderRadius: '6px', textDecoration: 'none', color: '#3F3F3F', fontSize: '12px' }}>
                        <span>{f.is_folder ? '📁' : '📄'} {f.name}</span>
                        <span style={{ color: '#9B9B9B' }}>{f.last_modified ? fmt(f.last_modified) : ''}</span>
                      </a>
                    ))}
                  </div>
                )
              )}
              <OpportunityLinksSection opportunityId={opp.id} />
            </div>
          )}

          {tab === 'Emails' && <EmailsTab entityType="opportunity" entityId={opp.id} />}
        </div>
      </div>
    </div>
  )

  const rightColumn = (
    <div>
      <SidebarSection title="Company">
        {opp.company ? <SidebarCard title={opp.company.name} subtitle={`Status: ${opp.company.status}`} href={`/companies/${opp.company.id}`} color="#144766" /> : <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No company.</p>}
      </SidebarSection>
      <SidebarSection title={`Contacts (${opp.contacts?.length || 0})`} onAdd={() => setShowAddContact(true)}>
        {(!opp.contacts || opp.contacts.length === 0) ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No contacts.</p> : opp.contacts.map((c: any) => <SidebarCard key={c.id} title={`${c.first_name} ${c.last_name}`} subtitle={c.job_type || c.email} href={`/contacts/${c.id}`} color="#e97132" onRemove={() => unlinkContact(c.id)} />)}
      </SidebarSection>
      <SidebarSection title="Partner">
        {opp.partner ? <SidebarCard title={opp.partner.name} subtitle={`Status: ${opp.partner.status}`} href={`/partners/${opp.partner.id}`} color="#7C3AED" /> : <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No partner.</p>}
      </SidebarSection>
      {opp.company && (
        <SidebarSection title={`Other ${opp.company.name} Opportunities (${companyDeals.length})`}>
          {companyDeals.length === 0 ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No other opportunities.</p> : companyDeals.map((d: any) => <SidebarCard key={d.id} title={d.deal_name} subtitle={d.deal_status} href={`/opportunities/${d.id}`} color="#219BD6" />)}
        </SidebarSection>
      )}
      <SidebarSection title="Opportunity Details">
        <PropertyRow label="Opportunity ID" value={opp.deal_id} />
        <PropertyRow label="Opportunity Type" value={opp.deal_type} />
        <PropertyRow label="Project Type" value={opp.project_status} />
        <PropertyRow label="Amount" value={opp.deal_amount ? `€${opp.deal_amount.toLocaleString()}` : null} />
        {opp.project_status === 'Daily Invoicing' && (
          <>
            <PropertyRow label="Days to Invoice" value={opp.invoice_days} />
            <PropertyRow label="Daily Invoice Rate" value={opp.daily_rate ? `€${opp.daily_rate.toLocaleString()}` : null} />
          </>
        )}
        <EditableDateRow label="Closing Date" value={opp.closing_date} editing={editingDateField === 'closing_date'} onStartEdit={() => setEditingDateField('closing_date')} onSave={v => saveDateField('closing_date', v)} />
        <EditableDateRow label="Contract Start" value={opp.contract_start_date} editing={editingDateField === 'contract_start_date'} onStartEdit={() => setEditingDateField('contract_start_date')} onSave={v => saveDateField('contract_start_date', v)} />
        <EditableDateRow label="Contract End" value={opp.contract_end_date} editing={editingDateField === 'contract_end_date'} onStartEdit={() => setEditingDateField('contract_end_date')} onSave={v => saveDateField('contract_end_date', v)} />
        <PropertyRow label="Contracting Party" value={opp.contracting_party} />
        <PropertyRow label="Owner" value={opp.assigned_to} />
        <PropertyRow label="Main Operational Team" value={opp.main_operational_team ? `${opp.main_operational_team.code} — ${opp.main_operational_team.title}` : null} />
        <PropertyRow label="Sales Team" value={opp.sales_team ? `${opp.sales_team.code} — ${opp.sales_team.title}` : null} />
        <PropertyRow label="Referral Contact" value={opp.referral_contact ? `${opp.referral_contact.first_name} ${opp.referral_contact.last_name}` : null} />
        {opp.lead && (
          <PropertyRow label="Source Lead" value={<a href={`/leads/${opp.lead.id}`} style={{ color: '#219BD6', fontWeight: '600' }}>{opp.lead.lead_number || opp.lead.title} ↗</a>} />
        )}
      </SidebarSection>
      <SidebarSection title={`Staffing (${staffing.length})`}>
        {staffing.length === 0 ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No one staffed yet.</p> : staffing.map((s: any) => <SidebarCard key={s.id} title={s.user_name || s.user_email} subtitle={s.role || 'Staffed'} href="/staffing" color="#059669" />)}
      </SidebarSection>
    </div>
  )

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try {
      await opportunitiesAPI.delete(opp.id)
      router.push('/opportunities')
    } catch {
      setDeleting(false)
    }
  }

  return (
    <>
      <RecordLayout leftColumn={leftColumn} rightColumn={rightColumn} />
      {showEdit && <OpportunityModal opportunity={opp} onClose={() => setShowEdit(false)} onSave={() => { setShowEdit(false); load() }} />}
      {showDuplicate && <OpportunityModal duplicateFrom={opp} onClose={() => setShowDuplicate(false)} onSave={() => setShowDuplicate(false)} />}
      {showAddContact && (
        <PickerModal
          title="Add a Contact" placeholder="Search contacts by name or email…"
          searchFn={q => contactsAPI.list(q.trim() ? { search: q.trim() } : undefined)}
          renderLabel={(c: any) => ({ title: `${c.first_name} ${c.last_name}`, subtitle: c.job_type || c.email })}
          onPick={async (c: any) => { await opportunitiesAPI.linkContact(opp.id, c.id); load() }}
          onClose={() => setShowAddContact(false)}
        />
      )}
      {showTaskModal && (
        <TaskModal
          task={editingTask}
          entityType="opportunity"
          entityId={opp.id}
          entityLabel={opp.deal_name}
          source="sales"
          onClose={() => setShowTaskModal(false)}
          onSave={() => { setShowTaskModal(false); reloadTasks() }}
        />
      )}
      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#DC2626' }}>Delete Opportunity</h2>
              <button onClick={() => setShowDelete(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: '#3F3F3F', marginBottom: '8px' }}>
                You are about to permanently delete <strong>{opp.deal_name}</strong>. This action cannot be undone.
              </p>
              <p style={{ fontSize: '13px', color: '#3F3F3F', marginBottom: '12px' }}>
                Type <strong style={{ color: '#DC2626' }}>DELETE</strong> to confirm.
              </p>
              <input
                className="form-input"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDelete()}
                placeholder="Type DELETE to confirm"
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDelete(false)}>Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                style={{ background: deleteConfirm === 'DELETE' ? '#DC2626' : '#FCA5A5', color: 'white', padding: '8px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'not-allowed', transition: 'background 0.15s' }}
              >
                {deleting ? 'Deleting...' : 'Delete Opportunity'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
