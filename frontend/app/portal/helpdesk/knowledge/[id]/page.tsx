'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getStoredPortalUser, portalApiJson } from '@/lib/portalAuth'
import { recordPortalPageVisit } from '@/lib/portalRecentPages'

interface Article { id: string; title: string; content: string; category: string | null; tags: string | null; author_name: string; views: number }

export default function PortalKnowledgeArticlePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [article, setArticle] = useState<Article | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const user = getStoredPortalUser()
    if (!user) { router.replace('/portal/login'); return }
    portalApiJson<Article>(`/helpdesk/knowledge/${id}`)
      .then(a => {
        setArticle(a)
        recordPortalPageVisit(user.email, `/portal/helpdesk/knowledge/${id}`, a.title)
      })
      .catch(() => setError(true))
  }, [id, router])

  const tags = (article?.tags || '').split(',').map(t => t.trim()).filter(Boolean)

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ background: '#156082', padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: 'white', fontSize: '15px', fontWeight: 800 }}>Helpdesk</div>
        <img src="/wcomply-logo.png" alt="WCOMPLY" style={{ height: '40px', objectFit: 'contain' }} />
      </div>

      <div style={{ padding: '32px 40px', maxWidth: '760px', margin: '0 auto' }}>
        <button onClick={() => router.push('/portal/helpdesk/knowledge')}
          style={{ background: 'none', border: 'none', color: '#156082', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: '16px' }}>
          ← Back to Knowledge Base
        </button>

        {error ? (
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            Article not found.
          </div>
        ) : !article ? (
          <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '40px' }}>Loading…</div>
        ) : (
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            {article.category && <span style={{ background: '#EFF6FF', color: '#156082', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, display: 'inline-block', marginBottom: '10px' }}>{article.category}</span>}
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#156082', margin: '0 0 8px' }}>{article.title}</h1>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '16px' }}>By {article.author_name} · 👁 {article.views} views</div>
            {tags.length > 0 && (
              <div style={{ marginBottom: '16px', display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                {tags.map(t => <span key={t} style={{ background: '#F1F5F9', color: '#45B6E4', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>#{t}</span>)}
              </div>
            )}
            <div style={{ fontSize: '13px', color: '#3F3F3F', lineHeight: 1.8, whiteSpace: 'pre-wrap' as const }}>{article.content}</div>
          </div>
        )}
      </div>
    </div>
  )
}
