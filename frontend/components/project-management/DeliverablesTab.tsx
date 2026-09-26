'use client'
import { Fragment, useEffect, useState } from 'react'
import { pmAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { Card, Table, TD, DEL_BTN, LINK_BTN, Modal, Field, ErrorBanner, useAction, fmtDate, toInput, fromInput, Badge, statusTone, PeopleEditor, Person, TabProps } from './shared'

const VERSION_LABEL: Record<string, string> = { draft: 'Draft', in_approval: 'In approval', approved: 'Approved', rejected: 'Rejected' }
const people = (ps?: Person[]) => (ps || []).map(p => p.name).join(', ') || '—'

export function DeliverablesTab({ projectId, canEdit }: TabProps) {
  const me = (getStoredUser()?.email || '').toLowerCase()
  const [items, setItems] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [editing, setEditing] = useState<any>(null)
  const [version, setVersion] = useState<any>(null)  // { deliverable, ...version fields }
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [comments, setComments] = useState<Record<string, string>>({})
  const { busy, error, run } = useAction()

  const load = () => pmAPI.deliverables.list(projectId).then(setItems).catch(() => {})
  useEffect(() => { load(); pmAPI.members.list(projectId).then(setMembers).catch(() => {}) }, [projectId])
  const replace = (d: any) => setItems(xs => xs.map(x => x.id === d.id ? d : x))

  const save = () => run(async () => {
    const { id, number, versions, ...body } = editing
    if (id) replace(await pmAPI.deliverables.update(projectId, id, body))
    else { await pmAPI.deliverables.create(projectId, body); load() }
    setEditing(null)
  })
  const remove = (d: any) => confirm(`Delete deliverable ${d.number} "${d.name}" and all its versions?`) && run(async () => { await pmAPI.deliverables.remove(projectId, d.id); load() })
  const saveVersion = () => run(async () => {
    const { deliverable, id, ...body } = version
    const payload = { version_label: body.version_label, due_date: fromInput(body.due_date), document_url: body.document_url || null, notes: body.notes || null }
    replace(id ? await pmAPI.updateVersion(projectId, deliverable.id, id, payload) : await pmAPI.addVersion(projectId, deliverable.id, payload))
    setOpen(o => new Set(o).add(deliverable.id))
    setVersion(null)
  })
  const submit = (d: any, v: any) => run(async () => replace(await pmAPI.submitVersion(projectId, d.id, v.id)))
  const removeVersion = (d: any, v: any) => confirm(`Delete version ${v.version_label}?`) && run(async () => replace(await pmAPI.deleteVersion(projectId, d.id, v.id)))
  const decide = (d: any, v: any, approve: boolean) => run(async () => { replace(await pmAPI.decideVersion(projectId, d.id, v.id, approve, comments[v.id])); setComments(c => ({ ...c, [v.id]: '' })) })

  return (
    <Card title="Project deliverables" action={canEdit && <button className="btn-primary" onClick={() => setEditing({ name: '', description: '', owner: null, approvers: [], contributors: [], document_url: '' })}>+ Deliverable</button>}>
      <ErrorBanner error={editing || version ? '' : error} />
      <Table headers={['ID', 'Deliverable', 'Owner', 'Approvers', 'Contributors', 'Latest version', 'Document', '']} empty={items.length === 0}>
        {items.map(d => {
          const latest = d.versions[d.versions.length - 1]
          const expanded = open.has(d.id)
          return (
            <Fragment key={d.id}>
              <tr>
                <td style={{ ...TD, fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>
                  <button aria-label={expanded ? 'Hide versions' : 'Show versions'} style={{ ...LINK_BTN, color: '#64748B', marginRight: '6px' }} onClick={() => setOpen(o => { const n = new Set(o); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n })}>{expanded ? '▾' : '▸'}</button>
                  {d.number}
                </td>
                <td style={{ ...TD, fontWeight: 600, minWidth: '200px' }}>
                  {canEdit ? <button style={{ ...LINK_BTN, color: '#144766', textAlign: 'left' }} onClick={() => setEditing({ ...d })}>{d.name}</button> : d.name}
                  {d.description && <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 400 }}>{d.description}</div>}
                </td>
                <td style={TD}>{d.owner?.name || '—'}</td>
                <td style={TD}>{people(d.approvers)}</td>
                <td style={TD}>{people(d.contributors)}</td>
                <td style={TD}>{latest ? <>{latest.version_label} <Badge value={VERSION_LABEL[latest.status]} tone={statusTone(latest.status)} /></> : '—'}</td>
                <td style={TD}>{d.document_url ? <a href={d.document_url} target="_blank" rel="noopener noreferrer" style={{ color: '#219BD6' }}>🔗 Open</a> : '—'}</td>
                <td style={TD}>{canEdit && <button aria-label={`Delete ${d.number}`} style={DEL_BTN} onClick={() => remove(d)}>×</button>}</td>
              </tr>
              {expanded && (
                <tr><td colSpan={8} style={{ ...TD, background: '#FAFBFC', padding: '12px 16px 12px 40px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <b style={{ fontSize: '12px', color: '#156082' }}>Versions</b>
                    {canEdit && <button style={LINK_BTN} onClick={() => setVersion({ deliverable: d, version_label: '', due_date: '', document_url: '', notes: '' })}>+ New version</button>}
                  </div>
                  {d.versions.length === 0 ? <div style={{ fontSize: '12px', color: '#9B9B9B' }}>No versions yet.</div> : d.versions.slice().reverse().map((v: any) => {
                    const mine = v.status === 'in_approval' && v.approvals.find((a: any) => a.approver_email === me && a.decision === 'pending')
                    return (
                      <div key={v.id} style={{ border: '1px solid #EDF2F7', background: 'white', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', fontSize: '12px' }}>
                          <b>{v.version_label}</b>
                          <Badge value={VERSION_LABEL[v.status]} tone={statusTone(v.status)} />
                          <span>Due {fmtDate(v.due_date)}</span>
                          {v.document_url && <a href={v.document_url} target="_blank" rel="noopener noreferrer" style={{ color: '#219BD6' }}>🔗 Document</a>}
                          {v.approved_at && <span style={{ color: '#059669' }}>Approved {fmtDate(v.approved_at)}</span>}
                          <span style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                            {canEdit && (v.status === 'draft' || v.status === 'rejected') && <>
                              <button style={LINK_BTN} onClick={() => setVersion({ deliverable: d, ...v, due_date: toInput(v.due_date) })}>Edit</button>
                              <button style={LINK_BTN} onClick={() => submit(d, v)}>Submit for approval</button>
                            </>}
                            {canEdit && v.status !== 'approved' && <button aria-label={`Delete version ${v.version_label}`} style={DEL_BTN} onClick={() => removeVersion(d, v)}>×</button>}
                          </span>
                        </div>
                        {v.notes && <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>{v.notes}</div>}
                        {v.approvals.length > 0 && (
                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '6px', fontSize: '11px' }}>
                            {v.approvals.map((a: any) => (
                              <span key={a.id} title={a.comment || ''}>{a.approver_name || a.approver_email}: <Badge value={a.decision} tone={statusTone(a.decision === 'pending' ? 'in_approval' : a.decision)} />{a.decided_at ? ` ${fmtDate(a.decided_at)}` : ''}{a.comment ? ` — “${a.comment}”` : ''}</span>
                            ))}
                          </div>
                        )}
                        {mine && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <input className="form-input" placeholder="Comment (required when rejecting)" value={comments[v.id] || ''} onChange={e => setComments(c => ({ ...c, [v.id]: e.target.value }))} />
                            <button className="btn-primary" onClick={() => decide(d, v, true)} disabled={busy}>Approve</button>
                            <button className="btn-secondary" onClick={() => decide(d, v, false)} disabled={busy || !(comments[v.id] || '').trim()}>Reject</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </td></tr>
              )}
            </Fragment>
          )
        })}
      </Table>

      {editing && (
        <Modal title={editing.id ? `${editing.number} — edit deliverable` : 'New deliverable'} onClose={() => setEditing(null)} onSave={save} saving={busy} width={720}>
          <div style={{ gridColumn: '1 / -1' }}><ErrorBanner error={error} /></div>
          <Field label="Name *" full><input className="form-input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="Description" full><textarea className="form-input" rows={2} value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} /></Field>
          <Field label="Document owner" full>
            <PeopleEditor value={editing.owner ? [editing.owner] : []} onChange={v => setEditing({ ...editing, owner: v[v.length - 1] || null })} members={members} placeholder="Owner name" />
          </Field>
          <Field label="Approvers (need an email to approve)" full><PeopleEditor value={editing.approvers} onChange={v => setEditing({ ...editing, approvers: v })} members={members} /></Field>
          <Field label="Contributors" full><PeopleEditor value={editing.contributors} onChange={v => setEditing({ ...editing, contributors: v })} members={members} /></Field>
          <Field label="Link to the latest version" full><input className="form-input" placeholder="https://…" value={editing.document_url || ''} onChange={e => setEditing({ ...editing, document_url: e.target.value })} /></Field>
        </Modal>
      )}
      {version && (
        <Modal title={`${version.deliverable.number} — ${version.id ? 'edit version' : 'new version'}`} onClose={() => setVersion(null)} onSave={saveVersion} saving={busy}>
          <div style={{ gridColumn: '1 / -1' }}><ErrorBanner error={error} /></div>
          <Field label="Version *"><input className="form-input" placeholder="e.g. v1.0" value={version.version_label} onChange={e => setVersion({ ...version, version_label: e.target.value })} /></Field>
          <Field label="Due date"><input type="date" className="form-input" value={version.due_date || ''} onChange={e => setVersion({ ...version, due_date: e.target.value })} /></Field>
          <Field label="Document link" full><input className="form-input" placeholder="https://…" value={version.document_url || ''} onChange={e => setVersion({ ...version, document_url: e.target.value })} /></Field>
          <Field label="Notes" full><textarea className="form-input" rows={2} value={version.notes || ''} onChange={e => setVersion({ ...version, notes: e.target.value })} /></Field>
        </Modal>
      )}
    </Card>
  )
}
