'use client'
import { useEffect, useState } from 'react'
import { pmAPI } from '@/lib/api'
import { Card, Table, TD, DEL_BTN, LINK_BTN, ErrorBanner, useAction, fmtDate, Level, TabProps } from './shared'

const TEMPLATE_LABELS: Record<string, string> = {
  project_status_report: 'Project status report', meeting_minutes: 'Meeting minutes', action_list: 'Action list',
  risk_register: 'Risk register', decision_list: 'Decision list', presentation: 'Presentation', other: 'Other',
}

function ListEditor({ label, value, onChange, disabled }: { label: string; value: string[]; onChange: (v: string[]) => void; disabled: boolean }) {
  const [draft, setDraft] = useState('')
  return (
    <div>
      <div className="form-label">{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
        {value.map(v => (
          <span key={v} style={{ background: '#F1F5F9', borderRadius: '12px', padding: '3px 10px', fontSize: '11px', display: 'inline-flex', gap: '6px' }}>
            {v}{!disabled && <button aria-label={`Remove ${v}`} onClick={() => onChange(value.filter(x => x !== v))} style={{ ...DEL_BTN, fontSize: '13px' }}>×</button>}
          </span>
        ))}
      </div>
      {!disabled && (
        <div style={{ display: 'flex', gap: '6px' }}>
          <input className="form-input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Add…"
            onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { onChange([...value, draft.trim()]); setDraft('') } }} />
          <button className="btn-secondary" onClick={() => { if (draft.trim()) { onChange([...value, draft.trim()]); setDraft('') } }}>Add</button>
        </div>
      )}
    </div>
  )
}

function LevelsEditor({ label, value, onChange, disabled }: { label: string; value: Level[]; onChange: (v: Level[]) => void; disabled: boolean }) {
  return (
    <div>
      <div className="form-label">{label}</div>
      {value.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
          <input className="form-input" style={{ width: '120px' }} value={l.level} disabled={disabled}
            onChange={e => onChange(value.map((x, j) => j === i ? { ...x, level: e.target.value } : x))} />
          <input className="form-input" style={{ flex: 1 }} placeholder="What this level means…" value={l.description || ''} disabled={disabled}
            onChange={e => onChange(value.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
          {!disabled && value.length > 1 && <button aria-label="Remove level" onClick={() => onChange(value.filter((_, j) => j !== i))} style={DEL_BTN}>×</button>}
        </div>
      ))}
      {!disabled && <button style={LINK_BTN} onClick={() => onChange([...value, { level: '', description: '' }])}>+ Add level</button>}
    </div>
  )
}

