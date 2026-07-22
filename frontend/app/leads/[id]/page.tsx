'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { leadsAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { RecordLayout, PropertyRow, SidebarSection, SidebarCard, StatusBadge, TabNav } from '@/components/shared/RecordLayout'
import { LeadModal } from '@/components/leads/LeadModal'
import { TaskModal } from '@/components/tasks/TaskModal'
import { OpportunityModal } from '@/components/opportunities/OpportunityModal'
import { taskManagerAPI } from '@/lib/api'

const TASK_DONE_STATUSES = ['resolved', 'closed']
// Display-only relabeling — the underlying status value stays 'Create an Opportunity'
// everywhere it's stored/compared (DB enum, backend trigger logic), only how it reads changes.
const STATUS_LABELS: Record<string, string> = { 'Create an Opportunity': 'Converted to Opportunity' }
const statusLabel = (s: string) => STATUS_LABELS[s] || s

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined
const fmtDateTime = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

export default function LeadDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [lead, setLead] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')
  const [showEdit, setShowEdit] = useState(false)
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [showCreateOpportunity, setShowCreateOpportunity] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')

  const [activityLog, setActivityLog] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [newNote, setNewNote] = useState('')
  const [files, setFiles] = useState<any[]>([])
  const [newFileTitle, setNewFileTitle] = useState('')
  const [newFileUrl, setNewFileUrl] = useState('')

  const [tasks, setTasks] = useState<any[]>([])
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<any>(null)

  const load = async () => {
    try {
      const l = await leadsAPI.get(id as string)
      setLead(l)
      const [log, nts, fls, tks] = await Promise.all([
        leadsAPI.getActivityLog(id as string),
        leadsAPI.getNotes(id as string),
        leadsAPI.getFiles(id as string),
        taskManagerAPI.list({ entity_type: 'lead', entity_id: id, source: 'sales' }),
      ])
      setActivityLog(log)
      setNotes(nts)
      setFiles(fls)
      setTasks(tks.tasks || tks || [])
    } catch {
      router.push('/leads')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    const u = getStoredUser()
    if (u) { setUserEmail(u.email); setUserName(u.name) }
  }, [])

  const addNote = async () => {
    if (!newNote.trim()) return
    await leadsAPI.addNote(lead.id, { content: newNote.trim(), created_by: userName || userEmail })
    setNewNote('')
    setNotes(await leadsAPI.getNotes(lead.id))
  }
  const deleteNote = async (n: any) => {
    if (!confirm('Delete this note?')) return
    await leadsAPI.deleteNote(lead.id, n.id)
    setNotes(await leadsAPI.getNotes(lead.id))
  }

  const addFile = async () => {
    if (!newFileTitle.trim() || !newFileUrl.trim()) return
    await leadsAPI.addFile(lead.id, { title: newFileTitle.trim(), url: newFileUrl.trim(), created_by: userEmail })
    setNewFileTitle(''); setNewFileUrl('')
    setFiles(await leadsAPI.getFiles(lead.id))
  }
  const deleteFile = async (f: any) => {
    if (!confirm(`Delete "${f.title}"?`)) return
    await leadsAPI.deleteFile(lead.id, f.id)
    setFiles(await leadsAPI.getFiles(lead.id))
  }

  const reloadTasks = async () => setTasks((await taskManagerAPI.list({ entity_type: 'lead', entity_id: id, source: 'sales' })).tasks || [])
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

  if (loading) return (
    <RecordLayout
      leftColumn={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#9B9B9B' }}>Loading...</div>}
      rightColumn={<div />}
    />
  )
  if (!lead) return null

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try {
      await leadsAPI.delete(lead.id)
      router.push('/leads')
    } catch {
      setDeleting(false)
    }
  }

  const leftColumn = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '11px', color: '#9B9B9B' }}>
        <button onClick={() => router.push('/leads')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontWeight: '600', fontSize: '11px', padding: 0 }}>Leads</button>
        <span>/</span><span style={{ color: '#3F3F3F', fontWeight: '600' }}>{lead.title}</span>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1 }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#144766', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '800', flexShrink: 0 }}>
              {lead.title[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#144766', margin: 0 }}>{lead.title}</h1>
                {lead.lead_number && <span style={{ background: '#F1F5F9', color: '#64748B', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{lead.lead_number}</span>}
                <StatusBadge value={statusLabel(lead.status)} />
              </div>
              <p style={{ color: '#9B9B9B', fontSize: '12px', margin: 0 }}>
                {lead.company?.name || 'No company'}
                {lead.origin && ` · Origin: ${lead.origin}`}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowEdit(true)} disabled={lead.status === 'Closed'} style={{ background: 'white', color: lead.status === 'Closed' ? '#CBD5E0' : '#144766', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #CBD5E0', cursor: lead.status === 'Closed' ? 'not-allowed' : 'pointer' }}>Edit</button>
            <button onClick={() => setShowDuplicate(true)} style={{ background: 'white', color: '#144766', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #CBD5E0', cursor: 'pointer' }}>Duplicate</button>
            <button onClick={() => { setDeleteConfirm(''); setShowDelete(true) }} style={{ background: 'white', color: '#DC2626', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #FCA5A5', cursor: 'pointer' }}>Delete</button>
          </div>
        </div>
      </div>

      {lead.status === 'Create an Opportunity' && !lead.opportunity_id && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: '700', color: '#059669', fontSize: '13px' }}>Ready to become an Opportunity</div>
            <div style={{ fontSize: '12px', color: '#3F3F3F' }}>Review the details and create the linked Opportunity — this will close the lead.</div>
          </div>
          <button className="btn-primary" onClick={() => setShowCreateOpportunity(true)}>Create Opportunity →</button>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '0 20px', background: '#FAFBFC', borderBottom: '2px solid #E2E8F0' }}>
          <TabNav tabs={['Overview', 'Notes', 'Files', 'Tasks']} active={tab} onChange={setTab} />
        </div>
        <div style={{ padding: '20px' }}>
          {tab === 'Overview' && (
            <div>
              {lead.opportunity_id && (
                <div style={{ marginBottom: '18px' }}>
                  <PropertyRow label="Linked Opportunity" value={<a href={`/opportunities/${lead.opportunity_id}`} style={{ color: '#219BD6', fontWeight: '600' }}>Open Opportunity ↗</a>} />
                </div>
              )}
              <PropertyRow label="Start Date" value={fmt(lead.start_date)} />
              <PropertyRow label="End Date" value={fmt(lead.end_date)} />
              <PropertyRow label="Origin" value={lead.origin} />
              {lead.status === 'Closed' && <PropertyRow label="Closed On" value={fmt(lead.closed_at)} />}

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

          {tab === 'Notes' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input className="form-input" style={{ flex: 1 }} placeholder="Add a note…" value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} />
                <button className="btn-primary" onClick={addNote}>+ Add</button>
              </div>
              {notes.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No notes yet.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {notes.map((n: any) => (
                    <div key={n.id} style={{ padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: '700', color: '#144766', fontSize: '12px' }}>{n.created_by || 'Unknown'}</span>
                        <button onClick={() => deleteNote(n)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                      </div>
                      <p style={{ fontSize: '13px', color: '#3F3F3F', margin: '4px 0' }}>{n.content}</p>
                      <div style={{ fontSize: '10px', color: '#9B9B9B' }}>{fmtDateTime(n.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'Files' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input className="form-input" style={{ flex: 1 }} placeholder="Title…" value={newFileTitle} onChange={e => setNewFileTitle(e.target.value)} />
                <input className="form-input" style={{ flex: 2 }} placeholder="Link…" value={newFileUrl} onChange={e => setNewFileUrl(e.target.value)} />
                <button className="btn-primary" onClick={addFile}>+ Add</button>
              </div>
              {files.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No files listed yet.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {files.map((f: any) => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', color: '#144766', fontSize: '13px' }}>{f.title}</div>
                        <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6', fontSize: '11px' }}>🔗 Open</a>
                      </div>
                      <button onClick={() => deleteFile(f)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
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
        </div>
      </div>
    </div>
  )

  const rightColumn = (
    <div>
      <SidebarSection title="Company">
        {lead.company ? <SidebarCard title={lead.company.name} subtitle={`Status: ${lead.company.status}`} href={`/companies/${lead.company.id}`} color="#144766" /> : <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No company.</p>}
      </SidebarSection>
      <SidebarSection title="Contacts">
        {lead.contact && <SidebarCard title={`${lead.contact.first_name} ${lead.contact.last_name}`} subtitle={lead.contact.job_type || lead.contact.email || 'Company Contact'} href={`/contacts/${lead.contact.id}`} color="#e97132" />}
        {(lead.partner_contacts || []).map((c: any) => <SidebarCard key={c.id} title={`${c.first_name} ${c.last_name}`} subtitle={c.job_type || c.email || 'Partner Contact'} href={`/contacts/${c.id}`} color="#7C3AED" />)}
        {!lead.contact && (!lead.partner_contacts || lead.partner_contacts.length === 0) && <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No contacts set.</p>}
      </SidebarSection>
      <SidebarSection title={`Partners (${lead.partners?.length || 0})`}>
        {(!lead.partners || lead.partners.length === 0) ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No partners.</p> : lead.partners.map((p: any) => <SidebarCard key={p.id} title={p.name} subtitle={`Status: ${p.status}`} href={`/partners/${p.id}`} color="#7C3AED" />)}
      </SidebarSection>
      <SidebarSection title="Teams">
        <PropertyRow label="Main Operational Team" value={lead.main_operational_team ? `${lead.main_operational_team.code} — ${lead.main_operational_team.title}` : null} />
        <PropertyRow label="Sales Team" value={lead.sales_team ? `${lead.sales_team.code} — ${lead.sales_team.title}` : null} />
      </SidebarSection>
      <SidebarSection title="Timeline">
        <PropertyRow label="Start" value={fmt(lead.start_date)} />
        <PropertyRow label="End" value={fmt(lead.end_date)} />
      </SidebarSection>
      {lead.opportunity_id && (
        <SidebarSection title="Opportunity">
          <SidebarCard title="View Opportunity" href={`/opportunities/${lead.opportunity_id}`} color="#219BD6" />
        </SidebarSection>
      )}
    </div>
  )

  return (
    <>
      <RecordLayout leftColumn={leftColumn} rightColumn={rightColumn} />
      {showEdit && <LeadModal lead={lead} onClose={() => setShowEdit(false)} onSave={() => { setShowEdit(false); load() }} />}
      {showDuplicate && <LeadModal duplicateFrom={lead} onClose={() => setShowDuplicate(false)} onSave={(newLead: any) => { setShowDuplicate(false); router.push(`/leads/${newLead.id}`) }} />}
      {showCreateOpportunity && <OpportunityModal fromLead={lead} onClose={() => setShowCreateOpportunity(false)} onSave={() => setShowCreateOpportunity(false)} />}
      {showTaskModal && (
        <TaskModal
          task={editingTask}
          entityType="lead"
          entityId={lead.id}
          entityLabel={lead.title}
          source="sales"
          onClose={() => setShowTaskModal(false)}
          onSave={() => { setShowTaskModal(false); reloadTasks() }}
        />
      )}
      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#DC2626' }}>Delete Lead</h2>
              <button onClick={() => setShowDelete(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: '#3F3F3F', marginBottom: '8px' }}>
                You are about to permanently delete <strong>{lead.title}</strong>. This action cannot be undone.
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
                {deleting ? 'Deleting...' : 'Delete Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
