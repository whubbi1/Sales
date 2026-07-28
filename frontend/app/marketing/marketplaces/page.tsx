'use client'
import { useState, useEffect } from 'react'
import { MarketingLayout, useMarketingPerm } from '@/components/MarketingLayout'
import { marketingAPI, partnersAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

const inp: React.CSSProperties = { fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white', width: '100%', boxSizing: 'border-box' as const }
const lbl: React.CSSProperties = { display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
const btn: React.CSSProperties = { padding: '9px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }

function StarRating({ value, onChange, readOnly }: { value: number; onChange?: (v: number) => void; readOnly?: boolean }) {
  return (
    <div style={{ display: 'inline-flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} onClick={() => !readOnly && onChange?.(n === value ? 0 : n)}
          style={{ fontSize: readOnly ? '13px' : '18px', cursor: readOnly ? 'default' : 'pointer', color: n <= value ? '#F59E0B' : '#E2E8F0', lineHeight: 1 }}>
          ★
        </span>
      ))}
    </div>
  )
}

function MarketplaceModal({ marketplace, partners, onClose, onSaved }: any) {
  const [name, setName] = useState(marketplace?.name || '')
  const [url, setUrl] = useState(marketplace?.url || '')
  const [description, setDescription] = useState(marketplace?.description || '')
  const [partnerId, setPartnerId] = useState(marketplace?.partner_id || '')
  const [rating, setRating] = useState(marketplace?.rating || 0)
  const [avgJobRequests, setAvgJobRequests] = useState(marketplace?.avg_job_requests ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const sortedPartners = [...partners].sort((a: any, b: any) => a.name.localeCompare(b.name))

  const submit = async () => {
    if (!name.trim() || !url.trim()) { setError('Name and Link are required'); return }
    setSaving(true); setError('')
    try {
      const me = getStoredUser()
      const payload = {
        name: name.trim(), url: url.trim(), description: description.trim() || null,
        partner_id: partnerId || null, rating: rating || null,
        avg_job_requests: avgJobRequests === '' ? null : Number(avgJobRequests),
        created_by_email: me?.email || '',
      }
      if (marketplace) await marketingAPI.updateMarketplace(marketplace.id, payload)
      else await marketingAPI.createMarketplace(payload)
      onSaved()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082' }}>{marketplace ? 'Edit Marketplace' : 'Add Marketplace'}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#94A3B8' }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={lbl}>Name</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SAP Store" autoFocus />
          </div>
          <div>
            <label style={lbl}>Link</label>
            <input style={inp} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label style={lbl}>Short Description</label>
            <textarea style={{ ...inp, minHeight: '70px', resize: 'vertical' as const, fontFamily: 'Montserrat, sans-serif' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label style={lbl}>Partner</label>
            <select style={inp} value={partnerId} onChange={e => setPartnerId(e.target.value)}>
              <option value="">— Not linked —</option>
              {sortedPartners.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div>
              <label style={lbl}>Rating</label>
              <StarRating value={rating} onChange={setRating} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Avg. Job Requests</label>
              <input style={inp} type="number" min="0" value={avgJobRequests} onChange={e => setAvgJobRequests(e.target.value)} placeholder="e.g. 25" />
            </div>
          </div>
          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '8px 12px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ ...btn, background: saving ? '#94A3B8' : '#156082', color: 'white' }}>
            {saving ? 'Saving…' : marketplace ? 'Save Changes' : 'Add Marketplace'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MarketplacesContent() {
  const { level, canEdit } = useMarketingPerm('marketplaces')
  const [marketplaces, setMarketplaces] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try { setMarketplaces((await marketingAPI.listMarketplaces()).marketplaces || []) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    partnersAPI.list({}).then(setPartners).catch(() => {})
  }, [])

  if (level === 'loading' || loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )

  const handleDelete = async (m: any) => {
    await marketingAPI.deleteMarketplace(m.id)
    setDeleteConfirm(null)
    load()
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>🛒 Marketplaces</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>{marketplaces.length} marketplace{marketplaces.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditing(null); setShowModal(true) }} style={{ ...btn, background: '#156082', color: 'white' }}>
            + Add Marketplace
          </button>
        )}
      </div>

      {marketplaces.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7' }}>
          <div style={{ fontSize: '36px', marginBottom: '10px', opacity: 0.35 }}>🛒</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#45B6E4', marginBottom: '5px' }}>No marketplaces yet</div>
          <div style={{ fontSize: '12px', color: '#94A3B8' }}>Add a link to get started.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {marketplaces.map((m: any) => (
            <div key={m.id} style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ minWidth: 0 }}>
                <a href={m.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '14px', fontWeight: '700', color: '#156082', textDecoration: 'none' }}>
                  {m.name} <span style={{ fontSize: '11px' }}>↗</span>
                </a>
                {m.description && <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>{m.description}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', flexWrap: 'wrap' as const }}>
                  {m.partner && <a href={`/partners/${m.partner.id}`} style={{ fontSize: '11px', color: '#7C3AED', fontWeight: '600', textDecoration: 'none', background: '#F5F3FF', padding: '2px 8px', borderRadius: '10px' }}>{m.partner.name}</a>}
                  {!!m.rating && <StarRating value={m.rating} readOnly />}
                  {m.avg_job_requests != null && <span style={{ fontSize: '11px', color: '#64748B' }}>Avg. {m.avg_job_requests} job requests</span>}
                </div>
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button onClick={() => { setEditing(m); setShowModal(true) }} style={{ border: '1px solid #E2E8F0', background: 'white', color: '#156082', borderRadius: '7px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>Edit</button>
                  <button onClick={() => setDeleteConfirm(m)} style={{ border: '1px solid #FCA5A5', background: 'white', color: '#DC2626', borderRadius: '7px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && <MarketplaceModal marketplace={editing} partners={partners} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#DC2626' }}>Delete Marketplace</h2>
              <button onClick={() => setDeleteConfirm(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#94A3B8' }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: '#3F3F3F' }}>Delete <strong>{deleteConfirm.name}</strong>? This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setDeleteConfirm(null)} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ ...btn, background: '#DC2626', color: 'white' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MarketplacesPage() {
  return <MarketingLayout><MarketplacesContent /></MarketingLayout>
}
