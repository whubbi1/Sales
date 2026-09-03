'use client'
import { useEffect, useState } from 'react'
import { MarketingLayout, useMarketingPerm } from '@/components/MarketingLayout'
import { getStoredUser } from '@/lib/auth'
import { marketingSetupAPI, legalAPI } from '@/lib/api'

const card: React.CSSProperties = { background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px 22px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const lbl: React.CSSProperties = { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '6px' }
const inp: React.CSSProperties = { fontSize: '12px', padding: '9px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white', width: '100%', boxSizing: 'border-box' as const }
const btn: React.CSSProperties = { padding: '9px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface Entity { id: string; legal_name: string }

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder: string }) {
  const [value, setValue] = useState('')
  const addTag = () => {
    const v = value.trim()
    if (v && !tags.includes(v)) onChange([...tags, v])
    setValue('')
  }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px', marginBottom: tags.length > 0 ? '8px' : 0 }}>
        {tags.map(t => (
          <span key={t} style={{ fontSize: '11px', fontWeight: '700', background: '#EFF6FF', color: '#2563EB', padding: '4px 10px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {t}
            <span onClick={() => onChange(tags.filter(x => x !== t))} style={{ cursor: 'pointer', fontWeight: '900' }}>×</span>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          style={{ ...inp, flex: 1 }} value={value} placeholder={placeholder}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
        />
        <button onClick={addTag} style={{ ...btn, padding: '7px 14px', fontSize: '11px', background: '#F1F5F9', color: '#64748B' }}>Add</button>
      </div>
    </div>
  )
}

// Same idiom as EntityChecklist in frontend/app/legal/templates/page.tsx — the established
// pattern in this codebase for assigning a record to "all" or a specific set of legal entities.
function EntityChecklist({ allEntities, selectedIds, entities, onToggleAll, onToggleEntity }: {
  allEntities: boolean; selectedIds: string[]; entities: Entity[]; onToggleAll: () => void; onToggleEntity: (id: string) => void
}) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', marginBottom: '6px', background: allEntities ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${allEntities ? '#156082' : '#E2E8F0'}`, borderRadius: '8px', fontSize: '11px', cursor: 'pointer', color: allEntities ? '#156082' : '#64748B', fontWeight: '700' }}>
        <input type="checkbox" checked={allEntities} onChange={onToggleAll} style={{ margin: 0 }} />
        All Legal Entities
      </label>
      {!allEntities && (
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
          {entities.length === 0 ? (
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>No legal entities found.</span>
          ) : entities.map(e => (
            <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: selectedIds.includes(e.id) ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${selectedIds.includes(e.id) ? '#156082' : '#E2E8F0'}`, borderRadius: '14px', fontSize: '11px', cursor: 'pointer', color: selectedIds.includes(e.id) ? '#156082' : '#64748B' }}>
              <input type="checkbox" checked={selectedIds.includes(e.id)} onChange={() => onToggleEntity(e.id)} style={{ margin: 0 }} />
              {e.legal_name}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// Click-to-edit field, saved on blur (Enter for single-line). Used for every free-text field on
// a setup card so the whole profile is editable in place — no modal.
function EditableField({ value, canEdit, multiline, placeholder, onSave, style }: {
  value: string; canEdit: boolean; multiline?: boolean; placeholder?: string; onSave: (v: string) => Promise<void>; style?: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const start = () => {
    if (!canEdit) return
    setDraft(value || '')
    setError('')
    setEditing(true)
  }

  const commit = async () => {
    if (draft === (value || '')) { setEditing(false); return }
    setSaving(true)
    setError('')
    try {
      await onSave(draft)
      setEditing(false)
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div>
        {multiline ? (
          <textarea autoFocus style={{ ...inp, minHeight: '70px', resize: 'vertical' as const }} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} placeholder={placeholder} />
        ) : (
          <input autoFocus style={inp} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => e.key === 'Enter' && commit()} placeholder={placeholder} />
        )}
        {saving && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Saving…</div>}
        {error && <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px' }}>⚠️ {error}</div>}
      </div>
    )
  }
  return (
    <div onClick={start} title={canEdit ? 'Click to edit' : undefined}
      style={{ fontSize: '12px', color: value ? '#3F3F3F' : '#94A3B8', cursor: canEdit ? 'pointer' : 'default', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px', whiteSpace: 'pre-wrap' as const, ...style }}
      onMouseEnter={e => canEdit && (e.currentTarget.style.background = '#F1F5F9')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {value || placeholder || '—'}
    </div>
  )
}

function SetupCard({ setup, entities, canEdit, onUpdate, onDelete }: {
  setup: any; entities: Entity[]; canEdit: boolean
  onUpdate: (fields: Record<string, any>) => Promise<void>
  onDelete: () => void
}) {
  const [error, setError] = useState('')

  const saveField = (field: string) => async (value: string) => {
    await onUpdate({ [field]: value })
  }

  const toggleAllEntities = async () => {
    setError('')
    try {
      await onUpdate({ all_entities: !setup.all_entities, entity_ids: [], entity_names: [] })
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    }
  }

  const toggleEntity = async (id: string) => {
    setError('')
    const has = (setup.entity_ids || []).includes(id)
    const ids = has ? setup.entity_ids.filter((x: string) => x !== id) : [...(setup.entity_ids || []), id]
    const names = entities.filter(e => ids.includes(e.id)).map(e => e.legal_name)
    try {
      await onUpdate({ entity_ids: ids, entity_names: names })
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    }
  }

  const updateCountries = async (t: string[]) => {
    setError('')
    try {
      await onUpdate({ target_countries: t })
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    }
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <EditableField value={setup.name} canEdit={canEdit} placeholder="Setup name" onSave={saveField('name')} style={{ fontSize: '15px', fontWeight: '800', color: '#156082' }} />
        </div>
        {canEdit && (
          <button onClick={onDelete} style={{ ...btn, padding: '6px 12px', background: '#FEF2F2', color: '#EF4444', flexShrink: 0 }}>Delete</button>
        )}
      </div>
      <div style={{ fontSize: '11px', color: '#94A3B8', margin: '2px 0 14px' }}>Last updated {fmtDate(setup.updated_at)}</div>

      <div style={{ marginBottom: '14px' }}>
        <div style={lbl}>Company description</div>
        <EditableField value={setup.description} canEdit={canEdit} multiline placeholder="What does the company do?" onSave={saveField('description')} />
      </div>
      <div style={{ marginBottom: '14px' }}>
        <div style={lbl}>Services we propose</div>
        <EditableField value={setup.services} canEdit={canEdit} multiline placeholder="Products and services offered" onSave={saveField('services')} />
      </div>
      <div style={{ marginBottom: '14px' }}>
        <div style={lbl}>Target countries</div>
        {canEdit ? (
          <TagInput tags={setup.target_countries || []} onChange={updateCountries} placeholder="Country, e.g. France" />
        ) : (setup.target_countries || []).length === 0 ? (
          <span style={{ fontSize: '12px', color: '#94A3B8' }}>—</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
            {setup.target_countries.map((c: string) => (
              <span key={c} style={{ fontSize: '11px', fontWeight: '700', background: '#EFF6FF', color: '#2563EB', padding: '4px 10px', borderRadius: '12px' }}>{c}</span>
            ))}
          </div>
        )}
      </div>
      <div style={{ marginBottom: '14px' }}>
        <div style={lbl}>Target customers</div>
        <EditableField value={setup.target_customers} canEdit={canEdit} multiline placeholder="e.g. Industries, company size, or specific target customer profiles" onSave={saveField('target_customers')} />
      </div>
      <div style={{ marginBottom: '14px' }}>
        <div style={lbl}>Target audience at our customers</div>
        <EditableField value={setup.target_audience} canEdit={canEdit} multiline placeholder="e.g. Compliance officers, HR directors, CISOs" onSave={saveField('target_audience')} />
      </div>
      <div style={{ marginBottom: '14px' }}>
        <div style={lbl}>Marketing objectives</div>
        <EditableField value={setup.marketing_objectives} canEdit={canEdit} multiline placeholder="What are we trying to achieve?" onSave={saveField('marketing_objectives')} />
      </div>
      <div>
        <div style={lbl}>Applies to</div>
        {canEdit ? (
          <EntityChecklist allEntities={setup.all_entities} selectedIds={setup.entity_ids || []} entities={entities} onToggleAll={toggleAllEntities} onToggleEntity={toggleEntity} />
        ) : (
          <div style={{ fontSize: '12px', color: '#3F3F3F' }}>
            {setup.all_entities ? 'All Legal Entities' : (setup.entity_names || []).length > 0 ? setup.entity_names.join(', ') : '—'}
          </div>
        )}
      </div>
      {error && <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '10px' }}>⚠️ {error}</div>}
    </div>
  )
}

export default function MarketingObjectivesPage() {
  return <MarketingLayout><MarketingObjectivesContent /></MarketingLayout>
}

// useMarketingPerm reads MarketingPermContext, which MarketingLayout only provides to its
// children — calling it in the same component that renders <MarketingLayout> would read the
// context from outside the Provider (always the default/null value, so canEdit would be stuck
// false forever). Must live in a component actually rendered as MarketingLayout's child.
function MarketingObjectivesContent() {
  const { canEdit } = useMarketingPerm('marketing_objectives')
  const [setups, setSetups] = useState<any[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [creating, setCreating] = useState(false)

  const load = () => {
    setLoading(true)
    setListError('')
    marketingSetupAPI.list()
      .then(d => setSetups(d.setups || []))
      .catch(e => setListError(e.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
    legalAPI.listEntities(true).then(d => setEntities(d.entities || [])).catch(() => setEntities([]))
  }, [])

  const addSetup = async () => {
    const user = getStoredUser()
    setCreating(true)
    setListError('')
    try {
      const created = await marketingSetupAPI.create({ name: 'New Marketing Objectives', created_by_email: user?.email || '' })
      setSetups(prev => [...prev, created])
    } catch (e: any) {
      setListError(e.message || 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  const updateSetup = async (id: string, fields: Record<string, any>) => {
    const user = getStoredUser()
    const updated = await marketingSetupAPI.update(id, { ...fields, updated_by_email: user?.email || '' })
    setSetups(prev => prev.map(s => s.id === id ? updated : s))
  }

  const removeSetup = async (id: string) => {
    if (!confirm('Delete these marketing objectives?')) return
    await marketingSetupAPI.delete(id)
    setSetups(prev => prev.filter(s => s.id !== id))
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: 0 }}>📋 Marketing Objectives</h1>
        {canEdit && (
          <button onClick={addSetup} disabled={creating} style={{ ...btn, background: creating ? '#94A3B8' : '#156082', color: 'white' }}>
            {creating ? 'Adding…' : '+ Add Marketing Objectives'}
          </button>
        )}
      </div>

      <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 16px' }}>
        Describe the company, its services, target markets and objectives for one or more legal entities — used across the module, including to ground the competitor suggestions in Competitor Analysis. Click any field below to edit it.
      </p>

      {listError && <div style={{ ...card, color: '#DC2626', fontSize: '12px' }}>⚠️ {listError}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>
      ) : setups.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '48px', color: '#94A3B8' }}>
          No marketing objectives yet — add one to start.
        </div>
      ) : (
        setups.map((s: any) => (
          <SetupCard
            key={s.id}
            setup={s}
            entities={entities}
            canEdit={canEdit}
            onUpdate={fields => updateSetup(s.id, fields)}
            onDelete={() => removeSetup(s.id)}
          />
        ))
      )}
    </>
  )
}
