'use client'
import { ReactNode, useState } from 'react'
import { Sidebar } from '@/components/Sidebar'

interface Props { leftColumn: ReactNode; rightColumn: ReactNode }

export function RecordLayout({ leftColumn, rightColumn }: Props) {
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', display: 'flex', flexDirection: 'column', background: '#F5F7FA' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', flex: 1, minHeight: '100vh', alignItems: 'start' }}>
          <div style={{ padding: '24px', minHeight: '100vh', borderRight: '1px solid #E2E8F0' }}>{leftColumn}</div>
          <div style={{ padding: '24px 20px', background: 'white', minHeight: '100vh', position: 'sticky', top: 0 }}>{rightColumn}</div>
        </div>
      </main>
    </div>
  )
}

export function PropertyRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
      <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '13px', color: '#3F3F3F', fontWeight: '500' }}>{value || <span style={{ color: '#45B6E4' }}>—</span>}</div>
    </div>
  )
}

export function SidebarSection({ title, children, onAdd }: { title: string; children: ReactNode; onAdd?: () => void }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4' }}>{title}</span>
        {onAdd && <button onClick={onAdd} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#156082', fontSize: '12px', fontWeight: '600', padding: 0 }}>+ Add</button>}
      </div>
      {children}
    </div>
  )
}

export function SidebarCard({ title, subtitle, href, color = '#156082' }: { title: string; subtitle?: string; href: string; color?: string }) {
  return (
    <a href={href} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '7px', marginBottom: '4px', border: '1px solid #EDF2F7', background: 'white', cursor: 'pointer' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', flexShrink: 0 }}>{title[0]?.toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#156082', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {subtitle && <div style={{ fontSize: '11px', color: '#45B6E4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
        </div>
      </div>
    </a>
  )
}

export function StatusBadge({ value }: { value: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    lead: { bg: '#EEF2FF', color: '#4F46E5' }, prospect: { bg: '#FFF7ED', color: '#EA580C' },
    client: { bg: '#ECFDF5', color: '#059669' }, partner: { bg: '#EFF6FF', color: '#156082' },
    New: { bg: '#F1F5F9', color: '#45B6E4' }, Open: { bg: '#FFF7ED', color: '#D97706' },
    Connected: { bg: '#ECFDF5', color: '#059669' },
    'Contract Lost': { bg: '#FEF2F2', color: '#DC2626' },
    'PO Received': { bg: '#ECFDF5', color: '#059669' },
    'Contract Finalised': { bg: '#ECFDF5', color: '#059669' },
  }
  const c = colors[value] || { bg: '#F1F5F9', color: '#45B6E4' }
  return <span style={{ background: c.bg, color: c.color, padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'inline-block' }}>{value}</span>
}

export function TabNav({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0', marginBottom: '20px' }}>
      {tabs.map(tab => (
        <button key={tab} onClick={() => onChange(tab)} style={{ padding: '9px 16px', fontSize: '13px', fontWeight: '600', fontFamily: 'Montserrat, sans-serif', color: active === tab ? '#156082' : '#45B6E4', border: 'none', background: 'none', cursor: 'pointer', borderBottom: `2px solid ${active === tab ? '#e97132' : 'transparent'}`, marginBottom: '-2px' }}>{tab}</button>
      ))}
    </div>
  )
}

export function PageHeader({ title, count, action, search }: { title: string; count?: number; action?: ReactNode; search?: { value: string; onChange: (v: string) => void } }) {
  const [searchOpen, setSearchOpen] = useState(false)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <h1 style={{ fontSize: '19px', fontWeight: '800', color: '#156082', marginBottom: '2px', letterSpacing: '-0.01em' }}>{title}</h1>
          {search && (
            searchOpen ? (
              <input autoFocus className="form-input" placeholder="Search…" value={search.value}
                onChange={e => search.onChange(e.target.value)}
                onBlur={() => { if (!search.value) setSearchOpen(false) }}
                style={{ fontSize: '12px', padding: '4px 8px', width: '180px' }} />
            ) : (
              <span onClick={() => setSearchOpen(true)} style={{ fontSize: '12px', color: '#45B6E4', cursor: 'pointer', fontWeight: '600' }}>Search</span>
            )
          )}
        </div>
        {count !== undefined && <p style={{ color: '#45B6E4', fontSize: '12px' }}>{count} record{count !== 1 ? 's' : ''}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
      <div style={{ fontSize: '36px', marginBottom: '10px', opacity: 0.35 }}>{icon}</div>
      <div style={{ fontSize: '14px', fontWeight: '700', color: '#45B6E4', marginBottom: '5px' }}>{title}</div>
      <div style={{ fontSize: '12px', color: '#45B6E4' }}>{description}</div>
    </div>
  )
}
