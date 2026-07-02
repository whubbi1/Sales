'use client'
import { useState, useEffect } from 'react'
import TrainingLayout, { useTrainingPerm } from '@/components/TrainingLayout'

const API = 'https://api.whubbi.wcomply.com'
const TRAINING_TYPES = ['wcomply', 'external']
const TYPE_LABEL: Record<string, string> = { wcomply: 'WCOMPLY', external: 'External' }
const TRAINING_LANGUAGES = ['English', 'French', 'Portuguese', 'Czech', 'Romanian', 'Spanish']
const EXPERTISE_LEVELS = ['beginner', 'intermediate', 'expert']
const EXPERTISE_LABEL: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' }

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

const EMPTY_FORM = { training_type: 'wcomply', company: '', title: '', description: '', duration: '', material_link: '', languages: [] as string[], expertise_level: 'beginner' }

function LanguageChecklist({ selected, onToggle }: { selected: string[]; onToggle: (lang: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {TRAINING_LANGUAGES.map(l => (
        <label key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: selected.includes(l) ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${selected.includes(l) ? '#156082' : '#E2E8F0'}`, borderRadius: '14px', fontSize: '11px', cursor: 'pointer', color: selected.includes(l) ? '#156082' : '#64748B' }}>
          <input type="checkbox" checked={selected.includes(l)} onChange={() => onToggle(l)} style={{ margin: 0 }} />
          {l}
        </label>
      ))}
    </div>
  )
}

function EditableCell({ display, editing, onStartEdit, children }: any) {
  return editing ? children : (
    <div onClick={onStartEdit} title="Click to edit"
      style={{ fontSize: '12px', color: '#3F3F3F', cursor: 'pointer', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {display || <span style={{ color: '#94A3B8' }}>—</span>}
    </div>
  )
}

function NewTrainingModal({ onClose, onSave }: any) {
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const valid = form.company.trim() && form.title.trim() && form.duration.trim() && form.languages.length > 0
  const toggleLang = (lang: string) => setForm((f: any) => ({ ...f, languages: f.languages.includes(lang) ? f.languages.filter((l: string) => l !== lang) : [...f.languages, lang] }))
  const submit = async () => {
    if (!valid) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>New Training</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Type *</label>
              <select style={{ ...inp, width: '100%' }} value={form.training_type} onChange={e => setForm((f: any) => ({ ...f, training_type: e.target.value }))}>
                {TRAINING_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Company *</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.company} onChange={e => setForm((f: any) => ({ ...f, company: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={lbl}>Title *</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Duration *</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder="e.g. 2 hours" value={form.duration} onChange={e => setForm((f: any) => ({ ...f, duration: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Link to Material</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder="https://…" value={form.material_link} onChange={e => setForm((f: any) => ({ ...f, material_link: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '70px', resize: 'vertical' }} value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Languages *</label>
            <LanguageChecklist selected={form.languages} onToggle={toggleLang} />
          </div>
          <div>
            <label style={lbl}>Level of Required Expertise</label>
            <select style={{ ...inp, width: '100%' }} value={form.expertise_level} onChange={e => setForm((f: any) => ({ ...f, expertise_level: e.target.value }))}>
              {EXPERTISE_LEVELS.map(l => <option key={l} value={l}>{EXPERTISE_LABEL[l]}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
            <button onClick={submit} disabled={saving || !valid}
              style={{ padding: '9px 18px', background: saving || !valid ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              {saving ? 'Creating…' : 'Create Training'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditableLanguages({ item, editing, onStartEdit, onSave }: any) {
  const [draft, setDraft] = useState<string[]>(item.languages || [])
  useEffect(() => { setDraft(item.languages || []) }, [editing])
  const toggle = (lang: string) => setDraft(d => d.includes(lang) ? d.filter(l => l !== lang) : [...d, lang])

  if (!editing) {
    return (
      <div onClick={onStartEdit} title="Click to edit"
        style={{ fontSize: '12px', color: '#3F3F3F', cursor: 'pointer', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        {(item.languages || []).length > 0 ? item.languages.join(', ') : <span style={{ color: '#94A3B8' }}>—</span>}
      </div>
    )
  }
  return (
    <div style={{ minWidth: '220px' }}>
      <LanguageChecklist selected={draft} onToggle={toggle} />
      <button onClick={() => onSave(draft)} disabled={draft.length === 0}
        style={{ marginTop: '6px', padding: '4px 10px', background: draft.length === 0 ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
        Done
      </button>
    </div>
  )
}

function CatalogueContent() {
  const { canEdit } = useTrainingPerm()
  const [catalog, setCatalog] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const d = await fetch(`${API}/training/catalog`).then(r => r.json()).catch(() => ({ catalog: [] }))
    setCatalog(d.catalog || [])
    setLoading(false)
  }

  const filtered = catalog.filter(c => !search || `${c.title} ${c.company}`.toLowerCase().includes(search.toLowerCase()))

  const createItem = async (form: any) => {
    await fetch(`${API}/training/catalog`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setShowNew(false)
    load()
  }

  const patchItem = async (item: any, fields: any) => {
    await fetch(`${API}/training/catalog/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ training_type: item.training_type, company: item.company, title: item.title, description: item.description, duration: item.duration, material_link: item.material_link, languages: item.languages || [], expertise_level: item.expertise_level || 'beginner', ...fields }),
    })
    setEditing(null)
    load()
  }

  const deleteItem = async (item: any) => {
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return
    await fetch(`${API}/training/catalog/${item.id}`, { method: 'DELETE' })
    load()
  }

  const isEditing = (id: string, field: string) => editing?.id === id && editing.field === field

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>📚 Training Catalogue</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{filtered.length} training{filtered.length !== 1 ? 's' : ''} · click any field to edit</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowNew(true)} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>+ New Training</button>
        )}
      </div>

      <div style={{ marginBottom: '14px' }}>
        <input style={{ ...inp, width: '260px' }} placeholder="Search title or company…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {['ID', 'Type', 'Company', 'Title', 'Description', 'Duration', 'Languages', 'Expertise', 'Material Link', canEdit ? '' : null].filter(x => x !== null).map(h => (
                <th key={h as string} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No trainings in the catalogue yet.</td></tr>
            ) : filtered.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '10px 12px', color: '#94A3B8', fontFamily: 'monospace', fontSize: '11px' }} title={item.id}>{item.id.slice(0, 8)}</td>
                <td style={{ padding: '10px 12px', minWidth: '90px' }}>
                  <EditableCell display={<span style={{ background: '#F1F5F9', color: '#3F3F3F', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{TYPE_LABEL[item.training_type] || item.training_type}</span>}
                    editing={isEditing(item.id, 'training_type')} onStartEdit={() => canEdit && setEditing({ id: item.id, field: 'training_type' })}>
                    <select autoFocus style={inp} defaultValue={item.training_type} onChange={e => patchItem(item, { training_type: e.target.value })} onBlur={() => setEditing(null)}>
                      {TRAINING_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                    </select>
                  </EditableCell>
                </td>
                <td style={{ padding: '10px 12px', minWidth: '120px' }}>
                  <EditableCell display={item.company} editing={isEditing(item.id, 'company')} onStartEdit={() => canEdit && setEditing({ id: item.id, field: 'company' })}>
                    <input autoFocus style={inp} defaultValue={item.company} onBlur={e => patchItem(item, { company: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                  </EditableCell>
                </td>
                <td style={{ padding: '10px 12px', minWidth: '160px', fontWeight: '700', color: '#156082' }}>
                  <EditableCell display={item.title} editing={isEditing(item.id, 'title')} onStartEdit={() => canEdit && setEditing({ id: item.id, field: 'title' })}>
                    <input autoFocus style={inp} defaultValue={item.title} onBlur={e => patchItem(item, { title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                  </EditableCell>
                </td>
                <td style={{ padding: '10px 12px', minWidth: '200px', color: '#64748B' }}>
                  <EditableCell display={item.description} editing={isEditing(item.id, 'description')} onStartEdit={() => canEdit && setEditing({ id: item.id, field: 'description' })}>
                    <textarea autoFocus style={{ ...inp, width: '100%', minWidth: '200px', boxSizing: 'border-box' as const, minHeight: '50px', resize: 'vertical' }} defaultValue={item.description} onBlur={e => patchItem(item, { description: e.target.value })} />
                  </EditableCell>
                </td>
                <td style={{ padding: '10px 12px', minWidth: '90px' }}>
                  <EditableCell display={item.duration} editing={isEditing(item.id, 'duration')} onStartEdit={() => canEdit && setEditing({ id: item.id, field: 'duration' })}>
                    <input autoFocus style={inp} defaultValue={item.duration} onBlur={e => patchItem(item, { duration: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                  </EditableCell>
                </td>
                <td style={{ padding: '10px 12px', minWidth: '160px' }}>
                  <EditableLanguages item={item} editing={isEditing(item.id, 'languages')}
                    onStartEdit={() => canEdit && setEditing({ id: item.id, field: 'languages' })}
                    onSave={(langs: string[]) => patchItem(item, { languages: langs })} />
                </td>
                <td style={{ padding: '10px 12px', minWidth: '110px' }}>
                  <EditableCell display={<span style={{ background: '#EEF2FF', color: '#156082', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{EXPERTISE_LABEL[item.expertise_level] || 'Beginner'}</span>}
                    editing={isEditing(item.id, 'expertise_level')} onStartEdit={() => canEdit && setEditing({ id: item.id, field: 'expertise_level' })}>
                    <select autoFocus style={inp} defaultValue={item.expertise_level || 'beginner'} onChange={e => patchItem(item, { expertise_level: e.target.value })} onBlur={() => setEditing(null)}>
                      {EXPERTISE_LEVELS.map(l => <option key={l} value={l}>{EXPERTISE_LABEL[l]}</option>)}
                    </select>
                  </EditableCell>
                </td>
                <td style={{ padding: '10px 12px', minWidth: '140px' }}>
                  <EditableCell display={item.material_link ? <a href={item.material_link} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6' }} onClick={e => e.stopPropagation()}>🔗 Link</a> : null}
                    editing={isEditing(item.id, 'material_link')} onStartEdit={() => canEdit && setEditing({ id: item.id, field: 'material_link' })}>
                    <input autoFocus style={inp} defaultValue={item.material_link} onBlur={e => patchItem(item, { material_link: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                  </EditableCell>
                </td>
                {canEdit && (
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => deleteItem(item)} style={{ padding: '5px 10px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#EF4444', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && <NewTrainingModal onClose={() => setShowNew(false)} onSave={createItem} />}
    </div>
  )
}

export default function TrainingCataloguePage() {
  return <TrainingLayout><CatalogueContent /></TrainingLayout>
}
