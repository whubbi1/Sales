'use client'
// Reusable "Emails" tab for Lead/Opportunity/Contact detail pages — link emails found in the
// user's connected mailbox, or send-and-track a new email (optionally from a Template Email).
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getStoredUser } from '@/lib/auth'
import { outlookAPI, marketingAPI, contactsAPI } from '@/lib/api'
import { RichTextEditor } from '@/components/shared/RichTextEditor'

const btn: React.CSSProperties = {
  padding: '8px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif',
}
const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', width: '100%', boxSizing: 'border-box' as const,
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}

function fmt(dt: string | null) {
  if (!dt) return ''
  return new Date(dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function LinkEmailModal({ email, entityType, entityId, onClose, onLinked }: any) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  const search = async () => {
    if (!q.trim()) return
    setSearching(true); setError('')
    try {
      const d = await outlookAPI.searchEmails(email, q.trim())
      setResults(d.messages || [])
    } catch (e: any) { setError(e.message) }
    finally { setSearching(false) }
  }

  const link = async (m: any) => {
    await outlookAPI.linkEmail({
      entity_type: entityType, entity_id: entityId, provider_message_id: m.id,
      subject: m.subject, from_address: m.from_address, to_addresses: m.to_addresses,
      received_at: m.received_at, body_preview: m.body_preview, created_by: email,
    })
    onLinked()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '560px', maxWidth: '92vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '800', color: '#156082', margin: 0 }}>Link an Email</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '18px 22px', overflowY: 'auto' as const, flex: 1 }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input autoFocus style={inp} placeholder="Search your mailbox (subject, sender…)" value={q}
              onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
            <button onClick={search} disabled={searching} style={{ ...btn, background: '#156082', color: 'white', whiteSpace: 'nowrap' as const }}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {error && <div style={{ fontSize: '11px', color: '#EF4444', marginBottom: '10px' }}>{error}</div>}
          {results && results.length === 0 && <p style={{ fontSize: '12px', color: '#94A3B8' }}>No matching emails found.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(results || []).map(m => (
              <div key={m.id} style={{ padding: '12px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#156082', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.subject || '(no subject)'}</div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>{m.from_address} · {fmt(m.received_at)}</div>
                </div>
                <button onClick={() => link(m)} style={{ ...btn, background: '#EFF6FF', color: '#156082', whiteSpace: 'nowrap' as const }}>Link</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SendEmailModal({ email, entityType, entityId, defaultContact, onClose, onSent }: any) {
  const [templates, setTemplates] = useState<any[]>([])
  const [templateId, setTemplateId] = useState('')
  const [contactId, setContactId] = useState(defaultContact?.id || '')
  const [contactSearch, setContactSearch] = useState('')
  const [contactResults, setContactResults] = useState<any[]>(defaultContact ? [defaultContact] : [])
  const [toAddress, setToAddress] = useState(defaultContact?.email || '')
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { marketingAPI.listEmailTemplates().then(d => setTemplates(d.templates || [])).catch(() => {}) }, [])

  useEffect(() => {
    if (defaultContact || !contactSearch.trim()) return
    const t = setTimeout(() => {
      contactsAPI.list({ search: contactSearch.trim() }).then(d => setContactResults(d.contacts || d || [])).catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [contactSearch, defaultContact])

  const applyTemplate = (tid: string) => {
    setTemplateId(tid)
    const t = templates.find((tt: any) => tt.id === tid)
    if (!t) return
    setSubject(t.email_title || '')
    setContent(t.content || '')
  }

  const pickContact = (c: any) => {
    setContactId(c.id); setToAddress(c.email || ''); setContactResults([c]); setContactSearch(`${c.first_name} ${c.last_name}`)
  }

  const submit = async () => {
    if (!toAddress.trim()) { setError('Recipient email is required'); return }
    setSending(true); setError('')
    try {
      await outlookAPI.sendEmail({
        email, entity_type: entityType, entity_id: entityId,
        to_address: toAddress.trim(), subject, content, template_id: templateId || null,
      })
      onSent()
    } catch (e: any) { setError(e.message) }
    finally { setSending(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '640px', maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '800', color: '#156082', margin: 0 }}>Send Email</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '18px 22px', overflowY: 'auto' as const, flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!defaultContact && (
            <div style={{ position: 'relative' as const }}>
              <label style={lbl}>To (Contact)</label>
              <input style={inp} placeholder="Search contacts by name or email…" value={contactSearch}
                onChange={e => { setContactSearch(e.target.value); setContactId('') }} />
              {contactSearch.trim() && !contactId && contactResults.length > 0 && (
                <div style={{ position: 'absolute' as const, top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', boxShadow: '0 6px 20px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '160px', overflowY: 'auto' as const }}>
                  {contactResults.map((c: any) => (
                    <div key={c.id} onClick={() => pickContact(c)} style={{ padding: '8px 12px', fontSize: '12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}>
                      {c.first_name} {c.last_name} <span style={{ color: '#94A3B8' }}>· {c.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div>
            <label style={lbl}>Recipient email</label>
            <input style={inp} value={toAddress} onChange={e => setToAddress(e.target.value)} placeholder="name@company.com" />
          </div>
          <div>
            <label style={lbl}>Template (optional)</label>
            <select style={inp} value={templateId} onChange={e => applyTemplate(e.target.value)}>
              <option value="">— No template —</option>
              {templates.map((t: any) => <option key={t.id} value={t.id}>{t.short_title}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Subject</label>
            <input style={inp} value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Content</label>
            <RichTextEditor value={content} onChange={setContent} minHeight="200px" />
          </div>
          {error && <div style={{ fontSize: '11px', color: '#EF4444' }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #EDF2F7', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
          <button onClick={submit} disabled={sending} style={{ ...btn, background: sending ? '#94A3B8' : '#156082', color: 'white' }}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function EmailsTab({ entityType, entityId, defaultContact }: { entityType: 'lead' | 'opportunity' | 'contact'; entityId: string; defaultContact?: any }) {
  const [email, setEmail] = useState('')
  const [connected, setConnected] = useState<boolean | null>(null)
  const [emails, setEmails] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showLink, setShowLink] = useState(false)
  const [showSend, setShowSend] = useState(false)

  useEffect(() => {
    const user = getStoredUser()
    if (user?.email) { setEmail(user.email); init(user.email) }
    else setLoading(false)
  }, [])

  const init = async (email: string) => {
    setLoading(true)
    const status = await outlookAPI.status(email).catch(() => ({ connected: false }))
    setConnected(!!status.connected)
    if (status.connected) await loadEmails()
    setLoading(false)
  }

  const loadEmails = async () => {
    const d = await outlookAPI.listLinkedEmails(entityType, entityId).catch(() => ({ emails: [] }))
    setEmails(d.emails || [])
  }

  const unlink = async (id: string) => {
    if (!confirm('Unlink this email? It will no longer show on this record.')) return
    await outlookAPI.unlinkEmail(id)
    loadEmails()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '40px', color: '#45B6E4', fontSize: '12px' }}>Loading…</div>

  if (!connected) {
    return (
      <div style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: '10px', padding: '18px 22px', fontSize: '12px', color: '#1E40AF', lineHeight: 1.6 }}>
        Connect your mailbox to link emails and send tracked emails here.{' '}
        <Link href="/settings/integrations" style={{ color: '#156082', fontWeight: '700' }}>Go to Settings &gt; Integrations</Link>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <button onClick={() => setShowLink(true)} style={{ ...btn, background: '#EFF6FF', color: '#156082' }}>+ Link an Email</button>
        <button onClick={() => setShowSend(true)} style={{ ...btn, background: '#156082', color: 'white' }}>+ Send Email</button>
      </div>

      {emails.length === 0 ? (
        <p style={{ fontSize: '12px', color: '#94A3B8' }}>No emails linked yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {emails.map((e: any) => (
            <div key={e.id} style={{ padding: '14px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '8px', background: e.direction === 'sent' ? '#F0FDF4' : '#EFF6FF', color: e.direction === 'sent' ? '#059669' : '#156082' }}>
                    {e.direction === 'sent' ? 'Sent' : 'Linked'}
                  </span>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#156082' }}>{e.subject || '(no subject)'}</div>
                </div>
                <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
                  {e.from_address} → {(e.to_addresses || []).join(', ')} · {fmt(e.sent_at || e.created_at)}
                  {e.template_short_title && ` · Template: ${e.template_short_title}`}
                </div>
                {e.body_preview && <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px' }}>{e.body_preview.slice(0, 200)}</div>}
              </div>
              <button onClick={() => unlink(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '11px', whiteSpace: 'nowrap' as const }}>Unlink</button>
            </div>
          ))}
        </div>
      )}

      {showLink && <LinkEmailModal email={email} entityType={entityType} entityId={entityId} onClose={() => setShowLink(false)} onLinked={() => { setShowLink(false); loadEmails() }} />}
      {showSend && <SendEmailModal email={email} entityType={entityType} entityId={entityId} defaultContact={defaultContact} onClose={() => setShowSend(false)} onSent={() => { setShowSend(false); loadEmails() }} />}
    </div>
  )
}
