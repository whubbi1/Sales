'use client'
// Shared building blocks for the Project Management tabs — same inline-style vocabulary as
// the rest of the Operations module (form-input / btn-primary / modal classes from globals).
import { ReactNode, useState } from 'react'
import { getStoredUser } from '@/lib/auth'
import { getStoredPortalUser } from '@/lib/portalAuth'
import { formatDateGlobal } from '@/lib/appSettings'

// These tabs are reused verbatim by both the internal app and the portal (same component,
// different host page). "Who am I" for internal-vs-me comparisons (pending validations,
// pending approvals, ...) must resolve whichever of the two login sessions is actually
// active — getStoredUser() alone only ever matches an internal caller, silently hiding
// every "this is addressed to you" action from a portal contact.
export const currentPmUserEmail = () => (getStoredPortalUser()?.email || getStoredUser()?.email || '').toLowerCase()

export type Person = { name: string; email?: string | null }
export type Level = { level: string; description?: string }
export type PMSettings = {
  project_id: string
  sharepoint_url?: string
  customer_logo_url?: string
  has_custom_logo?: boolean
  action_statuses: string[]
  extra_action_statuses: string[]
  impact_levels: Level[]
  probability_levels: Level[]
  meeting_types: string[]
  project_language: string
  documentation_language: string
}
export type TabProps = { projectId: string; canEdit: boolean; settings: PMSettings; reloadSettings: () => void }

// Respects the user's default date-format preference (MyWHUBBI > Profile) — see
// lib/appSettings.tsx for the loading/applying mechanism and its known limitation.
export const fmtDate = (d?: string | null) => formatDateGlobal(d)
// <input type="date"> value ↔ API datetime
export const toInput = (d?: string | null) => d ? d.slice(0, 10) : ''
export const fromInput = (v: string) => v ? `${v}T00:00:00` : null

export const TH: React.CSSProperties = { textAlign: 'left', padding: '9px 12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', background: '#FAFBFC', whiteSpace: 'nowrap' }
export const TD: React.CSSProperties = { padding: '9px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F', verticalAlign: 'top' }
export const LINK_BTN: React.CSSProperties = { border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontWeight: 600, fontSize: '12px', padding: 0, fontFamily: 'Montserrat, sans-serif' }
export const DEL_BTN: React.CSSProperties = { border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '15px', padding: 0, lineHeight: 1 }

export function Card({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px 18px', marginBottom: '16px' }}>
      {(title || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px' }}>
          {title && <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#156082', margin: 0 }}>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function Table({ headers, children, empty }: { headers: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{headers.map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
        <tbody>
          {empty ? <tr><td colSpan={headers.length} style={{ ...TD, textAlign: 'center', color: '#9B9B9B', padding: '28px' }}>Nothing here yet.</td></tr> : children}
        </tbody>
      </table>
    </div>
  )
}

export function Modal({ title, onClose, onSave, saving, children, width = 620, saveLabel = 'Save' }: {
  title: string; onClose: () => void; onSave?: () => void; saving?: boolean; children: ReactNode; width?: number; saveLabel?: string
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: `${width}px`, width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#144766' }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', overflowY: 'auto' }}>{children}</div>
        {onSave && (
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : saveLabel}</button>
          </div>
        )}
      </div>
    </div>
  )
}

export function Field({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <label style={{ gridColumn: full ? '1 / -1' : undefined, display: 'block' }}>
      <span className="form-label">{label}</span>
      {children}
    </label>
  )
}

export function Badge({ value, tone }: { value: string; tone?: 'green' | 'orange' | 'red' | 'blue' | 'grey' }) {
  const c = { green: ['#ECFDF5', '#059669'], orange: ['#FFF7ED', '#D97706'], red: ['#FEF2F2', '#DC2626'], blue: ['#EFF6FF', '#156082'], grey: ['#F1F5F9', '#475569'] }[tone || 'grey']
  return <span style={{ background: c[0], color: c[1], padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }}>{value}</span>
}

export const statusTone = (s?: string): 'green' | 'orange' | 'red' | 'blue' | 'grey' =>
  ({ Solved: 'green', Closed: 'green', Done: 'green', approved: 'green', validated: 'green',
     'In Progress': 'orange', in_review: 'orange', in_approval: 'orange', generated: 'blue',
     'On Hold': 'grey', Blocked: 'red', rejected: 'red', Open: 'blue', High: 'red', Medium: 'orange', Low: 'green' } as any)[s || ''] || 'grey'

export function ErrorBanner({ error }: { error: string }) {
  if (!error) return null
  return <div role="alert" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', marginBottom: '12px' }}>{error}</div>
}

// Wraps an async action with busy + error state, so every tab reports API failures the same way.
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (fn: () => Promise<any>) => {
    setBusy(true); setError('')
    try { return await fn() } catch (e: any) { setError(e.message || 'Something went wrong') } finally { setBusy(false) }
  }
  return { busy, error, setError, run }
}

export function PeopleEditor({ value, onChange, members, placeholder = 'Add person' }: {
  value: Person[]; onChange: (v: Person[]) => void; members?: { name: string; email: string }[]; placeholder?: string
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const add = (p: Person) => {
    if (!p.name.trim() || value.some(v => (v.email && v.email === p.email) || v.name === p.name)) return
    onChange([...value, { name: p.name.trim(), email: p.email?.trim() || null }])
    setName(''); setEmail('')
  }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: value.length ? '8px' : 0 }}>
        {value.map((p, i) => (
          <span key={i} style={{ background: '#EFF6FF', color: '#156082', borderRadius: '12px', padding: '3px 10px', fontSize: '11px', display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
            {p.name}{p.email ? ` · ${p.email}` : ''}
            <button type="button" aria-label={`Remove ${p.name}`} onClick={() => onChange(value.filter((_, j) => j !== i))} style={{ ...DEL_BTN, fontSize: '13px' }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {members && members.length > 0 && (
          <select className="form-input" value="" onChange={e => { const m = members.find(x => x.email === e.target.value); if (m) add(m) }} style={{ flex: 1 }}>
            <option value="">From project members…</option>
            {members.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}
          </select>
        )}
        <input className="form-input" placeholder={placeholder} value={name} onChange={e => setName(e.target.value)} style={{ flex: 1 }} />
        <input className="form-input" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ flex: 1 }} />
        <button type="button" className="btn-secondary" onClick={() => add({ name, email })}>Add</button>
      </div>
    </div>
  )
}

export function MeetingPicker({ meetings, value, onChange }: { meetings: { id: string; number: string; title: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  if (meetings.length === 0) return <div style={{ fontSize: '12px', color: '#9B9B9B' }}>No meetings on this project yet.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px 8px' }}>
      {meetings.map(m => (
        <label key={m.id} style={{ fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={value.includes(m.id)} onChange={e => onChange(e.target.checked ? [...value, m.id] : value.filter(x => x !== m.id))} />
          <b>{m.number}</b> {m.title}
        </label>
      ))}
    </div>
  )
}

export function MeetingRefs({ ids, meetings }: { ids: string[]; meetings: { id: string; number: string }[] }) {
  if (!ids?.length) return <>—</>
  return <>{ids.map(id => meetings.find(m => m.id === id)?.number).filter(Boolean).join(', ')}</>
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}
