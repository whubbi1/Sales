'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MarketingLayout, useMarketingPerm } from '@/components/MarketingLayout'
import { competitorAPI } from '@/lib/api'

const card: React.CSSProperties = { background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px 22px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const lbl: React.CSSProperties = { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '6px' }
const inp: React.CSSProperties = { fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white' }
const btn: React.CSSProperties = { padding: '7px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function EditableCell({ display, editing, canEdit, onStartEdit, children }: any) {
  return editing ? children : (
    <div onClick={() => canEdit && onStartEdit()} title={canEdit ? 'Click to edit' : undefined}
      style={{ fontSize: '12px', color: '#3F3F3F', cursor: canEdit ? 'pointer' : 'default', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px' }}
      onMouseEnter={e => canEdit && (e.currentTarget.style.background = '#F1F5F9')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {display || <span style={{ color: '#94A3B8' }}>—</span>}
    </div>
  )
}

export default function CompetitorDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { canEdit } = useMarketingPerm('competitor_analysis')
  const [competitor, setCompetitor] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [draft, setDraft] = useState<any>({})
  const [analyzing, setAnalyzing] = useState(false)

  const load = () => {
    setLoading(true)
    competitorAPI.getCompetitor(id as string).then(setCompetitor).finally(() => setLoading(false))
  }
  useEffect(load, [id])

  const startEdit = (field: string, value: any) => {
    setEditingField(field)
    setDraft({ [field]: value })
  }

  const save = async (field: string) => {
    const value = field === 'countries'
      ? String(draft[field] || '').split(',').map((s: string) => s.trim()).filter(Boolean)
      : draft[field]
    const updated = await competitorAPI.updateCompetitor(id as string, { [field]: value })
    setCompetitor(updated)
    setEditingField(null)
  }

  const analyze = async () => {
    setAnalyzing(true)
    const updated = await competitorAPI.analyzeCompetitor(id as string).catch(() => null)
    if (updated) setCompetitor(updated)
    setAnalyzing(false)
  }

  if (loading || !competitor) {
    return <MarketingLayout><div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div></MarketingLayout>
  }

  return (
    <MarketingLayout>
      <button onClick={() => router.push('/marketing/competitor-analysis')} style={{ background: 'none', border: 'none', color: '#45B6E4', fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: 0, marginBottom: '14px' }}>← Back to Competitor Analysis</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: 0 }}>{competitor.name}</h1>
        {canEdit && (
          <button onClick={analyze} disabled={analyzing} style={{ ...btn, background: analyzing ? '#94A3B8' : '#156082', color: 'white' }}>
            {analyzing ? 'Analyzing…' : '🔍 Analyze'}
          </button>
        )}
      </div>

      <div style={card}>
        <div style={lbl}>Overview</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '8px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '2px' }}>Name</div>
            <EditableCell display={competitor.name} editing={editingField === 'name'} canEdit={canEdit} onStartEdit={() => startEdit('name', competitor.name)}>
              <input autoFocus style={inp} value={draft.name} onChange={e => setDraft({ name: e.target.value })} onBlur={() => save('name')} onKeyDown={e => e.key === 'Enter' && save('name')} />
            </EditableCell>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '2px' }}>Countries</div>
            <EditableCell display={(competitor.countries || []).join(', ')} editing={editingField === 'countries'} canEdit={canEdit} onStartEdit={() => startEdit('countries', (competitor.countries || []).join(', '))}>
              <input autoFocus style={inp} value={draft.countries} onChange={e => setDraft({ countries: e.target.value })} onBlur={() => save('countries')} onKeyDown={e => e.key === 'Enter' && save('countries')} placeholder="Comma-separated" />
            </EditableCell>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '2px' }}>Website</div>
            <EditableCell display={competitor.website && <a href={competitor.website} target="_blank" rel="noreferrer">{competitor.website}</a>} editing={editingField === 'website'} canEdit={canEdit} onStartEdit={() => startEdit('website', competitor.website || '')}>
              <input autoFocus style={inp} value={draft.website} onChange={e => setDraft({ website: e.target.value })} onBlur={() => save('website')} onKeyDown={e => e.key === 'Enter' && save('website')} />
            </EditableCell>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '2px' }}>LinkedIn</div>
            <EditableCell display={competitor.linkedin_url && <a href={competitor.linkedin_url} target="_blank" rel="noreferrer">{competitor.linkedin_url}</a>} editing={editingField === 'linkedin_url'} canEdit={canEdit} onStartEdit={() => startEdit('linkedin_url', competitor.linkedin_url || '')}>
              <input autoFocus style={inp} value={draft.linkedin_url} onChange={e => setDraft({ linkedin_url: e.target.value })} onBlur={() => save('linkedin_url')} onKeyDown={e => e.key === 'Enter' && save('linkedin_url')} />
            </EditableCell>
          </div>
        </div>
        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '12px' }}>
          Source: {competitor.source === 'ai_suggested' ? 'AI-suggested' : 'Manually added'} · Last analyzed {fmtDate(competitor.last_analyzed_at)}
        </div>
        {competitor.last_analysis_error && <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px' }}>⚠️ {competitor.last_analysis_error}</div>}
      </div>

      <div style={card}>
        <div style={lbl}>LinkedIn & Size</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '8px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '2px' }}>LinkedIn followers</div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#156082' }}>{competitor.linkedin_followers != null ? competitor.linkedin_followers.toLocaleString() : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '2px' }}>Estimated employees</div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#156082' }}>{competitor.employee_count_estimate || '—'}</div>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={lbl}>Services</div>
        <p style={{ fontSize: '12px', color: '#3F3F3F', margin: '8px 0 0', whiteSpace: 'pre-wrap' as const }}>{competitor.services_summary || '—'}</p>
      </div>

      <div style={card}>
        <div style={lbl}>Customer Stories</div>
        <p style={{ fontSize: '12px', color: '#3F3F3F', margin: '8px 0 0', whiteSpace: 'pre-wrap' as const }}>{competitor.customer_stories || '—'}</p>
      </div>

      <div style={card}>
        <div style={lbl}>Customers ({(competitor.customers || []).length})</div>
        {(competitor.customers || []).length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: '8px 0 0' }}>No customers found yet — run Analyze to research this.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px', marginTop: '8px' }}>
            {competitor.customers.map((c: string, i: number) => (
              <span key={i} style={{ fontSize: '11px', fontWeight: '700', background: '#F1F5F9', color: '#475569', padding: '4px 10px', borderRadius: '12px' }}>{c}</span>
            ))}
          </div>
        )}
      </div>

      {competitor.analysis_notes && (
        <div style={card}>
          <div style={lbl}>Other notes</div>
          <p style={{ fontSize: '12px', color: '#3F3F3F', margin: '8px 0 0', whiteSpace: 'pre-wrap' as const }}>{competitor.analysis_notes}</p>
        </div>
      )}
    </MarketingLayout>
  )
}
