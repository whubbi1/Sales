'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GRCLayout, useGRCPerm } from '@/components/GRCLayout'
import { ropaAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}
const btn: React.CSSProperties = {
  padding: '9px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif',
}

const CREATE_FIELDS: { key: string; label: string; textarea?: boolean }[] = [
  { key: 'name', label: 'Name' },
  { key: 'objective', label: 'Objectif', textarea: true },
  { key: 'legal_base', label: 'Legal Base', textarea: true },
  { key: 'application', label: 'Application' },
  { key: 'data_subject_categories', label: 'Categories of Data Subjects', textarea: true },
  { key: 'data_categories', label: 'Categories of Data Processed', textarea: true },
  { key: 'data_source', label: 'Data Source', textarea: true },
  { key: 'internal_recipients', label: 'Internal Recipients', textarea: true },
  { key: 'external_recipients', label: 'External Recipients / Processors', textarea: true },
  { key: 'transfers_outside_eu', label: 'Transfers Outside the EU', textarea: true },
  { key: 'retention_period', label: 'Retention Period' },
]

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.name?.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      const me = getStoredUser()
      const r = await ropaAPI.create({ ...form, created_by: me?.email || '' })
      onCreated(r.id)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '560px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'white' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>New ROPA Record</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {CREATE_FIELDS.map(f => (
            <div key={f.key}>
              <label style={lbl}>{f.label}{f.key === 'name' ? ' *' : ''}</label>
              {f.textarea ? (
                <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '54px', resize: 'vertical' }}
                  value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
              ) : (
                <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }}
                  value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
              )}
            </div>
          ))}
          <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>Security Measures, Rights of Data Subjects, and other details can be added afterwards on the record's own page.</p>
          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
            <button onClick={submit} disabled={saving} style={{ ...btn, background: saving ? '#94A3B8' : '#156082', color: 'white' }}>
              {saving ? 'Creating…' : 'Create Record'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ROPAList() {
  const router = useRouter()
  const { level, canEdit } = useGRCPerm('ropa')
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const d = await ropaAPI.list()
      setRecords(d.records || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
      <p style={{ fontSize: '13px' }}>You don't have permission to access Data & Privacy. Ask HR to grant it via WHUBBI Permissions.</p>
    </div>
  )

  const filtered = records.filter(r => !search || `${r.name} ${r.application || ''}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Record of Processing Activities (ROPA)</h2>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowCreate(true)} style={{ ...btn, background: '#156082', color: 'white' }}>+ New Record</button>
        )}
      </div>

      <div style={{ marginBottom: '14px' }}>
        <input style={{ ...inp, width: '260px' }} placeholder="Search name or application…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {['Name', 'Application', 'Legal Base', 'Data Source', 'Retention Period', 'Tasks'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>No ROPA records yet.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} onClick={() => router.push(`/grc/data-privacy/ropa/${r.id}`)} style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '10px 12px', fontWeight: '700', color: '#156082' }}>{r.name}</td>
                <td style={{ padding: '10px 12px', color: '#3F3F3F' }}>{r.application || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#64748B', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.legal_base || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#64748B' }}>{r.data_source || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#64748B' }}>{r.retention_period || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#64748B' }}>{r.tasks_open > 0 ? `${r.tasks_open}/${r.tasks_total}` : (r.tasks_total > 0 ? `0/${r.tasks_total}` : '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={id => { setShowCreate(false); router.push(`/grc/data-privacy/ropa/${id}`) }} />
      )}
    </div>
  )
}

function IncidentManagementStub() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <div style={{ fontSize: '72px', marginBottom: '24px' }}>🚧</div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#156082', marginBottom: '12px' }}>Under Construction</h1>
        <p style={{ fontSize: '14px', color: '#45B6E4', maxWidth: '420px', margin: '0 auto', lineHeight: '1.7' }}>
          Incident Management will be managed later.
        </p>
      </div>
    </div>
  )
}

function DataPrivacyContent() {
  const [tab, setTab] = useState<'ropa' | 'incidents'>('ropa')

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '10px 18px', border: 'none', borderBottom: active ? '2px solid #156082' : '2px solid transparent',
    background: 'transparent', color: active ? '#156082' : '#94A3B8', fontWeight: active ? '800' : '600',
    fontSize: '13px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
  })

  return (
    <div style={{ padding: '24px 28px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>🔒 Data & Privacy</h1>
      <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 16px' }}>GRC — data protection register and incident tracking</p>

      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #EDF2F7', marginBottom: '20px' }}>
        <button onClick={() => setTab('ropa')} style={tabBtn(tab === 'ropa')}>Record of Processing Activities (ROPA)</button>
        <button onClick={() => setTab('incidents')} style={tabBtn(tab === 'incidents')}>Incident Management</button>
      </div>

      {tab === 'ropa' ? <ROPAList /> : <IncidentManagementStub />}
    </div>
  )
}

export default function DataPrivacyPage() {
  return <GRCLayout><DataPrivacyContent /></GRCLayout>
}
