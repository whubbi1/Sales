'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { GRCLayout } from '@/components/GRCLayout'

const API = 'https://api.whubbi.wcomply.com'

const FW_COLORS: Record<string, string> = {
  'ISO 27001': '#156082', 'GDPR': '#e97132', 'SOC 2': '#059669', 'NIS2': '#7C3AED'
}

const STATUS_CONFIG: Record<string, {bg:string;color:string;label:string}> = {
  not_started:    {bg:'#F1F5F9', color:'#45B6E4', label:'Not Started'},
  in_progress:    {bg:'#FFF7ED', color:'#D97706', label:'In Progress'},
  compliant:      {bg:'#ECFDF5', color:'#059669', label:'Compliant'},
  not_applicable: {bg:'#F8FAFC', color:'#94A3B8', label:'N/A'},
}

import { Suspense } from 'react'

function FrameworksContent() {
  const searchParams = useSearchParams()
  const [frameworks, setFrameworks] = useState<any[]>([])
  const [selected, setSelected] = useState<string|null>(searchParams.get('id'))
  const [controls, setControls] = useState<any[]>([])
  const [fw, setFw] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editControl, setEditControl] = useState<any>(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetch(`${API}/grc/frameworks`).then(r => r.json()).then(d => {
      setFrameworks(d.frameworks || [])
      if (!selected && d.frameworks?.length > 0) setSelected(d.frameworks[0].id)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    fetch(`${API}/grc/frameworks/${selected}/controls`).then(r => r.json()).then(d => {
      setControls(d.controls || [])
      setFw(d.framework)
    })
  }, [selected])

  const updateControl = async (controlId: string, status: string, evidence: string) => {
    await fetch(`${API}/grc/controls/${controlId}`, {
      method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({status, evidence})
    })
    setControls(prev => prev.map(c => c.id === controlId ? {...c, status, evidence} : c))
    setEditControl(null)
  }

  const filtered = filter === 'all' ? controls : controls.filter(c => c.status === filter)

  // Group by category
  const grouped = filtered.reduce((acc: any, c) => {
    const cat = c.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(c)
    return acc
  }, {})

  const fwColor = (name: string) => FW_COLORS[name] || '#156082'

  return (
    <GRCLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', marginBottom: '4px' }}>📋 Frameworks</h1>
          <p style={{ fontSize: '12px', color: '#45B6E4' }}>Regulatory compliance tracking</p>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading...</div>}

        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '20px' }}>
            {/* Framework list */}
            <div>
              {frameworks.map(f => (
                <div key={f.id} onClick={() => setSelected(f.id)}
                  style={{ background: selected === f.id ? 'white' : 'transparent', borderRadius: '10px', border: `1px solid ${selected === f.id ? fwColor(f.name) : 'transparent'}`, padding: '14px', cursor: 'pointer', marginBottom: '8px', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: fwColor(f.name), marginBottom: '4px' }}>{f.name}</div>
                  <div style={{ fontSize: '10px', color: '#45B6E4', marginBottom: '8px' }}>v{f.version} · {f.total_controls} controls</div>
                  <div style={{ height: '5px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${f.compliance_pct}%`, background: fwColor(f.name), borderRadius: '3px' }} />
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: fwColor(f.name), marginTop: '4px' }}>{f.compliance_pct}% compliant</div>
                </div>
              ))}
            </div>

            {/* Controls */}
            {selected && fw && (
              <div>
                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  {/* Header */}
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #EDF2F7', background: `${fwColor(fw.name)}08`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: fwColor(fw.name) }}>{fw.name}</div>
                      <div style={{ fontSize: '11px', color: '#45B6E4' }}>{fw.description}</div>
                    </div>
                    {/* Filter */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {['all','not_started','in_progress','compliant'].map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                          style={{ padding: '4px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif',
                            background: filter === f ? fwColor(fw.name) : '#F1F5F9',
                            color: filter === f ? 'white' : '#45B6E4' }}>
                          {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Controls grouped by category */}
                  <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', padding: '16px' }}>
                    {Object.entries(grouped).map(([cat, ctls]: any) => (
                      <div key={cat} style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #F1F5F9' }}>{cat}</div>
                        {ctls.map((ctrl: any) => {
                          const sc = STATUS_CONFIG[ctrl.status] || STATUS_CONFIG.not_started
                          return (
                            <div key={ctrl.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', border: '1px solid #F1F5F9', marginBottom: '6px', background: 'white' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '10px', fontWeight: '700', color: fwColor(fw.name), background: `${fwColor(fw.name)}15`, padding: '2px 6px', borderRadius: '4px' }}>{ctrl.control_id}</span>
                                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#3F3F3F' }}>{ctrl.title}</span>
                                </div>
                                {ctrl.evidence && <div style={{ fontSize: '10px', color: '#45B6E4', marginTop: '4px' }}>📎 {ctrl.evidence}</div>}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
                                <span style={{ background: sc.bg, color: sc.color, padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' }}>{sc.label}</span>
                                <button onClick={() => setEditControl(ctrl)}
                                  style={{ padding: '4px 10px', background: '#F5F7FA', border: '1px solid #EDF2F7', borderRadius: '6px', fontSize: '10px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', color: '#156082' }}>
                                  Edit
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit Modal */}
        {editControl && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(21,96,130,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' }}>
            <div style={{ background: 'white', borderRadius: '14px', width: '500px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(21,96,130,0.25)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#156082' }}>{editControl.control_id} — {editControl.title}</div>
                  <div style={{ fontSize: '11px', color: '#45B6E4' }}>{editControl.category}</div>
                </div>
                <button onClick={() => setEditControl(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#45B6E4' }}>×</button>
              </div>
              <EditControlForm control={editControl} onSave={updateControl} onCancel={() => setEditControl(null)} />
            </div>
          </div>
        )}
      </div>
    </GRCLayout>
  )
}

export default function FrameworksPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading...</div>}>
      <FrameworksContent />
    </Suspense>
  )
}

function EditControlForm({ control, onSave, onCancel }: any) {
  const [status, setStatus] = useState(control.status)
  const [evidence, setEvidence] = useState(control.evidence || '')

  return (
    <div>
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '6px' }}>Status</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {Object.entries({not_started:'Not Started', in_progress:'In Progress', compliant:'Compliant', not_applicable:'N/A'}).map(([val, label]) => (
              <button key={val} onClick={() => setStatus(val)}
                style={{ padding: '6px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif',
                  background: status === val ? '#156082' : '#F1F5F9',
                  color: status === val ? 'white' : '#45B6E4' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '6px' }}>Evidence / Notes</label>
          <textarea value={evidence} onChange={e => setEvidence(e.target.value)}
            placeholder="Describe evidence, documentation, or notes..."
            style={{ width: '100%', padding: '10px', border: '1.5px solid #EDF2F7', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', fontSize: '12px', resize: 'vertical', minHeight: '80px', outline: 'none', color: '#3F3F3F' }} />
        </div>
      </div>
      <div style={{ padding: '14px 20px', borderTop: '1px solid #EDF2F7', background: '#FAFBFC', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button onClick={onCancel} style={{ padding: '8px 16px', background: 'white', border: '1.5px solid #EDF2F7', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', color: '#45B6E4' }}>Cancel</button>
        <button onClick={() => onSave(control.id, status, evidence)} style={{ padding: '8px 16px', background: '#156082', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', color: 'white' }}>Save</button>
      </div>
    </div>
  )
}
