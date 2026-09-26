'use client'
import { useEffect, useState } from 'react'
import { pmAPI } from '@/lib/api'
import { Card, Table, TD, DEL_BTN, LINK_BTN, Modal, Field, ErrorBanner, useAction, Badge } from './shared'

export const SECTIONS: { key: string; label: string }[] = [
  { key: 'basic_info', label: 'Basic Information' }, { key: 'members', label: 'Members' }, { key: 'planning', label: 'Planning' },
  { key: 'tasks', label: 'Tasks' }, { key: 'meetings', label: 'Meetings' }, { key: 'actions', label: 'Action List' },
  { key: 'decisions', label: 'Decision Register' }, { key: 'risks', label: 'Risk Management' }, { key: 'deliverables', label: 'Deliverables' },
]
const EMPTY = { name: '', email: '', phone: '', project_role: '', company_role: '', permissions: Object.fromEntries(SECTIONS.map(s => [s.key, 'view'])) as Record<string, string> }

export function MembersTab({ projectId, isManager }: { projectId: string; isManager: boolean }) {
  const [members, setMembers] = useState<any[]>([])
  const [editing, setEditing] = useState<any>(null)
  const { busy, error, run } = useAction()

  const load = () => pmAPI.members.list(projectId).then(setMembers).catch(() => {})
  useEffect(() => { load() }, [projectId])

  const save = () => run(async () => {
    const { id, ...body } = editing
    if (id) await pmAPI.members.update(projectId, id, body)
    else await pmAPI.members.create(projectId, body)
    setEditing(null); load()
  })
  const remove = (m: any) => confirm(`Remove ${m.name} from the project?`) && run(async () => { await pmAPI.members.remove(projectId, m.id); load() })
  const setAll = (level: string) => setEditing({ ...editing, permissions: Object.fromEntries(SECTIONS.map(s => [s.key, s.key === 'members' && level === 'edit' ? 'view' : level])) })

  return (
    <Card title="Project members" action={isManager && <button className="btn-primary" onClick={() => setEditing({ ...EMPTY, permissions: { ...EMPTY.permissions } })}>+ Member</button>}>
      <ErrorBanner error={editing ? '' : error} />
      {!isManager && <p style={{ fontSize: '11px', color: '#64748B', marginTop: 0 }}>Only project managers can add members or change their authorisations.</p>}
      <Table headers={['Name', 'Email', 'Phone', 'Project role', 'Company role', 'Authorisations', '']} empty={members.length === 0}>
        {members.map(m => (
          <tr key={m.id}>
            <td style={{ ...TD, fontWeight: 600 }}>{isManager ? <button style={LINK_BTN} onClick={() => setEditing({ ...m })}>{m.name}</button> : m.name}</td>
            <td style={TD}><a href={`mailto:${m.email}`} style={{ color: '#219BD6' }}>{m.email}</a></td>
            <td style={TD}>{m.phone || '—'}</td>
            <td style={TD}>{m.project_role || '—'}</td>
            <td style={TD}>{m.company_role || '—'}</td>
            <td style={{ ...TD, maxWidth: '320px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {SECTIONS.filter(s => (m.permissions?.[s.key] || 'none') !== 'none').map(s => (
                  <Badge key={s.key} value={`${s.label}${m.permissions[s.key] === 'edit' ? ' ✎' : ''}`} tone={m.permissions[s.key] === 'edit' ? 'blue' : 'grey'} />
                ))}
              </div>
            </td>
            <td style={TD}>{isManager && <button aria-label={`Remove ${m.name}`} style={DEL_BTN} onClick={() => remove(m)}>×</button>}</td>
          </tr>
        ))}
      </Table>

      {editing && (
        <Modal title={editing.id ? 'Edit member' : 'New member'} onClose={() => setEditing(null)} onSave={save} saving={busy} width={720}>
          <div style={{ gridColumn: '1 / -1' }}><ErrorBanner error={error} /></div>
          <Field label="Name *"><input className="form-input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="Email *"><input className="form-input" type="email" value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} /></Field>
          <Field label="Phone"><input className="form-input" value={editing.phone || ''} onChange={e => setEditing({ ...editing, phone: e.target.value })} /></Field>
          <Field label="Project role"><input className="form-input" placeholder="e.g. Project Manager, Key User" value={editing.project_role || ''} onChange={e => setEditing({ ...editing, project_role: e.target.value })} /></Field>
          <Field label="Company role" full><input className="form-input" placeholder="e.g. CFO, IT Director" value={editing.company_role || ''} onChange={e => setEditing({ ...editing, company_role: e.target.value })} /></Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="form-label">Authorisations on this project</span>
              <span style={{ fontSize: '11px', display: 'flex', gap: '10px' }}>
                Set all: <button style={LINK_BTN} onClick={() => setAll('none')}>None</button><button style={LINK_BTN} onClick={() => setAll('view')}>View</button><button style={LINK_BTN} onClick={() => setAll('edit')}>Edit</button>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 16px', marginTop: '6px' }}>
              {SECTIONS.map(s => (
                <label key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', gap: '8px' }}>
                  {s.label}
                  <select className="form-input" style={{ width: '90px', padding: '4px 6px' }} value={editing.permissions?.[s.key] || 'none'}
                    onChange={e => setEditing({ ...editing, permissions: { ...editing.permissions, [s.key]: e.target.value } })}>
                    <option value="none">None</option><option value="view">View</option>
                    {s.key !== 'members' && <option value="edit">Edit</option>}
                  </select>
                </label>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: '#94A3B8', marginBottom: 0 }}>The member also needs access to Operations › Project Management in WHUBBI permissions.</p>
          </div>
        </Modal>
      )}
    </Card>
  )
}
