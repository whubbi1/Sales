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

function AddCertModal({ onClose, onSave }: any) {
  const [form, setForm] = useState({ cert_date: '', name: '', description: '' })
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
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>Add Certification</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Date of Certification</label>
            <input type="date" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.cert_date} onChange={e => setForm(f => ({ ...f, cert_date: e.target.value }))} />
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
              {saving ? 'Saving…' : 'Add Certification'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CertificationsPage() {
  const [email, setEmail] = useState('')
  const [certifications, setCertifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    const user = getStoredUser()
    if (user?.email) { setEmail(user.email); load(user.email) }
    else setLoading(false)
  }, [])

  const load = async (email: string) => {
    setLoading(true)
    const d = await fetch(`${API}/training/certifications/${encodeURIComponent(email)}`).then(r => r.json()).catch(() => ({ certifications: [] }))
    setCertifications(d.certifications || [])
    setLoading(false)
  }

  const addCert = async (form: any) => {
    await fetch(`${API}/training/certifications/${encodeURIComponent(email)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    setShowAdd(false)
    load(email)
  }

  const patchCert = async (c: any, fields: any) => {
    await fetch(`${API}/training/certifications/${encodeURIComponent(email)}/${c.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cert_date: c.cert_date, name: c.name, description: c.description, ...fields }),
    })
    setEditing(null)
    load(email)
  }

  const deleteCert = async (c: any) => {
    if (!confirm(`Delete "${c.name}"?`)) return
    await fetch(`${API}/training/certifications/${encodeURIComponent(email)}/${c.id}`, { method: 'DELETE' })
    load(email)
  }

  const uploadFile = async (c: any, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    await fetch(`${API}/training/certifications/${encodeURIComponent(email)}/${c.id}/upload`, { method: 'POST', body: fd })
    load(email)
  }

  return (
    <ProfileLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Certifications</h1>
            <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>Your obtained certifications</p>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>+ Add Certification</button>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading...</div>}

        {!loading && (
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            {certifications.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>No certifications recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {certifications.map(c => (
                  <div key={c.id} style={{ padding: '14px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #EDF2F7' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: '14px', alignItems: 'start' }}>
                      <EditableField label="Date" display={c.cert_date ? new Date(c.cert_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null}
                        editing={editing && editing.id === c.id && editing.field === 'cert_date'} onStartEdit={() => setEditing({ id: c.id, field: 'cert_date' })}>
                        <input autoFocus type="date" style={inp} defaultValue={c.cert_date || ''} onBlur={e => patchCert(c, { cert_date: e.target.value })} />
                      </EditableField>
                      <div>
                        <EditableField label="Name" display={<span style={{ fontWeight: '700', color: '#156082' }}>{c.name}</span>}
                          editing={editing && editing.id === c.id && editing.field === 'name'} onStartEdit={() => setEditing({ id: c.id, field: 'name' })}>
                          <input autoFocus style={inp} defaultValue={c.name} onBlur={e => patchCert(c, { name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                        </EditableField>
                        <div style={{ marginTop: '6px' }}>
                          <EditableField label="Description" display={c.description}
                            editing={editing && editing.id === c.id && editing.field === 'description'} onStartEdit={() => setEditing({ id: c.id, field: 'description' })}>
                            <textarea autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '60px', resize: 'vertical' }} defaultValue={c.description} onBlur={e => patchCert(c, { description: e.target.value })} />
                          </EditableField>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                        {c.file_url ? (
                          <a href={c.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#3B82F6', fontWeight: '700', textDecoration: 'none' }}>📎 {c.file_name || 'View file'}</a>
                        ) : (
                          <button onClick={() => fileInputs.current[c.id]?.click()} style={{ padding: '5px 10px', background: '#EFF6FF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#3B82F6', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>📎 Upload</button>
                        )}
                        <input ref={el => { fileInputs.current[c.id] = el }} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(c, f) }} />
                        <button onClick={() => deleteCert(c)} style={{ padding: '5px 10px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#EF4444', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showAdd && <AddCertModal onClose={() => setShowAdd(false)} onSave={addCert} />}
      </div>
    </ProfileLayout>
  )
}
