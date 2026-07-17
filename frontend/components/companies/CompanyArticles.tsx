'use client'
import { useState, useEffect } from 'react'
import { companiesAPI, contactsAPI } from '@/lib/api'
import { EmptyState } from '@/components/shared/RecordLayout'

// Small expandable panel for managing an article's *additional* company/contact links
// (beyond the one company/contact it was created under) — lazy-loads only when opened.
// Exported so ContactArticles.tsx can reuse it — the underlying company_articles/
// article_companies/article_contacts tables are shared regardless of which side created it.
export function ArticleLinksPanel({ article, companyId, onClose }: { article: any; companyId: string; onClose: () => void }) {
  const [links, setLinks] = useState<{ companies: any[]; contacts: any[] }>({ companies: [], contacts: [] })
  const [allCompanies, setAllCompanies] = useState<any[]>([])
  const [allContacts, setAllContacts] = useState<any[]>([])
  const [companySearch, setCompanySearch] = useState('')
  const [contactSearch, setContactSearch] = useState('')

  const load = () => companiesAPI.getArticleLinks(article.id).then(setLinks)
  useEffect(() => {
    load()
    companiesAPI.list({}).then(setAllCompanies).catch(() => {})
    contactsAPI.list({}).then(setAllContacts).catch(() => {})
  }, [article.id])

  const linkedCompanyIds = new Set(links.companies.map((c: any) => c.id))
  const linkedContactIds = new Set(links.contacts.map((c: any) => c.id))

  const companyOptions = allCompanies
    .filter((c: any) => c.id !== companyId && !linkedCompanyIds.has(c.id))
    .filter((c: any) => !companySearch.trim() || c.name.toLowerCase().includes(companySearch.trim().toLowerCase()))
    .sort((a: any, b: any) => a.name.localeCompare(b.name))

  const contactName = (c: any) => `${c.first_name} ${c.last_name}`
  const contactOptions = allContacts
    .filter((c: any) => !linkedContactIds.has(c.id))
    .filter((c: any) => !contactSearch.trim() || contactName(c).toLowerCase().includes(contactSearch.trim().toLowerCase()))
    .sort((a: any, b: any) => contactName(a).localeCompare(contactName(b)))

  return (
    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px', marginTop: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: '#45B6E4' }}>Linked Companies & Contacts</span>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9B9B9B', fontSize: '14px', lineHeight: 1 }}>×</button>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '4px' }}>Companies</div>
        {links.companies.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
            {links.companies.map((c: any) => (
              <span key={c.id} style={{ background: '#EFF6FF', color: '#2563EB', padding: '3px 9px', borderRadius: '12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {c.name}
                <button onClick={() => companiesAPI.unlinkArticleCompany(article.id, c.id).then(load)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563EB', fontSize: '13px', lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
        )}
        <input className="form-input" style={{ width: '100%', boxSizing: 'border-box' as const, marginBottom: '4px' }} placeholder="Search companies to link…" value={companySearch} onChange={e => setCompanySearch(e.target.value)} />
        {companySearch.trim() && (
          <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
            {companyOptions.slice(0, 15).map((c: any) => (
              <div key={c.id} onClick={() => companiesAPI.linkArticleCompany(article.id, c.id).then(() => { setCompanySearch(''); load() })}
                style={{ padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{c.name}</div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '4px' }}>Contacts</div>
        {links.contacts.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
            {links.contacts.map((c: any) => (
              <span key={c.id} style={{ background: '#FFF7ED', color: '#D97706', padding: '3px 9px', borderRadius: '12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {c.name}
                <button onClick={() => companiesAPI.unlinkArticleContact(article.id, c.id).then(load)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#D97706', fontSize: '13px', lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
        )}
        <input className="form-input" style={{ width: '100%', boxSizing: 'border-box' as const, marginBottom: '4px' }} placeholder="Search contacts to link…" value={contactSearch} onChange={e => setContactSearch(e.target.value)} />
        {contactSearch.trim() && (
          <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
            {contactOptions.slice(0, 15).map((c: any) => (
              <div key={c.id} onClick={() => companiesAPI.linkArticleContact(article.id, c.id).then(() => { setContactSearch(''); load() })}
                style={{ padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{contactName(c)}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function CompanyArticles({ companyId }: { companyId: string }) {
  const [articles, setArticles] = useState<any[]>([])
  const [form, setForm] = useState({ title: '', url: '', description: '' })
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [managingId, setManagingId] = useState<string | null>(null)
  const load = async () => setArticles(await companiesAPI.getArticles(companyId))
  useEffect(() => { load() }, [companyId])
  const handleAdd = async () => {
    if (!form.title || !form.url) return
    setSaving(true)
    try { await companiesAPI.createArticle(companyId, form); setForm({ title: '', url: '', description: '' }); setShowForm(false); load() }
    finally { setSaving(false) }
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B' }}>Articles & Links</span>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Add Link</button>
      </div>
      {showForm && (
        <div style={{ background: '#F5F7FA', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input className="form-input" placeholder="Article title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <input className="form-input" placeholder="URL * (https://...)" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} />
            <textarea className="form-input" placeholder="Description (optional)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} style={{ resize: 'vertical' }} />
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>You can link this to other companies/contacts after saving.</p>
            <div style={{ display: 'flex', gap: '8px' }}><button className="btn-primary" onClick={handleAdd} disabled={saving}>{saving ? 'Saving...' : 'Add'}</button><button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button></div>
          </div>
        </div>
      )}
      {articles.length === 0 ? <EmptyState icon="🔗" title="No articles yet" description="Add links to relevant articles" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {articles.map(a => (
            <div key={a.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white' }}>
                <p style={{
                  flex: 1, minWidth: 0, fontSize: '12px', color: '#3F3F3F', margin: 0,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
                }}>{a.description || a.title}</p>
                <button onClick={() => setManagingId(managingId === a.id ? null : a.id)} title="Manage links"
                  style={{ flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '13px' }}>🔗</button>
                <button onClick={() => window.open(a.url, '_blank', 'noopener')}
                  style={{ flexShrink: 0, padding: '6px 14px', background: '#EFF6FF', color: '#156082', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>Open</button>
                <button onClick={() => companiesAPI.deleteArticle(companyId, a.id).then(load)} style={{ flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer', color: '#9B9B9B', fontSize: '16px', lineHeight: 1 }}>×</button>
              </div>
              {managingId === a.id && <ArticleLinksPanel article={a} companyId={companyId} onClose={() => setManagingId(null)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
