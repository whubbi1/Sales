'use client'
import { useState, useEffect } from 'react'
import { MarketingLayout, useMarketingPerm } from '@/components/MarketingLayout'
import { marketingAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { RichTextEditor } from '@/components/shared/RichTextEditor'

// Mirrors JOB_TYPES in ContactModal.tsx — "audience" targets Contact.job_type values.
const JOB_TYPES = ['CIO', 'CTO', 'CISO', 'SAP Manager', 'SAP Architect', 'SAP GRC', 'SAP Security Manager', 'SAP Technical Manager', 'Cybersecurity Architect', 'SOC Manager', 'Internal Audit', 'CFO', 'Partner', 'Buyer', 'Other']
const LANGUAGES = ['English', 'French', 'German', 'Spanish', 'Other']

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

function fmtDate(d: string) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

function TemplateModal({ template, onClose, onSaved }: { template: any; onClose: () => void; onSaved: () => void }) {
  const [shortTitle, setShortTitle] = useState(template?.short_title || '')
  const [emailTitle, setEmailTitle] = useState(template?.email_title || '')
  const [language, setLanguage] = useState(template?.language || 'English')
  const [audience, setAudience] = useState<string[]>(template?.audience || [])
  const [content, setContent] = useState(template?.content || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleAudience = (jt: string) => setAudience(prev => prev.includes(jt) ? prev.filter(x => x !== jt) : [...prev, jt])

  const submit = async () => {
    if (!shortTitle.trim()) { setError('Short title is required'); return }
    setSaving(true); setError('')
    try {
      const me = getStoredUser()
      const payload = { short_title: shortTitle.trim(), email_title: emailTitle.trim() || null, language, audience, content, created_by: me?.email || '' }
      if (template) await marketingAPI.updateEmailTemplate(template.id, payload)
      else await marketingAPI.createEmailTemplate(payload)
      onSaved()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '680px', maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>{template ? 'Edit Template' : 'New Template Email'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Short Title *</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' }} value={shortTitle} onChange={e => setShortTitle(e.target.value)} placeholder="Internal name, e.g. Q3 Newsletter" />
          </div>
          <div>
            <label style={lbl}>Email Title (subject)</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' }} value={emailTitle} onChange={e => setEmailTitle(e.target.value)} placeholder="Subject line as recipients will see it" />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Language</label>
              <select style={{ ...inp, width: '100%' }} value={language} onChange={e => setLanguage(e.target.value)}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>Audience (Contact Job Type)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '90px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px' }}>
              {JOB_TYPES.map(jt => (
                <label key={jt} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '3px 8px', borderRadius: '6px', background: audience.includes(jt) ? '#EEF2FF' : '#F8FAFC', cursor: 'pointer' }}>
                  <input type="checkbox" checked={audience.includes(jt)} onChange={() => toggleAudience(jt)} />
                  {jt}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label style={lbl}>Content</label>
            <RichTextEditor value={content} onChange={setContent} minHeight="260px" />
          </div>
          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid #EDF2F7', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ padding: '9px 18px', background: saving ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
            {saving ? 'Saving…' : template ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TemplatesContent() {
  const { level, canEdit } = useMarketingPerm('email_templates')
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try { setTemplates((await marketingAPI.listEmailTemplates()).templates || []) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  if (level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )

  const handleDelete = async (t: any) => {
    await marketingAPI.deleteEmailTemplate(t.id)
    setDeleteConfirm(null)
    load()
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>✉️ Template Emails</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditing(null); setShowModal(true) }} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
            + New Template
          </button>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {['Short Title', 'Email Title', 'Language', 'Audience', 'Updated', ''].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : templates.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No templates yet.</td></tr>
            ) : templates.map((t: any) => (
              <tr key={t.id} style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                onClick={() => { setEditing(t); setShowModal(true) }}
                onMouseEnter={ev => (ev.currentTarget.style.background = '#FAFBFC')} onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '10px 12px', fontWeight: '700', color: '#156082' }}>{t.short_title}</td>
                <td style={{ padding: '10px 12px', color: '#3F3F3F' }}>{t.email_title || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#64748B' }}>{t.language || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#64748B' }}>{(t.audience || []).length ? (t.audience || []).join(', ') : '—'}</td>
                <td style={{ padding: '10px 12px', color: '#64748B' }}>{fmtDate(t.updated_at)}</td>
                <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                  {canEdit && <button onClick={() => setDeleteConfirm(t)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <TemplateModal template={editing} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null) }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '380px', padding: '22px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#144766', margin: '0 0 10px' }}>Delete "{deleteConfirm.short_title}"?</h3>
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 16px' }}>This cannot be undone. Mailings that already used this template keep their own copy of the content.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '8px 16px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ padding: '8px 16px', background: '#DC2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TemplatesPage() {
  return <MarketingLayout><TemplatesContent /></MarketingLayout>
}
