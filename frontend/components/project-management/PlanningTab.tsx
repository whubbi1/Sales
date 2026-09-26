'use client'
import { useEffect, useMemo, useState } from 'react'
import { pmAPI } from '@/lib/api'
import { Card, Table, TD, DEL_BTN, LINK_BTN, Modal, Field, ErrorBanner, useAction, fmtDate, toInput, fromInput, TabProps } from './shared'

const MAX_DEPTH = 10  // mirrors PHASE_MAX_DEPTH in the backend

type Phase = { id: string; parent_id: string | null; name: string; description?: string; owner?: string; start_date?: string; end_date?: string; progress?: number; position?: number }
type Row = Phase & { depth: number; wbs: string }

// Depth-first flattening with WBS numbering (1, 1.1, 1.1.1 …) for the indented tree view.
function flatten(phases: Phase[]): Row[] {
  const children = new Map<string | null, Phase[]>()
  phases.forEach(p => children.set(p.parent_id, [...(children.get(p.parent_id) || []), p]))
  const out: Row[] = []
  const walk = (parent: string | null, depth: number, prefix: string) =>
    (children.get(parent) || []).forEach((p, i) => {
      const wbs = prefix ? `${prefix}.${i + 1}` : `${i + 1}`
      out.push({ ...p, depth, wbs })
      walk(p.id, depth + 1, wbs)
    })
  walk(null, 1, '')
  return out
}

export function PlanningTab({ projectId, canEdit }: TabProps) {
  const [phases, setPhases] = useState<Phase[]>([])
  const [editing, setEditing] = useState<any>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const { busy, error, run } = useAction()

  const load = () => pmAPI.phases.list(projectId).then(setPhases).catch(() => {})
  useEffect(() => { load() }, [projectId])

  const rows = useMemo(() => flatten(phases), [phases])
  const visible = rows.filter(r => {
    let cur = phases.find(p => p.id === r.id)?.parent_id
    while (cur) { if (collapsed.has(cur)) return false; cur = phases.find(p => p.id === cur)?.parent_id ?? null }
    return true
  })
  const range = useMemo(() => {
    const ts = phases.flatMap(p => [p.start_date, p.end_date]).filter(Boolean).map(d => new Date(d!).getTime())
    return ts.length ? { min: Math.min(...ts), max: Math.max(...ts) } : null
  }, [phases])

  const save = () => run(async () => {
    const { id, ...body } = editing
    const payload = { ...body, start_date: fromInput(body.start_date), end_date: fromInput(body.end_date), progress: Number(body.progress) || 0 }
    if (id) await pmAPI.phases.update(projectId, id, payload)
    else await pmAPI.phases.create(projectId, payload)
    setEditing(null); load()
  })
  const remove = (p: Row) => confirm(`Delete "${p.name}" and all its sub-phases?`) && run(async () => { await pmAPI.phases.remove(projectId, p.id); load() })
  const hasChildren = (id: string) => phases.some(p => p.parent_id === id)

  return (
    <Card title="Project planning" action={canEdit && <button className="btn-primary" onClick={() => setEditing({ parent_id: null, name: '', progress: 0 })}>+ Phase</button>}>
      <ErrorBanner error={editing ? '' : error} />
      <Table headers={['WBS', 'Phase', 'Owner', 'Start', 'End', 'Progress', 'Timeline', '']} empty={rows.length === 0}>
        {visible.map(p => {
          const s = p.start_date ? new Date(p.start_date).getTime() : null
          const e = p.end_date ? new Date(p.end_date).getTime() : null
          const span = range ? Math.max(range.max - range.min, 1) : 1
          return (
            <tr key={p.id}>
              <td style={{ ...TD, color: '#64748B', fontWeight: 700, whiteSpace: 'nowrap' }}>{p.wbs}</td>
              <td style={{ ...TD, paddingLeft: `${12 + (p.depth - 1) * 18}px`, fontWeight: p.depth === 1 ? 700 : 500 }}>
                {hasChildren(p.id)
                  ? <button aria-label={collapsed.has(p.id) ? 'Expand' : 'Collapse'} style={{ ...LINK_BTN, color: '#64748B', marginRight: '6px' }}
                      onClick={() => setCollapsed(c => { const n = new Set(c); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })}>{collapsed.has(p.id) ? '▸' : '▾'}</button>
                  : <span style={{ display: 'inline-block', width: '16px' }} />}
                {canEdit ? <button style={{ ...LINK_BTN, color: '#144766', fontWeight: 'inherit' }} onClick={() => setEditing({ ...p, start_date: toInput(p.start_date), end_date: toInput(p.end_date) })}>{p.name}</button> : p.name}
              </td>
              <td style={TD}>{p.owner || '—'}</td>
              <td style={TD}>{fmtDate(p.start_date)}</td>
              <td style={TD}>{fmtDate(p.end_date)}</td>
              <td style={TD}>{p.progress ?? 0}%</td>
              <td style={{ ...TD, width: '220px' }}>
                {range && s && e ? (
                  <div style={{ position: 'relative', height: '10px', background: '#F1F5F9', borderRadius: '5px' }}>
                    <div style={{ position: 'absolute', left: `${((s - range.min) / span) * 100}%`, width: `${Math.max(((e - s) / span) * 100, 1)}%`, top: 0, bottom: 0, background: '#BFDBFE', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{ width: `${p.progress ?? 0}%`, height: '100%', background: '#156082' }} />
                    </div>
                  </div>
                ) : '—'}
              </td>
              <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                {canEdit && p.depth < MAX_DEPTH && <button style={{ ...LINK_BTN, marginRight: '10px' }} onClick={() => setEditing({ parent_id: p.id, name: '', progress: 0 })}>+ Sub-phase</button>}
                {canEdit && <button aria-label={`Delete ${p.name}`} style={DEL_BTN} onClick={() => remove(p)}>×</button>}
              </td>
            </tr>
          )
        })}
      </Table>

      {editing && (
        <Modal title={editing.id ? 'Edit phase' : editing.parent_id ? 'New sub-phase' : 'New phase'} onClose={() => setEditing(null)} onSave={save} saving={busy}>
          <div style={{ gridColumn: '1 / -1' }}><ErrorBanner error={error} /></div>
          <Field label="Name *" full><input className="form-input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="Parent phase" full>
            <select className="form-input" value={editing.parent_id || ''} onChange={e => setEditing({ ...editing, parent_id: e.target.value || null })}>
              <option value="">— Top level —</option>
              {rows.filter(r => r.id !== editing.id && r.depth < MAX_DEPTH).map(r => <option key={r.id} value={r.id}>{' '.repeat((r.depth - 1) * 3)}{r.wbs} {r.name}</option>)}
            </select>
          </Field>
          <Field label="Start"><input type="date" className="form-input" value={editing.start_date || ''} onChange={e => setEditing({ ...editing, start_date: e.target.value })} /></Field>
          <Field label="End"><input type="date" className="form-input" value={editing.end_date || ''} onChange={e => setEditing({ ...editing, end_date: e.target.value })} /></Field>
          <Field label="Owner"><input className="form-input" value={editing.owner || ''} onChange={e => setEditing({ ...editing, owner: e.target.value })} /></Field>
          <Field label="Progress (%)"><input type="number" min={0} max={100} className="form-input" value={editing.progress ?? 0} onChange={e => setEditing({ ...editing, progress: e.target.value })} /></Field>
          <Field label="Description" full><textarea className="form-input" rows={3} value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} /></Field>
        </Modal>
      )}
    </Card>
  )
}
