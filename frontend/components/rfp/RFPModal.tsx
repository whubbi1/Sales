'use client'
// components/rfp/RFPModal.tsx
import { useState, useEffect } from 'react'
import { rfpAPI } from '@/lib/api'

function FormField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

export function RFPModal({ rfp, onClose, onSave }: any) {
  const [users, setUsers] = useState<any[]>([])
  const [approverSearch, setApproverSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: rfp?.name || '',
    owner: rfp?.owner || '',
    owner_email: rfp?.owner_email || '',
    approvers: rfp?.approvers || [],
    status: rfp?.status || 'Open',
  })

  useEffect(() => {
    fetch('https://api.whubbi.wcomply.com/settings/users').then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {})
  }, [])

  const approverName = (u: any) => u.display_name || `${u.first_name} ${u.last_name}`
  const scopedUsers = users
    .filter((u: any) => !approverSearch.trim() || approverName(u).toLowerCase().includes(approverSearch.trim().toLowerCase()))
    .sort((a: any, b: any) => approverName(a).localeCompare(approverName(b)))

  const toggleApprover = (u: any) => {
    setForm(p => ({
      ...p,
      approvers: p.approvers.some((a: any) => a.email === u.email)
        ? p.approvers.filter((a: any) => a.email !== u.email)
        : [...p.approvers, { email: u.email, name: approverName(u) }]
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      await rfpAPI.update(rfp.id, form)
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>Edit RFP</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <FormField label="RFP Name" full>
            <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <FormField label="Owner">
              <select className="form-input" value={form.owner_email} onChange={e => {
                const u = users.find((uu: any) => uu.email === e.target.value)
                setForm(p => ({ ...p, owner_email: e.target.value, owner: u ? approverName(u) : '' }))
              }}>
                <option value="">Select employee…</option>
                {[...users].sort((a, b) => approverName(a).localeCompare(approverName(b))).map((u: any) => <option key={u.email} value={u.email}>{approverName(u)}</option>)}
              </select>
            </FormField>
            <FormField label="Status">
              <select className="form-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                <option value="Open">Open</option>
                <option value="Submitted">Submitted</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
              </select>
            </FormField>
          </div>

          <div>
            <p className="section-label">Approvers</p>
            {form.approvers.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                {form.approvers.map((a: any) => (
                  <span key={a.email} style={{ background: '#EFF6FF', color: '#2563EB', padding: '3px 9px', borderRadius: '12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {a.name || a.email}
                    <button onClick={() => setForm(p => ({ ...p, approvers: p.approvers.filter((x: any) => x.email !== a.email) }))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563EB', fontSize: '13px', lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            )}
            <input className="form-input" style={{ marginBottom: '6px' }} placeholder="Search employees…" value={approverSearch} onChange={e => setApproverSearch(e.target.value)} />
            <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '4px' }}>
              {scopedUsers.map((u: any) => {
                const checked = form.approvers.some((a: any) => a.email === u.email)
                return (
                  <label key={u.email} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', cursor: 'pointer', borderRadius: '6px', background: checked ? '#EFF8FD' : 'transparent' }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleApprover(u)} style={{ accentColor: '#219BD6', width: '14px', height: '14px' }} />
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#144766' }}>{approverName(u)}</div>
                  </label>
                )
              })}
            </div>
          </div>

          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}
