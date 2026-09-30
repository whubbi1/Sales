'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredPortalUser, portalApiJson } from '@/lib/portalAuth'
import { pmAPI } from '@/lib/api'

const PRIORITY_LABEL: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }
const STATUS_LABEL: Record<string, string> = { new: 'New', open: 'Open', in_progress: 'In Progress', pending: 'Pending', resolved: 'Resolved', closed: 'Closed' }
const TICKET_TYPES = [
  { value: 'incident_request', label: 'Incident' },
  { value: 'change_request', label: 'Change Request' },
  { value: 'information_request', label: 'Information Request' },
]

function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString() : '—' }

export default function PortalHelpdeskPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<any[] | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', ticket_type: 'incident_request', project_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => portalApiJson<{ tickets: any[] }>('/helpdesk/tickets').then(d => setTickets(d.tickets || [])).catch(() => setTickets([]))

  useEffect(() => {
    if (!getStoredPortalUser()) {
      router.replace('/portal/login')
      return
    }
    load()
    pmAPI.listProjects().then((ps: any[]) => {
      setProjects(ps)
      setForm(f => ({ ...f, project_id: ps.length === 1 ? ps[0].id : '' }))
    }).catch(() => {})
  }, [router])

  const create = async () => {
    if (!form.title.trim() || !form.project_id) { setError('Title and Project are required.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await portalApiJson<{ id: string }>('/helpdesk/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      setShowModal(false)
      router.push(`/portal/helpdesk/${res.id}`)
    } catch {
      setError('Could not create the ticket. Please try again.')
    }
    setSaving(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ background: '#156082', padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: 'white', fontSize: '15px', fontWeight: 800 }}>Helpdesk</div>
        <img src="/logo.png" alt="WCOMPLY" style={{ height: '48px', objectFit: 'contain' }} />
      </div>

      <div style={{ padding: '32px 40px', maxWidth: '760px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <button onClick={() => router.push('/portal/home')}
            style={{ background: 'none', border: 'none', color: '#156082', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
            ← Back
          </button>
          <button className="btn-primary" onClick={() => setShowModal(true)}
            style={{ padding: '9px 18px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            + New ticket
          </button>
        </div>

        {tickets === null ? (
          <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '40px' }}>Loading…</div>
        ) : tickets.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            No tickets yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {tickets.map(t => (
              <button key={t.id} onClick={() => router.push(`/portal/helpdesk/${t.id}`)}
                style={{ textAlign: 'left', background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '14px 18px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#156082' }}>{t.title}</span>
                  <span style={{ fontSize: '10px', color: '#94A3B8' }}>{t.ticket_number}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px', display: 'flex', gap: '10px' }}>
                  <span>{STATUS_LABEL[t.status] || t.status}</span>
                  <span>·</span>
                  <span>{PRIORITY_LABEL[t.priority] || t.priority}</span>
                  <span>·</span>
                  <span>{fmtDate(t.created_at)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(21,96,130,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setShowModal(false)}>
          <div style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '480px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#156082', margin: '0 0 16px' }}>New Support Ticket</h2>
            {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>{error}</div>}
            <div style={{ display: 'grid', gap: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>Project *
                <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '9px 11px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px' }}>
                  <option value="">Select project…</option>
                  {projects.map((p: any) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
              </label>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>Type
                <select value={form.ticket_type} onChange={e => setForm({ ...form, ticket_type: e.target.value })}
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '9px 11px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px' }}>
                  {TICKET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>Priority
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '9px 11px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px' }}>
                  {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>Title *
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '9px 11px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', boxSizing: 'border-box' }} />
              </label>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>Description
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4}
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '9px 11px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' as const, fontFamily: 'inherit' }} />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 16px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={create} disabled={saving} style={{ padding: '9px 16px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Creating…' : 'Create ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
