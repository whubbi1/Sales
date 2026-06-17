'use client'
// components/clients/ClientArticles.tsx
import { useState, useEffect } from 'react'
import { clientsAPI } from '@/lib/api'

export function ClientArticles({ clientId }: { clientId: string }) {
  const [articles, setArticles] = useState<any[]>([])
  const [form, setForm] = useState({ title: '', url: '', description: '' })
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = async () => { setArticles(await clientsAPI.getArticles(clientId)) }
  useEffect(() => { load() }, [clientId])

  const handleAdd = async () => {
    if (!form.title || !form.url) return
    setSaving(true)
    try {
      await clientsAPI.createArticle(clientId, form)
      setForm({ title: '', url: '', description: '' })
      setShowForm(false)
      load()
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <p className="section-title">Articles & Links</p>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Add Link</button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input className="form-input" placeholder="Article title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <input className="form-input" placeholder="URL * (https://...)" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} />
            <textarea className="form-input" placeholder="Description (optional)" value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} style={{ resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-primary" onClick={handleAdd} disabled={saving}>{saving ? 'Saving...' : 'Add'}</button>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {articles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔗</div>
          <div className="empty-state-title">No articles yet</div>
          <div className="empty-state-desc">Add links to relevant articles about this client</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {articles.map(article => (
            <div key={article.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px',
              padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '8px', background: 'white'
            }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '7px', background: 'var(--secondary)',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0
              }}>🔗</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={article.url} target="_blank" rel="noopener"
                  style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)', textDecoration: 'none', display: 'block', marginBottom: '2px' }}>
                  {article.title} ↗
                </a>
                <p style={{ fontSize: '11px', color: 'var(--secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>{article.url}</p>
                {article.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{article.description}</p>}
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {new Date(article.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => clientsAPI.deleteArticle(clientId, article.id).then(load)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', flexShrink: 0, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
