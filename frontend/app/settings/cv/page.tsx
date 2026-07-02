'use client'
import { useState, useEffect } from 'react'
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

const EMPTY_EXP = { job_title: '', company: '', start_date: '', end_date: '', location: '', description: '' }

function EditableField({ label, display, editing, onStartEdit, children, big }: any) {
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
      <div style={lbl}>{label}</div>
      {editing ? children : (
        <div onClick={onStartEdit} title="Click to edit"
          style={{ fontSize: big ? '16px' : '13px', fontWeight: big ? '800' : '500', color: big ? '#156082' : '#3F3F3F', cursor: 'pointer', padding: '3px 5px', margin: '-3px -5px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', minHeight: '20px' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <span style={{ whiteSpace: 'pre-wrap' }}>{display || <span style={{ color: '#94A3B8', fontWeight: 400, fontSize: '12px' }}>Click to add…</span>}</span>
          <span style={{ opacity: 0.35, fontSize: '10px', flexShrink: 0 }}>✎</span>
        </div>
      )}
    </div>
  )
}

function TagEditor({ label, tags, onAdd, onRemove }: any) {
  const [value, setValue] = useState('')
  const add = () => {
    const v = value.trim()
    if (!v) return
    onAdd(v)
    setValue('')
  }
  return (
    <div>
      <div style={lbl}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
        {tags.length === 0 && <span style={{ fontSize: '12px', color: '#94A3B8' }}>None added yet.</span>}
        {tags.map((t: string, i: number) => (
          <span key={i} style={{ background: '#EFF6FF', color: '#156082', padding: '4px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {t}
            <button onClick={() => onRemove(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#3B82F6', fontSize: '13px', fontWeight: '800', padding: 0, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input style={{ ...inp, flex: 1 }} placeholder={`Add ${label.toLowerCase()}…`} value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }} />
        <button onClick={add} style={{ padding: '7px 14px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>+ Add</button>
      </div>
    </div>
  )
}

export default function CurriculumVitaePage() {
  const [email, setEmail] = useState('')
  const [cv, setCv] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [showExpModal, setShowExpModal] = useState(false)
  const [editingExp, setEditingExp] = useState<any>(null)
  const [expForm, setExpForm] = useState<any>(EMPTY_EXP)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const user = getStoredUser()
    if (user?.email) { setEmail(user.email); load(user.email) }
    else setLoading(false)
  }, [])

  const load = async (email: string) => {
    setLoading(true)
    const d = await fetch(`${API}/cv/${encodeURIComponent(email)}`).then(r => r.json()).catch(() => null)
    setCv(d?.cv || null)
    setLoading(false)
  }

  const patch = async (fields: any) => {
    const payload = {
      first_name: cv.first_name, last_name: cv.last_name, title: cv.title,
      short_description: cv.short_description, skills: cv.skills, languages: cv.languages,
      ...fields,
    }
    setCv((c: any) => ({ ...c, ...fields }))
    await fetch(`${API}/cv/${encodeURIComponent(email)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    setEditingField(null)
    load(email)
  }

  const openAddExp = () => { setExpForm(EMPTY_EXP); setEditingExp(null); setShowExpModal(true) }
  const openEditExp = (exp: any) => {
    setExpForm({ job_title: exp.job_title || '', company: exp.company || '', start_date: exp.start_date || '', end_date: exp.end_date || '', location: exp.location || '', description: exp.description || '' })
    setEditingExp(exp)
    setShowExpModal(true)
  }

  const saveExp = async () => {
    if (!expForm.job_title.trim()) return
    setSaving(true)
    if (editingExp) {
      await fetch(`${API}/cv/${encodeURIComponent(email)}/experience/${editingExp.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(expForm),
      })
    } else {
      await fetch(`${API}/cv/${encodeURIComponent(email)}/experience`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(expForm),
      })
    }
    setSaving(false)
    setShowExpModal(false)
    load(email)
  }

  const deleteExp = async (exp: any) => {
    if (!confirm(`Delete "${exp.job_title}" at ${exp.company}?`)) return
    await fetch(`${API}/cv/${encodeURIComponent(email)}/experience/${exp.id}`, { method: 'DELETE' })
    load(email)
  }

  return (
    <ProfileLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Curriculum Vitae</h1>
          <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>Click any field to edit — changes save automatically</p>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading...</div>}

        {!loading && cv && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
            {/* Left */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Header */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                  <EditableField label="First Name" display={cv.first_name} big editing={editingField === 'first_name'} onStartEdit={() => setEditingField('first_name')}>
                    <input autoFocus style={inp} defaultValue={cv.first_name} onBlur={e => patch({ first_name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                  </EditableField>
                  <EditableField label="Last Name" display={cv.last_name} big editing={editingField === 'last_name'} onStartEdit={() => setEditingField('last_name')}>
                    <input autoFocus style={inp} defaultValue={cv.last_name} onBlur={e => patch({ last_name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                  </EditableField>
                </div>
                <EditableField label="Title" display={cv.title} editing={editingField === 'title'} onStartEdit={() => setEditingField('title')}>
                  <input autoFocus style={inp} defaultValue={cv.title} onBlur={e => patch({ title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                </EditableField>
                <EditableField label="Short Description" display={cv.short_description} editing={editingField === 'short_description'} onStartEdit={() => setEditingField('short_description')}>
                  <textarea autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '70px', resize: 'vertical' }} defaultValue={cv.short_description} onBlur={e => patch({ short_description: e.target.value })} />
                </EditableField>
              </div>

              {/* Experience */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', margin: 0 }}>Experience</h3>
                  <button onClick={openAddExp} style={{ padding: '6px 14px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>+ Add Experience</button>
                </div>
                {(cv.experiences || []).length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#94A3B8' }}>No experience added yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {cv.experiences.map((exp: any) => (
                      <div key={exp.id} style={{ padding: '14px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #EDF2F7' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: '#156082' }}>{exp.job_title}</div>
                            <div style={{ fontSize: '12px', color: '#3F3F3F', fontWeight: '600' }}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</div>
                            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{exp.start_date || '—'} → {exp.end_date || 'Present'}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button onClick={() => openEditExp(exp)} style={{ padding: '5px 10px', background: '#EFF6FF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#3B82F6', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Edit</button>
                            <button onClick={() => deleteExp(exp)} style={{ padding: '5px 10px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#EF4444', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Delete</button>
                          </div>
                        </div>
                        {exp.description && <div style={{ fontSize: '12px', color: '#3F3F3F', marginTop: '8px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{exp.description}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Trainings (read-only, populated once Training page exists) */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', margin: '0 0 12px' }}>Trainings</h3>
                {(cv.trainings || []).length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#94A3B8' }}>No trainings recorded yet. Add them from the Training page.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {cv.trainings.map((t: any) => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9', fontSize: '12px' }}>
                        <span style={{ fontWeight: '600', color: '#3F3F3F' }}>{t.name}</span>
                        <span style={{ color: '#94A3B8' }}>{t.training_date}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Certifications (read-only, populated once Certifications page exists) */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', margin: '0 0 12px' }}>Certifications</h3>
                {(cv.certifications || []).length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#94A3B8' }}>No certifications recorded yet. Add them from the Certifications page.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {cv.certifications.map((c: any) => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9', fontSize: '12px' }}>
                        <span style={{ fontWeight: '600', color: '#3F3F3F' }}>{c.name}</span>
                        <span style={{ color: '#94A3B8' }}>{c.cert_date}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Skills & Languages */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <TagEditor label="Compétences" tags={cv.skills || []}
                  onAdd={(v: string) => patch({ skills: [...(cv.skills || []), v] })}
                  onRemove={(i: number) => patch({ skills: (cv.skills || []).filter((_: any, idx: number) => idx !== i) })} />
              </div>
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <TagEditor label="Languages" tags={cv.languages || []}
                  onAdd={(v: string) => patch({ languages: [...(cv.languages || []), v] })}
                  onRemove={(i: number) => patch({ languages: (cv.languages || []).filter((_: any, idx: number) => idx !== i) })} />
              </div>
            </div>
          </div>
        )}

        {/* Experience Modal */}
        {showExpModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) setShowExpModal(false) }}>
            <div style={{ background: 'white', borderRadius: '14px', width: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>{editingExp ? 'Edit Experience' : 'Add Experience'}</h2>
                <button onClick={() => setShowExpModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
              </div>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={lbl}>Job Title *</label>
                    <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={expForm.job_title} onChange={e => setExpForm((f: any) => ({ ...f, job_title: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lbl}>Company</label>
                    <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={expForm.company} onChange={e => setExpForm((f: any) => ({ ...f, company: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={lbl}>Start Date</label>
                    <input type="month" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={expForm.start_date} onChange={e => setExpForm((f: any) => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lbl}>End Date</label>
                    <input type="month" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} placeholder="Present" value={expForm.end_date} onChange={e => setExpForm((f: any) => ({ ...f, end_date: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lbl}>Location</label>
                    <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={expForm.location} onChange={e => setExpForm((f: any) => ({ ...f, location: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Description</label>
                  <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '80px', resize: 'vertical' }} value={expForm.description} onChange={e => setExpForm((f: any) => ({ ...f, description: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowExpModal(false)} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
                  <button onClick={saveExp} disabled={saving || !expForm.job_title.trim()}
                    style={{ padding: '9px 18px', background: saving || !expForm.job_title.trim() ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
                    {saving ? 'Saving…' : editingExp ? 'Save Changes' : 'Add Experience'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProfileLayout>
  )
}
