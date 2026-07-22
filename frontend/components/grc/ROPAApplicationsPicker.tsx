'use client'
// components/grc/ROPAApplicationsPicker.tsx
// Lets a ROPA record link more than one Application from the IT inventory, each
// optionally scoped to one of that application's submodules — used by both the ROPA
// create modal and the record's own detail page.
import { useState, useEffect } from 'react'
import { itAPI } from '@/lib/api'

export type ROPAApplicationEntry = {
  application_id: string
  application_name: string
  submodule_id: string | null
  submodule_name: string | null
}

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const btn: React.CSSProperties = {
  padding: '7px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer',
  fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif',
}

export function ROPAApplicationsPicker({ value, onChange, canEdit = true }: {
  value: ROPAApplicationEntry[]
  onChange: (v: ROPAApplicationEntry[]) => void
  canEdit?: boolean
}) {
  const [applications, setApplications] = useState<any[]>([])
  const [pickAppId, setPickAppId] = useState('')
  const [pickSubmodules, setPickSubmodules] = useState<any[]>([])
  const [pickSubmoduleId, setPickSubmoduleId] = useState('')

  useEffect(() => { itAPI.listApplications().then((d: any) => setApplications(d.applications || [])).catch(() => {}) }, [])

  useEffect(() => {
    if (!pickAppId) { setPickSubmodules([]); return }
    itAPI.listSubmodules(pickAppId).then((d: any) => setPickSubmodules(d.submodules || [])).catch(() => setPickSubmodules([]))
  }, [pickAppId])

  const addEntry = () => {
    if (!pickAppId) return
    const app = applications.find((a: any) => a.id === pickAppId)
    const sub = pickSubmodules.find((s: any) => s.id === pickSubmoduleId)
    onChange([...value, {
      application_id: pickAppId, application_name: app?.name || '',
      submodule_id: sub?.id || null, submodule_name: sub?.name || null,
    }])
    setPickAppId(''); setPickSubmoduleId('')
  }
  const removeEntry = (idx: number) => onChange(value.filter((_, i) => i !== idx))

  return (
    <div>
      {value.length === 0 ? (
        <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 8px' }}>No applications linked.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
          {value.map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', border: '1px solid #EDF2F7', borderRadius: '7px', background: '#F8FAFC' }}>
              <span style={{ fontSize: '12px', color: '#144766', fontWeight: '600' }}>
                {e.application_name}{e.submodule_name ? ` — ${e.submodule_name}` : ''}
              </span>
              {canEdit && <button onClick={() => removeEntry(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <div style={{ display: 'flex', gap: '6px' }}>
          <select style={{ ...inp, flex: 1 }} value={pickAppId} onChange={e => { setPickAppId(e.target.value); setPickSubmoduleId('') }}>
            <option value="">Select an application…</option>
            {applications.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {pickSubmodules.length > 0 && (
            <select style={{ ...inp, flex: 1 }} value={pickSubmoduleId} onChange={e => setPickSubmoduleId(e.target.value)}>
              <option value="">No submodule</option>
              {pickSubmodules.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button onClick={addEntry} disabled={!pickAppId} style={{ ...btn, background: pickAppId ? '#156082' : '#94A3B8', color: 'white' }}>+ Add</button>
        </div>
      )}
    </div>
  )
}
