'use client'
// One component for every numbered list on a project — Tasks, Action List, Risk Register,
// Decision Register — configured by a field list, so they share add/update/delete,
// filtering and meeting links instead of four copies of the same table + modal.
import { useEffect, useState } from 'react'
import { pmAPI } from '@/lib/api'
import { Card, Table, TD, DEL_BTN, LINK_BTN, Modal, Field, ErrorBanner, useAction, fmtDate, toInput, fromInput, Badge, statusTone, MeetingPicker, MeetingRefs, TabProps } from './shared'

type FieldDef = {
  key: string; label: string
  type: 'text' | 'textarea' | 'date' | 'select' | 'names' | 'progress'
  options?: { value: string; label: string }[]
  inTable?: boolean; full?: boolean; required?: boolean; badge?: boolean
}
type Crud = { list: (p: string) => Promise<any>; create: (p: string, d: any) => Promise<any>; update: (p: string, id: string, d: any) => Promise<any>; remove: (p: string, id: string) => Promise<any> }

const opts = (xs: string[]) => xs.map(x => ({ value: x, label: x }))

function RegisterTab({ projectId, canEdit, title, singular, api, fields, defaults, linkMeetings, filterKey }: {
  projectId: string; canEdit: boolean; title: string; singular: string; api: Crud; fields: FieldDef[]
  defaults: Record<string, any>; linkMeetings: boolean; filterKey?: string
}) {
  const [items, setItems] = useState<any[]>([])
  const [meetings, setMeetings] = useState<any[]>([])
  const [editing, setEditing] = useState<any>(null)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const { busy, error, run } = useAction()

  const load = () => api.list(projectId).then(setItems).catch(() => {})
  useEffect(() => {
    load()
    if (linkMeetings) pmAPI.meetings.list(projectId).then(setMeetings).catch(() => {})
  }, [projectId])

  const openEdit = (item?: any) => {
    const base = item ? { ...item } : { ...defaults, meeting_ids: [] }
    fields.filter(f => f.type === 'date').forEach(f => { base[f.key] = toInput(base[f.key]) })
    fields.filter(f => f.type === 'names').forEach(f => { base[f.key] = (base[f.key] || []).join(', ') })
    setEditing(base)
  }
  const save = () => run(async () => {
    const { id, number, ...body } = editing
    fields.forEach(f => {
      if (f.type === 'date') body[f.key] = fromInput(body[f.key])
      if (f.type === 'names') body[f.key] = String(body[f.key] || '').split(',').map(s => s.trim()).filter(Boolean)
      if (f.type === 'progress') body[f.key] = Number(body[f.key]) || 0
      if (f.type === 'select' && body[f.key] === '') body[f.key] = null
    })
    if (!linkMeetings) delete body.meeting_ids
    if (id) await api.update(projectId, id, body)
    else await api.create(projectId, body)
    setEditing(null); load()
  })
  const remove = (item: any) => confirm(`Delete ${item.number} "${item.title}"?`) && run(async () => { await api.remove(projectId, item.id); load() })

  const filterField = fields.find(f => f.key === filterKey)
  const shown = items
    .filter(i => !filter || i[filterKey!] === filter)
    .filter(i => !search.trim() || `${i.number} ${i.title} ${i.description || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const tableFields = fields.filter(f => f.inTable)

  const cell = (f: FieldDef, item: any) => {
    const v = item[f.key]
    if (f.type === 'date') return fmtDate(v)
    if (f.type === 'names') return (v || []).join(', ') || '—'
    if (f.type === 'progress') return `${v ?? 0}%`
    if (f.type === 'select' && f.options) {
      const label = f.options.find(o => o.value === v)?.label ?? v
      return label ? (f.badge ? <Badge value={label} tone={statusTone(v)} /> : label) : '—'
    }
    return v || '—'
  }

  return (
    <Card title={title} action={
      <div style={{ display: 'flex', gap: '8px' }}>
        <input className="form-input" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: '180px' }} />
        {filterField && (
          <select className="form-input" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: '150px' }} aria-label={`Filter by ${filterField.label}`}>
            <option value="">All {filterField.label.toLowerCase()}</option>
            {filterField.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        {canEdit && <button className="btn-primary" onClick={() => openEdit()}>+ {singular}</button>}
      </div>
    }>
      <ErrorBanner error={editing ? '' : error} />
      <Table headers={['#', ...tableFields.map(f => f.label), ...(linkMeetings ? ['Meetings'] : []), '']} empty={shown.length === 0}>
        {shown.map(item => (
          <tr key={item.id}>
            <td style={{ ...TD, fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>{item.number}</td>
            {tableFields.map(f => (
              <td key={f.key} style={{ ...TD, ...(f.key === 'title' ? { fontWeight: 600, minWidth: '200px' } : {}) }}>
                {f.key === 'title' && canEdit ? <button style={{ ...LINK_BTN, color: '#144766', textAlign: 'left' }} onClick={() => openEdit(item)}>{item.title}</button> : cell(f, item)}
                {f.key === 'title' && item.description && <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 400, marginTop: '2px', whiteSpace: 'pre-wrap' }}>{item.description}</div>}
              </td>
            ))}
            {linkMeetings && <td style={TD}><MeetingRefs ids={item.meeting_ids} meetings={meetings} /></td>}
            <td style={TD}>{canEdit && <button aria-label={`Delete ${item.number}`} style={DEL_BTN} onClick={() => remove(item)}>×</button>}</td>
          </tr>
        ))}
      </Table>

      {editing && (
        <Modal title={editing.id ? `${editing.number} — edit ${singular.toLowerCase()}` : `New ${singular.toLowerCase()}`} onClose={() => setEditing(null)} onSave={save} saving={busy}>
          <div style={{ gridColumn: '1 / -1' }}><ErrorBanner error={error} /></div>
          {fields.map(f => (
            <Field key={f.key} label={`${f.label}${f.required ? ' *' : ''}`} full={f.full || f.type === 'textarea'}>
              {f.type === 'textarea' ? <textarea className="form-input" rows={3} value={editing[f.key] || ''} onChange={e => setEditing({ ...editing, [f.key]: e.target.value })} />
                : f.type === 'select' ? (
                  <select className="form-input" value={editing[f.key] ?? ''} onChange={e => setEditing({ ...editing, [f.key]: e.target.value })}>
                    {!f.required && <option value="">—</option>}
                    {f.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === 'date' ? <input type="date" className="form-input" value={editing[f.key] || ''} onChange={e => setEditing({ ...editing, [f.key]: e.target.value })} />
                : f.type === 'progress' ? <input type="number" min={0} max={100} className="form-input" value={editing[f.key] ?? 0} onChange={e => setEditing({ ...editing, [f.key]: e.target.value })} />
                : <input className="form-input" placeholder={f.type === 'names' ? 'Comma-separated names' : ''} value={editing[f.key] || ''} onChange={e => setEditing({ ...editing, [f.key]: e.target.value })} />}
            </Field>
          ))}
          {linkMeetings && (
            <Field label="Linked meetings" full>
              <MeetingPicker meetings={meetings} value={editing.meeting_ids || []} onChange={v => setEditing({ ...editing, meeting_ids: v })} />
            </Field>
          )}
        </Modal>
      )}
    </Card>
  )
}

export function ActionsTab({ projectId, canEdit, settings }: TabProps) {
  const statuses = opts(settings.action_statuses)
  return <RegisterTab projectId={projectId} canEdit={canEdit} title="Action list" singular="Action" api={pmAPI.actions} linkMeetings filterKey="status"
    defaults={{ status: 'Open', opening_date: new Date().toISOString() }}
    fields={[
      { key: 'title', label: 'Title', type: 'text', inTable: true, required: true, full: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'owner', label: 'Owner', type: 'text', inTable: true },
      { key: 'status', label: 'Status', type: 'select', options: statuses, inTable: true, required: true, badge: true },
      { key: 'opening_date', label: 'Opening date', type: 'date', inTable: true },
      { key: 'due_date', label: 'Due date', type: 'date', inTable: true },
      { key: 'closing_date', label: 'Closing date', type: 'date', inTable: true },
      { key: 'comment', label: 'Comment', type: 'textarea', inTable: true },
    ]} />
}

export function RisksTab({ projectId, canEdit, settings }: TabProps) {
  const impacts = settings.impact_levels.map(l => ({ value: l.level, label: l.level }))
  const probs = settings.probability_levels.map(l => ({ value: l.level, label: l.level }))
  const mid = (xs: { value: string }[]) => xs[Math.floor(xs.length / 2)]?.value
  return <RegisterTab projectId={projectId} canEdit={canEdit} title="Risk register" singular="Risk" api={pmAPI.risks} linkMeetings filterKey="status"
    defaults={{ status: 'Open', impact: mid(impacts), probability: mid(probs) }}
    fields={[
      { key: 'title', label: 'Title', type: 'text', inTable: true, required: true, full: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'mitigation', label: 'Mitigation action', type: 'textarea', inTable: true },
      { key: 'owner', label: 'Owner', type: 'text', inTable: true },
      { key: 'impact', label: 'Impact', type: 'select', options: impacts, inTable: true, required: true, badge: true },
      { key: 'probability', label: 'Probability', type: 'select', options: probs, inTable: true, required: true, badge: true },
      { key: 'status', label: 'Status', type: 'select', options: opts(['Open', 'Closed']), inTable: true, required: true, badge: true },
    ]} />
}

export function DecisionsTab({ projectId, canEdit }: TabProps) {
  return <RegisterTab projectId={projectId} canEdit={canEdit} title="Decision register" singular="Decision" api={pmAPI.decisions} linkMeetings
    defaults={{ decision_date: new Date().toISOString(), decision_makers: [] }}
    fields={[
      { key: 'decision_date', label: 'Decision date', type: 'date', inTable: true },
      { key: 'title', label: 'Title', type: 'text', inTable: true, required: true, full: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'decision_makers', label: 'Decision makers', type: 'names', inTable: true, full: true },
    ]} />
}

export function TasksTab({ projectId, canEdit }: TabProps) {
  const [phases, setPhases] = useState<{ value: string; label: string }[] | null>(null)
  useEffect(() => {
    // Phases need 'planning' access; without it tasks simply can't be attached to one.
    pmAPI.phases.list(projectId).then((ps: any[]) => setPhases(ps.map(p => ({ value: p.id, label: p.name })))).catch(() => setPhases([]))
  }, [projectId])
  if (!phases) return null
  return <RegisterTab projectId={projectId} canEdit={canEdit} title="Project tasks" singular="Task" api={pmAPI.tasks} linkMeetings={false} filterKey="status"
    defaults={{ status: 'To Do', progress: 0 }}
    fields={[
      { key: 'title', label: 'Title', type: 'text', inTable: true, required: true, full: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'phase_id', label: 'Phase', type: 'select', options: phases, inTable: true },
      { key: 'assignee', label: 'Assignee', type: 'text', inTable: true },
      { key: 'start_date', label: 'Start', type: 'date', inTable: true },
      { key: 'due_date', label: 'Due date', type: 'date', inTable: true },
      { key: 'status', label: 'Status', type: 'select', options: opts(['To Do', 'In Progress', 'Done', 'Blocked']), inTable: true, required: true, badge: true },
      { key: 'progress', label: 'Progress (%)', type: 'progress', inTable: true },
    ]} />
}
