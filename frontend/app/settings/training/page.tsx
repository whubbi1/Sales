'use client'
import { useState, useEffect, useRef } from 'react'
import ProfileLayout from '@/components/ProfileLayout'
import { getStoredUser } from '@/lib/auth'

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
          style={{ fontSize: '12px', color: '#3F3F3F', fontWeight: '500', cursor: 'pointer', padding: '3px 5px', margin: '-3px -5px', borderRadius: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <span>{display || <span style={{ color: '#94A3B8' }}>—</span>}</span>
          <span style={{ opacity: 0.35, fontSize: '10px' }}>✎</span>
        </div>
      )}
    </div>
  )
}

function AddTrainingModal({ onClose, onSave }: any) {
  const [form, setForm] = useState({ training_date: '', name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>Add Training</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Date of Training</label>
            <input type="date" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.training_date} onChange={e => setForm(f => ({ ...f, training_date: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Name *</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '70px', resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
            <button onClick={submit} disabled={saving || !form.name.trim()}
              style={{ padding: '9px 18px', background: saving || !form.name.trim() ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              {saving ? 'Saving…' : 'Add Training'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CompleteModal({ plan, onClose, onSave }: any) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState(plan.description || '')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    setSaving(true)
    await onSave(plan, date, description, file)
    setSaving(false)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>Mark "{plan.training_name}" Complete</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Completion Date *</label>
            <input type="date" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '60px', resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Proof / Certificate (optional)</label>
            <input type="file" style={{ fontSize: '12px', fontFamily: 'Montserrat, sans-serif' }} onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
            <button onClick={submit} disabled={saving || !date}
              style={{ padding: '9px 18px', background: saving || !date ? '#94A3B8' : '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              {saving ? 'Saving…' : '✓ Mark Complete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TrainingPage() {
  const [email, setEmail] = useState('')
  const [plans, setPlans] = useState<any[]>([])
  const [trainings, setTrainings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [completingPlan, setCompletingPlan] = useState<any>(null)
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    const user = getStoredUser()
    if (user?.email) { setEmail(user.email); load(user.email) }
    else setLoading(false)
  }, [])

  const load = async (email: string) => {
    setLoading(true)
    const [pr, tr] = await Promise.all([
      fetch(`${API}/training/assignments/${encodeURIComponent(email)}`).then(r => r.json()).catch(() => ({ assignments: [] })),
      fetch(`${API}/training/trainings/${encodeURIComponent(email)}`).then(r => r.json()).catch(() => ({ trainings: [] })),
    ])
    setPlans(pr.assignments || [])
    setTrainings(tr.trainings || [])
    setLoading(false)
  }

  const addTraining = async (form: any) => {
    await fetch(`${API}/training/trainings/${encodeURIComponent(email)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    setShowAdd(false)
    load(email)
  }

  const patchTraining = async (t: any, fields: any) => {
    await fetch(`${API}/training/trainings/${encodeURIComponent(email)}/${t.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ training_date: t.training_date, name: t.name, description: t.description, ...fields }),
    })
    setEditing(null)
    load(email)
  }

  const deleteTraining = async (t: any) => {
    if (!confirm(`Delete "${t.name}"?`)) return
    await fetch(`${API}/training/trainings/${encodeURIComponent(email)}/${t.id}`, { method: 'DELETE' })
    load(email)
  }

  const uploadFile = async (t: any, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    await fetch(`${API}/training/trainings/${encodeURIComponent(email)}/${t.id}/upload`, { method: 'POST', body: fd })
    load(email)
  }

  const completePlan = async (plan: any, date: string, description: string, file: File | null) => {
    const fd = new FormData()
    fd.append('completion_date', date)
    fd.append('description', description)
    if (file) fd.append('file', file)
    await fetch(`${API}/training/assignments/${encodeURIComponent(email)}/${plan.id}/complete`, { method: 'POST', body: fd })
    setCompletingPlan(null)
    load(email)
  }

  const activePlans = plans.filter(p => p.status === 'assigned')

  return (
    <ProfileLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Training</h1>
          <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>Your training plan and performed trainings</p>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading...</div>}

        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Training Plan */}
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', margin: '0 0 14px' }}>Training Plan</h3>
              {activePlans.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#94A3B8' }}>No trainings currently assigned to you.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activePlans.map(p => {
                    const overdue = p.due_date && new Date(p.due_date) < new Date()
                    return (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', background: overdue ? '#FEF2F2' : '#F8FAFC', borderRadius: '10px', border: `1px solid ${overdue ? '#FECACA' : '#EDF2F7'}` }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: '#156082' }}>{p.training_name}</div>
                          {p.description && <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{p.description}</div>}
                          <div style={{ fontSize: '11px', color: overdue ? '#DC2626' : '#94A3B8', marginTop: '4px', fontWeight: overdue ? '700' : '400' }}>
                            {overdue ? '⚠️ Overdue — ' : 'Due '}{p.due_date ? new Date(p.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'no due date'}
                          </div>
                        </div>
                        <button onClick={() => setCompletingPlan(p)} style={{ padding: '7px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', flexShrink: 0 }}>✓ Mark Complete</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Performed Trainings */}
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', margin: 0 }}>Performed Trainings</h3>
                <button onClick={() => setShowAdd(true)} style={{ padding: '6px 14px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>+ Add Training</button>
              </div>
              {trainings.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#94A3B8' }}>No trainings recorded yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {trainings.map(t => (
                    <div key={t.id} style={{ padding: '14px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #EDF2F7' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: '14px', alignItems: 'start' }}>
                        <EditableField label="Date" display={t.training_date ? new Date(t.training_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null}
                          editing={editing && editing.id === t.id && editing.field === 'training_date'} onStartEdit={() => setEditing({ id: t.id, field: 'training_date' })}>
                          <input autoFocus type="date" style={inp} defaultValue={t.training_date || ''} onBlur={e => patchTraining(t, { training_date: e.target.value })} />
                        </EditableField>
                        <div>
                          <EditableField label="Name" display={<span style={{ fontWeight: '700', color: '#156082' }}>{t.name}</span>}
                            editing={editing && editing.id === t.id && editing.field === 'name'} onStartEdit={() => setEditing({ id: t.id, field: 'name' })}>
                            <input autoFocus style={inp} defaultValue={t.name} onBlur={e => patchTraining(t, { name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                          </EditableField>
                          <div style={{ marginTop: '6px' }}>
                            <EditableField label="Description" display={t.description}
                              editing={editing && editing.id === t.id && editing.field === 'description'} onStartEdit={() => setEditing({ id: t.id, field: 'description' })}>
                              <textarea autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '60px', resize: 'vertical' }} defaultValue={t.description} onBlur={e => patchTraining(t, { description: e.target.value })} />
                            </EditableField>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                          {t.file_url ? (
                            <a href={t.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#3B82F6', fontWeight: '700', textDecoration: 'none' }}>📎 {t.file_name || 'View file'}</a>
                          ) : (
                            <button onClick={() => fileInputs.current[t.id]?.click()} style={{ padding: '5px 10px', background: '#EFF6FF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#3B82F6', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>📎 Upload</button>
                          )}
                          <input ref={el => { fileInputs.current[t.id] = el }} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(t, f) }} />
                          <button onClick={() => deleteTraining(t)} style={{ padding: '5px 10px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#EF4444', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {showAdd && <AddTrainingModal onClose={() => setShowAdd(false)} onSave={addTraining} />}
        {completingPlan && <CompleteModal plan={completingPlan} onClose={() => setCompletingPlan(null)} onSave={completePlan} />}
      </div>
    </ProfileLayout>
  )
}
