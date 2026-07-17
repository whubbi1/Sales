'use client'
import { useState, useEffect } from 'react'
import { projectsAPI, partnersAPI } from '@/lib/api'

function FormField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

export function InternalProjectModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [partners, setPartners] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    project_name: '', description: '', partner_id: '', start_date: '', end_date: '',
  })

  useEffect(() => { partnersAPI.list({}).then(setPartners).catch(() => {}) }, [])

  const handleSave = async () => {
    if (!form.project_name.trim()) { setError('Project name is required'); return }
    setSaving(true); setError('')
    try {
      await projectsAPI.createInternal({
        project_name: form.project_name.trim(),
        description: form.description.trim() || null,
        partner_id: form.partner_id || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      })
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>New Internal Project</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <FormField label="Project Name *" full>
            <input className="form-input" value={form.project_name} onChange={e => setForm(p => ({ ...p, project_name: e.target.value }))} placeholder="Internal tooling upgrade" />
          </FormField>
          <FormField label="Description" full>
            <textarea className="form-input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} style={{ resize: 'vertical' }} />
          </FormField>
          <FormField label="Involved Partner">
            <select className="form-input" value={form.partner_id} onChange={e => setForm(p => ({ ...p, partner_id: e.target.value }))}>
              <option value="">None</option>
              {partners.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>
          <div />
          <FormField label="Start Date">
            <input className="form-input" type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
          </FormField>
          <FormField label="End Date">
            <input className="form-input" type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
          </FormField>
          {error && <p style={{ color: '#DC2626', fontSize: '12px', gridColumn: '1/-1' }}>{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Creating…' : 'Create Project'}</button>
        </div>
      </div>
    </div>
  )
}
