'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredPortalUser, portalApiJson } from '@/lib/portalAuth'
import { recordPortalPageVisit } from '@/lib/portalRecentPages'

interface Article { id: string; title: string; category: string | null; excerpt: string; author_name: string; views: number }

export default function PortalKnowledgeBasePage() {
  const router = useRouter()
  const [articles, setArticles] = useState<Article[] | null>(null)
  const [search, setSearch] = useState('')

  const load = (q: string) => {
    const p = new URLSearchParams()
    if (q) p.set('search', q)
    portalApiJson<{ articles: Article[] }>(`/helpdesk/knowledge?${p}`).then(d => setArticles(d.articles || [])).catch(() => setArticles([]))
  }

  useEffect(() => {
    const user = getStoredPortalUser()
    if (!user) { router.replace('/portal/login'); return }
    recordPortalPageVisit(user.email, '/portal/helpdesk/knowledge')
    load('')
  }, [router])

  useEffect(() => {
    const t = setTimeout(() => load(search), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ background: '#156082', padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: 'white', fontSize: '15px', fontWeight: 800 }}>Helpdesk</div>
        <img src="/wcomply-logo.png" alt="WCOMPLY" style={{ height: '40px', objectFit: 'contain' }} />
      </div>

      <div style={{ padding: '32px 40px', maxWidth: '760px', margin: '0 auto' }}>
        <button onClick={() => router.push('/portal/home')}
          style={{ background: 'none', border: 'none', color: '#156082', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: '16px' }}>
          ← Back
        </button>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #EDF2F7' }}>
          <button onClick={() => router.push('/portal/helpdesk')}
            style={{ padding: '10px 4px', fontSize: '12px', fontWeight: 700, color: '#94A3B8', background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
            🎫 Tickets
          </button>
          <div style={{ padding: '10px 4px', fontSize: '12px', fontWeight: 700, color: '#156082', borderBottom: '2px solid #156082' }}>📚 Knowledge Base</div>
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles…"
          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', fontFamily: 'Montserrat, sans-serif', marginBottom: '20px', boxSizing: 'border-box' }} />

        {articles === null ? (
          <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '40px' }}>Loading…</div>
        ) : articles.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            No articles found.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {articles.map(a => (
              <button key={a.id} onClick={() => router.push(`/portal/helpdesk/knowledge/${a.id}`)}
                style={{ textAlign: 'left', background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '14px 18px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                {a.category && <span style={{ background: '#EFF6FF', color: '#156082', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, display: 'inline-block', marginBottom: '6px' }}>{a.category}</span>}
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#156082' }}>{a.title}</div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px' }}>{a.excerpt}…</div>
                <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '8px' }}>By {a.author_name} · 👁 {a.views} views</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
