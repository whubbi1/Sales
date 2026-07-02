'use client'
import { useState, useEffect } from 'react'
import TrainingLayout, { useTrainingPerm } from '@/components/TrainingLayout'

const API = 'https://api.whubbi.wcomply.com'

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

function EditableField({ label, display, editing, onStartEdit, children }: any) {
  return (
    <div>
      {label && <div style={lbl}>{label}</div>}
      {editing ? children : (
        <div onClick={onStartEdit} title="Click to edit"
          style={{ fontSize: '13px', color: '#3F3F3F', cursor: 'pointer', padding: '3px 5px', margin: '-3px -5px', borderRadius: '5px' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          {display || <span style={{ color: '#94A3B8' }}>—</span>}
        </div>
      )}
    </div>
  )
}

function NewPlanModal({ catalog, onClose, onSave }: any) {
  const [form, setForm] = useState<{ training_function: string; description: string; items: { catalog_id: string; sequence: number }[] }>({ training_function: '', description: '', items: [] })
  const [saving, setSaving] = useState(false)
  const isSelected = (id: string) => form.items.some(i => i.catalog_id === id)
  const toggle = (id: string) => setForm(f => {
    if (f.items.some(i => i.catalog_id === id)) return { ...f, items: f.items.filter(i => i.catalog_id !== id) }
    const nextSeq = f.items.length > 0 ? Math.max(...f.items.map(i => i.sequence)) + 1 : 1
    return { ...f, items: [...f.items, { catalog_id: id, sequence: nextSeq }] }
  })
  const setSeq = (id: string, sequence: number) => setForm(f => ({ ...f, items: f.items.map(i => i.catalog_id === id ? { ...i, sequence } : i) }))
  const submit = async () => {
    if (!form.training_function.trim()) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '560px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>New Training Plan</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Training Function *</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder="e.g. Sales Representative" value={form.training_function} onChange={e => setForm(f => ({ ...f, training_function: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '60px', resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Assigned Trainings — Training Sequence *</label>
            {catalog.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>No trainings in the catalogue yet — create some first.</p>
            ) : (
              <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                {catalog.map((c: any) => {
                  const item = form.items.find(i => i.catalog_id === c.id)
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 }}>
                        <input type="checkbox" checked={isSelected(c.id)} onChange={() => toggle(c.id)} />
                        <span style={{ fontWeight: '600' }}>{c.title}</span>
                        <span style={{ color: '#94A3B8' }}>· {c.company} · {c.duration}</span>
                      </label>
                      {item && (
                        <input type="number" min={1} style={{ ...inp, width: '56px', flexShrink: 0 }} value={item.sequence}
                          onChange={e => setSeq(c.id, parseInt(e.target.value) || 1)} title="Sequence" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
            <button onClick={submit} disabled={saving || !form.training_function.trim()}
              style={{ padding: '9px 18px', background: saving || !form.training_function.trim() ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              {saving ? 'Creating…' : 'Create Plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlansContent() {
  const { canEdit } = useTrainingPerm()
  const [plans, setPlans] = useState<any[]>([])
  const [catalog, setCatalog] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null)
  const [addingCatalogId, setAddingCatalogId] = useState('')
  const [addingSequence, setAddingSequence] = useState(1)
  const [editingSeq, setEditingSeq] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [pr, cr] = await Promise.all([
      fetch(`${API}/training/plans`).then(r => r.json()).catch(() => ({ plans: [] })),
      fetch(`${API}/training/catalog`).then(r => r.json()).catch(() => ({ catalog: [] })),
    ])
    setPlans(pr.plans || [])
    setCatalog(cr.catalog || [])
    setLoading(false)
  }

  const createPlan = async (form: any) => {
    await fetch(`${API}/training/plans`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setShowNew(false)
    load()
  }

  const patchPlan = async (plan: any, fields: any) => {
    await fetch(`${API}/training/plans/${plan.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ training_function: plan.training_function, description: plan.description, ...fields }),
    })
    setEditing(null)
    load()
  }

  const deletePlan = async (plan: any) => {
    if (!confirm(`Delete the "${plan.training_function}" plan?`)) return
    await fetch(`${API}/training/plans/${plan.id}`, { method: 'DELETE' })
    load()
  }

  const addTrainingToPlan = async (plan: any) => {
    if (!addingCatalogId) return
    await fetch(`${API}/training/plans/${plan.id}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalog_id: addingCatalogId, sequence: addingSequence }),
    })
    setAddingCatalogId('')
    setAddingSequence(1)
    load()
  }

  const removeTrainingFromPlan = async (plan: any, itemId: string) => {
    await fetch(`${API}/training/plans/${plan.id}/items/${itemId}`, { method: 'DELETE' })
    load()
  }

  const updateItemSequence = async (plan: any, itemId: string, sequence: number) => {
    await fetch(`${API}/training/plans/${plan.id}/items/${itemId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sequence }),
    })
    setEditingSeq(null)
    load()
  }

  const isEditing = (id: string, field: string) => editing?.id === id && editing.field === field

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>🗂️ Training Plans</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{plans.length} plan{plans.length !== 1 ? 's' : ''} · bundles of trainings for a function</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowNew(true)} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>+ New Plan</button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>
      ) : plans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94A3B8', background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7' }}>No training plans yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {plans.map(plan => {
            const isExpanded = expandedId === plan.id
            const attachedIds = new Set((plan.trainings || []).map((t: any) => t.id))
            const availableToAdd = catalog.filter(c => !attachedIds.has(c.id))
            return (
              <div key={plan.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ flex: 1 }}>
                    <EditableField display={<span style={{ fontWeight: '800', color: '#156082', fontSize: '14px' }}>{plan.training_function}</span>}
                      editing={isEditing(plan.id, 'training_function')} onStartEdit={() => canEdit && setEditing({ id: plan.id, field: 'training_function' })}>
                      <input autoFocus style={inp} defaultValue={plan.training_function} onBlur={e => patchPlan(plan, { training_function: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                    </EditableField>
                    <div style={{ marginTop: '4px' }}>
                      <EditableField display={<span style={{ fontSize: '12px', color: '#64748B' }}>{plan.description}</span>}
                        editing={isEditing(plan.id, 'description')} onStartEdit={() => canEdit && setEditing({ id: plan.id, field: 'description' })}>
                        <textarea autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '50px', resize: 'vertical' }} defaultValue={plan.description} onBlur={e => patchPlan(plan, { description: e.target.value })} />
                      </EditableField>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>📋 {(plan.trainings || []).length} training{(plan.trainings || []).length !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => {
                      setExpandedId(isExpanded ? null : plan.id)
                      const maxSeq = (plan.trainings || []).reduce((m: number, t: any) => Math.max(m, t.sequence || 0), 0)
                      setAddingSequence(maxSeq + 1)
                    }} style={{ padding: '6px 12px', background: '#F1F5F9', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', color: '#64748B', fontFamily: 'Montserrat, sans-serif', fontWeight: '600' }}>
                      {isExpanded ? '▲ Collapse' : '▼ Trainings'}
                    </button>
                    {canEdit && (
                      <button onClick={() => deletePlan(plan)} style={{ padding: '6px 12px', background: '#FEF2F2', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', color: '#EF4444', fontFamily: 'Montserrat, sans-serif', fontWeight: '600' }}>Delete</button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid #EDF2F7', background: '#FAFBFC', padding: '14px 20px' }}>
                    {(plan.trainings || []).length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '10px' }}>No trainings attached yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                        {plan.trainings.map((t: any) => (
                          <div key={t.item_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'white', borderRadius: '8px', border: '1px solid #EDF2F7' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {editingSeq === t.item_id ? (
                                <input type="number" min={1} autoFocus style={{ ...inp, width: '48px' }} defaultValue={t.sequence}
                                  onBlur={e => updateItemSequence(plan, t.item_id, parseInt(e.target.value) || 1)}
                                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                              ) : (
                                <span onClick={() => canEdit && setEditingSeq(t.item_id)} title="Click to edit sequence"
                                  style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#EFF6FF', color: '#156082', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', cursor: canEdit ? 'pointer' : 'default', flexShrink: 0 }}>
                                  {t.sequence ?? '—'}
                                </span>
                              )}
                              <span style={{ fontSize: '12px' }}><strong>{t.title}</strong> · {t.company} · {t.duration}</span>
                            </div>
                            {canEdit && (
                              <button onClick={() => removeTrainingFromPlan(plan, t.item_id)} style={{ padding: '3px 9px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', color: '#EF4444', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Remove</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {canEdit && availableToAdd.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select style={{ ...inp, flex: 1 }} value={addingCatalogId} onChange={e => setAddingCatalogId(e.target.value)}>
                          <option value="">Add a training…</option>
                          {availableToAdd.map(c => <option key={c.id} value={c.id}>{c.title} · {c.company}</option>)}
                        </select>
                        <input type="number" min={1} style={{ ...inp, width: '70px' }} value={addingSequence} title="Sequence"
                          onChange={e => setAddingSequence(parseInt(e.target.value) || 1)} />
                        <button onClick={() => addTrainingToPlan(plan)} disabled={!addingCatalogId} style={{ padding: '7px 14px', background: addingCatalogId ? '#156082' : '#94A3B8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>+ Add</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showNew && <NewPlanModal catalog={catalog} onClose={() => setShowNew(false)} onSave={createPlan} />}
    </div>
  )
}

export default function TrainingPlansPage() {
  return <TrainingLayout><PlansContent /></TrainingLayout>
}
