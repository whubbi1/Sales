'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { rfpAPI, companiesAPI, partnersAPI, opportunitiesAPI } from '@/lib/api'
import { RecordLayout, PropertyRow, SidebarSection, SidebarCard, StatusBadge, TabNav } from '@/components/shared/RecordLayout'
import { RFPModal } from '@/components/rfp/RFPModal'

const API = 'https://api.whubbi.wcomply.com'

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined
const toDateStr = (d?: string) => d ? new Date(d).toISOString().split('T')[0] : ''

// Click-to-edit inline field — same interaction used on the Opportunity detail page.
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

export default function RFPDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [rfp, setRfp] = useState<any>(null)
  const [contacts, setContacts] = useState<any[]>([])
  const [allOpportunities, setAllOpportunities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [actionItems, setActionItems] = useState<any[]>([])
  const [documentChecklist, setDocumentChecklist] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null)

  const [newAction, setNewAction] = useState('')
  const [newDocName, setNewDocName] = useState('')
  const [newDocTemplate, setNewDocTemplate] = useState('')

  const [documentsFolderUrl, setDocumentsFolderUrl] = useState('')
  const [editingFolder, setEditingFolder] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')

  const [showLinkPicker, setShowLinkPicker] = useState(false)
  const [linkSearch, setLinkSearch] = useState('')

  const load = async () => {
    try {
      const r = await rfpAPI.get(id as string)
      setRfp(r)
      setDocumentsFolderUrl(r.documents_folder_url || '')
      const [items, docs] = await Promise.all([
        rfpAPI.getActionItems(id as string),
        rfpAPI.getDocumentChecklist(id as string),
      ])
      setActionItems(items)
      setDocumentChecklist(docs)
      if (r.company_id) setContacts(await companiesAPI.getContacts(r.company_id))
      else if (r.partner_id) setContacts(await partnersAPI.getContacts(r.partner_id))
      else setContacts([])
    } catch {
      router.push('/rfp')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    fetch(`${API}/settings/users`).then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
    opportunitiesAPI.list({}).then(setAllOpportunities).catch(() => {})
  }, [])

  const isEditing = (itemId: string, field: string) => editing?.id === itemId && editing.field === field

  const saveFolderUrl = async () => {
    await rfpAPI.update(rfp.id, { documents_folder_url: documentsFolderUrl })
    setRfp((r: any) => ({ ...r, documents_folder_url: documentsFolderUrl }))
    setEditingFolder(false)
  }

  const runAnalyze = async () => {
    setAnalyzing(true); setAnalyzeError('')
    try {
      await rfpAPI.analyze(rfp.id)
      await load()
      setTab('Overview')
    } catch (e: any) {
      setAnalyzeError(e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  // ─── Action plan ──────────────────────────────────────────────────────────
  const addAction = async () => {
    if (!newAction.trim()) return
    await rfpAPI.addActionItem(rfp.id, { description: newAction.trim(), position: actionItems.length })
    setNewAction('')
    setActionItems(await rfpAPI.getActionItems(rfp.id))
  }
  const patchAction = async (item: any, fields: any) => {
    await rfpAPI.updateActionItem(rfp.id, item.id, fields)
    setEditing(null)
    setActionItems(await rfpAPI.getActionItems(rfp.id))
  }
  const deleteAction = async (item: any) => {
    if (!confirm('Delete this action item?')) return
    await rfpAPI.deleteActionItem(rfp.id, item.id)
    setActionItems(await rfpAPI.getActionItems(rfp.id))
  }
  const toggleActionDone = async (item: any) => {
    await patchAction(item, { status: item.status === 'done' ? 'pending' : 'done' })
  }

  const employeeName = (u: any) => u.display_name || `${u.first_name} ${u.last_name}`
  const sortedUsers = [...users].sort((a, b) => employeeName(a).localeCompare(employeeName(b)))
  const sortedContacts = [...contacts].sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))

  // ─── Document checklist ───────────────────────────────────────────────────
  const addDoc = async () => {
    if (!newDocName.trim()) return
    await rfpAPI.addDocumentChecklist(rfp.id, { name: newDocName.trim(), template_url: newDocTemplate.trim() || undefined, position: documentChecklist.length })
    setNewDocName(''); setNewDocTemplate('')
    setDocumentChecklist(await rfpAPI.getDocumentChecklist(rfp.id))
  }
  const patchDoc = async (item: any, fields: any) => {
    await rfpAPI.updateDocumentChecklist(rfp.id, item.id, fields)
    setEditing(null)
    setDocumentChecklist(await rfpAPI.getDocumentChecklist(rfp.id))
  }
  const deleteDoc = async (item: any) => {
    if (!confirm(`Delete "${item.name}"?`)) return
    await rfpAPI.deleteDocumentChecklist(rfp.id, item.id)
    setDocumentChecklist(await rfpAPI.getDocumentChecklist(rfp.id))
  }
  const toggleDocDone = async (item: any) => {
    await patchDoc(item, { status: item.status === 'done' ? 'pending' : 'done' })
  }

  // ─── Linked opportunities ─────────────────────────────────────────────────
  const linkedIds = new Set((rfp?.opportunities || []).map((o: any) => o.id))
  const linkableOpportunities = allOpportunities
    .filter((o: any) => !linkedIds.has(o.id))
    .filter((o: any) => !linkSearch.trim() || o.deal_name.toLowerCase().includes(linkSearch.trim().toLowerCase()))
    .sort((a: any, b: any) => a.deal_name.localeCompare(b.deal_name))

  const linkOpportunity = async (oppId: string) => {
    await rfpAPI.linkOpportunity(rfp.id, oppId)
    setShowLinkPicker(false); setLinkSearch('')
    load()
  }
  const unlinkOpportunity = async (oppId: string) => {
    if (!confirm('Unlink this opportunity from the RFP?')) return
    await rfpAPI.unlinkOpportunity(rfp.id, oppId)
    load()
  }

  if (loading) return (
    <RecordLayout
      leftColumn={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#9B9B9B' }}>Loading...</div>}
      rightColumn={<div />}
    />
  )

  if (!rfp) return null

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try {
      await rfpAPI.delete(rfp.id)
      router.push('/rfp')
    } catch {
      setDeleting(false)
    }
  }

  const leftColumn = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '11px', color: '#9B9B9B' }}>
        <button onClick={() => router.push('/rfp')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontWeight: '600', fontSize: '11px', padding: 0 }}>RFP</button>
        <span>/</span><span style={{ color: '#3F3F3F', fontWeight: '600' }}>{rfp.name}</span>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1 }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#144766', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '800', flexShrink: 0 }}>
              {rfp.name[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#144766', margin: 0 }}>{rfp.name}</h1>
                <StatusBadge value={rfp.status} />
              </div>
              <p style={{ color: '#9B9B9B', fontSize: '12px', margin: 0 }}>
                {rfp.company?.name || rfp.partner?.name || 'No customer'}
                {rfp.owner && ` · Owner: ${rfp.owner}`}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowEdit(true)} style={{ background: 'white', color: '#144766', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #CBD5E0', cursor: 'pointer' }}>Edit</button>
            <button onClick={() => { setDeleteConfirm(''); setShowDelete(true) }} style={{ background: 'white', color: '#DC2626', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #FCA5A5', cursor: 'pointer' }}>Delete</button>
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '0 20px', background: '#FAFBFC', borderBottom: '2px solid #E2E8F0' }}>
          <TabNav tabs={['Overview', 'Action Plan', 'Documents Checklist', 'Files']} active={tab} onChange={setTab} />
        </div>
        <div style={{ padding: '20px' }}>
          {tab === 'Overview' && (
            <div>
              <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '8px' }}>AI Analysis</p>
              <p style={{ color: rfp.ai_summary ? '#3F3F3F' : '#CBD5E0', fontSize: '13px', lineHeight: '1.8', marginBottom: '20px' }}>
                {rfp.ai_summary || (rfp.analysis_status === 'analyzing' ? 'Analysis in progress…' : 'No analysis yet — link a documents folder in the Files tab and click Analyze Documents.')}
              </p>
              {rfp.analysis_status === 'failed' && rfp.analysis_error && (
                <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '20px' }}>Last analysis failed: {rfp.analysis_error}</div>
              )}
              <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '8px' }}>Key Dates</p>
              {(!rfp.key_dates || rfp.key_dates.length === 0) ? (
                <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No key dates extracted yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {rfp.key_dates.map((kd: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid #EDF2F7', borderRadius: '8px', fontSize: '13px' }}>
                      <span style={{ fontWeight: '600', color: '#144766' }}>{kd.label}</span>
                      <span style={{ color: '#3F3F3F' }}>{fmt(kd.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'Action Plan' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input className="form-input" style={{ flex: 1 }} placeholder="Add an action…" value={newAction} onChange={e => setNewAction(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAction()} />
                <button className="btn-primary" onClick={addAction}>+ Add</button>
              </div>
              {actionItems.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No action items yet.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {actionItems.map((item: any) => (
                    <div key={item.id} style={{ padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <input type="checkbox" checked={item.status === 'done'} onChange={() => toggleActionDone(item)} style={{ accentColor: '#219BD6', width: '15px', height: '15px', marginTop: '4px', cursor: 'pointer' }} />
                        <div style={{ flex: 1 }}>
                          {isEditing(item.id, 'description') ? (
                            <textarea autoFocus className="form-input" style={{ width: '100%', boxSizing: 'border-box' as const }} defaultValue={item.description} onBlur={e => patchAction(item, { description: e.target.value })} />
                          ) : (
                            <div onClick={() => setEditing({ id: item.id, field: 'description' })} style={{ fontSize: '13px', color: item.status === 'done' ? '#9B9B9B' : '#3F3F3F', textDecoration: item.status === 'done' ? 'line-through' : 'none', cursor: 'pointer' }}>{item.description}</div>
                          )}
                          <div style={{ display: 'flex', gap: '14px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: '10px', color: '#9B9B9B', marginRight: '4px' }}>Due:</span>
                              {isEditing(item.id, 'due_date') ? (
                                <input type="date" autoFocus className="form-input" style={{ fontSize: '11px', padding: '3px 6px' }} defaultValue={toDateStr(item.due_date)} onBlur={e => patchAction(item, { due_date: e.target.value || null })} />
                              ) : (
                                <span onClick={() => setEditing({ id: item.id, field: 'due_date' })} style={{ fontSize: '11px', color: '#219BD6', cursor: 'pointer', fontWeight: '600' }}>{fmt(item.due_date) || 'Set date'}</span>
                              )}
                            </div>
                            <div>
                              <span style={{ fontSize: '10px', color: '#9B9B9B', marginRight: '4px' }}>Owner:</span>
                              {isEditing(item.id, 'owner') ? (
                                <span style={{ display: 'inline-flex', gap: '4px' }}>
                                  <select className="form-input" style={{ fontSize: '11px', padding: '3px 6px' }} defaultValue={item.owner_type || ''}
                                    onChange={e => {
                                      const kind = e.target.value
                                      if (kind === 'internal') setEditing({ id: item.id, field: 'owner_internal' })
                                      else if (kind === 'external') setEditing({ id: item.id, field: 'owner_external' })
                                    }}>
                                    <option value="">Select type…</option>
                                    <option value="internal">Internal (wcomply)</option>
                                    <option value="external">External (contact)</option>
                                  </select>
                                </span>
                              ) : isEditing(item.id, 'owner_internal') ? (
                                <select autoFocus className="form-input" style={{ fontSize: '11px', padding: '3px 6px' }} defaultValue=""
                                  onChange={e => {
                                    const u = sortedUsers.find((uu: any) => uu.email === e.target.value)
                                    if (u) patchAction(item, { owner_type: 'internal', owner_email: u.email, owner_name: employeeName(u) })
                                  }}
                                  onBlur={() => setEditing(null)}>
                                  <option value="">Select employee…</option>
                                  {sortedUsers.map((u: any) => <option key={u.email} value={u.email}>{employeeName(u)}</option>)}
                                </select>
                              ) : isEditing(item.id, 'owner_external') ? (
                                <select autoFocus className="form-input" style={{ fontSize: '11px', padding: '3px 6px' }} defaultValue=""
                                  onChange={e => { if (e.target.value) patchAction(item, { owner_type: 'external', owner_contact_id: e.target.value }) }}
                                  onBlur={() => setEditing(null)}>
                                  <option value="">Select contact…</option>
                                  {sortedContacts.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                                </select>
                              ) : (
                                <span onClick={() => setEditing({ id: item.id, field: 'owner' })} style={{ fontSize: '11px', color: '#219BD6', cursor: 'pointer', fontWeight: '600' }}>
                                  {item.owner_name ? `${item.owner_name}${item.owner_type === 'external' ? ' (external)' : ''}` : 'Assign owner'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => deleteAction(item)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'Documents Checklist' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input className="form-input" style={{ flex: 1 }} placeholder="Document name…" value={newDocName} onChange={e => setNewDocName(e.target.value)} />
                <input className="form-input" style={{ flex: 1 }} placeholder="Template link (optional)…" value={newDocTemplate} onChange={e => setNewDocTemplate(e.target.value)} />
                <button className="btn-primary" onClick={addDoc}>+ Add</button>
              </div>
              {documentChecklist.length === 0 ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No documents listed yet.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {documentChecklist.map((item: any) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                      <input type="checkbox" checked={item.status === 'done'} onChange={() => toggleDocDone(item)} style={{ accentColor: '#219BD6', width: '15px', height: '15px', cursor: 'pointer' }} />
                      <div style={{ flex: 1 }}>
                        <EditableCell display={<span style={{ fontWeight: '700', color: '#144766', textDecoration: item.status === 'done' ? 'line-through' : 'none' }}>{item.name}</span>} editing={isEditing(item.id, 'name')} onStartEdit={() => setEditing({ id: item.id, field: 'name' })}>
                          <input autoFocus className="form-input" defaultValue={item.name} onBlur={e => patchDoc(item, { name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                        </EditableCell>
                        <EditableCell display={item.template_url ? <a href={item.template_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#3B82F6', fontSize: '11px' }}>🔗 Template</a> : <span style={{ fontSize: '11px', color: '#CBD5E0' }}>No template link — click to add</span>} editing={isEditing(item.id, 'template_url')} onStartEdit={() => setEditing({ id: item.id, field: 'template_url' })}>
                          <input autoFocus className="form-input" style={{ fontSize: '11px' }} defaultValue={item.template_url} onBlur={e => patchDoc(item, { template_url: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                        </EditableCell>
                      </div>
                      <button onClick={() => deleteDoc(item)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '15px', padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'Files' && (
            <div>
              <div style={{ marginBottom: '18px' }}>
                <p className="section-label" style={{ marginBottom: '6px' }}>Documents Folder</p>
                {editingFolder ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="form-input" style={{ flex: 1 }} placeholder="https://wcomply.sharepoint.com/..." value={documentsFolderUrl} onChange={e => setDocumentsFolderUrl(e.target.value)} autoFocus />
                    <button className="btn-primary" onClick={saveFolderUrl}>Save</button>
                    <button className="btn-secondary" onClick={() => { setDocumentsFolderUrl(rfp.documents_folder_url || ''); setEditingFolder(false) }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {rfp.documents_folder_url ? (
                      <a href={rfp.documents_folder_url} target="_blank" rel="noopener noreferrer" style={{ color: '#219BD6', fontSize: '13px', fontWeight: '600' }}>Open Folder ↗</a>
                    ) : <span style={{ color: '#9B9B9B', fontSize: '13px' }}>No documents folder linked yet.</span>}
                    <button onClick={() => setEditingFolder(true)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#156082', fontSize: '12px', fontWeight: '600', padding: 0 }}>{rfp.documents_folder_url ? 'Edit' : '+ Link Folder'}</button>
                    {rfp.documents_folder_url && (
                      <button onClick={runAnalyze} disabled={analyzing} style={{ padding: '6px 14px', background: analyzing ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '700', cursor: analyzing ? 'default' : 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                        {analyzing ? '🤖 Analyzing…' : '🤖 Analyze Documents'}
                      </button>
                    )}
                  </div>
                )}
                {analyzing && <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px' }}>Reading the first PDF/Word documents in the folder and asking Claude to extract dates, an action plan, and a document checklist — this can take up to a minute.</p>}
                {analyzeError && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginTop: '8px' }}>{analyzeError}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const rightColumn = (
    <div>
      <SidebarSection title="Customer">
        {rfp.company ? (
          <SidebarCard title={rfp.company.name} subtitle={`Status: ${rfp.company.status}`} href={`/companies/${rfp.company.id}`} color="#144766" />
        ) : rfp.partner ? (
          <SidebarCard title={rfp.partner.name} subtitle={`Status: ${rfp.partner.status}`} href={`/partners/${rfp.partner.id}`} color="#7C3AED" />
        ) : <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No customer.</p>}
      </SidebarSection>
      <SidebarSection title={`Contacts (${contacts.length})`}>
        {contacts.length === 0 ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No contacts.</p> : contacts.map((c: any) => <SidebarCard key={c.id} title={`${c.first_name} ${c.last_name}`} subtitle={c.job_type || c.email} href={`/contacts/${c.id}`} color="#e97132" />)}
      </SidebarSection>
      <SidebarSection title={`Linked Opportunities (${rfp.opportunities?.length || 0})`} onAdd={() => setShowLinkPicker(o => !o)}>
        {showLinkPicker && (
          <div style={{ marginBottom: '10px' }}>
            <input className="form-input" style={{ width: '100%', boxSizing: 'border-box' as const, marginBottom: '6px' }} placeholder="Search opportunities…" value={linkSearch} onChange={e => setLinkSearch(e.target.value)} />
            <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
              {linkableOpportunities.length === 0 ? (
                <p style={{ fontSize: '11px', color: '#9B9B9B', padding: '8px' }}>No matching opportunities.</p>
              ) : linkableOpportunities.slice(0, 20).map((o: any) => (
                <div key={o.id} onClick={() => linkOpportunity(o.id)} style={{ padding: '6px 10px', fontSize: '12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {o.deal_name}
                </div>
              ))}
            </div>
          </div>
        )}
        {(!rfp.opportunities || rfp.opportunities.length === 0) ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No opportunities linked.</p> : rfp.opportunities.map((o: any) => (
          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ flex: 1 }}><SidebarCard title={o.deal_name} subtitle={o.deal_status} href={`/opportunities/${o.id}`} color="#219BD6" /></div>
            <button onClick={() => unlinkOpportunity(o.id)} title="Unlink" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '13px', padding: '0 4px' }}>×</button>
          </div>
        ))}
      </SidebarSection>
      <SidebarSection title="Owner & Approvers">
        <PropertyRow label="Owner" value={rfp.owner} />
        <PropertyRow label="Approvers" value={rfp.approvers?.length ? rfp.approvers.map((a: any) => a.name || a.email).join(', ') : null} />
      </SidebarSection>
    </div>
  )

  return (
    <>
      <RecordLayout leftColumn={leftColumn} rightColumn={rightColumn} />
      {showEdit && <RFPModal rfp={rfp} onClose={() => setShowEdit(false)} onSave={() => { setShowEdit(false); load() }} />}
      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#DC2626' }}>Delete RFP</h2>
              <button onClick={() => setShowDelete(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: '#3F3F3F', marginBottom: '8px' }}>
                You are about to permanently delete <strong>{rfp.name}</strong>. This action cannot be undone.
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
                {deleting ? 'Deleting...' : 'Delete RFP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
