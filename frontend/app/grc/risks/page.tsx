'use client'
import { useState, useEffect } from 'react'
import { GRCLayout } from '@/components/GRCLayout'

const API = 'https://api.whubbi.wcomply.com'

const RISK_COLOR = (score: number) =>
  score >= 15 ? '#DC2626' : score >= 9 ? '#D97706' : score >= 4 ? '#2563EB' : '#059669'
const RISK_LABEL = (score: number) =>
  score >= 15 ? 'Critical' : score >= 9 ? 'High' : score >= 4 ? 'Medium' : 'Low'

const CATEGORIES = ['operational', 'security', 'compliance', 'financial', 'strategic', 'other']
const STATUSES = ['open', 'mitigated', 'accepted', 'closed']

export default function RisksPage() {
  const [risks, setRisks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editRisk, setEditRisk] = useState<any>(null)
  const [filter, setFilter] = useState('all')

  const load = () => {
    fetch(`${API}/grc/risks`).then(r => r.json()).then(d => setRisks(d.risks || [])).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const save = async (data: any) => {
    if (editRisk) {
      await fetch(`${API}/grc/risks/${editRisk.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) })
    } else {
      await fetch(`${API}/grc/risks`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) })
    }
    setShowModal(false); setEditRisk(null); load()
  }

  const del = async (id: string) => {
    if (!confirm('Delete this risk?')) return
    await fetch(`${API}/grc/risks/${id}`, { method: 'DELETE' })
    load()
  }

  const filtered = filter === 'all' ? risks : risks.filter(r => r.status === filter)

  return (
    <GRCLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', marginBottom: '4px' }}>⚠️ Risk Register</h1>
            <p style={{ fontSize: '12px', color: '#45B6E4' }}>{risks.length} risks tracked</p>
          </div>
          <button onClick={() => { setEditRisk(null); setShowModal(true) }}
            style={{ background: '#156082', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
            + Add Risk
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          {['all', ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: '5px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif',
                background: filter === s ? '#156082' : '#F1F5F9', color: filter === s ? 'white' : '#45B6E4' }}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading...</div>}

        {/* Risk Matrix hint */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC', display: 'flex', gap: '16px', fontSize: '11px', fontWeight: '600' }}>
            {[{label:'Critical (≥15)', color:'#DC2626'},{label:'High (9-14)', color:'#D97706'},{label:'Medium (4-8)', color:'#2563EB'},{label:'Low (1-3)', color:'#059669'}].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.color }} />
                <span style={{ color: '#45B6E4' }}>{l.label}</span>
              </div>
            ))}
          </div>

          {filtered.length === 0 && !loading && (
            <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>No risks found. Add your first risk!</div>
          )}

          {filtered.map((risk: any) => {
            const score = risk.probability * risk.impact
            const color = RISK_COLOR(score)
            return (
              <div key={risk.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #F9FAFB', gap: '12px' }}>
                {/* Score */}
                <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: color + '15', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: '16px', fontWeight: '900', color }}>{score}</div>
                  <div style={{ fontSize: '8px', fontWeight: '700', color, textTransform: 'uppercase' }}>{RISK_LABEL(score)}</div>
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#3F3F3F', marginBottom: '3px' }}>{risk.title}</div>
                  <div style={{ fontSize: '11px', color: '#45B6E4' }}>
                    {risk.category} · P:{risk.probability} × I:{risk.impact}
                    {risk.owner_name && ` · ${risk.owner_name}`}
                  </div>
                  {risk.mitigation && <div style={{ fontSize: '10px', color: '#45B6E4', marginTop: '2px', fontStyle: 'italic' }}>↳ {risk.mitigation}</div>}
                </div>

                {/* Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: '700',
                    background: risk.status === 'closed' ? '#ECFDF5' : risk.status === 'mitigated' ? '#EFF6FF' : risk.status === 'accepted' ? '#FFF7ED' : '#FEF2F2',
                    color: risk.status === 'closed' ? '#059669' : risk.status === 'mitigated' ? '#2563EB' : risk.status === 'accepted' ? '#D97706' : '#DC2626' }}>
                    {risk.status.charAt(0).toUpperCase() + risk.status.slice(1)}
                  </span>
                  <button onClick={() => { setEditRisk(risk); setShowModal(true) }}
                    style={{ padding: '4px 10px', background: '#F5F7FA', border: '1px solid #EDF2F7', borderRadius: '6px', fontSize: '10px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', color: '#156082' }}>Edit</button>
                  <button onClick={() => del(risk.id)}
                    style={{ padding: '4px 10px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '6px', fontSize: '10px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', color: '#DC2626' }}>Del</button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(21,96,130,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' }}>
            <div style={{ background: 'white', borderRadius: '14px', width: '560px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(21,96,130,0.25)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#156082' }}>{editRisk ? 'Edit Risk' : 'New Risk'}</span>
                <button onClick={() => { setShowModal(false); setEditRisk(null) }} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#45B6E4' }}>×</button>
              </div>
              <RiskForm risk={editRisk} onSave={save} onCancel={() => { setShowModal(false); setEditRisk(null) }} />
            </div>
          </div>
        )}
      </div>
    </GRCLayout>
  )
}

function RiskForm({ risk, onSave, onCancel }: any) {
  const [form, setForm] = useState({
    title: risk?.title || '', description: risk?.description || '',
    category: risk?.category || 'operational', probability: risk?.probability || 3,
    impact: risk?.impact || 3, status: risk?.status || 'open',
    mitigation: risk?.mitigation || '', owner_name: risk?.owner_name || '',
  })

  const score = form.probability * form.impact

  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label className="form-label">Title *</label>
          <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="form-input" placeholder="Risk title" />
        </div>
        <div>
          <label className="form-label">Description</label>
          <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="form-input" placeholder="Describe the risk..." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label className="form-label">Category</label>
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="form-input">
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="form-input">
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', alignItems: 'center' }}>
          <div>
            <label className="form-label">Probability (1-5)</label>
            <input type="number" min="1" max="5" value={form.probability} onChange={e => setForm({...form, probability: parseInt(e.target.value)})} className="form-input" />
          </div>
          <div>
            <label className="form-label">Impact (1-5)</label>
            <input type="number" min="1" max="5" value={form.impact} onChange={e => setForm({...form, impact: parseInt(e.target.value)})} className="form-input" />
          </div>
          <div style={{ textAlign: 'center', padding: '10px', borderRadius: '10px', background: RISK_COLOR(score) + '15' }}>
            <div style={{ fontSize: '24px', fontWeight: '900', color: RISK_COLOR(score) }}>{score}</div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: RISK_COLOR(score) }}>{RISK_LABEL(score)}</div>
          </div>
        </div>
        <div>
          <label className="form-label">Mitigation Plan</label>
          <textarea value={form.mitigation} onChange={e => setForm({...form, mitigation: e.target.value})} className="form-input" placeholder="How to mitigate this risk..." />
        </div>
        <div>
          <label className="form-label">Risk Owner</label>
          <input value={form.owner_name} onChange={e => setForm({...form, owner_name: e.target.value})} className="form-input" placeholder="Owner name" />
        </div>
      </div>
      <div style={{ padding: '14px 20px', borderTop: '1px solid #EDF2F7', background: '#FAFBFC', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button onClick={onCancel} style={{ padding: '8px 16px', background: 'white', border: '1.5px solid #EDF2F7', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', color: '#45B6E4' }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={!form.title}
          style={{ padding: '8px 16px', background: form.title ? '#156082' : '#F1F5F9', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: form.title ? 'pointer' : 'not-allowed', fontFamily: 'Montserrat, sans-serif', color: form.title ? 'white' : '#45B6E4' }}>
          {risk ? 'Update Risk' : 'Add Risk'}
        </button>
      </div>
    </div>
  )
}
