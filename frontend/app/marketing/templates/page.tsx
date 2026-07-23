'use client'
import { useState, useEffect } from 'react'
import { MarketingLayout, useMarketingPerm } from '@/components/MarketingLayout'
import { marketingAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { RichTextEditor } from '@/components/shared/RichTextEditor'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, ColumnResizeHandle, SortArrow, Pagination } from '@/components/it/ReportBuilder'

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

const COLUMNS: ReportColumn[] = [
  { key: 'short_title', label: 'Short Title', filterable: 'text' },
  { key: 'email_title', label: 'Email Title', filterable: 'text' },
  { key: 'language', label: 'Language', filterable: 'select', options: LANGUAGES },
  { key: 'audience_display', label: 'Audience', filterable: 'text' },
  { key: 'updated_at', label: 'Updated' },
]

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  short_title: 220, email_title: 240, language: 120, audience_display: 220, updated_at: 130,
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
  const [attachments, setAttachments] = useState<any[]>(template?.attachments || [])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleAudience = (jt: string) => setAudience(prev => prev.includes(jt) ? prev.filter(x => x !== jt) : [...prev, jt])

  const uploadAttachment = async (file: File) => {
    if (!template) return
    setUploading(true)
    try {
      const a = await marketingAPI.uploadTemplateAttachment(template.id, file)
      setAttachments(prev => [...prev, a])
    } catch (e: any) { setError(e.message) }
    finally { setUploading(false) }
  }
  const deleteAttachment = async (a: any) => {
    if (!template) return
    await marketingAPI.deleteTemplateAttachment(template.id, a.id)
    setAttachments(prev => prev.filter(x => x.id !== a.id))
  }

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
          <div>
            <label style={lbl}>Attachments</label>
            {!template ? (
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>Save the template first, then reopen it to attach documents.</p>
            ) : (
              <>
                <label style={{ display: 'inline-block', padding: '7px 14px', background: '#EFF6FF', color: '#156082', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', marginBottom: '8px' }}>
                  {uploading ? 'Uploading…' : '+ Attach Document'}
                  <input type="file" style={{ display: 'none' }} disabled={uploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadAttachment(f); e.target.value = '' }} />
                </label>
                {attachments.length === 0 ? (
                  <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>No documents attached yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {attachments.map((a: any) => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', border: '1px solid #EDF2F7', borderRadius: '7px' }}>
                        <a href={a.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#156082', fontWeight: '600', textDecoration: 'none' }}>📎 {a.title}</a>
                        <button onClick={() => deleteAttachment(a)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
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
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null)
  const [userEmail, setUserEmail] = useState('')

  const rb = useReportBuilder('marketing_email_template', COLUMNS, userEmail)

  const load = async () => {
    setLoading(true)
    try { setTemplates((await marketingAPI.listEmailTemplates()).templates || []) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }
  const openTemplate = async (t: any) => {
    // The list response doesn't include attachments (kept light, same as Events) — the full
    // GET does, so re-fetch before opening the edit modal.
    try { setEditing(await marketingAPI.getEmailTemplate(t.id)) } catch { setEditing(t) }
    setShowModal(true)
  }

  useEffect(() => {
    load()
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

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

  const withDisplay = templates.map((t: any) => ({ ...t, audience_display: (t.audience || []).join(', ') }))
  const searched = withDisplay.filter((t: any) => !search || t.short_title.toLowerCase().includes(search.toLowerCase()))
  const reported = applyReport(searched, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const pageRows = reported.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>✉️ Template Emails</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{reported.length} template{reported.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ReportPanel columns={COLUMNS} rb={rb} />
          {canEdit && (
            <button onClick={() => { setEditing(null); setShowModal(true) }} style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
              + New Template
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <input style={{ ...inp, width: '260px' }} placeholder="Search short title…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflowX: 'auto', overflowY: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', maxWidth: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {COLUMNS.filter(c => isVisible(c.key)).map(c => (
                <th key={c.key} onClick={() => rb.toggleSort(c.key)} style={{ position: 'relative', padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: `${rb.columnWidths[c.key] || DEFAULT_COLUMN_WIDTHS[c.key] || 150}px`, cursor: 'pointer', userSelect: 'none' }}>
                  {c.label}<SortArrow active={rb.sortField === c.key} dir={rb.sortDir} />
                  <ColumnResizeHandle colKey={c.key} rb={rb} />
                </th>
              ))}
              <th style={{ borderBottom: '1px solid #EDF2F7', width: '40px' }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : reported.length === 0 ? (
              <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No templates yet.</td></tr>
            ) : pageRows.map((t: any) => (
              <tr key={t.id} onClick={() => openTemplate(t)} style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                onMouseEnter={ev => (ev.currentTarget.style.background = '#FAFBFC')} onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
                {isVisible('short_title') && <td style={{ padding: '10px 12px', fontWeight: '700', color: '#156082', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.short_title}</td>}
                {isVisible('email_title') && <td style={{ padding: '10px 12px', color: '#3F3F3F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.email_title || '—'}</td>}
                {isVisible('language') && <td style={{ padding: '10px 12px', color: '#64748B' }}>{t.language || '—'}</td>}
                {isVisible('audience_display') && <td style={{ padding: '10px 12px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.audience_display || '—'}</td>}
                {isVisible('updated_at') && <td style={{ padding: '10px 12px', color: '#64748B' }}>{fmtDate(t.updated_at)}</td>}
                <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                  {canEdit && <button onClick={() => setDeleteConfirm(t)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={rb.page} setPage={rb.setPage} total={reported.length} />
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
