'use client'
import { useState, useEffect } from 'react'
import { partnersAPI } from '@/lib/api'
import { EmptyState } from '@/components/shared/RecordLayout'
import { ArticleLinksPanel } from '@/components/companies/CompanyArticles'

export function PartnerArticles({ partnerId }: { partnerId: string }) {
  const [articles, setArticles] = useState<any[]>([])
  const [form, setForm] = useState({ title: '', url: '', description: '' })
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [managingId, setManagingId] = useState<string | null>(null)
  const load = async () => setArticles(await partnersAPI.getArticles(partnerId))
  useEffect(() => { load() }, [partnerId])
  const handleAdd = async () => {
    if (!form.title || !form.url) return
    setSaving(true)
    try { await partnersAPI.createArticle(partnerId, form); setForm({ title: '', url: '', description: '' }); setShowForm(false); load() }
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
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>You can link this to companies/contacts/other partners after saving.</p>
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
                <button onClick={() => partnersAPI.deleteArticle(partnerId, a.id).then(load)} style={{ flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer', color: '#9B9B9B', fontSize: '16px', lineHeight: 1 }}>×</button>
              </div>
              {managingId === a.id && <ArticleLinksPanel article={a} companyId="" onClose={() => setManagingId(null)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
