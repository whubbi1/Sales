'use client'
import { useEffect, useState } from 'react'
import { MarketingLayout, useMarketingPerm } from '@/components/MarketingLayout'
import { TabNav } from '@/components/shared/RecordLayout'
import { getStoredUser } from '@/lib/auth'
import { socialInfluenceAPI } from '@/lib/api'

const btn: React.CSSProperties = {
  padding: '9px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif',
}
const inp: React.CSSProperties = {
  fontSize: '12px', padding: '8px 12px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white', width: '100%', boxSizing: 'border-box' as const,
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}
const card: React.CSSProperties = {
  background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '14px',
}
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  draft:    { bg: '#F1F5F9', text: '#64748B' },
  approved: { bg: '#EFF6FF', text: '#2563EB' },
  posted:   { bg: '#ECFDF5', text: '#059669' },
}

export default function SocialMediaInfluencePage() {
  return <MarketingLayout><SocialMediaInfluenceContent /></MarketingLayout>
}

function SocialMediaInfluenceContent() {
  const { canEdit } = useMarketingPerm('social_media_influence')
  const [tab, setTab] = useState('Sources')

  return (
    <div style={{ padding: '28px 32px', maxWidth: '980px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Social Media Influence</h1>
        <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>
          Monitor information sources and generate on-brand LinkedIn/X post drafts with Claude.
        </p>
      </div>

      <TabNav tabs={['Sources', 'Compose', 'Posts']} active={tab} onChange={setTab} />

      {tab === 'Sources' && <SourcesTab canEdit={canEdit} />}
      {tab === 'Compose' && <ComposeTab canEdit={canEdit} />}
      {tab === 'Posts' && <PostsTab canEdit={canEdit} />}
    </div>
  )
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Sources ──────────────────────────────────────────────────────────────────
function SourcesTab({ canEdit }: { canEdit: boolean }) {
  const [sources, setSources] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [checking, setChecking] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [updates, setUpdates] = useState<any[]>([])

  const load = () => {
    setLoading(true)
    socialInfluenceAPI.listSources().then(d => setSources(d.sources || [])).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const checkNow = async (id: string) => {
    setChecking(id)
    await socialInfluenceAPI.checkSource(id).catch(() => {})
    setChecking(null)
    load()
  }

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    const d = await socialInfluenceAPI.getSourceUpdates(id).catch(() => ({ updates: [] }))
    setUpdates(d.updates || [])
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this source? Its content will no longer be used to generate posts.')) return
    await socialInfluenceAPI.deleteSource(id)
    load()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>

  return (
    <div>
      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
          <button onClick={() => setShowAdd(true)} style={{ ...btn, background: '#156082', color: 'white' }}>+ Add source</button>
        </div>
      )}

      {sources.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '48px', color: '#94A3B8' }}>
          No sources yet — add a website, blog, LinkedIn page, or upload a file to start grounding generated posts.
        </div>
      ) : (
        <div style={card}>
          {sources.map((s, i) => (
            <div key={s.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #F1F5F9', padding: '14px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#156082' }}>
                    {s.source_type === 'file' ? '📄' : s.subtype === 'linkedin' ? '🔗' : '🌐'} {s.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                    {s.source_type === 'url' ? s.url : s.file_name} · {s.check_frequency}
                    {s.source_type === 'url' && ` · last checked ${fmtDate(s.last_checked_at)}`}
                  </div>
                  {s.last_error && <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '2px' }}>⚠️ {s.last_error}</div>}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {s.source_type === 'url' && (
                    <>
                      <button onClick={() => toggleExpand(s.id)} style={{ ...btn, padding: '6px 12px', background: '#F1F5F9', color: '#64748B' }}>
                        {expanded === s.id ? 'Hide history' : 'History'}
                      </button>
                      {canEdit && (
                        <button onClick={() => checkNow(s.id)} disabled={checking === s.id} style={{ ...btn, padding: '6px 12px', background: '#EFF6FF', color: '#2563EB' }}>
                          {checking === s.id ? 'Checking…' : 'Check now'}
                        </button>
                      )}
                    </>
                  )}
                  {canEdit && <button onClick={() => remove(s.id)} style={{ ...btn, padding: '6px 12px', background: '#FEF2F2', color: '#EF4444' }}>Delete</button>}
                </div>
              </div>
              {expanded === s.id && (
                <div style={{ marginTop: '10px', paddingLeft: '4px' }}>
                  {s.last_summary && (
                    <div style={{ fontSize: '11px', color: '#64748B', background: '#F8FAFC', padding: '10px 12px', borderRadius: '8px', marginBottom: '8px' }}>
                      <b>Current summary:</b> {s.last_summary}
                    </div>
                  )}
                  {updates.length === 0 ? (
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>No changes detected yet.</div>
                  ) : (
                    updates.map((u: any) => (
                      <div key={u.id} style={{ fontSize: '11px', color: '#64748B', padding: '6px 0', borderTop: '1px dashed #E2E8F0' }}>
                        <span style={{ color: '#94A3B8' }}>{fmtDate(u.checked_at)}</span> — {u.summary}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddSourceModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load() }} />}
    </div>
  )
}

function AddSourceModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [mode, setMode] = useState<'url' | 'file'>('url')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [subtype, setSubtype] = useState('website')
  const [frequency, setFrequency] = useState('weekly')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const user = getStoredUser()
    setSaving(true)
    try {
      if (mode === 'url') {
        await socialInfluenceAPI.createSource({ name, url, subtype, check_frequency: frequency, created_by_email: user?.email })
      } else if (file) {
        await socialInfluenceAPI.uploadSource(name, frequency, file, user?.email || '')
      }
      onAdded()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>Add Source</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setMode('url')} style={{ ...btn, flex: 1, background: mode === 'url' ? '#156082' : '#F1F5F9', color: mode === 'url' ? 'white' : '#64748B' }}>Website / Blog / LinkedIn URL</button>
            <button onClick={() => setMode('file')} style={{ ...btn, flex: 1, background: mode === 'file' ? '#156082' : '#F1F5F9', color: mode === 'file' ? 'white' : '#64748B' }}>Upload file</button>
          </div>
          <div>
            <label style={lbl}>Name</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Company blog" />
          </div>
          {mode === 'url' ? (
            <>
              <div>
                <label style={lbl}>URL</label>
                <input style={inp} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" />
              </div>
              <div>
                <label style={lbl}>Type</label>
                <select style={inp} value={subtype} onChange={e => setSubtype(e.target.value)}>
                  <option value="website">Website</option>
                  <option value="blog">Blog</option>
                  <option value="linkedin">LinkedIn page</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Re-check frequency</label>
                <select style={inp} value={frequency} onChange={e => setFrequency(e.target.value)}>
                  <option value="manual">Manual only</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </>
          ) : (
            <div>
              <label style={lbl}>File</label>
              <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
            <button onClick={submit} disabled={saving || !name || (mode === 'url' ? !url : !file)}
              style={{ ...btn, background: saving ? '#94A3B8' : '#156082', color: 'white' }}>
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Compose ──────────────────────────────────────────────────────────────────
function ComposeTab({ canEdit }: { canEdit: boolean }) {
  const [platform, setPlatform] = useState<'linkedin' | 'twitter'>('linkedin')
  const [topic, setTopic] = useState('')
  const [sources, setSources] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { socialInfluenceAPI.listSources().then(d => setSources(d.sources || [])) }, [])

  const toggleSource = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const generate = async () => {
    const user = getStoredUser()
    setGenerating(true)
    try {
      const d = await socialInfluenceAPI.generatePost({
        platform, topic, source_ids: selectedIds.length ? selectedIds : undefined, created_by_email: user?.email,
      })
      setDraft(d)
    } finally {
      setGenerating(false)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const d = await socialInfluenceAPI.updatePost(draft.id, { content: draft.content, status: 'approved' })
      setDraft(d)
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit) return <div style={{ ...card, textAlign: 'center', color: '#94A3B8' }}>You have view-only access to this module.</div>

  return (
    <div style={card}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
        <div>
          <label style={lbl}>Platform</label>
          <select style={inp} value={platform} onChange={e => setPlatform(e.target.value as any)}>
            <option value="linkedin">LinkedIn</option>
            <option value="twitter">X / Twitter</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: '14px' }}>
        <label style={lbl}>Topic / instructions</label>
        <textarea style={{ ...inp, minHeight: '70px', resize: 'vertical' as const }} value={topic} onChange={e => setTopic(e.target.value)}
          placeholder="e.g. Announce our new compliance feature, tie it to the latest source updates" />
      </div>
      <div style={{ marginBottom: '14px' }}>
        <label style={lbl}>Sources to draw from (default: all active)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
          {sources.map(s => (
            <button key={s.id} onClick={() => toggleSource(s.id)}
              style={{ ...btn, padding: '5px 10px', background: selectedIds.includes(s.id) ? '#156082' : '#F1F5F9', color: selectedIds.includes(s.id) ? 'white' : '#64748B' }}>
              {s.name}
            </button>
          ))}
        </div>
      </div>
      <button onClick={generate} disabled={generating} style={{ ...btn, background: generating ? '#94A3B8' : '#e97132', color: 'white' }}>
        {generating ? 'Generating…' : 'Generate draft'}
      </button>

      {draft && (
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #EDF2F7' }}>
          <label style={lbl}>Draft ({draft.content.length} characters)</label>
          <textarea style={{ ...inp, minHeight: '140px', resize: 'vertical' as const }} value={draft.content}
            onChange={e => setDraft({ ...draft, content: e.target.value })} />
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button onClick={save} disabled={saving} style={{ ...btn, background: saving ? '#94A3B8' : '#156082', color: 'white' }}>
              {saving ? 'Saving…' : 'Save draft'}
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px' }}>
            Copy this into {platform === 'linkedin' ? 'LinkedIn' : 'X'} yourself for now — direct publishing is a later stage. Once posted, mark it from the Posts tab.
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Posts ────────────────────────────────────────────────────────────────────
function PostsTab({ canEdit }: { canEdit: boolean }) {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    socialInfluenceAPI.listPosts().then(d => setPosts(d.posts || [])).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const markPosted = async (id: string) => {
    setUpdating(id)
    await socialInfluenceAPI.updatePost(id, { status: 'posted' }).catch(() => {})
    setUpdating(null)
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this post?')) return
    await socialInfluenceAPI.deletePost(id)
    load()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>

  return (
    <div style={card}>
      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>No posts yet — generate one from the Compose tab.</div>
      ) : (
        posts.map((p, i) => {
          const c = STATUS_COLOR[p.status] || STATUS_COLOR.draft
          return (
            <div key={p.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #F1F5F9', padding: '14px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#156082' }}>{p.platform === 'linkedin' ? 'LinkedIn' : 'X / Twitter'}</span>
                    <span style={{ fontSize: '10px', fontWeight: '700', background: c.bg, color: c.text, padding: '2px 8px', borderRadius: '10px' }}>{p.status}</span>
                    <span style={{ fontSize: '10px', color: '#94A3B8' }}>{fmtDate(p.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#3F3F3F', whiteSpace: 'pre-wrap' as const }}>{p.content}</div>
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    {p.status !== 'posted' && (
                      <button onClick={() => markPosted(p.id)} disabled={updating === p.id} style={{ ...btn, padding: '6px 12px', background: '#EFF6FF', color: '#2563EB' }}>
                        {updating === p.id ? 'Saving…' : 'Mark as posted'}
                      </button>
                    )}
                    <button onClick={() => remove(p.id)} style={{ ...btn, padding: '6px 12px', background: '#FEF2F2', color: '#EF4444' }}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

