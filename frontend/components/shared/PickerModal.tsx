'use client'
// Generic search-and-add modal — used to link a Contact/Partner (or anything else with an
// `id`) onto a record, without leaving the detail page or opening its full edit form.
import { useState, useEffect } from 'react'

const btn: React.CSSProperties = {
  padding: '5px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer',
  fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif',
}
const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', width: '100%', boxSizing: 'border-box' as const,
}

export function PickerModal({ title, placeholder, searchFn, renderLabel, onPick, onClose }: {
  title: string
  placeholder?: string
  searchFn: (query: string) => Promise<any[]>
  renderLabel: (item: any) => { title: string; subtitle?: string }
  onPick: (item: any) => Promise<void> | void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      searchFn(q).then(r => setResults(r || [])).catch(() => setResults([])).finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const pick = async (item: any) => {
    await onPick(item)
    setPickedIds(prev => new Set(prev).add(item.id))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '420px', maxWidth: '92vw', maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '800', color: '#156082', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #EDF2F7' }}>
          <input autoFocus style={inp} placeholder={placeholder || 'Search…'} value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div style={{ padding: '10px', overflowY: 'auto' as const, flex: 1 }}>
          {loading && <div style={{ textAlign: 'center', padding: '20px', color: '#94A3B8', fontSize: '12px' }}>Searching…</div>}
          {!loading && results.length === 0 && <p style={{ textAlign: 'center', padding: '20px', color: '#94A3B8', fontSize: '12px' }}>No matches.</p>}
          {!loading && results.map(item => {
            const { title: t, subtitle } = renderLabel(item)
            const picked = pickedIds.has(item.id)
            return (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 8px', borderRadius: '8px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#156082', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{t}</div>
                  {subtitle && <div style={{ fontSize: '10px', color: '#94A3B8' }}>{subtitle}</div>}
                </div>
                {picked ? (
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#059669', whiteSpace: 'nowrap' as const }}>Added ✓</span>
                ) : (
                  <button onClick={() => pick(item)} style={{ ...btn, background: '#EFF6FF', color: '#156082', whiteSpace: 'nowrap' as const }}>+ Add</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
