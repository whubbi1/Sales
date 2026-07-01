'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DevelopmentLayout, { useDevPerm } from '@/components/DevelopmentLayout'
import {
  API, APPLICATIONS, REQUEST_STATUSES, REQUEST_PRIORITIES,
  getRequestStatus, getRequestPriority
} from '../constants'

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}

function RequestsContent() {
  const router = useRouter()
  const { canEdit } = useDevPerm()
  const [requests, setRequests]   = useState<any[]>([])
  const [pipelines, setPipelines] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [appFilter, setAppFilter] = useState('')
  const [statusFilter, setStatus] = useState('')
  const [pipeFilter, setPipe]     = useState('')

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const [rReq, rPl] = await Promise.all([
      fetch(`${API}/development/requests`).then(r => r.json()).catch(() => ({ requests: [] })),
      fetch(`${API}/development/pipelines`).then(r => r.json()).catch(() => ({ pipelines: [] })),
    ])
    setRequests(rReq.requests || [])
    setPipelines(rPl.pipelines || [])
    setLoading(false)
  }

  const filtered = requests.filter(r => {
    if (appFilter && r.application !== appFilter) return false
    if (statusFilter && r.status !== statusFilter) return false
    if (pipeFilter && r.pipeline_id !== pipeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (r.title || '').toLowerCase().includes(q) ||
             (r.request_number || '').toLowerCase().includes(q) ||
             (r.requester_name || '').toLowerCase().includes(q)
    }
    return true
  })

  const byStatus = REQUEST_STATUSES.reduce((acc, s) => ({
    ...acc, [s.value]: filtered.filter(r => r.status === s.value).length
  }), {} as Record<string, number>)

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>📋 Development Requests</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>
            {filtered.length} request{filtered.length !== 1 ? 's' : ''} · sourced from Helpdesk (type: Development Request)
          </p>
        </div>
        <button onClick={() => router.push('/helpdesk/tickets')}
          style={{ padding: '9px 16px', background: '#EFF6FF', color: '#156082', border: '1.5px solid #156082', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
          🎧 Open in Helpdesk
        </button>
      </div>

      {/* KPI row */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${REQUEST_STATUSES.length}, 1fr)`, gap: '10px', marginBottom: '20px' }}>
          {REQUEST_STATUSES.map(s => (
            <div key={s.value} onClick={() => setStatus(statusFilter === s.value ? '' : s.value)}
              style={{ background: statusFilter === s.value ? s.bg : 'white', borderRadius: '10px', border: `1.5px solid ${statusFilter === s.value ? s.color : '#EDF2F7'}`, padding: '12px 14px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: s.color, marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: s.color }}>{byStatus[s.value] || 0}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inp, width: '220px' }} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...inp }} value={appFilter} onChange={e => setAppFilter(e.target.value)}>
          <option value="">All applications</option>
          {APPLICATIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select style={{ ...inp }} value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {REQUEST_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select style={{ ...inp }} value={pipeFilter} onChange={e => setPipe(e.target.value)}>
          <option value="">All pipelines</option>
          {pipelines.map((p: any) => <option key={p.id} value={p.id}>{p.pipeline_code} – {p.name}</option>)}
        </select>
        {(search || appFilter || statusFilter || pipeFilter) && (
          <button onClick={() => { setSearch(''); setAppFilter(''); setStatus(''); setPipe('') }}
            style={{ ...inp, background: '#F1F5F9', color: '#64748B', cursor: 'pointer' }}>× Clear</button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {['Ticket #', 'Title', 'Application', 'Priority', 'Status', 'Assignee', 'Pipeline', 'Created'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>
                No development requests found. Create one in Helpdesk by choosing <strong>Development Request</strong> as the ticket type.
              </td></tr>
            ) : filtered.map(r => {
              const st = getRequestStatus(r.status)
              const pr = getRequestPriority(r.priority)
              return (
                <tr key={r.id} onClick={() => router.push(`/development/requests/${r.id}`)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '10px 12px', fontWeight: '700', color: '#156082', whiteSpace: 'nowrap' }}>{r.request_number}</td>
                  <td style={{ padding: '10px 12px', color: '#3F3F3F', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</td>
                  <td style={{ padding: '10px 12px', color: '#45B6E4', fontSize: '11px' }}>{r.application || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: pr.bg, color: pr.color, padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', textTransform: 'capitalize' }}>{pr.label}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: st.bg, color: st.color, padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{st.label}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#3F3F3F', fontSize: '11px' }}>{r.assignee_name || r.assignee_email || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: '11px' }}>
                    {r.pipeline_code ? (
                      <span style={{ background: '#EFF6FF', color: '#3B82F6', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{r.pipeline_code}</span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#94A3B8', whiteSpace: 'nowrap' }}>
                    {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function DevRequestsPage() {
  return <DevelopmentLayout><RequestsContent /></DevelopmentLayout>
}
