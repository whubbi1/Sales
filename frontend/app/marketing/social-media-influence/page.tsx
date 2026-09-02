'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MarketingLayout, useMarketingPerm } from '@/components/MarketingLayout'
import { TabNav } from '@/components/shared/RecordLayout'
import { getStoredUser } from '@/lib/auth'
import { socialInfluenceAPI } from '@/lib/api'

const LANGUAGES = ['English', 'French', 'German', 'Spanish', 'Other']
const CATEGORIES = ['Competitor', 'Solution Provider', 'Partner', 'Other']
const SUBTYPE_ORDER = ['website', 'blog', 'linkedin', 'study', 'mailing', 'other']
const SUBTYPE_LABEL: Record<string, string> = { website: 'Website', blog: 'Blog', linkedin: 'LinkedIn page', study: 'Study', mailing: 'Mailing', other: 'Other' }
const SUBTYPE_ICON: Record<string, string> = { website: '🌐', blog: '📝', linkedin: '🔗', study: '🔬', mailing: '📧', other: '📄' }

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
  return (
    <MarketingLayout>
      <Suspense fallback={<div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>}>
        <SocialMediaInfluenceContent />
      </Suspense>
    </MarketingLayout>
  )
}

function SocialMediaInfluenceContent() {
  const { canEdit } = useMarketingPerm('social_media_influence')
  const router = useRouter()
  const params = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') || 'Sources')
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (params.get('mailbox_connected')) setNotice({ type: 'success', text: 'Mailings Inbox connected successfully.' })
    else if (params.get('mailbox_error')) setNotice({ type: 'error', text: `Mailbox connection failed: ${params.get('mailbox_error')}` })
    if (params.get('mailbox_connected') || params.get('mailbox_error')) router.replace('/marketing/social-media-influence?tab=Sources')
  }, [params])

  return (
    <div style={{ padding: '28px 32px', maxWidth: '980px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Social Media Influence</h1>
        <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>
          Monitor information sources and generate on-brand LinkedIn/X post drafts with Claude.
        </p>
      </div>

      {notice && (
        <div style={{
          background: notice.type === 'success' ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${notice.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
          color: notice.type === 'success' ? '#166534' : '#DC2626',
          borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '12px', fontWeight: '600',
        }}>
          {notice.text}
        </div>
      )}

      <TabNav tabs={['Sources', 'Compose', 'Posts', 'Review']} active={tab} onChange={setTab} />

      {tab === 'Sources' && <SourcesTab canEdit={canEdit} />}
      {tab === 'Compose' && <ComposeTab canEdit={canEdit} />}
      {tab === 'Posts' && <PostsTab canEdit={canEdit} />}
      {tab === 'Review' && <ReviewTab canEdit={canEdit} />}
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
  const [editing, setEditing] = useState<any | null>(null)
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
      <MailboxCard canEdit={canEdit} />

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
          {(() => {
            const grouped: Record<string, any[]> = {}
            sources.forEach(s => {
              const key = SUBTYPE_ORDER.includes(s.subtype) ? s.subtype : 'other'
              ;(grouped[key] = grouped[key] || []).push(s)
            })
            const groupEntries = SUBTYPE_ORDER.map(key => [key, grouped[key] || []] as [string, any[]]).filter(([, items]) => items.length > 0)
            return groupEntries.map(([key, items], gi) => (
              <div key={key} style={{ marginTop: gi === 0 ? 0 : '20px' }}>
                <div style={{
                  fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.03em',
                  padding: gi === 0 ? '0 0 8px' : '16px 0 8px', borderTop: gi === 0 ? 'none' : '1px solid #F1F5F9',
                }}>
                  {SUBTYPE_ICON[key]} {SUBTYPE_LABEL[key] || key} ({items.length})
                </div>
                {items.map((s, i) => (
                  <div key={s.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #F1F5F9', padding: '14px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#156082', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{SUBTYPE_ICON[key]} {s.name}</span>
                          {s.category && <span style={{ fontSize: '10px', fontWeight: '700', background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: '10px' }}>{s.category}</span>}
                          {!s.active && <span style={{ fontSize: '10px', fontWeight: '700', background: '#F1F5F9', color: '#94A3B8', padding: '2px 8px', borderRadius: '10px' }}>Inactive</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                          {s.source_type === 'url' ? s.url : s.file_name}
                          {' · '}{s.check_frequency}
                          {s.language && ` · ${s.language}`}
                          {s.source_type === 'url' && ` · last checked ${fmtDate(s.last_checked_at)}`}
                        </div>
                        {s.description && <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{s.description}</div>}
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
                        {canEdit && <button onClick={() => setEditing(s)} style={{ ...btn, padding: '6px 12px', background: '#F1F5F9', color: '#64748B' }}>Edit</button>}
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
            ))
          })()}
        </div>
      )}

      {(showAdd || editing) && (
        <SourceModal
          source={editing}
          onClose={() => { setShowAdd(false); setEditing(null) }}
          onSaved={() => { setShowAdd(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function MailboxCard({ canEdit }: { canEdit: boolean }) {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mailboxInput, setMailboxInput] = useState('')
  const [connecting, setConnecting] = useState(false)

  const load = () => {
    setLoading(true)
    socialInfluenceAPI.getMailboxStatus().then(setStatus).catch(() => setStatus({ connected: false })).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const connect = async () => {
    if (!mailboxInput.trim()) return
    const user = getStoredUser()
    setConnecting(true)
    try {
      const { auth_url } = await socialInfluenceAPI.connectMailbox(mailboxInput.trim(), user?.email || '')
      window.location.href = auth_url
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = async () => {
    if (!confirm('Disconnect the Mailings Inbox? New mail will stop being turned into sources until it\'s reconnected.')) return
    await socialInfluenceAPI.disconnectMailbox()
    load()
  }

  if (loading) return null

  return (
    <div style={{ ...card, background: '#F8FAFC' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' as const }}>
        <div>
          <div style={lbl}>Mailings Inbox</div>
          {status?.connected ? (
            <>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#156082' }}>📧 {status.mailbox_address}</div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                {status.last_synced_at ? `Last synced ${fmtDate(status.last_synced_at)}` : 'Not synced yet — first check runs shortly'}
              </div>
              {status.last_error && <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '2px' }}>⚠️ {status.last_error}</div>}
            </>
          ) : (
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Not connected — mail sent to a dedicated inbox can be auto-ingested as sources here.</div>
          )}
        </div>
        {canEdit && (
          status?.connected ? (
            <button onClick={disconnect} style={{ ...btn, background: '#FEF2F2', color: '#EF4444' }}>Disconnect</button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input style={{ ...inp, width: '220px' }} placeholder="mailbox@wcomply.com" value={mailboxInput} onChange={e => setMailboxInput(e.target.value)} />
              <button onClick={connect} disabled={connecting || !mailboxInput.trim()} style={{ ...btn, background: connecting ? '#94A3B8' : '#156082', color: 'white', whiteSpace: 'nowrap' as const }}>
                {connecting ? 'Redirecting…' : 'Connect'}
              </button>
            </div>
          )
        )}
      </div>
    </div>
  )
}

function SourceModal({ source, onClose, onSaved }: { source?: any | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!source
  const [mode, setMode] = useState<'url' | 'file'>(source?.source_type || 'url')
  const [name, setName] = useState(source?.name || '')
  const [category, setCategory] = useState(source?.category || 'Other')
  const [description, setDescription] = useState(source?.description || '')
  const [language, setLanguage] = useState(source?.language || 'English')
  const [url, setUrl] = useState(source?.url || '')
  const [subtype, setSubtype] = useState(source?.subtype || 'website')
  const [frequency, setFrequency] = useState(source?.check_frequency || 'weekly')
  const [active, setActive] = useState(source?.active ?? true)
  const [file, setFile] = useState<File | null>(null)
  const [replacementFile, setReplacementFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const user = getStoredUser()
    setSaving(true)
    try {
      if (isEdit) {
        if (replacementFile) await socialInfluenceAPI.replaceSourceFile(source.id, replacementFile)
        await socialInfluenceAPI.updateSource(source.id, {
          name, category, subtype, description, language, active,
          url: mode === 'url' ? url : undefined,
          check_frequency: mode === 'url' ? frequency : undefined,
        })
      } else if (mode === 'url') {
        await socialInfluenceAPI.createSource({ name, category, description, language, url, subtype, check_frequency: frequency, created_by_email: user?.email })
      } else if (file) {
        await socialInfluenceAPI.uploadSource({ name, category, description, language, subtype, file, createdByEmail: user?.email || '' })
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>{isEdit ? 'Edit Source' : 'Add Source'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!isEdit && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setMode('url')} style={{ ...btn, flex: 1, background: mode === 'url' ? '#156082' : '#F1F5F9', color: mode === 'url' ? 'white' : '#64748B' }}>Website / Blog / LinkedIn URL</button>
              <button onClick={() => setMode('file')} style={{ ...btn, flex: 1, background: mode === 'file' ? '#156082' : '#F1F5F9', color: mode === 'file' ? 'white' : '#64748B' }}>Upload file</button>
            </div>
          )}
          <div>
            <label style={lbl}>Name</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Company blog" />
          </div>
          <div>
            <label style={lbl}>Type</label>
            <select style={inp} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Description (optional)</label>
            <textarea style={{ ...inp, minHeight: '50px', resize: 'vertical' as const }} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What this source is / why it's useful for content generation" />
          </div>
          <div>
            <label style={lbl}>Language</label>
            <select style={inp} value={language} onChange={e => setLanguage(e.target.value)}>
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Source</label>
            <select style={inp} value={subtype} onChange={e => setSubtype(e.target.value)}>
              <option value="website">Website</option>
              <option value="blog">Blog</option>
              <option value="linkedin">LinkedIn page</option>
              <option value="study">Study</option>
              <option value="mailing">Mailing</option>
              <option value="other">Other</option>
            </select>
          </div>
          {mode === 'url' ? (
            <>
              <div>
                <label style={lbl}>URL</label>
                <input style={inp} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" />
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
          ) : isEdit ? (
            <div>
              <label style={lbl}>File</label>
              <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '6px' }}>
                Current: {source.file_name}{replacementFile && <span style={{ color: '#156082', fontWeight: 700 }}> → {replacementFile.name}</span>}
              </div>
              <input type="file" onChange={e => setReplacementFile(e.target.files?.[0] || null)} />
            </div>
          ) : (
            <div>
              <label style={lbl}>File</label>
              <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
          )}
          {isEdit && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#3F3F3F', cursor: 'pointer' }}>
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
              Active (used for monitoring / content generation)
            </label>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
            <button onClick={submit} disabled={saving || !name || (mode === 'url' ? !url : (!isEdit && !file))}
              style={{ ...btn, background: saving ? '#94A3B8' : '#156082', color: 'white' }}>
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Add'}
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

  const load = () => {
    setLoading(true)
    socialInfluenceAPI.listPosts().then(d => setPosts(d.posts || [])).finally(() => setLoading(false))
  }
  useEffect(load, [])

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>

  return (
    <div style={card}>
      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>No posts yet — generate one from the Compose tab.</div>
      ) : (
        posts.map((p, i) => <PostRow key={p.id} post={p} first={i === 0} canEdit={canEdit} onChanged={load} />)
      )}
    </div>
  )
}

function PostRow({ post, first, canEdit, onChanged }: { post: any; first: boolean; canEdit: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(post.content)
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState(false)
  const c = STATUS_COLOR[post.status] || STATUS_COLOR.draft

  const saveEdit = async () => {
    setSaving(true)
    try {
      await socialInfluenceAPI.updatePost(post.id, { content })
      setEditing(false)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  const markPosted = async () => {
    setUpdating(true)
    await socialInfluenceAPI.updatePost(post.id, { status: 'posted' }).catch(() => {})
    setUpdating(false)
    onChanged()
  }

  const remove = async () => {
    if (!confirm('Delete this post?')) return
    await socialInfluenceAPI.deletePost(post.id)
    onChanged()
  }

  return (
    <div style={{ borderTop: first ? 'none' : '1px solid #F1F5F9', padding: '14px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#156082' }}>{post.platform === 'linkedin' ? 'LinkedIn' : 'X / Twitter'}</span>
            <span style={{ fontSize: '10px', fontWeight: '700', background: c.bg, color: c.text, padding: '2px 8px', borderRadius: '10px' }}>{post.status}</span>
            <span style={{ fontSize: '10px', color: '#94A3B8' }}>{fmtDate(post.created_at)}</span>
          </div>
          {editing ? (
            <textarea style={{ ...inp, minHeight: '100px', resize: 'vertical' as const }} value={content} onChange={e => setContent(e.target.value)} />
          ) : (
            <div style={{ fontSize: '12px', color: '#3F3F3F', whiteSpace: 'pre-wrap' as const }}>{post.content}</div>
          )}
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {editing ? (
              <>
                <button onClick={() => { setEditing(false); setContent(post.content) }} style={{ ...btn, padding: '6px 12px', background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
                <button onClick={saveEdit} disabled={saving} style={{ ...btn, padding: '6px 12px', background: saving ? '#94A3B8' : '#156082', color: 'white' }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} style={{ ...btn, padding: '6px 12px', background: '#F1F5F9', color: '#64748B' }}>Edit</button>
                {post.status !== 'posted' && (
                  <button onClick={markPosted} disabled={updating} style={{ ...btn, padding: '6px 12px', background: '#EFF6FF', color: '#2563EB' }}>
                    {updating ? 'Saving…' : 'Mark as posted'}
                  </button>
                )}
                <button onClick={remove} style={{ ...btn, padding: '6px 12px', background: '#FEF2F2', color: '#EF4444' }}>Delete</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Review ───────────────────────────────────────────────────────────────────
// Anti-spam gate: incoming mail lands here first — nothing reaches the Sources list or the
// LLM until a person Accepts it. Rejecting just discards it; nothing is ever imported.
function ReviewTab({ canEdit }: { canEdit: boolean }) {
  const [pending, setPending] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState<any | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkActing, setBulkActing] = useState(false)

  const load = () => {
    setLoading(true)
    setSelected(new Set())
    socialInfluenceAPI.listPendingEmails().then(d => setPending(d.pending || [])).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    setSelected(prev => prev.size === pending.length ? new Set() : new Set(pending.map((p: any) => p.id)))
  }

  const accept = async (id: string) => {
    const user = getStoredUser()
    setActingId(id)
    try {
      await socialInfluenceAPI.acceptPendingEmail(id, user?.email || '')
      setViewing(null)
      load()
    } catch (e: any) {
      alert(e.message || 'Failed to accept')
    } finally {
      setActingId(null)
    }
  }

  const reject = async (id: string) => {
    if (!confirm('Reject this email? It will be discarded and never imported.')) return
    const user = getStoredUser()
    setActingId(id)
    try {
      await socialInfluenceAPI.rejectPendingEmail(id, user?.email || '')
      setViewing(null)
      load()
    } catch (e: any) {
      alert(e.message || 'Failed to reject')
    } finally {
      setActingId(null)
    }
  }

  const bulkAct = async (action: 'accept' | 'reject') => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (action === 'reject' && !confirm(`Reject ${ids.length} email${ids.length !== 1 ? 's' : ''}? They will be discarded and never imported.`)) return
    const user = getStoredUser()
    setBulkActing(true)
    const failures: string[] = []
    for (const id of ids) {
      try {
        if (action === 'accept') await socialInfluenceAPI.acceptPendingEmail(id, user?.email || '')
        else await socialInfluenceAPI.rejectPendingEmail(id, user?.email || '')
      } catch (e: any) {
        const p = pending.find((x: any) => x.id === id)
        failures.push(`${p?.subject || '(no subject)'}: ${e.message || 'failed'}`)
      }
    }
    setBulkActing(false)
    load()
    if (failures.length > 0) alert(`${failures.length} of ${ids.length} failed:\n${failures.join('\n')}`)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: '8px' }}>
        <div style={lbl}>Pending Review ({pending.length})</div>
        {canEdit && selected.size > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#64748B' }}>{selected.size} selected</span>
            <button onClick={() => bulkAct('accept')} disabled={bulkActing} style={{ ...btn, padding: '6px 12px', background: '#ECFDF5', color: '#059669' }}>
              {bulkActing ? 'Working…' : `Accept selected (${selected.size})`}
            </button>
            <button onClick={() => bulkAct('reject')} disabled={bulkActing} style={{ ...btn, padding: '6px 12px', background: '#FEF2F2', color: '#EF4444' }}>
              {bulkActing ? 'Working…' : `Reject selected (${selected.size})`}
            </button>
          </div>
        )}
      </div>
      <p style={{ fontSize: '11px', color: '#94A3B8', margin: '4px 0 14px' }}>
        Mail received in the Mailings Inbox waits here until accepted — nothing is imported as a source until you approve it.
      </p>
      {pending.length === 0 ? (
        <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>Nothing waiting for review.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {canEdit && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748B', padding: '0 4px 2px', cursor: 'pointer' }}>
              <input type="checkbox" checked={selected.size === pending.length} onChange={toggleSelectAll} disabled={bulkActing} />
              Select all
            </label>
          )}
          {pending.map((p: any) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
              {canEdit && (
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} disabled={bulkActing} style={{ flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#156082', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{p.subject || '(no subject)'}</div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                  {p.sender_name || p.sender_email}{p.sender_name && p.sender_email ? ` <${p.sender_email}>` : ''} · {fmtDate(p.received_at)}
                  {(p.attachments || []).length > 0 && ` · ${p.attachments.length} attachment${p.attachments.length !== 1 ? 's' : ''}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button onClick={() => setViewing(p)} style={{ ...btn, padding: '6px 12px', background: '#F1F5F9', color: '#64748B' }}>View</button>
                {canEdit && (
                  <>
                    <button onClick={() => accept(p.id)} disabled={actingId === p.id || bulkActing} style={{ ...btn, padding: '6px 12px', background: '#ECFDF5', color: '#059669' }}>
                      {actingId === p.id ? '…' : 'Accept'}
                    </button>
                    <button onClick={() => reject(p.id)} disabled={actingId === p.id || bulkActing} style={{ ...btn, padding: '6px 12px', background: '#FEF2F2', color: '#EF4444' }}>Reject</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <EmailPreviewModal
          email={viewing}
          canEdit={canEdit}
          acting={actingId === viewing.id}
          onAccept={() => accept(viewing.id)}
          onReject={() => reject(viewing.id)}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}

function EmailPreviewModal({ email, canEdit, acting, onAccept, onReject, onClose }: {
  email: any; canEdit: boolean; acting: boolean; onAccept: () => void; onReject: () => void; onClose: () => void
}) {
  const isHtml = (email.body_content_type || '').toLowerCase() === 'html'
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '640px', maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>{email.subject || '(no subject)'}</h2>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>
              From {email.sender_name || email.sender_email}{email.sender_name && email.sender_email ? ` <${email.sender_email}>` : ''} · {fmtDate(email.received_at)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {(email.attachments || []).length > 0 && (
            <div style={{ fontSize: '11px', color: '#64748B', background: '#F8FAFC', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px' }}>
              📎 {email.attachments.map((a: any) => a.name).join(', ')}
            </div>
          )}
          {isHtml ? (
            // Sandboxed with no allow-scripts/allow-same-origin — renders the visual layout
            // but any embedded <script> or event-handler JS in the email simply cannot run.
            <iframe sandbox="" srcDoc={email.body_content || ''} title="Email preview" style={{ width: '100%', height: '360px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white' }} />
          ) : (
            <pre style={{ fontSize: '12px', color: '#3F3F3F', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const, margin: 0, fontFamily: 'inherit' }}>
              {email.body_content || '(empty)'}
            </pre>
          )}
        </div>
        {canEdit && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid #EDF2F7', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexShrink: 0 }}>
            <button onClick={onReject} disabled={acting} style={{ ...btn, background: '#FEF2F2', color: '#EF4444' }}>Reject</button>
            <button onClick={onAccept} disabled={acting} style={{ ...btn, background: acting ? '#94A3B8' : '#156082', color: 'white' }}>
              {acting ? 'Accepting…' : 'Accept & Import'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

