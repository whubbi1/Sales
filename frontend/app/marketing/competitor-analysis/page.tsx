'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MarketingLayout, useMarketingPerm } from '@/components/MarketingLayout'
import { getStoredUser } from '@/lib/auth'
import { competitorAPI } from '@/lib/api'

const card: React.CSSProperties = { background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px 22px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const lbl: React.CSSProperties = { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '6px' }
const inp: React.CSSProperties = { fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white' }
const btn: React.CSSProperties = { padding: '7px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder: string }) {
  const [value, setValue] = useState('')
  const addTag = () => {
    const v = value.trim()
    if (v && !tags.includes(v)) onChange([...tags, v])
    setValue('')
  }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px', marginBottom: tags.length > 0 ? '8px' : 0 }}>
        {tags.map(t => (
          <span key={t} style={{ fontSize: '11px', fontWeight: '700', background: '#EFF6FF', color: '#2563EB', padding: '4px 10px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {t}
            <span onClick={() => onChange(tags.filter(x => x !== t))} style={{ cursor: 'pointer', fontWeight: '900' }}>×</span>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          style={{ ...inp, flex: 1 }} value={value} placeholder={placeholder}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
        />
        <button onClick={addTag} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Add</button>
      </div>
    </div>
  )
}

function AddCompetitorModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [countries, setCountries] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    const user = getStoredUser()
    setSaving(true)
    setError('')
    try {
      await competitorAPI.createCompetitor({
        name, website, linkedin_url: linkedinUrl, countries, source: 'manual', created_by_email: user?.email || '',
      })
      onSaved()
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '480px', maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #EDF2F7' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>Add Competitor</h2>
        </div>
        <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={lbl}>Name</div>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={name} onChange={e => setName(e.target.value)} placeholder="Company name" />
          </div>
          <div>
            <div style={lbl}>Website</div>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <div style={lbl}>LinkedIn</div>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/company/..." />
          </div>
          <div>
            <div style={lbl}>Countries</div>
            <TagInput tags={countries} onChange={setCountries} placeholder="Country, e.g. France" />
          </div>
          {error && <div style={{ fontSize: '11px', color: '#DC2626' }}>⚠️ {error}</div>}
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid #EDF2F7', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...btn, padding: '9px 18px', background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ ...btn, padding: '9px 18px', background: saving ? '#94A3B8' : '#156082', color: 'white' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CompetitorAnalysisPage() {
  return <MarketingLayout><CompetitorAnalysisContent /></MarketingLayout>
}

// useMarketingPerm reads MarketingPermContext, which MarketingLayout only provides to its
// children — calling it in the same component that renders <MarketingLayout> would read the
// context from outside the Provider (always the default/null value, so canEdit would be stuck
// false forever). Must live in a component actually rendered as MarketingLayout's child.
function CompetitorAnalysisContent() {
  const { canEdit } = useMarketingPerm('competitor_analysis')
  const router = useRouter()
  const [competitors, setCompetitors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [countries, setCountries] = useState<string[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [suggestError, setSuggestError] = useState('')
  const [addError, setAddError] = useState('')
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = () => {
    setLoading(true)
    setListError('')
    competitorAPI.listCompetitors()
      .then(d => setCompetitors(d.competitors || []))
      .catch(e => setListError(e.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const suggest = async () => {
    if (countries.length === 0) return
    setSuggesting(true)
    setSuggestError('')
    try {
      const d = await competitorAPI.suggestCompetitors(countries)
      setSuggestions(d.suggestions || [])
    } catch (e: any) {
      setSuggestError(e.message || 'Failed to get suggestions')
    } finally {
      setSuggesting(false)
    }
  }

  const addSuggestion = async (s: any) => {
    const user = getStoredUser()
    setAddError('')
    try {
      await competitorAPI.createCompetitor({
        name: s.name, website: s.website, linkedin_url: s.linkedin_url,
        countries: [s.country], source: 'ai_suggested', created_by_email: user?.email || '',
      })
      setSuggestions(prev => prev.filter(x => x !== s))
      load()
    } catch (e: any) {
      setAddError(e.message || 'Failed to add competitor')
    }
  }

  const dismissSuggestion = (s: any) => setSuggestions(prev => prev.filter(x => x !== s))

  const analyze = async (id: string) => {
    setAnalyzingId(id)
    await competitorAPI.analyzeCompetitor(id).catch(() => {})
    setAnalyzingId(null)
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this competitor? Its analysis will be lost.')) return
    try {
      await competitorAPI.deleteCompetitor(id)
      load()
    } catch (e: any) {
      alert(e.message || 'Failed to delete')
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: 0 }}>🔬 Competitor Analysis</h1>
        {canEdit && (
          <button onClick={() => setShowAdd(true)} style={{ ...btn, padding: '9px 18px', background: '#156082', color: 'white' }}>+ Add Competitor</button>
        )}
      </div>

      {listError && <div style={{ ...card, color: '#DC2626', fontSize: '12px' }}>⚠️ {listError}</div>}

      {canEdit && (
        <div style={card}>
          <div style={lbl}>Suggest competitors</div>
          <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 12px' }}>
            Add the countries you want to research, and Whubbi will search the web and propose real competitors operating there. Prefer to add one yourself? Use "+ Add Competitor" above instead.
          </p>
          <TagInput tags={countries} onChange={setCountries} placeholder="Country, e.g. France" />
          <div style={{ marginTop: '12px' }}>
            <button onClick={suggest} disabled={suggesting || countries.length === 0} style={{ ...btn, background: '#156082', color: 'white' }}>
              {suggesting ? 'Researching…' : 'Suggest competitors'}
            </button>
          </div>
          {suggestError && <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '8px' }}>⚠️ {suggestError}</div>}
          {addError && <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '8px' }}>⚠️ {addError}</div>}

          {suggestions.length > 0 && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {suggestions.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px solid #EDF2F7', borderRadius: '8px', background: '#F8FAFC' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#156082' }}>
                      {s.name} <span style={{ fontSize: '10px', fontWeight: '700', background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: '10px', marginLeft: '4px' }}>{s.country}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>{s.website}</div>
                    {s.why && <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{s.why}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => addSuggestion(s)} style={{ ...btn, padding: '6px 12px', background: '#ECFDF5', color: '#059669' }}>Add</button>
                    <button onClick={() => dismissSuggestion(s)} style={{ ...btn, padding: '6px 12px', background: '#F1F5F9', color: '#64748B' }}>Dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>
      ) : competitors.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '48px', color: '#94A3B8' }}>
          No competitors tracked yet — suggest some above or add one manually.
        </div>
      ) : (
        <div style={card}>
          <div style={lbl}>Tracked Competitors ({competitors.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
            {competitors.map((c: any, i: number) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 12px', borderTop: i === 0 ? 'none' : '1px solid #F1F5F9' }}>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => router.push(`/marketing/competitor-analysis/${c.id}`)}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#156082' }}>{c.name}</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                    {(c.countries || []).join(', ') || '—'}
                    {c.website && ` · ${c.website}`}
                    {' · '}last analyzed {fmtDate(c.last_analyzed_at)}
                  </div>
                  {c.last_analysis_error && <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '2px' }}>⚠️ {c.last_analysis_error}</div>}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => router.push(`/marketing/competitor-analysis/${c.id}`)} style={{ ...btn, padding: '6px 12px', background: '#F1F5F9', color: '#64748B' }}>View</button>
                  {canEdit && (
                    <>
                      <button onClick={() => analyze(c.id)} disabled={analyzingId === c.id} style={{ ...btn, padding: '6px 12px', background: '#EFF6FF', color: '#2563EB' }}>
                        {analyzingId === c.id ? 'Analyzing…' : 'Analyze'}
                      </button>
                      <button onClick={() => remove(c.id)} style={{ ...btn, padding: '6px 12px', background: '#FEF2F2', color: '#EF4444' }}>Delete</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <AddCompetitorModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />
      )}
    </>
  )
}
