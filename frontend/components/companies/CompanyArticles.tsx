'use client'
import { useState, useEffect } from 'react'
import { companiesAPI } from '@/lib/api'
import { EmptyState } from '@/components/shared/RecordLayout'

export function CompanyArticles({ companyId }: { companyId: string }) {
  const [articles, setArticles] = useState<any[]>([])
  const [form, setForm] = useState({ title: '', url: '', description: '' })
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
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
            <div style={{ display: 'flex', gap: '8px' }}><button className="btn-primary" onClick={handleAdd} disabled={saving}>{saving ? 'Saving...' : 'Add'}</button><button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button></div>
          </div>
        </div>
      )}
      {articles.length === 0 ? <EmptyState icon="🔗" title="No articles yet" description="Add links to relevant articles" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {articles.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={a.url} target="_blank" rel="noopener" style={{ fontSize: '12px', fontWeight: '700', color: '#144766', textDecoration: 'none', display: 'block', marginBottom: '2px' }}>{a.title} ↗</a>
                <p style={{ fontSize: '10px', color: '#219BD6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{a.url}</p>
                {a.description && <p style={{ fontSize: '11px', color: '#9B9B9B', margin: '3px 0 0' }}>{a.description}</p>}
              </div>
              <button onClick={() => companiesAPI.deleteArticle(companyId, a.id).then(load)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9B9B9B', fontSize: '16px', lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