export function BasicInfoTab({ projectId, canEdit, settings, reloadSettings }: TabProps) {
  const [form, setForm] = useState(settings)
  const [templates, setTemplates] = useState<any[]>([])
  const [tplType, setTplType] = useState('meeting_minutes')
  const [tplName, setTplName] = useState('')
  const [tplFile, setTplFile] = useState<File | null>(null)
  const { busy, error, run } = useAction()

  const loadTemplates = () => pmAPI.listTemplates(projectId).then(setTemplates).catch(() => {})
  useEffect(() => { loadTemplates() }, [projectId])

  const save = () => run(async () => {
    await pmAPI.updateSettings(projectId, {
      sharepoint_url: form.sharepoint_url || null,
      extra_action_statuses: form.extra_action_statuses,
      impact_levels: form.impact_levels, probability_levels: form.probability_levels,
      meeting_types: form.meeting_types,
    })
    reloadSettings()
  })
  const uploadLogo = (file?: File) => file && run(async () => { await pmAPI.uploadLogo(projectId, file); reloadSettings() })
  const removeLogo = () => confirm('Remove this project\'s custom logo?') && run(async () => { await pmAPI.deleteLogo(projectId); reloadSettings() })
  const uploadTemplate = () => tplFile && run(async () => {
    await pmAPI.uploadTemplate(projectId, tplType, tplName || tplFile.name, tplFile)
    setTplName(''); setTplFile(null); loadTemplates()
  })
  const openTemplate = (t: any) => run(async () => { const { url } = await pmAPI.templateUrl(projectId, t.id); window.open(url, '_blank') })
  const deleteTemplate = (t: any) => confirm(`Delete template "${t.name}"?`) && run(async () => { await pmAPI.deleteTemplate(projectId, t.id); loadTemplates() })

  return (
    <div>
      <ErrorBanner error={error} />
      <Card title="Project links & customer" action={canEdit && <button className="btn-primary" onClick={save} disabled={busy}>Save</button>}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', alignItems: 'start' }}>
          <div>
            <span className="form-label">SharePoint project folder</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="form-input" placeholder="https://…sharepoint.com/…" value={form.sharepoint_url || ''} disabled={!canEdit}
                onChange={e => setForm({ ...form, sharepoint_url: e.target.value })} />
              {settings.sharepoint_url && <a className="btn-secondary" href={settings.sharepoint_url} target="_blank" rel="noopener noreferrer" style={{ whiteSpace: 'nowrap', textDecoration: 'none' }}>🔗 Open</a>}
            </div>
          </div>
          <div>
            <span className="form-label">Customer logo</span>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {settings.customer_logo_url
                ? <img src={settings.customer_logo_url} alt="Customer logo" style={{ maxHeight: '48px', maxWidth: '140px', objectFit: 'contain', border: '1px solid #EDF2F7', borderRadius: '6px', padding: '4px' }} />
                : <span style={{ fontSize: '12px', color: '#9B9B9B' }}>No logo</span>}
              {canEdit && <label className="btn-secondary" style={{ cursor: 'pointer' }}>Upload<input type="file" accept="image/png,image/jpeg" hidden onChange={e => uploadLogo(e.target.files?.[0])} /></label>}
              {canEdit && settings.has_custom_logo && <button style={LINK_BTN} onClick={removeLogo}>Remove</button>}
            </div>
            {settings.customer_logo_url && !settings.has_custom_logo && (
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>(from customer profile)</div>
            )}
          </div>
        </div>
      </Card>

      <Card title="Document templates">
        <p style={{ fontSize: '11px', color: '#64748B', marginTop: 0 }}>
          A Word (.docx) <b>meeting minutes</b> template is used when exporting validated minutes. It can contain the placeholders
          {' '}<code>{'{{PROJECT_NAME}}'}</code>, <code>{'{{PROJECT_NUMBER}}'}</code>, <code>{'{{MEETING_NUMBER}}'}</code>, <code>{'{{MEETING_TITLE}}'}</code>, <code>{'{{MEETING_TYPE}}'}</code> and <code>{'{{MEETING_DATE}}'}</code>; the minutes are added after the template content.
        </p>
        {canEdit && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <select className="form-input" style={{ width: '200px' }} value={tplType} onChange={e => setTplType(e.target.value)}>
              {Object.entries(TEMPLATE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="form-input" placeholder="Template name" value={tplName} onChange={e => setTplName(e.target.value)} />
            <input type="file" onChange={e => setTplFile(e.target.files?.[0] || null)} style={{ fontSize: '12px' }} />
            <button className="btn-primary" onClick={uploadTemplate} disabled={!tplFile || busy}>Upload</button>
          </div>
        )}
        <Table headers={['Type', 'Name', 'File', 'Uploaded', '']} empty={templates.length === 0}>
          {templates.map(t => (
            <tr key={t.id}>
              <td style={TD}>{TEMPLATE_LABELS[t.template_type] || t.template_type}</td>
              <td style={{ ...TD, fontWeight: 600 }}>{t.name}</td>
              <td style={TD}><button style={LINK_BTN} onClick={() => openTemplate(t)}>{t.filename}</button></td>
              <td style={TD}>{fmtDate(t.created_at)} · {t.uploaded_by}</td>
              <td style={TD}>{canEdit && <button aria-label="Delete template" style={DEL_BTN} onClick={() => deleteTemplate(t)}>×</button>}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Registers & meetings setup" action={canEdit && <button className="btn-primary" onClick={save} disabled={busy}>Save</button>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <div className="form-label">Default action statuses</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px' }}>Open · In Progress · Solved · On Hold</div>
            <ListEditor label="Additional action statuses" value={form.extra_action_statuses} disabled={!canEdit} onChange={v => setForm({ ...form, extra_action_statuses: v })} />
            <div style={{ height: '16px' }} />
            <ListEditor label="Meeting types" value={form.meeting_types} disabled={!canEdit} onChange={v => setForm({ ...form, meeting_types: v })} />
          </div>
          <div>
            <LevelsEditor label="Risk impact levels" value={form.impact_levels} disabled={!canEdit} onChange={v => setForm({ ...form, impact_levels: v })} />
            <div style={{ height: '16px' }} />
            <LevelsEditor label="Risk probability levels" value={form.probability_levels} disabled={!canEdit} onChange={v => setForm({ ...form, probability_levels: v })} />
          </div>
        </div>
      </Card>
    </div>
  )
}
