'use client'
import { useEffect, useState } from 'react'
import { MarketingLayout, useMarketingPerm } from '@/components/MarketingLayout'
import { getStoredUser } from '@/lib/auth'
import { companySetupAPI } from '@/lib/api'

const card: React.CSSProperties = { background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px 22px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const lbl: React.CSSProperties = { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '6px' }
const inp: React.CSSProperties = { fontSize: '12px', padding: '9px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white', width: '100%', boxSizing: 'border-box' as const }
const btn: React.CSSProperties = { padding: '9px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }

function fmtDate(d?: string | null) {
  if (!d) return null
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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
        <button onClick={addTag} style={{ ...btn, padding: '7px 14px', fontSize: '11px', background: '#F1F5F9', color: '#64748B' }}>Add</button>
      </div>
    </div>
  )
}

export default function CompanySetupPage() {
  const { canEdit } = useMarketingPerm('company_marketing_setup')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [description, setDescription] = useState('')
  const [services, setServices] = useState('')
  const [targetCountries, setTargetCountries] = useState<string[]>([])
  const [targetAudience, setTargetAudience] = useState('')
  const [marketingObjectives, setMarketingObjectives] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    companySetupAPI.get().then(d => {
      setDescription(d.description || '')
      setServices(d.services || '')
      setTargetCountries(d.target_countries || [])
      setTargetAudience(d.target_audience || '')
      setMarketingObjectives(d.marketing_objectives || '')
      setUpdatedAt(d.updated_at || null)
    }).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    const user = getStoredUser()
    setSaving(true)
    try {
      const d = await companySetupAPI.update({
        description, services, target_countries: targetCountries, target_audience: targetAudience,
        marketing_objectives: marketingObjectives, updated_by_email: user?.email || '',
      })
      setUpdatedAt(d.updated_at || null)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <MarketingLayout><div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div></MarketingLayout>

  return (
    <MarketingLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: 0 }}>🏢 Company Marketing Setup</h1>
      </div>

      <div style={card}>
        <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 16px' }}>
          One shared record describing the company for marketing purposes — used across the module, including to ground the competitor suggestions in Competitor Analysis.
        </p>

        <div style={{ marginBottom: '16px' }}>
          <div style={lbl}>Company description</div>
          <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' as const }} value={description} onChange={e => setDescription(e.target.value)} disabled={!canEdit} placeholder="What does the company do?" />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={lbl}>Services we propose</div>
          <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' as const }} value={services} onChange={e => setServices(e.target.value)} disabled={!canEdit} placeholder="Products and services offered" />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={lbl}>Target countries</div>
          {canEdit ? (
            <TagInput tags={targetCountries} onChange={setTargetCountries} placeholder="Country, e.g. France" />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
              {targetCountries.length === 0 ? <span style={{ fontSize: '12px', color: '#94A3B8' }}>—</span> : targetCountries.map(c => (
                <span key={c} style={{ fontSize: '11px', fontWeight: '700', background: '#EFF6FF', color: '#2563EB', padding: '4px 10px', borderRadius: '12px' }}>{c}</span>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={lbl}>Target audience at our customers</div>
          <textarea style={{ ...inp, minHeight: '70px', resize: 'vertical' as const }} value={targetAudience} onChange={e => setTargetAudience(e.target.value)} disabled={!canEdit} placeholder="e.g. Compliance officers, HR directors, CISOs" />
        </div>

        <div style={{ marginBottom: canEdit ? '16px' : 0 }}>
          <div style={lbl}>Marketing objectives</div>
          <textarea style={{ ...inp, minHeight: '70px', resize: 'vertical' as const }} value={marketingObjectives} onChange={e => setMarketingObjectives(e.target.value)} disabled={!canEdit} placeholder="What are we trying to achieve?" />
        </div>

        {canEdit && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>{updatedAt ? `Last updated ${fmtDate(updatedAt)}` : 'Not saved yet'}</span>
            <button onClick={save} disabled={saving} style={{ ...btn, background: saving ? '#94A3B8' : '#156082', color: 'white' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </MarketingLayout>
  )
}
