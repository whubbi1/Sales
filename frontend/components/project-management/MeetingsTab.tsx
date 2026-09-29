'use client'
import { useEffect, useState } from 'react'
import { pmAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { Card, Table, TD, TH, DEL_BTN, LINK_BTN, Modal, Field, ErrorBanner, useAction, fmtDate, toInput, fromInput, Badge, statusTone, PeopleEditor, downloadBlob, Person, TabProps } from './shared'

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', generated: 'Minutes to review', in_review: 'Awaiting validation', validated: 'Validated' }
type Registers = { actions: any[]; decisions: any[]; risks: any[] }

// onChange: a validation decision was made (the page refreshes its "waiting for you" panel).
// onExit: replaces "back to the list" — for validators who can't see the list at all.
export function MeetingsTab({ projectId, canEdit, settings, openMeetingId, onChange, onExit }: TabProps & { openMeetingId?: string; onChange?: () => void; onExit?: () => void }) {
  const [meetings, setMeetings] = useState<any[]>([])
  const [creating, setCreating] = useState<any>(null)
  const [openId, setOpenId] = useState<string | null>(openMeetingId || null)
  const [typeFilter, setTypeFilter] = useState('')
  const { busy, error, run } = useAction()

  const load = () => pmAPI.meetings.list(projectId).then(setMeetings).catch(() => {})
  useEffect(() => { load() }, [projectId])

  const create = () => run(async () => {
    const m = await pmAPI.meetings.create(projectId, { ...creating, meeting_date: fromInput(creating.meeting_date) })
    setCreating(null); await load(); setOpenId(m.id)
  })
  const remove = (m: any) => confirm(`Delete meeting ${m.number} "${m.title}"? Register entries created from it are kept.`) && run(async () => { await pmAPI.meetings.remove(projectId, m.id); load() })

  if (openId) return <MeetingDetail projectId={projectId} meetingId={openId} canEdit={canEdit} settings={settings} onChange={onChange}
    onBack={() => { if (onExit) return onExit(); setOpenId(null); load() }} />

  const shown = meetings.filter(m => !typeFilter || m.meeting_type === typeFilter)
  return (
    <Card title="Project meetings" action={
      <div style={{ display: 'flex', gap: '8px' }}>
        <select className="form-input" style={{ width: '180px' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Filter by meeting type">
          <option value="">All meeting types</option>
          {settings.meeting_types.map(t => <option key={t}>{t}</option>)}
        </select>
        {canEdit && <button className="btn-primary" onClick={() => setCreating({ title: '', meeting_type: settings.meeting_types[0] || '', meeting_date: new Date().toISOString().slice(0, 10), location: '', attendees: [] })}>+ Meeting</button>}
      </div>
    }>
      <ErrorBanner error={creating ? '' : error} />
      <Table headers={['#', 'Date', 'Type', 'Title', 'Status', '']} empty={shown.length === 0}>
        {shown.map(m => (
          <tr key={m.id}>
            <td style={{ ...TD, fontWeight: 700, color: '#64748B' }}>{m.number}</td>
            <td style={TD}>{fmtDate(m.meeting_date)}</td>
            <td style={TD}>{m.meeting_type || '—'}</td>
            <td style={{ ...TD, fontWeight: 600 }}><button style={{ ...LINK_BTN, color: '#144766' }} onClick={() => setOpenId(m.id)}>{m.title}</button></td>
            <td style={TD}><Badge value={STATUS_LABEL[m.status] || m.status} tone={statusTone(m.status)} /></td>
            <td style={TD}>{canEdit && <button aria-label={`Delete ${m.number}`} style={DEL_BTN} onClick={() => remove(m)}>×</button>}</td>
          </tr>
        ))}
      </Table>
      {creating && (
        <Modal title="New meeting" onClose={() => setCreating(null)} onSave={create} saving={busy} saveLabel="Create">
          <div style={{ gridColumn: '1 / -1' }}><ErrorBanner error={error} /></div>
          <MeetingFields value={creating} onChange={setCreating} meetingTypes={settings.meeting_types} projectId={projectId} />
        </Modal>
      )}
    </Card>
  )
}

function MeetingFields({ value, onChange, meetingTypes, projectId }: { value: any; onChange: (v: any) => void; meetingTypes: string[]; projectId: string }) {
  const [members, setMembers] = useState<any[]>([])
  useEffect(() => { pmAPI.members.list(projectId).then(setMembers).catch(() => {}) }, [projectId])
  return (
    <>
      <Field label="Title *" full><input className="form-input" value={value.title} onChange={e => onChange({ ...value, title: e.target.value })} /></Field>
      <Field label="Meeting type">
        <select className="form-input" value={value.meeting_type || ''} onChange={e => onChange({ ...value, meeting_type: e.target.value })}>
          <option value="">—</option>
          {meetingTypes.map(t => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Date"><input type="date" className="form-input" value={value.meeting_date || ''} onChange={e => onChange({ ...value, meeting_date: e.target.value })} /></Field>
      <Field label="Location / link" full><input className="form-input" value={value.location || ''} onChange={e => onChange({ ...value, location: e.target.value })} /></Field>
      <Field label="Attendees" full><PeopleEditor value={value.attendees || []} onChange={v => onChange({ ...value, attendees: v })} members={members} /></Field>
    </>
  )
}

function MeetingDetail({ projectId, meetingId, canEdit, settings, onBack, onChange }: { projectId: string; meetingId: string; canEdit: boolean; settings: any; onBack: () => void; onChange?: () => void }) {
  const me = (getStoredUser()?.email || '').toLowerCase()
  const [m, setM] = useState<any>(null)
  const [draft, setDraft] = useState<any>(null)        // editable minutes + proposal
  const [info, setInfo] = useState<any>(null)          // editable header fields
  const [registers, setRegisters] = useState<Registers>({ actions: [], decisions: [], risks: [] })
  const [members, setMembers] = useState<any[]>([])
  const [validators, setValidators] = useState<Person[]>([])
  const [comment, setComment] = useState('')
  const [dirty, setDirty] = useState(false)
  const { busy, error, run } = useAction()

  const apply = (meeting: any) => {
    setM(meeting)
    setDraft({ minutes: meeting.minutes || '', proposal: meeting.proposal })
    setInfo({ title: meeting.title, meeting_type: meeting.meeting_type, meeting_date: toInput(meeting.meeting_date), location: meeting.location, attendees: meeting.attendees })
    setDirty(false)
  }
  const loadRegisters = () => Promise.all([
    pmAPI.actions.list(projectId).catch(() => []), pmAPI.decisions.list(projectId).catch(() => []), pmAPI.risks.list(projectId).catch(() => []),
  ]).then(([actions, decisions, risks]) => setRegisters({ actions, decisions, risks }))
  useEffect(() => {
    run(async () => apply(await pmAPI.getMeeting(projectId, meetingId)))
    loadRegisters()
    pmAPI.members.list(projectId).then(setMembers).catch(() => {})
  }, [meetingId])

  if (!m || !draft) return <Card><ErrorBanner error={error} />Loading…</Card>

  const locked = m.status === 'validated'
  const editable = canEdit && !locked
  const myPending = m.status === 'in_review' && m.validations.some((v: any) => v.validator_email === me && v.status === 'pending')

  const saveInfo = () => run(async () => apply(await pmAPI.meetings.update(projectId, meetingId, { ...info, meeting_date: fromInput(info.meeting_date) })))
  const upload = (file?: File) => file && run(async () => apply(await pmAPI.uploadTranscript(projectId, meetingId, file)))
  const generate = () => (!m.minutes || confirm('Regenerate? Your edits to the minutes and action plan will be replaced.')) &&
    run(async () => apply(await pmAPI.generateMinutes(projectId, meetingId)))
  const saveReview = () => run(async () => apply(await pmAPI.saveReview(projectId, meetingId, draft)))
  const generateActions = () => {
    const hasProposal = ['actions', 'decisions', 'risks'].some(k => (draft.proposal[k] || []).length > 0)
    if (hasProposal && !confirm('Regenerate the action items, decisions and risks from these minutes? Your current action plan will be replaced.')) return
    run(async () => {
      if (dirty) await pmAPI.saveReview(projectId, meetingId, draft)
      apply(await pmAPI.generateActions(projectId, meetingId))
    })
  }
  const requestValidation = () => run(async () => {
    if (dirty) await pmAPI.saveReview(projectId, meetingId, draft)
    if (validators.length === 0 && !confirm('No validators selected — validate these minutes yourself now? The action list, decision register and risk register will be updated.')) return
    apply(await pmAPI.requestValidation(projectId, meetingId, validators))
    loadRegisters()
  })
  const decide = (approve: boolean) => run(async () => { apply(await pmAPI.decideValidation(projectId, meetingId, approve, comment)); setComment(''); loadRegisters(); onChange?.() })
  const exportDocx = () => run(async () => { const { blob, name } = await pmAPI.exportMinutes(projectId, meetingId); downloadBlob(blob, name) })

  const setProposal = (kind: keyof Registers, items: any[]) => { setDraft({ ...draft, proposal: { ...draft.proposal, [kind]: items } }); setDirty(true) }
  const numberOf = (kind: keyof Registers, id?: string) => registers[kind].find(x => x.id === id)?.number

  return (
    <div>
      <button style={{ ...LINK_BTN, marginBottom: '12px' }} onClick={() => (!dirty || confirm('Discard unsaved changes?')) && onBack()}>← All meetings</button>
      <ErrorBanner error={error} />

      <Card title={`${m.number} — ${m.title}`} action={<Badge value={STATUS_LABEL[m.status] || m.status} tone={statusTone(m.status)} />}>
        {editable ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <MeetingFields value={info} onChange={setInfo} meetingTypes={settings.meeting_types} projectId={projectId} />
            <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}><button className="btn-secondary" onClick={saveInfo} disabled={busy}>Save meeting details</button></div>
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#3F3F3F', lineHeight: 1.8 }}>
            <div><b>Type:</b> {m.meeting_type || '—'} · <b>Date:</b> {fmtDate(m.meeting_date)} · <b>Location:</b> {m.location || '—'}</div>
            <div><b>Attendees:</b> {(m.attendees || []).map((a: Person) => a.name).join(', ') || '—'}</div>
          </div>
        )}
      </Card>

      <Card title="1. Transcript (optional — or write the minutes directly below)">
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: m.has_transcript ? '#059669' : '#9B9B9B' }}>{m.has_transcript ? `✓ ${m.transcript_filename}` : 'No transcript uploaded yet'}</span>
          {editable && <label className="btn-secondary" style={{ cursor: 'pointer' }}>{m.has_transcript ? 'Replace transcript' : 'Upload transcript'}<input type="file" hidden accept=".docx,.txt,.vtt,.srt,.md" onChange={e => upload(e.target.files?.[0])} /></label>}
          {editable && m.has_transcript && <button className="btn-primary" onClick={generate} disabled={busy}>{busy ? 'Working…' : m.minutes ? '↻ Regenerate minutes & action plan' : '✨ Generate minutes & action plan'}</button>}
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Word (.docx), Teams (.vtt), .srt or text files.</span>
        </div>
      </Card>

      {(m.status !== 'draft' || m.minutes || editable) && (
        <>
          <Card title="2. Meeting minutes" action={editable && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" onClick={generateActions} disabled={busy || !draft.minutes.trim()}>{busy ? 'Working…' : '✨ Generate action items'}</button>
              <button className="btn-primary" onClick={saveReview} disabled={busy || !dirty}>Save review</button>
            </div>
          )}>
            <textarea className="form-input" rows={16} readOnly={!editable} placeholder={editable ? 'Write or paste the meeting minutes here…' : ''} value={draft.minutes} style={{ fontFamily: 'inherit', fontSize: '12px', lineHeight: 1.6 }}
              onChange={e => { setDraft({ ...draft, minutes: e.target.value }); setDirty(true) }} />
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Lines starting with “# ” become headings and “- ” bullet points in the exported document. Once the minutes are final, “Generate action items” extracts the action list, decisions and risks below from this text.</div>
          </Card>

          <ProposalEditor kind="decisions" title="Decisions" items={draft.proposal.decisions} existing={registers.decisions} editable={editable} locked={locked} numberOf={numberOf}
            onChange={items => setProposal('decisions', items)} blank={{ title: '', description: '', decision_makers: [] }}
            columns={[{ key: 'title', label: 'Decision' }, { key: 'description', label: 'Description', wide: true }, { key: 'decision_makers', label: 'Decision makers', names: true }]} />
          <ProposalEditor kind="actions" title="Action items" items={draft.proposal.actions} existing={registers.actions} editable={editable} locked={locked} numberOf={numberOf}
            onChange={items => setProposal('actions', items)} blank={{ title: '', description: '', owner: '', due_date: '', status: 'Open' }}
            columns={[{ key: 'title', label: 'Action' }, { key: 'description', label: 'Description', wide: true }, { key: 'owner', label: 'Owner' }, { key: 'due_date', label: 'Due date', date: true }, { key: 'status', label: 'Status', options: settings.action_statuses }]} />
          <ProposalEditor kind="risks" title="Risks" items={draft.proposal.risks} existing={registers.risks} editable={editable} locked={locked} numberOf={numberOf}
            onChange={items => setProposal('risks', items)} blank={{ title: '', description: '', mitigation: '', status: 'Open' }}
            columns={[{ key: 'title', label: 'Risk' }, { key: 'mitigation', label: 'Mitigation', wide: true }, { key: 'impact', label: 'Impact', options: settings.impact_levels.map((l: any) => l.level) }, { key: 'probability', label: 'Probability', options: settings.probability_levels.map((l: any) => l.level) }, { key: 'status', label: 'Status', options: ['Open', 'Closed'] }]} />

          <Card title="3. Validation">
            {m.validations.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
                <thead><tr><th style={TH}>Validator</th><th style={TH}>Status</th><th style={TH}>Date</th><th style={TH}>Comment</th></tr></thead>
                <tbody>{m.validations.map((v: any) => (
                  <tr key={v.id}><td style={TD}>{v.validator_name || v.validator_email}</td><td style={TD}><Badge value={v.status} tone={statusTone(v.status)} /></td><td style={TD}>{fmtDate(v.decided_at)}</td><td style={TD}>{v.comment || '—'}</td></tr>
                ))}</tbody>
              </table>
            )}
            {myPending && (
              <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#9A3412', marginBottom: '8px' }}>Your validation is requested on these minutes, decisions and action items.</div>
                <textarea className="form-input" rows={2} placeholder="Comment (required when rejecting)" value={comment} onChange={e => setComment(e.target.value)} />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button className="btn-primary" onClick={() => decide(true)} disabled={busy}>✓ Approve</button>
                  <button className="btn-secondary" onClick={() => decide(false)} disabled={busy || !comment.trim()}>✗ Reject</button>
                </div>
              </div>
            )}
            {editable && m.status !== 'in_review' && (
              <div>
                {m.validations.some((v: any) => v.status === 'rejected') && <p style={{ fontSize: '12px', color: '#B91C1C', marginTop: 0 }}>A validator rejected the previous version — update the minutes and request a new validation.</p>}
                <span className="form-label">Request validation from</span>
                <PeopleEditor value={validators} onChange={setValidators} members={members} placeholder="Validator name" />
                <button className="btn-primary" style={{ marginTop: '10px' }} onClick={requestValidation} disabled={busy || !draft.minutes.trim()}>
                  {validators.length ? `Request validation (${validators.length})` : 'Validate myself'}
                </button>
              </div>
            )}
            {m.status === 'in_review' && !myPending && <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>Waiting for the validators. Editing the minutes restarts the validation round.</p>}
            {locked && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: '#059669' }}>✓ Validated on {fmtDate(m.validated_at)} — the action list, decision register and risk register were updated.</span>
                <button className="btn-primary" onClick={exportDocx} disabled={busy}>⬇ Export minutes (.docx)</button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

type Col = { key: string; label: string; wide?: boolean; names?: boolean; date?: boolean; options?: string[] }

function ProposalEditor({ kind, title, items, existing, editable, locked, numberOf, onChange, blank, columns }: {
  kind: keyof Registers; title: string; items: any[]; existing: any[]; editable: boolean; locked: boolean
  numberOf: (k: keyof Registers, id?: string) => string | undefined; onChange: (items: any[]) => void; blank: any; columns: Col[]
}) {
  const update = (i: number, patch: any) => onChange(items.map((x, j) => j === i ? { ...x, ...patch } : x))
  const input = (c: Col, it: any, i: number) => {
    const v = it[c.key]
    if (!editable) return c.names ? (v || []).join(', ') || '—' : v || '—'
    if (c.options) return (
      <select className="form-input" style={{ padding: '4px 6px', fontSize: '12px' }} value={v || ''} onChange={e => update(i, { [c.key]: e.target.value || null })}>
        <option value="">—</option>{c.options.map(o => <option key={o}>{o}</option>)}
      </select>
    )
    if (c.names) return <input className="form-input" style={{ fontSize: '12px' }} value={(v || []).join(', ')} onChange={e => update(i, { [c.key]: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
    if (c.date) return <input type="date" className="form-input" style={{ fontSize: '12px' }} value={v || ''} onChange={e => update(i, { [c.key]: e.target.value })} />
    return <textarea className="form-input" rows={c.wide ? 2 : 1} style={{ fontSize: '12px', resize: 'vertical' }} value={v || ''} onChange={e => update(i, { [c.key]: e.target.value })} />
  }
  return (
    <Card title={`${title} (${items.length})`} action={editable && <button style={LINK_BTN} onClick={() => onChange([...items, { ...blank, existing_id: null }])}>+ Add</button>}>
      <Table headers={[locked ? 'Register #' : 'Register entry', ...columns.map(c => c.label), '']} empty={items.length === 0}>
        {items.map((it, i) => (
          <tr key={i}>
            <td style={{ ...TD, width: '170px' }}>
              {locked ? <b>{numberOf(kind, it.applied_id) || '—'}</b> : editable ? (
                <select className="form-input" style={{ padding: '4px 6px', fontSize: '12px' }} value={it.existing_id || ''} onChange={e => update(i, { existing_id: e.target.value || null })}>
                  <option value="">New entry</option>
                  {existing.map(x => <option key={x.id} value={x.id}>Update {x.number} {x.title.slice(0, 40)}</option>)}
                </select>
              ) : it.existing_id ? `Update ${numberOf(kind, it.existing_id) || ''}` : 'New entry'}
            </td>
            {columns.map(c => <td key={c.key} style={{ ...TD, minWidth: c.wide ? '240px' : c.options ? '110px' : '130px' }}>{input(c, it, i)}</td>)}
            <td style={TD}>{editable && <button aria-label="Remove item" style={DEL_BTN} onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>}</td>
          </tr>
        ))}
      </Table>
    </Card>
  )
}
