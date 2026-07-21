'use client'
import { useState, useEffect } from 'react'
import { HRLayout } from '@/components/HRLayout'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const ABSENCE_STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  synced:       { bg: '#ECFDF5', text: '#059669' },
  pending_push: { bg: '#FFF7ED', text: '#D97706' },
  error:        { bg: '#FEF2F2', text: '#DC2626' },
}

export default function PayfitSyncPage() {
  const [userEmail, setUserEmail] = useState('')
  const [status, setStatus] = useState<any>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [collaborators, setCollaborators] = useState<any[]>([])
  const [absences, setAbsences] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [syncingCollaborators, setSyncingCollaborators] = useState(false)
  const [syncingAbsences, setSyncingAbsences] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [showNewAbsence, setShowNewAbsence] = useState(false)
  const [newAbsence, setNewAbsence] = useState({ collaborator_payfit_id: '', absence_type: 'paid_holiday', start_date: '', end_date: '' })
  const [creatingAbsence, setCreatingAbsence] = useState(false)

  useEffect(() => {
    const user = getStoredUser(); if (user) setUserEmail(user.email)
    loadStatus(); loadCollaborators(); loadAbsences()
  }, [])

  const loadStatus = () => {
    setLoadingStatus(true)
    fetch(`${API}/payfit/status`).then(r => r.json()).then(setStatus).finally(() => setLoadingStatus(false))
  }

  const loadCollaborators = () => {
    fetch(`${API}/payfit/collaborators`).then(r => r.json()).then(d => setCollaborators(d.collaborators || [])).catch(() => {})
  }

  const loadAbsences = () => {
    fetch(`${API}/payfit/absences`).then(r => r.json()).then(d => setAbsences(d.absences || [])).catch(() => {})
  }

  const flash = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  const syncCollaborators = async () => {
    setSyncingCollaborators(true)
    try {
      const r = await fetch(`${API}/payfit/sync/collaborators?triggered_by=${encodeURIComponent(userEmail)}`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || 'Sync failed')
      flash(`Synced ${d.synced} collaborator(s) from PayFit`, 'success')
      loadCollaborators(); loadStatus()
    } catch (e: any) {
      flash(e.message, 'error')
    }
    setSyncingCollaborators(false)
  }

  const syncAbsences = async () => {
    setSyncingAbsences(true)
    try {
      const r = await fetch(`${API}/payfit/sync/absences?triggered_by=${encodeURIComponent(userEmail)}`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || 'Sync failed')
      flash(`Synced ${d.synced} absence(s) from PayFit`, 'success')
      loadAbsences(); loadStatus()
    } catch (e: any) {
      flash(e.message, 'error')
    }
    setSyncingAbsences(false)
  }

  const createAbsence = async () => {
    if (!newAbsence.collaborator_payfit_id || !newAbsence.start_date || !newAbsence.end_date) {
      flash('Collaborator, start date and end date are required', 'error'); return
    }
    setCreatingAbsence(true)
    try {
      const r = await fetch(`${API}/payfit/absences`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newAbsence, created_by: userEmail }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || 'Could not push absence to PayFit')
      flash('Absence created and pushed to PayFit', 'success')
      setShowNewAbsence(false)
      setNewAbsence({ collaborator_payfit_id: '', absence_type: 'paid_holiday', start_date: '', end_date: '' })
      loadAbsences()
    } catch (e: any) {
      flash(e.message, 'error')
    }
    setCreatingAbsence(false)
  }

  const cancelAbsence = async (id: string) => {
    if (!confirm('Cancel this absence? This also cancels it in PayFit if already synced.')) return
    try {
      const r = await fetch(`${API}/payfit/absences/${id}`, { method: 'DELETE' })
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Could not cancel') }
      flash('Absence cancelled', 'success')
      loadAbsences()
    } catch (e: any) {
      flash(e.message, 'error')
    }
  }

  const filteredCollaborators = collaborators.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(search.toLowerCase())
  )

  const label = { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: '#45B6E4' }
  const card = { background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }

  return (
    <HRLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', marginBottom: '4px' }}>💰 PayFit Sync</h1>
          <p style={{ fontSize: '12px', color: '#45B6E4' }}>Collaborators &amp; contracts sync one-way from PayFit; absences sync both ways.</p>
        </div>

        {message && (
          <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '14px', background: message.type === 'success' ? '#ECFDF5' : '#FEF2F2', color: message.type === 'success' ? '#059669' : '#DC2626', fontSize: '12px', fontWeight: '600' }}>
            {message.type === 'success' ? '✅' : '❌'} {message.text}
          </div>
        )}

        {/* Connection status */}
        <div style={{ ...card, padding: '16px 20px', marginBottom: '16px' }}>
          {loadingStatus ? (
            <div style={{ color: '#94A3B8', fontSize: '12px' }}>Checking connection…</div>
          ) : !status?.configured ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#DC2626', fontSize: '12px', fontWeight: '700' }}>
              🚫 PayFit is not configured — PAYFIT_API_KEY is missing on the backend.
            </div>
          ) : status?.error ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#DC2626', fontSize: '12px', fontWeight: '700' }}>
              ⚠️ Connected but the last health check failed: {status.error}
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>✅</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#156082' }}>{status.company?.name || 'Connected'}</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>Company ID: {status.company_id}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sync actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
          <div style={{ ...card, padding: '16px 20px' }}>
            <div style={label}>Collaborators</div>
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: '6px 0 12px' }}>Pulls the full PayFit roster. Read + create only — profile edits still happen in PayFit.</p>
            <button onClick={syncCollaborators} disabled={syncingCollaborators || !status?.configured}
              style={{ padding: '8px 16px', background: '#156082', color: 'white', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', opacity: syncingCollaborators || !status?.configured ? 0.6 : 1 }}>
              {syncingCollaborators ? '⏳ Syncing…' : '🔄 Sync from PayFit'}
            </button>
            <span style={{ marginLeft: '10px', fontSize: '11px', color: '#94A3B8' }}>{collaborators.length} synced</span>
          </div>
          <div style={{ ...card, padding: '16px 20px' }}>
            <div style={label}>Absences</div>
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: '6px 0 12px' }}>Genuinely two-way — WHUBBI can create/cancel, and pull PayFit's own record.</p>
            <button onClick={syncAbsences} disabled={syncingAbsences || !status?.configured}
              style={{ padding: '8px 16px', background: '#156082', color: 'white', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', opacity: syncingAbsences || !status?.configured ? 0.6 : 1 }}>
              {syncingAbsences ? '⏳ Syncing…' : '🔄 Sync from PayFit'}
            </button>
            <span style={{ marginLeft: '10px', fontSize: '11px', color: '#94A3B8' }}>{absences.length} tracked</span>
          </div>
        </div>

        {/* Collaborators list */}
        <div style={{ ...card, overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#156082' }}>Collaborators</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              style={{ padding: '6px 10px', border: '1.5px solid #EDF2F7', borderRadius: '6px', fontSize: '11px', outline: 'none', fontFamily: 'Montserrat, sans-serif' }} />
          </div>
          {filteredCollaborators.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>No collaborators synced yet.</div>
          )}
          {filteredCollaborators.map((c, i) => (
            <div key={c.id} style={{ padding: '10px 20px', borderTop: i === 0 ? 'none' : '1px solid #F9FAFB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#3F3F3F' }}>{c.first_name} {c.last_name}</div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>{c.email || '—'} · PayFit ID {c.payfit_id}</div>
              </div>
              <div style={{ fontSize: '11px', color: c.whubbi_user_email ? '#059669' : '#94A3B8', fontWeight: '600' }}>
                {c.whubbi_user_email || 'Not linked to a WHUBBI user'}
              </div>
            </div>
          ))}
        </div>

        {/* Absences list */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#156082' }}>Absences</span>
            <button onClick={() => setShowNewAbsence(v => !v)}
              style={{ padding: '6px 14px', background: '#EFF6FF', color: '#156082', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
              + New Absence
            </button>
          </div>

          {showNewAbsence && (
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#94A3B8', marginBottom: '4px' }}>PayFit Collaborator ID</label>
                  <select value={newAbsence.collaborator_payfit_id} onChange={e => setNewAbsence({ ...newAbsence, collaborator_payfit_id: e.target.value })}
                    style={{ width: '100%', padding: '7px 8px', border: '1.5px solid #EDF2F7', borderRadius: '6px', fontSize: '12px', outline: 'none' }}>
                    <option value="">Select…</option>
                    {collaborators.map(c => <option key={c.payfit_id} value={c.payfit_id}>{c.first_name} {c.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#94A3B8', marginBottom: '4px' }}>Type</label>
                  <input value={newAbsence.absence_type} onChange={e => setNewAbsence({ ...newAbsence, absence_type: e.target.value })}
                    style={{ width: '100%', padding: '7px 8px', border: '1.5px solid #EDF2F7', borderRadius: '6px', fontSize: '12px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#94A3B8', marginBottom: '4px' }}>Start</label>
                  <input type="date" value={newAbsence.start_date} onChange={e => setNewAbsence({ ...newAbsence, start_date: e.target.value })}
                    style={{ width: '100%', padding: '7px 8px', border: '1.5px solid #EDF2F7', borderRadius: '6px', fontSize: '12px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#94A3B8', marginBottom: '4px' }}>End</label>
                  <input type="date" value={newAbsence.end_date} onChange={e => setNewAbsence({ ...newAbsence, end_date: e.target.value })}
                    style={{ width: '100%', padding: '7px 8px', border: '1.5px solid #EDF2F7', borderRadius: '6px', fontSize: '12px', outline: 'none' }} />
                </div>
                <button onClick={createAbsence} disabled={creatingAbsence}
                  style={{ padding: '8px 16px', background: '#156082', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
                  {creatingAbsence ? 'Pushing…' : 'Create & Push'}
                </button>
              </div>
            </div>
          )}

          {absences.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>No absences tracked yet.</div>
          )}
          {absences.map((a, i) => {
            const c = ABSENCE_STATUS_COLOR[a.status] || ABSENCE_STATUS_COLOR.error
            return (
              <div key={a.id} style={{ padding: '10px 20px', borderTop: i === 0 ? 'none' : '1px solid #F9FAFB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#3F3F3F' }}>{a.absence_type} · {a.start_date} → {a.end_date}</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>Collaborator {a.collaborator_payfit_id} · source: {a.source}{a.error_detail ? ` · ${a.error_detail}` : ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', background: c.bg, color: c.text, padding: '3px 9px', borderRadius: '10px' }}>{a.status}</span>
                  <button onClick={() => cancelAbsence(a.id)}
                    style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', width: '26px', height: '26px', cursor: 'pointer', fontSize: '13px' }}>×</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </HRLayout>
  )
}
