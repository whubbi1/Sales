'use client'
import { useState, useEffect } from 'react'
import { GRCLayout } from '@/components/GRCLayout'

const API = 'https://api.whubbi.wcomply.com'

const STATUS_COLORS: Record<string, {bg:string;color:string}> = {
  planned:     {bg:'#EFF6FF', color:'#2563EB'},
  in_progress: {bg:'#FFF7ED', color:'#D97706'},
  completed:   {bg:'#ECFDF5', color:'#059669'},
  cancelled:   {bg:'#F1F5F9', color:'#94A3B8'},
}

const SEVERITY_COLORS: Record<string, string> = {
  critical:'#DC2626', high:'#D97706', medium:'#2563EB', low:'#059669'
}

export default function AuditsPage() {
  const [audits, setAudits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [selectedData, setSelectedData] = useState<any>(null)
  const [showFindingModal, setShowFindingModal] = useState(false)

  const load = () => {
    fetch(`${API}/grc/audits`).then(r => r.json()).then(d => setAudits(d.audits || [])).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const loadAudit = (audit: any) => {
    setSelected(audit)
    fetch(`${API}/grc/audits/${audit.id}`).then(r => r.json()).then(setSelectedData)
  }

  const createAudit = async (data: any) => {
    await fetch(`${API}/grc/audits`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) })
    setShowModal(false); load()
  }

  const addFinding = async (data: any) => {
    await fetch(`${API}/grc/audits/${selected.id}/findings`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) })
    setShowFindingModal(false); loadAudit(selected)
  }

  return (
    <GRCLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', marginBottom: '4px' }}>🔍 Audits</h1>
            <p style={{ fontSize: '12px', color: '#45B6E4' }}>{audits.length} audits</p>
          </div>
          <button onClick={() => setShowModal(true)}
            style={{ background: '#156082', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
            + New Audit
          </button>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading...</div>}

        <div style={{ display: 'grid', gridTemplateColumns: selected ? '340px 1fr' : '1fr', gap: '20px' }}>
          {/* Audit list */}
          <div>
            {audits.length === 0 && !loading && (
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '48px', textAlign: 'center', color: '#45B6E4' }}>
                No audits yet. Create your first audit!
              </div>
            )}
            {audits.map(audit => {
              const sc = STATUS_COLORS[audit.status] || STATUS_COLORS.planned
              return (
                <div key={audit.id} onClick={() => loadAudit(audit)}
                  style={{ background: 'white', borderRadius: '12px', border: `1.5px solid ${selected?.id === audit.id ? '#156082' : '#EDF2F7'}`, padding: '16px', marginBottom: '10px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#156082' }}>{audit.title}</div>
                    <span style={{ background: sc.bg, color: sc.color, padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                      {audit.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#45B6E4' }}>
                    {audit.audit_type} · {audit.auditor_name || 'TBD'}
                    {audit.findings_count > 0 && ` · ${audit.findings_count} findings`}
                  </div>
                  {audit.start_date && (
                    <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
                      {new Date(audit.start_date).toLocaleDateString()} — {audit.end_date ? new Date(audit.end_date).toLocaleDateString() : 'TBD'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Audit detail */}
          {selected && selectedData && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#156082' }}>{selectedData.audit?.title}</div>
                  <div style={{ fontSize: '11px', color: '#45B6E4' }}>{selectedData.audit?.audit_type} · {selectedData.audit?.auditor_name}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setShowFindingModal(true)}
                    style={{ padding: '7px 14px', background: '#156082', color: 'white', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                    + Finding
                  </button>
                  <button onClick={() => setSelected(null)}
                    style={{ padding: '7px 14px', background: '#F1F5F9', color: '#45B6E4', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                    ×
                  </button>
                </div>
              </div>

              {/* Scope */}
              {selectedData.audit?.scope && (
                <div style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Scope</div>
                  <div style={{ fontSize: '12px', color: '#3F3F3F' }}>{selectedData.audit.scope}</div>
                </div>
              )}

              {/* Findings */}
              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '12px' }}>
                  Findings ({selectedData.findings?.length || 0})
                </div>
                {selectedData.findings?.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px', color: '#45B6E4', fontSize: '13px' }}>No findings yet.</div>
                )}
                {selectedData.findings?.map((f: any) => (
                  <div key={f.id} style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${SEVERITY_COLORS[f.severity] || '#EDF2F7'}30`, marginBottom: '8px', background: `${SEVERITY_COLORS[f.severity] || '#156082'}06` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#3F3F3F' }}>{f.title}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ background: `${SEVERITY_COLORS[f.severity] || '#156082'}15`, color: SEVERITY_COLORS[f.severity] || '#156082', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '700' }}>
                          {f.severity?.charAt(0).toUpperCase() + f.severity?.slice(1)}
                        </span>
                        <span style={{ background: f.status === 'resolved' ? '#ECFDF5' : '#FFF7ED', color: f.status === 'resolved' ? '#059669' : '#D97706', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '700' }}>
                          {f.status?.charAt(0).toUpperCase() + f.status?.slice(1)}
                        </span>
                      </div>
                    </div>
                    {f.description && <div style={{ fontSize: '11px', color: '#45B6E4' }}>{f.description}</div>}
                    {f.corrective_action && <div style={{ fontSize: '10px', color: '#059669', marginTop: '4px', fontStyle: 'italic' }}>↳ {f.corrective_action}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* New Audit Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(21,96,130,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' }}>
            <div style={{ background: 'white', borderRadius: '14px', width: '520px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(21,96,130,0.25)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#156082' }}>New Audit</span>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#45B6E4' }}>×</button>
              </div>
              <AuditForm onSave={createAudit} onCancel={() => setShowModal(false)} />
            </div>
          </div>
        )}

        {/* New Finding Modal */}
        {showFindingModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(21,96,130,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' }}>
            <div style={{ background: 'white', borderRadius: '14px', width: '500px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(21,96,130,0.25)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#156082' }}>Add Finding</span>
                <button onClick={() => setShowFindingModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#45B6E4' }}>×</button>
              </div>
              <FindingForm onSave={addFinding} onCancel={() => setShowFindingModal(false)} />
            </div>
          </div>
        )}
      </div>
    </GRCLayout>
  )
}

function AuditForm({ onSave, onCancel }: any) {
  const [form, setForm] = useState({ title:'', audit_type:'internal', status:'planned', start_date:'', end_date:'', auditor_name:'', scope:'' })
  return (
    <div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label className="form-label">Title *</label>
          <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="form-input" placeholder="Audit title" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label className="form-label">Type</label>
            <select value={form.audit_type} onChange={e => setForm({...form, audit_type: e.target.value})} className="form-input">
              {['internal','external','regulatory'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="form-input">
              {['planned','in_progress','completed','cancelled'].map(s => <option key={s} value={s}>{s.replace('_',' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label className="form-label">Start Date</label>
            <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className="form-input" />
          </div>
          <div>
            <label className="form-label">End Date</label>
            <input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} className="form-input" />
          </div>
        </div>
        <div>
          <label className="form-label">Auditor</label>
          <input value={form.auditor_name} onChange={e => setForm({...form, auditor_name: e.target.value})} className="form-input" placeholder="Auditor name" />
        </div>
        <div>
          <label className="form-label">Scope</label>
          <textarea value={form.scope} onChange={e => setForm({...form, scope: e.target.value})} className="form-input" placeholder="Audit scope..." />
        </div>
      </div>
      <div style={{ padding: '14px 20px', borderTop: '1px solid #EDF2F7', background: '#FAFBFC', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button onClick={onCancel} style={{ padding: '8px 16px', background: 'white', border: '1.5px solid #EDF2F7', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', color: '#45B6E4' }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={!form.title}
          style={{ padding: '8px 16px', background: form.title ? '#156082' : '#F1F5F9', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: form.title ? 'pointer' : 'not-allowed', fontFamily: 'Montserrat, sans-serif', color: form.title ? 'white' : '#45B6E4' }}>
          Create Audit
        </button>
      </div>
    </div>
  )
}

function FindingForm({ onSave, onCancel }: any) {
  const [form, setForm] = useState({ title:'', description:'', severity:'medium', corrective_action:'', owner_email:'' })
  return (
    <div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label className="form-label">Title *</label>
          <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="form-input" placeholder="Finding title" />
        </div>
        <div>
          <label className="form-label">Description</label>
          <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="form-input" placeholder="Describe the finding..." />
        </div>
        <div>
          <label className="form-label">Severity</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['critical','high','medium','low'].map(s => (
              <button key={s} onClick={() => setForm({...form, severity: s})}
                style={{ flex: 1, padding: '6px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif',
                  background: form.severity === s ? SEVERITY_COLORS[s] : '#F1F5F9',
                  color: form.severity === s ? 'white' : '#45B6E4' }}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="form-label">Corrective Action</label>
          <textarea value={form.corrective_action} onChange={e => setForm({...form, corrective_action: e.target.value})} className="form-input" placeholder="Recommended corrective action..." />
        </div>
      </div>
      <div style={{ padding: '14px 20px', borderTop: '1px solid #EDF2F7', background: '#FAFBFC', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button onClick={onCancel} style={{ padding: '8px 16px', background: 'white', border: '1.5px solid #EDF2F7', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', color: '#45B6E4' }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={!form.title}
          style={{ padding: '8px 16px', background: form.title ? '#156082' : '#F1F5F9', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: form.title ? 'pointer' : 'not-allowed', fontFamily: 'Montserrat, sans-serif', color: form.title ? 'white' : '#45B6E4' }}>
          Add Finding
        </button>
      </div>
    </div>
  )
}

const SEVERITY_COLORS: Record<string, string> = {
  critical:'#DC2626', high:'#D97706', medium:'#2563EB', low:'#059669'
}
