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

const EMPTY_FORM = {
  name: '', description: '', services: '', target_countries: [] as string[], target_audience: '',
  marketing_objectives: '', all_entities: true, entity_ids: [] as string[], entity_names: [] as string[],
}

function SetupModal({ setup, entities, onClose, onSaved }: { setup?: any | null; entities: Entity[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(setup ? {
    name: setup.name || '', description: setup.description || '', services: setup.services || '',
    target_countries: setup.target_countries || [], target_audience: setup.target_audience || '',
    marketing_objectives: setup.marketing_objectives || '', all_entities: setup.all_entities !== false,
    entity_ids: setup.entity_ids || [], entity_names: setup.entity_names || [],
  } : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleAllEntities = () => setForm(f => ({ ...f, all_entities: !f.all_entities, entity_ids: [], entity_names: [] }))
  const toggleEntity = (id: string) => setForm(f => {
    const has = f.entity_ids.includes(id)
    const ids = has ? f.entity_ids.filter((x: string) => x !== id) : [...f.entity_ids, id]
    const names = entities.filter(e => ids.includes(e.id)).map(e => e.legal_name)
    return { ...f, entity_ids: ids, entity_names: names }
  })

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    const user = getStoredUser()
    setSaving(true)
    setError('')
    try {
      if (setup) {
        await marketingSetupAPI.update(setup.id, { ...form, updated_by_email: user?.email || '' })
      } else {
        await marketingSetupAPI.create({ ...form, created_by_email: user?.email || '' })
      }
      onSaved()
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '640px', maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #EDF2F7', flexShrink: 0 }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>{setup ? 'Edit Marketing Setup' : 'New Marketing Setup'}</h2>
        </div>
        <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={lbl}>Name</div>
            <input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. France Setup" />
          </div>
          <div>
            <div style={lbl}>Company description</div>
            <textarea style={{ ...inp, minHeight: '70px', resize: 'vertical' as const }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What does the company do?" />
          </div>
          <div>
            <div style={lbl}>Services we propose</div>
            <textarea style={{ ...inp, minHeight: '70px', resize: 'vertical' as const }} value={form.services} onChange={e => setForm({ ...form, services: e.target.value })} placeholder="Products and services offered" />
          </div>
          <div>
            <div style={lbl}>Target countries</div>
            <TagInput tags={form.target_countries} onChange={t => setForm({ ...form, target_countries: t })} placeholder="Country, e.g. France" />
          </div>
          <div>
            <div style={lbl}>Target audience at our customers</div>
            <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' as const }} value={form.target_audience} onChange={e => setForm({ ...form, target_audience: e.target.value })} placeholder="e.g. Compliance officers, HR directors, CISOs" />
          </div>
          <div>
            <div style={lbl}>Marketing objectives</div>
            <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' as const }} value={form.marketing_objectives} onChange={e => setForm({ ...form, marketing_objectives: e.target.value })} placeholder="What are we trying to achieve?" />
          </div>
          <div>
            <div style={lbl}>Applies to</div>
            <EntityChecklist allEntities={form.all_entities} selectedIds={form.entity_ids} entities={entities} onToggleAll={toggleAllEntities} onToggleEntity={toggleEntity} />
          </div>
          {error && <div style={{ fontSize: '11px', color: '#DC2626' }}>⚠️ {error}</div>}
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid #EDF2F7', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ ...btn, background: saving ? '#94A3B8' : '#156082', color: 'white' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MarketingSetupPage() {
  const { canEdit } = useMarketingPerm('marketing_setup')
  const [setups, setSetups] = useState<any[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [listError, setListError] = useState('')

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

  const remove = async (id: string) => {
    if (!confirm('Delete this marketing setup?')) return
    await marketingSetupAPI.delete(id)
    load()
  }

  return (
    <MarketingLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: 0 }}>📋 Marketing Setup</h1>
        {canEdit && (
          <button onClick={() => setShowAdd(true)} style={{ ...btn, background: '#156082', color: 'white' }}>+ Add Marketing Setup</button>
        )}
      </div>

      <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 16px' }}>
        Describe the company, its services, target markets and objectives for one or more legal entities — used across the module, including to ground the competitor suggestions in Competitor Analysis.
      </p>

      {listError && <div style={{ ...card, color: '#DC2626', fontSize: '12px' }}>⚠️ {listError}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>
      ) : setups.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '48px', color: '#94A3B8' }}>
          No marketing setups yet — add one to start.
        </div>
      ) : (
        setups.map((s: any) => (
          <div key={s.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#156082' }}>{s.name}</div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                  {s.all_entities ? 'All Legal Entities' : (s.entity_names || []).length > 0 ? (s.entity_names || []).join(', ') : 'No legal entities assigned'}
                  {' · '}Last updated {fmtDate(s.updated_at)}
                </div>
                {s.description && <p style={{ fontSize: '12px', color: '#3F3F3F', margin: '10px 0 0' }}>{s.description}</p>}
                {(s.target_countries || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px', marginTop: '10px' }}>
                    {s.target_countries.map((c: string) => (
                      <span key={c} style={{ fontSize: '10px', fontWeight: '700', background: '#EFF6FF', color: '#2563EB', padding: '3px 8px', borderRadius: '10px' }}>{c}</span>
                    ))}
                  </div>
                )}
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => setEditing(s)} style={{ ...btn, padding: '6px 12px', background: '#F1F5F9', color: '#64748B' }}>Edit</button>
                  <button onClick={() => remove(s.id)} style={{ ...btn, padding: '6px 12px', background: '#FEF2F2', color: '#EF4444' }}>Delete</button>
                </div>
              )}
            </div>
          </div>
        ))
      )}

      {(showAdd || editing) && (
        <SetupModal
          setup={editing}
          entities={entities}
          onClose={() => { setShowAdd(false); setEditing(null) }}
          onSaved={() => { setShowAdd(false); setEditing(null); load() }}
        />
      )}
    </MarketingLayout>
  )
}
