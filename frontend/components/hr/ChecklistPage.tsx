'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { HRLayout, useHRPerm } from '@/components/HRLayout'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn } from '@/components/it/ReportBuilder'
import { hrChecklistAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const KIND_META: Record<string, { title: string; icon: string; verb: string }> = {
  onboarding: { title: 'Onboarding', icon: '🎒', verb: 'Onboard' },
  offboarding: { title: 'Offboarding', icon: '📤', verb: 'Offboard' },
}

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}
const btn: React.CSSProperties = { padding: '7px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }

const CASE_COLUMNS: ReportColumn[] = [
  { key: 'user_display', label: 'Person', filterable: 'text' },
  { key: 'location_name', label: 'Location', filterable: 'text' },
  { key: 'started_by_email', label: 'Started By', filterable: 'text' },
  { key: 'created_at', label: 'Started' },
  { key: 'tasks_open', label: 'Tasks Open' },
]

function EditableCell({ display, editing, canEdit, onStartEdit, children }: any) {
  return editing ? children : (
    <div onClick={() => canEdit && onStartEdit()} title={canEdit ? 'Click to edit' : undefined}
      style={{ fontSize: '12px', color: '#3F3F3F', cursor: canEdit ? 'pointer' : 'default', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px' }}
      onMouseEnter={e => canEdit && (e.currentTarget.style.background = '#F1F5F9')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {display || <span style={{ color: '#94A3B8' }}>—</span>}
    </div>
  )
}

function fmtDateTime(d: string) {
  return d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

function NewTaskModal({ locationId, locationName, kind, users, onClose, onSave }: any) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [sharepointUrl, setSharepointUrl] = useState('')
  const [responsibleEmail, setResponsibleEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const valid = title.trim().length > 0

  const submit = async () => {
    if (!valid) return
    setSaving(true)
    const u = users.find((u: any) => u.email === responsibleEmail)
    const me = getStoredUser()
    await onSave({
      kind, location_id: locationId, location_name: locationName,
      title: title.trim(), description, url, sharepoint_url: sharepointUrl,
      responsible_email: responsibleEmail, responsible_name: u?.display_name || (u ? `${u.first_name} ${u.last_name}` : ''),
      created_by_email: me?.email || '',
    })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>New Task for {locationName}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Title *</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '70px', resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>URL</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>SharePoint Document Link</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder="https://wcomply.sharepoint.com/…" value={sharepointUrl} onChange={e => setSharepointUrl(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Responsible Person</label>
            <select style={{ ...inp, width: '100%' }} value={responsibleEmail} onChange={e => setResponsibleEmail(e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
            <button onClick={submit} disabled={saving || !valid} style={{ padding: '9px 18px', background: saving || !valid ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              {saving ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChecklistContent({ kind }: { kind: 'onboarding' | 'offboarding' }) {
  const router = useRouter()
  const meta = KIND_META[kind]
  const { level, canEdit } = useHRPerm(kind)
  const [tab, setTab] = useState<'templates' | 'start' | 'history'>('templates')
  const [locations, setLocations] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [locationId, setLocationId] = useState('')
  const [templateTasks, setTemplateTasks] = useState<any[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [showNewTask, setShowNewTask] = useState(false)
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null)

  // Start-case state
  const [startUserEmail, setStartUserEmail] = useState('')
  const [startLocationId, setStartLocationId] = useState('')
  const [startTasks, setStartTasks] = useState<any[]>([])
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const [startWarning, setStartWarning] = useState('')

  const [cases, setCases] = useState<any[]>([])
  const [loadingCases, setLoadingCases] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  const rb = useReportBuilder(`hr_${kind}_cases`, CASE_COLUMNS, userEmail)

  useEffect(() => {
    fetch(`${API}/legal/locations`).then(r => r.json()).then(d => setLocations(d.locations || [])).catch(() => {})
    fetch(`${API}/settings/users`).then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  useEffect(() => {
    if (!locationId) { setTemplateTasks([]); return }
    loadTemplateTasks(locationId)
  }, [locationId])

  useEffect(() => {
    if (tab === 'history') loadCases()
  }, [tab])

  const loadTemplateTasks = async (locId: string) => {
    setLoadingTasks(true)
    try {
      const d = await hrChecklistAPI.listTasks({ kind, location_id: locId })
      setTemplateTasks(d.tasks || [])
    } catch (e) { console.error(e) }
    finally { setLoadingTasks(false) }
  }

  const loadCases = async () => {
    setLoadingCases(true)
    try {
      const d = await hrChecklistAPI.listCases({ kind })
      setCases(d.cases || [])
    } catch (e) { console.error(e) }
    finally { setLoadingCases(false) }
  }

  const createTemplateTask = async (payload: any) => {
    await hrChecklistAPI.createTask(payload)
    setShowNewTask(false)
    loadTemplateTasks(locationId)
  }

  const patchTemplateTask = async (t: any, fields: any) => {
    await hrChecklistAPI.updateTask(t.id, fields)
    setEditing(null)
    loadTemplateTasks(locationId)
  }

  const deleteTemplateTask = async (t: any) => {
    if (!confirm(`Delete task "${t.title}"?`)) return
    await hrChecklistAPI.deleteTask(t.id)
    loadTemplateTasks(locationId)
  }

  const isEditing = (id: string, field: string) => editing?.id === id && editing.field === field

  // ─── Start case ───────────────────────────────────────────────────────────
  const pickStartUser = async (email: string) => {
    setStartUserEmail(email)
    setStartTasks([]); setOverrides({}); setStartError(''); setStartWarning('')
    if (!email) { setStartLocationId(''); return }
    try {
      const loc = await fetch(`${API}/settings/main-location/${encodeURIComponent(email)}`).then(r => r.json())
      setStartLocationId(loc.main_location_id || '')
      if (loc.main_location_id) {
        const d = await hrChecklistAPI.listTasks({ kind, location_id: loc.main_location_id })
        setStartTasks(d.tasks || [])
      }
    } catch (e) { console.error(e) }
  }

  const changeStartLocation = async (locId: string) => {
    setStartLocationId(locId)
    setOverrides({})
    if (!locId) { setStartTasks([]); return }
    const d = await hrChecklistAPI.listTasks({ kind, location_id: locId })
    setStartTasks(d.tasks || [])
  }

  const launchCase = async () => {
    if (!startUserEmail) { setStartError('Select a person first'); return }
    if (!startLocationId) { setStartError('Select a location first'); return }
    setStarting(true); setStartError(''); setStartWarning('')
    try {
      const su = users.find((u: any) => u.email === startUserEmail)
      const me = getStoredUser()
      const overridePayload: Record<string, any> = {}
      for (const t of startTasks) {
        const overrideEmail = overrides[t.id]
        if (overrideEmail) {
          const ou = users.find((u: any) => u.email === overrideEmail)
          overridePayload[t.id] = { assignee_email: overrideEmail, assignee_name: ou?.display_name || (ou ? `${ou.first_name} ${ou.last_name}` : '') }
        }
      }
      const loc = locations.find((l: any) => l.id === startLocationId)
      const r = await hrChecklistAPI.startCase({
        kind, user_email: startUserEmail, user_name: su?.display_name || (su ? `${su.first_name} ${su.last_name}` : ''),
        location_id: startLocationId, location_name: loc?.location_name || '',
        started_by_email: me?.email || '', overrides: overridePayload,
      })
      if (r.warnings?.length) setStartWarning(r.warnings.join('; '))
      router.push(`/rh/checklist-cases/${r.id}`)
    } catch (e: any) { setStartError(e.message) }
    finally { setStarting(false) }
  }

  if (level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
      <p style={{ fontSize: '13px' }}>You don't have permission to access {meta.title}. Ask HR to grant it via WHUBBI Permissions.</p>
    </div>
  )

  const withDisplay = cases.map(c => ({ ...c, user_display: c.user_name || c.user_email }))
  const reportedCases = applyReport(withDisplay, CASE_COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>{meta.icon} {meta.title}</h1>
        <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>Per-location task checklists, turned into real tasks when someone is {kind === 'onboarding' ? 'onboarded' : 'offboarded'}.</p>
      </div>

      <div style={{ display: 'flex', gap: '3px', marginBottom: '20px', background: 'white', padding: '4px', borderRadius: '10px', border: '1px solid #EDF2F7', width: 'fit-content' }}>
        {[{ id: 'templates', label: 'Checklist Tasks' }, { id: 'start', label: `${meta.verb} Someone` }, { id: 'history', label: 'History' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', background: tab === t.id ? '#156082' : 'transparent', color: tab === t.id ? 'white' : '#45B6E4', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'templates' && (
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'center' }}>
            <select style={{ ...inp, width: '240px' }} value={locationId} onChange={e => setLocationId(e.target.value)}>
              <option value="">Select a location…</option>
              {locations.map((l: any) => <option key={l.id} value={l.id}>{l.location_name}</option>)}
            </select>
            {canEdit && locationId && (
              <button onClick={() => setShowNewTask(true)} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
                + New Task
              </button>
            )}
          </div>

          {!locationId ? (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '48px', textAlign: 'center', color: '#94A3B8' }}>Select a location to see or build its {kind} checklist.</div>
          ) : (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflowX: 'auto', overflowY: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', maxWidth: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ background: '#FAFBFC' }}>
                  <tr>
                    {['Title', 'Description', 'URL', 'SharePoint Doc', 'Responsible', canEdit ? '' : null].filter(x => x !== null).map(h => (
                      <th key={h as string} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingTasks ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#45B6E4' }}>Loading…</td></tr>
                  ) : templateTasks.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>No {kind} tasks configured for this location yet.</td></tr>
                  ) : templateTasks.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', minWidth: '160px', fontWeight: '700', color: '#156082' }}>
                        <EditableCell display={t.title} editing={isEditing(t.id, 'title')} canEdit={canEdit} onStartEdit={() => setEditing({ id: t.id, field: 'title' })}>
                          <input autoFocus style={inp} defaultValue={t.title} onBlur={e => patchTemplateTask(t, { title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                        </EditableCell>
                      </td>
                      <td style={{ padding: '10px 12px', minWidth: '200px', color: '#64748B' }}>
                        <EditableCell display={t.description} editing={isEditing(t.id, 'description')} canEdit={canEdit} onStartEdit={() => setEditing({ id: t.id, field: 'description' })}>
                          <textarea autoFocus style={{ ...inp, width: '100%', minWidth: '200px', boxSizing: 'border-box' as const, minHeight: '50px', resize: 'vertical' }} defaultValue={t.description} onBlur={e => patchTemplateTask(t, { description: e.target.value })} />
                        </EditableCell>
                      </td>
                      <td style={{ padding: '10px 12px', minWidth: '120px' }}>
                        <EditableCell display={t.url ? <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6' }} onClick={e => e.stopPropagation()}>🔗 Link</a> : null}
                          editing={isEditing(t.id, 'url')} canEdit={canEdit} onStartEdit={() => setEditing({ id: t.id, field: 'url' })}>
                          <input autoFocus style={inp} defaultValue={t.url} onBlur={e => patchTemplateTask(t, { url: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                        </EditableCell>
                      </td>
                      <td style={{ padding: '10px 12px', minWidth: '140px' }}>
                        <EditableCell display={t.sharepoint_url ? <a href={t.sharepoint_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6' }} onClick={e => e.stopPropagation()}>📄 Document</a> : null}
                          editing={isEditing(t.id, 'sharepoint_url')} canEdit={canEdit} onStartEdit={() => setEditing({ id: t.id, field: 'sharepoint_url' })}>
                          <input autoFocus style={inp} defaultValue={t.sharepoint_url} onBlur={e => patchTemplateTask(t, { sharepoint_url: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                        </EditableCell>
                      </td>
                      <td style={{ padding: '10px 12px', minWidth: '160px' }}>
                        <EditableCell display={t.responsible_name || t.responsible_email} editing={isEditing(t.id, 'responsible')} canEdit={canEdit} onStartEdit={() => setEditing({ id: t.id, field: 'responsible' })}>
                          <select autoFocus style={inp} defaultValue={t.responsible_email || ''}
                            onChange={e => {
                              const email = e.target.value
                              const u = users.find((u: any) => u.email === email)
                              patchTemplateTask(t, { responsible_email: email, responsible_name: u?.display_name || (u ? `${u.first_name} ${u.last_name}` : '') })
                            }}
                            onBlur={() => setEditing(null)}>
                            <option value="">Unassigned</option>
                            {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
                          </select>
                        </EditableCell>
                      </td>
                      {canEdit && (
                        <td style={{ padding: '10px 12px' }}>
                          <button onClick={() => deleteTemplateTask(t)} style={{ padding: '5px 10px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#EF4444', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Delete</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'start' && (
        <div style={{ maxWidth: '760px' }}>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '4px' }}>
              <div>
                <label style={lbl}>Person</label>
                <select style={{ ...inp, width: '100%' }} value={startUserEmail} onChange={e => pickStartUser(e.target.value)}>
                  <option value="">Select a person…</option>
                  {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Location</label>
                <select style={{ ...inp, width: '100%' }} value={startLocationId} onChange={e => changeStartLocation(e.target.value)} disabled={!startUserEmail}>
                  <option value="">{startUserEmail ? 'No main location set — pick one' : 'Select a person first'}</option>
                  {locations.map((l: any) => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                </select>
              </div>
            </div>
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>The location defaults to the person's main location (set on WHUBBI Permissions), but can be changed here.</p>
          </div>

          {startUserEmail && startLocationId && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ ...lbl, marginBottom: '10px' }}>Tasks to be created ({startTasks.length})</div>
              {startTasks.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No {kind} tasks configured for this location — add some under "Checklist Tasks" first.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {startTasks.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#156082' }}>{t.title}</div>
                        {t.description && <div style={{ fontSize: '10px', color: '#94A3B8' }}>{t.description}</div>}
                      </div>
                      <select style={{ ...inp, width: '220px' }} value={overrides[t.id] || t.responsible_email || ''} onChange={e => setOverrides(o => ({ ...o, [t.id]: e.target.value }))}>
                        <option value="">Unassigned</option>
                        {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              {startError && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '10px' }}>{startError}</div>}
              {startWarning && <div style={{ background: '#FFF7ED', color: '#D97706', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '10px' }}>{startWarning}</div>}
              <button onClick={launchCase} disabled={starting || startTasks.length === 0} style={{ ...btn, padding: '10px 20px', background: starting ? '#94A3B8' : '#156082', color: 'white' }}>
                {starting ? 'Launching…' : `${meta.verb} This Person`}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
            <ReportPanel columns={CASE_COLUMNS} rb={rb} />
          </div>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflowX: 'auto', overflowY: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', maxWidth: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ background: '#FAFBFC' }}>
                <tr>
                  {CASE_COLUMNS.filter(c => isVisible(c.key)).map(c => (
                    <th key={c.key} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingCases ? (
                  <tr><td colSpan={CASE_COLUMNS.length} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
                ) : reportedCases.length === 0 ? (
                  <tr><td colSpan={CASE_COLUMNS.length} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No {kind} cases yet.</td></tr>
                ) : reportedCases.map(c => (
                  <tr key={c.id} onClick={() => router.push(`/rh/checklist-cases/${c.id}`)} style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {isVisible('user_display') && <td style={{ padding: '10px 12px', fontWeight: '700', color: '#156082' }}>{c.user_display}</td>}
                    {isVisible('location_name') && <td style={{ padding: '10px 12px', color: '#3F3F3F' }}>{c.location_name || '—'}</td>}
                    {isVisible('started_by_email') && <td style={{ padding: '10px 12px', color: '#64748B' }}>{c.started_by_email || '—'}</td>}
                    {isVisible('created_at') && <td style={{ padding: '10px 12px', color: '#64748B' }}>{fmtDateTime(c.created_at)}</td>}
                    {isVisible('tasks_open') && <td style={{ padding: '10px 12px', color: '#64748B' }}>{c.tasks_open > 0 ? `${c.tasks_open}/${c.tasks_total} open` : `${c.tasks_total} done`}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNewTask && (
        <NewTaskModal locationId={locationId} locationName={locations.find((l: any) => l.id === locationId)?.location_name || ''} kind={kind} users={users}
          onClose={() => setShowNewTask(false)} onSave={createTemplateTask} />
      )}
    </div>
  )
}

export default function ChecklistPage({ kind }: { kind: 'onboarding' | 'offboarding' }) {
  return <HRLayout><ChecklistContent kind={kind} /></HRLayout>
}
