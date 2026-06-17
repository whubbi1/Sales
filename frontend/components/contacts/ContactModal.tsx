'use client'
// components/contacts/ContactModal.tsx
import { useState, useEffect } from 'react'
import { contactsAPI, companiesAPI } from '@/lib/api'

const JOB_TYPES = ['CIO','CTO','CISO','SAP Manager','SAP Architect','SAP GRC','SAP Security Manager','SAP Technical Manager','Cybersecurity Architect','SOC Manager','Internal Audit','CFO','Partner','Buyer','Other']
const SUBSCRIPTIONS = ['Marketing Information','Customer Service Communication','One to One']

// All world languages for the dropdown
const LANGUAGES = [
  'Afrikaans','Albanian','Amharic','Arabic','Armenian','Azerbaijani','Basque','Belarusian','Bengali','Bosnian',
  'Bulgarian','Catalan','Cebuano','Chinese (Simplified)','Chinese (Traditional)','Croatian','Czech','Danish',
  'Dutch','English','Esperanto','Estonian','Finnish','French','Galician','Georgian','German','Greek','Gujarati',
  'Haitian Creole','Hausa','Hebrew','Hindi','Hmong','Hungarian','Icelandic','Igbo','Indonesian','Irish',
  'Italian','Japanese','Javanese','Kannada','Kazakh','Khmer','Korean','Kurdish','Kyrgyz','Lao','Latin',
  'Latvian','Lithuanian','Luxembourgish','Macedonian','Malagasy','Malay','Malayalam','Maltese','Maori',
  'Marathi','Mongolian','Myanmar (Burmese)','Nepali','Norwegian','Pashto','Persian','Polish','Portuguese',
  'Punjabi','Romanian','Russian','Samoan','Serbian','Sesotho','Shona','Sindhi','Sinhala','Slovak','Slovenian',
  'Somali','Spanish','Sudanese','Swahili','Swedish','Tajik','Tamil','Telugu','Thai','Turkish','Ukrainian',
  'Urdu','Uzbek','Vietnamese','Welsh','Xhosa','Yiddish','Yoruba','Zulu'
]

export function ContactModal({ contact, onClose, onSave }: any) {
  const [companies, setCompanies] = useState<any[]>([])
  const [form, setForm] = useState({
    first_name: contact?.first_name || '',
    last_name: contact?.last_name || '',
    company_id: contact?.company_id || contact?.company?.id || '',
    email: contact?.email || '',
    mobile_phone: contact?.mobile_phone || '',
    office_phone: contact?.office_phone || '',
    linkedin_url: contact?.linkedin_url || '',
    job_name: contact?.job_name || '',
    job_type: contact?.job_type || '',
    lead_status: contact?.lead_status || 'New',
    preferred_language: contact?.preferred_language || '',
    subscriptions: contact?.subscriptions || [],
    assigned_to: contact?.assigned_to || '',
    notes: contact?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    companiesAPI.list({}).then(setCompanies).catch(() => {})
  }, [])

  const toggleSub = (sub: string) => {
    setForm(p => ({
      ...p,
      subscriptions: p.subscriptions.includes(sub)
        ? p.subscriptions.filter((s: string) => s !== sub)
        : [...p.subscriptions, sub]
    }))
  }

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) { setError('First and last name are required'); return }
    setSaving(true); setError('')
    try {
      const payload = { ...form, company_id: form.company_id || null }
      if (contact) { await contactsAPI.update(contact.id, payload) }
      else { await contactsAPI.create(payload) }
      onSave()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const F = ({ label, children, full }: any) => (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <label className="form-label">{label}</label>{children}
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>{contact ? 'Edit Contact' : 'New Contact'}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Identity */}
          <div>
            <p className="section-label">Identity</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <F label="First Name *"><input className="form-input" value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} placeholder="Marie" /></F>
              <F label="Last Name *"><input className="form-input" value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} placeholder="Dupont" /></F>
              <F label="Company">
                <select className="form-input" value={form.company_id} onChange={e => setForm(p => ({ ...p, company_id: e.target.value }))}>
                  <option value="">No company</option>
                  {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </F>
              <F label="Lead Status">
                <select className="form-input" value={form.lead_status} onChange={e => setForm(p => ({ ...p, lead_status: e.target.value }))}>
                  <option value="New">New</option>
                  <option value="Open">Open</option>
                  <option value="Connected">Connected</option>
                </select>
              </F>
            </div>
          </div>

          {/* Contact info */}
          <div>
            <p className="section-label">Contact Information</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <F label="Email"><input className="form-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="marie@company.com" /></F>
              <F label="Mobile Phone"><input className="form-input" value={form.mobile_phone} onChange={e => setForm(p => ({ ...p, mobile_phone: e.target.value }))} placeholder="+32 470 00 00 00" /></F>
              <F label="Office Phone"><input className="form-input" value={form.office_phone} onChange={e => setForm(p => ({ ...p, office_phone: e.target.value }))} placeholder="+32 2 000 00 00" /></F>
              <F label="LinkedIn">
                <input className="form-input" value={form.linkedin_url} onChange={e => setForm(p => ({ ...p, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/..." />
              </F>
            </div>
          </div>

          {/* Professional */}
          <div>
            <p className="section-label">Professional</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <F label="Job Title"><input className="form-input" value={form.job_name} onChange={e => setForm(p => ({ ...p, job_name: e.target.value }))} placeholder="SAP Security Manager" /></F>
              <F label="Job Type">
                <select className="form-input" value={form.job_type} onChange={e => setForm(p => ({ ...p, job_type: e.target.value }))}>
                  <option value="">Select job type...</option>
                  {JOB_TYPES.map(jt => <option key={jt} value={jt}>{jt}</option>)}
                </select>
              </F>
              <F label="Preferred Language">
                <select className="form-input" value={form.preferred_language} onChange={e => setForm(p => ({ ...p, preferred_language: e.target.value }))}>
                  <option value="">Select language...</option>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </F>
              <F label="Assigned To">
                <input className="form-input" value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} placeholder="Sales rep" />
              </F>
            </div>
          </div>

          {/* Subscriptions */}
          <div>
            <p className="section-label">Subscriptions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SUBSCRIPTIONS.map(sub => (
                <label key={sub} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', border: `1.5px solid ${form.subscriptions.includes(sub) ? '#219BD6' : '#E2E8F0'}`, borderRadius: '8px', cursor: 'pointer', background: form.subscriptions.includes(sub) ? '#EFF8FD' : 'white', transition: 'all 0.12s' }}>
                  <input type="checkbox" checked={form.subscriptions.includes(sub)} onChange={() => toggleSub(sub)} style={{ accentColor: '#219BD6', width: '14px', height: '14px' }} />
                  <span style={{ fontSize: '12px', fontWeight: '600', color: form.subscriptions.includes(sub) ? '#144766' : '#6B6B6B' }}>{sub}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <F label="Notes" full>
            <textarea className="form-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." rows={3} style={{ resize: 'vertical' }} />
          </F>

          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '500' }}>{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : contact ? 'Save Changes' : 'Create Contact'}</button>
        </div>
      </div>
    </div>
  )
}
