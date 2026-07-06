'use client'
import { useState, useEffect } from 'react'
import { partnersAPI, companiesAPI, contactsAPI } from '@/lib/api'
import { EmptyState } from '@/components/shared/RecordLayout'

const S_COLOR: Record<string, string> = { open: '#94A3B8', in_progress: '#D97706', done: '#059669' }
const S_BG: Record<string, string> = { open: '#F1F5F9', in_progress: '#FFFBEB', done: '#F0FDF4' }
const S_NEXT: Record<string, string> = { open: 'in_progress', in_progress: 'done', done: 'open' }
const S_LABEL: Record<string, string> = { open: 'Open', in_progress: 'In progress', done: 'Done' }

const EMPTY_FORM = { title: '', description: '', company_id: '', contact_id: '', owner_email: '', owner_name: '', due_date: '' }

function ActionItemEditModal({ item, companies, contacts, onClose, onSave }: any) {
  const [form, setForm] = useState({
    title: item.title || '', description: item.description || '',
    company_id: item.company_id || '', contact_id: item.contact_id || '',
    owner_email: item.owner_email || '', owner_name: item.owner_name || '',
    due_date: item.due_date ? item.due_date.slice(0, 10) : '', status: item.status || 'open',
  })
  const [saving, setSaving] = useState(false)
  const contactsForCompany = form.company_id ? contacts.filter((c: any) => c.company_id === form.company_id) : contacts

  const save = async () => {
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>Edit Action</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div><label className="form-label">Title *</label><input className="form-input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
          <div><label className="form-label">Description</label><textarea className="form-input" rows={2} style={{ resize: 'vertical' }} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label className="form-label">Company</label>
              <select className="form-input" value={form.company_id} onChange={e => setForm(p => ({ ...p, company_id: e.target.value, contact_id: '' }))}>
                <option value="">No company</option>
                {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Contact</label>
              <select className="form-input" value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))}>
                <option value="">No contact</option>
                {contactsForCompany.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Owner Email</label>
              <input className="form-input" placeholder="owner@wcomply.com" value={form.owner_email} onChange={e => setForm(p => ({ ...p, owner_email: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Owner Name</label>
              <input className="form-input" value={form.owner_name} onChange={e => setForm(p => ({ ...p, owner_name: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Due Date</label>
              <input type="date" className="form-input" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                <option value="open">Open</option><option value="in_progress">In progress</option><option value="done">Done</option>
              </select>
            </div>
          </div>
          <p style={{ fontSize: '10px', color: '#9B9B9B', marginTop: '4px', marginBottom: 0 }}>
            If the owner's email is an @wcomply.com address, this also creates a task in their Task Manager.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving || !form.title.trim()}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

export function PartnerActionItems({ partnerId }: { partnerId: string }) {
  const [items, setItems] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [editItem, setEditItem] = useState<any>(null)

  const load = async () => setItems(await partnersAPI.getActionItems(partnerId))
  useEffect(() => {
    load()
    companiesAPI.list({}).then(setCompanies)
    contactsAPI.list({}).then(setContacts)
  }, [partnerId])

  const handleAdd = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await partnersAPI.createActionItem(partnerId, form)
      setForm(EMPTY_FORM); setShowForm(false); load()
    } finally { setSaving(false) }
  }

  const cycleStatus = (item: any) => partnersAPI.updateActionItem(partnerId, item.id, { status: S_NEXT[item.status] }).then(load)
  const remove = (item: any) => { if (confirm(`Delete "${item.title}"?`)) partnersAPI.deleteActionItem(partnerId, item.id).then(load) }
  const saveTitle = async (item: any) => {
    setEditingTitleId(null)
    if (titleDraft.trim() && titleDraft !== item.title) await partnersAPI.updateActionItem(partnerId, item.id, { title: titleDraft.trim() })
    load()
  }
  const saveEditModal = async (fields: any) => {
    await partnersAPI.updateActionItem(partnerId, editItem.id, fields)
    setEditItem(null)
    load()
  }

  const contactsForCompany = form.company_id ? contacts.filter((c: any) => c.company_id === form.company_id) : contacts

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B' }}>
          Action Items ({items.filter(i => i.status !== 'done').length} open)
        </span>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ New Action</button>
      </div>

      {showForm && (
        <div style={{ background: '#F5F7FA', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ gridColumn: '1/-1' }}><input className="form-input" placeholder="Action title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div style={{ gridColumn: '1/-1' }}><textarea className="form-input" placeholder="Description" rows={2} style={{ resize: 'vertical' }} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div>
              <label className="form-label">Company</label>
              <select className="form-input" value={form.company_id} onChange={e => setForm(p => ({ ...p, company_id: e.target.value, contact_id: '' }))}>
                <option value="">No company</option>
                {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Contact</label>
              <select className="form-input" value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))}>
                <option value="">No contact</option>
                {contactsForCompany.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Owner Email</label>
              <input className="form-input" placeholder="owner@wcomply.com" value={form.owner_email} onChange={e => setForm(p => ({ ...p, owner_email: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Owner Name</label>
              <input className="form-input" value={form.owner_name} onChange={e => setForm(p => ({ ...p, owner_name: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Due Date</label>
              <input type="date" className="form-input" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <button className="btn-primary" onClick={handleAdd} disabled={saving}>{saving ? 'Saving...' : 'Create Action'}</button>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
          <p style={{ fontSize: '10px', color: '#9B9B9B', marginTop: '8px', marginBottom: 0 }}>
            If the owner's email is an @wcomply.com address, this also creates a task in their Task Manager.
          </p>
        </div>
      )}

      {items.length === 0 ? <EmptyState icon="📋" title="No action items yet" description="Create an action to track partner follow-ups" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', opacity: item.status === 'done' ? 0.65 : 1 }}>
              <button onClick={() => cycleStatus(item)} style={{ width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0, marginTop: '2px', border: `2px solid ${S_COLOR[item.status]}`, background: item.status === 'done' ? S_COLOR[item.status] : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: 'white' }}>{item.status === 'done' ? '✓' : ''}</button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px', flexWrap: 'wrap' }}>
                  {editingTitleId === item.id ? (
                    <input autoFocus className="form-input" style={{ fontSize: '12px', padding: '3px 6px', width: '220px' }} value={titleDraft}
                      onChange={e => setTitleDraft(e.target.value)} onBlur={() => saveTitle(item)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingTitleId(null) }} />
                  ) : (
                    <span onClick={() => { setEditingTitleId(item.id); setTitleDraft(item.title) }} title="Click to edit"
                      style={{ fontSize: '12px', fontWeight: '600', color: '#3F3F3F', textDecoration: item.status === 'done' ? 'line-through' : 'none', cursor: 'pointer', padding: '2px 4px', margin: '-2px -4px', borderRadius: '4px' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{item.title}</span>
                  )}
                  <span style={{ background: S_BG[item.status], color: S_COLOR[item.status], padding: '1px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>{S_LABEL[item.status]}</span>
                  {item.task_id && <span style={{ background: '#EFF6FF', color: '#156082', padding: '1px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700' }}>✓ Task created</span>}
                </div>
                {item.description && <div style={{ fontSize: '11px', color: '#6B6B6B', marginBottom: '3px' }}>{item.description}</div>}
                <div style={{ display: 'flex', gap: '10px', fontSize: '10px', color: '#9B9B9B', flexWrap: 'wrap' }}>
                  {item.company_name && <span>🏢 {item.company_name}</span>}
                  {(item.contact_first_name || item.contact_last_name) && <span>👤 {item.contact_first_name} {item.contact_last_name}</span>}
                  {item.owner_name && <span>Owner: {item.owner_name}</span>}
                  {item.due_date && <span>Due {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                </div>
              </div>
              <button onClick={() => setEditItem(item)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>Edit</button>
              <button onClick={() => remove(item)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9B9B9B', fontSize: '16px', lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}
      {editItem && <ActionItemEditModal item={editItem} companies={companies} contacts={contacts} onClose={() => setEditItem(null)} onSave={saveEditModal} />}
    </div>
  )
}
