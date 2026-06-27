'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { GRCLayout } from '@/components/GRCLayout'

const API = 'https://api.whubbi.wcomply.com'

const STATUS_CFG: Record<string,{bg:string;color:string;label:string}> = {
  not_started:    {bg:'#F1F5F9',color:'#45B6E4',label:'Not Started'},
  in_progress:    {bg:'#FFF7ED',color:'#D97706',label:'In Progress'},
  compliant:      {bg:'#ECFDF5',color:'#059669',label:'Compliant'},
  not_applicable: {bg:'#F8FAFC',color:'#94A3B8',label:'N/A'},
}

function FrameworksContent() {
  const searchParams = useSearchParams()
  const [frameworks, setFrameworks] = useState<any[]>([])
  const [selected, setSelected] = useState<string|null>(searchParams.get('id'))
  const [requirements, setRequirements] = useState<any[]>([])
  const [fw, setFw] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [reqLoading, setReqLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editReq, setEditReq] = useState<any>(null)
  const [showAddReq, setShowAddReq] = useState(false)
  const [newReq, setNewReq] = useState({ requirement_text:'', reference_code:'', status:'not_started' })
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState('')

  useEffect(() => {
    fetch(`${API}/grc/frameworks`)
      .then(r=>r.json())
      .then(d=>{ setFrameworks(d.frameworks||[]); if (!selected && d.frameworks?.length>0) setSelected(d.frameworks[0].id) })
      .finally(()=>setLoading(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    setReqLoading(true)
    fetch(`${API}/grc/frameworks/${selected}/requirements`)
      .then(r=>r.json())
      .then(d=>{ setRequirements(d.requirements||[]); setFw(d.framework) })
      .finally(()=>setReqLoading(false))
  }, [selected])

  const seedFrameworks = async () => {
    setSeeding(true); setSeedMsg('')
    try {
      const r = await fetch(`${API}/grc/seed`, { method:'POST' })
      const d = await r.json()
      setSeedMsg(d.status==='already_seeded' ? '✅ Already seeded' : `✅ Seeded: ${d.frameworks} frameworks, ${d.requirements||0} requirements`)
      // Reload
      const fr = await fetch(`${API}/grc/frameworks`).then(r=>r.json())
      setFrameworks(fr.frameworks||[])
      if (!selected && fr.frameworks?.length>0) setSelected(fr.frameworks[0].id)
    } catch(e:any) { setSeedMsg(`❌ Error: ${e.message}`) }
    setSeeding(false)
  }

  const updateRequirement = async (reqId: string, data: any) => {
    await fetch(`${API}/grc/requirements/${reqId}`, {
      method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)
    })
    setRequirements(prev => prev.map(r => r.id===reqId ? {...r,...data} : r))
    setEditReq(null)
  }

  const deleteRequirement = async (reqId: string) => {
    if (!confirm('Delete this requirement?')) return
    await fetch(`${API}/grc/requirements/${reqId}`, { method:'DELETE' })
    setRequirements(prev => prev.filter(r => r.id!==reqId))
  }

  const addRequirement = async () => {
    if (!newReq.requirement_text.trim()) return
    const r = await fetch(`${API}/grc/frameworks/${selected}/requirements`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...newReq, document_id: null})
    })
    const d = await r.json()
    setRequirements(prev => [...prev, {...newReq, id:d.id, document_name:'Manual'}])
    setNewReq({ requirement_text:'', reference_code:'', status:'not_started' })
    setShowAddReq(false)
  }

  const filteredReqs = requirements.filter(r => {
    const matchFilter = filter==='all' || r.status===filter
    const matchSearch = !search || r.requirement_text?.toLowerCase().includes(search.toLowerCase()) || r.document_name?.toLowerCase().includes(search.toLowerCase()) || r.reference_code?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  // Group by document
  const grouped = filteredReqs.reduce((acc:any, r) => {
    const doc = r.document_name || 'Other'
    if (!acc[doc]) acc[doc] = []
    acc[doc].push(r)
    return acc
  }, {})

  const fwColor = fw?.color || '#156082'
  const totalReqs = requirements.length
  const compliantReqs = requirements.filter(r=>r.status==='compliant').length
  const compliancePct = totalReqs > 0 ? Math.round(compliantReqs/totalReqs*100) : 0

  return (
    <GRCLayout>
      <div style={{ padding:'28px 32px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#156082', marginBottom:'4px' }}>📋 Frameworks & Requirements</h1>
            <p style={{ fontSize:'12px', color:'#45B6E4' }}>{frameworks.length} frameworks — 67 documents</p>
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            {seedMsg && <span style={{ fontSize:'11px', color:'#059669', fontWeight:'600' }}>{seedMsg}</span>}
            <button onClick={seedFrameworks} disabled={seeding}
              style={{ padding:'8px 16px', background:'#7C3AED', color:'white', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
              {seeding ? '⏳ Loading...' : '🌱 Load from Excel'}
            </button>
          </div>
        </div>

        {loading && <div style={{ textAlign:'center', padding:'48px', color:'#45B6E4' }}>Loading...</div>}
        {!loading && (
          <div style={{ display:'grid', gridTemplateColumns:'240px 1fr', gap:'20px' }}>
            {/* Framework list */}
            <div>
              {frameworks.map(f => (
                <div key={f.id} onClick={() => setSelected(f.id)}
                  style={{ background:selected===f.id?'white':'transparent', borderRadius:'10px', border:`1px solid ${selected===f.id?f.color||'#156082':'transparent'}`, padding:'12px 14px', cursor:'pointer', marginBottom:'6px', transition:'all 0.15s' }}>
                  <div style={{ fontSize:'12px', fontWeight:'800', color:f.color||'#156082', marginBottom:'3px' }}>{f.name}</div>
                  <div style={{ fontSize:'10px', color:'#45B6E4', marginBottom:'6px' }}>v{f.version} · {f.total_requirements} requirements</div>
                  <div style={{ height:'4px', background:'#F1F5F9', borderRadius:'2px', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${f.compliance_pct}%`, background:f.color||'#156082', borderRadius:'2px' }}/>
                  </div>
                  <div style={{ fontSize:'10px', fontWeight:'700', color:f.color||'#156082', marginTop:'3px' }}>{f.compliance_pct}%</div>
                </div>
              ))}
            </div>

            {/* Requirements panel */}
            {selected && (
              <div>
                {/* Header */}
                {fw && (
                  <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'16px 20px', marginBottom:'14px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontSize:'16px', fontWeight:'800', color:fwColor }}>{fw.name}</div>
                        <div style={{ fontSize:'11px', color:'#45B6E4' }}>{fw.description}</div>
                      </div>
                      <div style={{ display:'flex', gap:'16px', alignItems:'center' }}>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:'24px', fontWeight:'900', color:fwColor }}>{compliancePct}%</div>
                          <div style={{ fontSize:'10px', color:'#45B6E4' }}>Compliant</div>
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:'24px', fontWeight:'900', color:'#3F3F3F' }}>{totalReqs}</div>
                          <div style={{ fontSize:'10px', color:'#45B6E4' }}>Requirements</div>
                        </div>
                        <button onClick={() => setShowAddReq(true)}
                          style={{ padding:'8px 16px', background:fwColor, color:'white', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
                          + Add
                        </button>
                      </div>
                    </div>
                    {/* Filters */}
                    <div style={{ display:'flex', gap:'8px', marginTop:'12px', flexWrap:'wrap' }}>
                      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search requirements..."
                        style={{ flex:1, minWidth:'200px', padding:'7px 12px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none' }}/>
                      {['all','not_started','in_progress','compliant','not_applicable'].map(s=>(
                        <button key={s} onClick={()=>setFilter(s)}
                          style={{ padding:'6px 12px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'10px', fontWeight:'700', fontFamily:'Montserrat, sans-serif',
                            background:filter===s?fwColor:'#F1F5F9', color:filter===s?'white':'#45B6E4' }}>
                          {STATUS_CFG[s]?.label||'All'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {reqLoading && <div style={{ textAlign:'center', padding:'32px', color:'#45B6E4' }}>Loading requirements...</div>}

                {/* Requirements grouped by document */}
                {!reqLoading && Object.entries(grouped).map(([doc, reqs]:any) => (
                  <div key={doc} style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', marginBottom:'12px' }}>
                    <div style={{ padding:'10px 16px', background:'#F8FAFC', borderBottom:'1px solid #EDF2F7', display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:'11px', fontWeight:'700', color:'#156082' }}>📄 {doc}</span>
                      <span style={{ fontSize:'10px', color:'#45B6E4' }}>{reqs.length} requirement{reqs.length!==1?'s':''}</span>
                    </div>
                    {reqs.map((req:any, i:number) => {
                      const sc = STATUS_CFG[req.status] || STATUS_CFG.not_started
                      return (
                        <div key={req.id} style={{ padding:'12px 16px', borderBottom:'1px solid #F9FAFB', background:i%2===0?'white':'#FAFBFC', display:'flex', alignItems:'flex-start', gap:'12px' }}>
                          <div style={{ flex:1 }}>
                            {req.reference_code && (
                              <span style={{ fontSize:'10px', fontWeight:'700', color:fwColor, background:`${fwColor}15`, padding:'2px 7px', borderRadius:'4px', marginBottom:'6px', display:'inline-block' }}>
                                {req.reference_code}
                              </span>
                            )}
                            <div style={{ fontSize:'12px', color:'#3F3F3F', lineHeight:'1.6', marginBottom:req.evidence?'6px':0 }}>
                              {req.requirement_text}
                            </div>
                            {req.evidence && (
                              <div style={{ fontSize:'11px', color:'#059669', fontStyle:'italic' }}>📎 {req.evidence}</div>
                            )}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
                            <span style={{ background:sc.bg, color:sc.color, padding:'3px 8px', borderRadius:'12px', fontSize:'10px', fontWeight:'700', whiteSpace:'nowrap' }}>{sc.label}</span>
                            <button onClick={() => setEditReq(req)}
                              style={{ padding:'4px 8px', background:'#EFF6FF', border:'none', borderRadius:'6px', fontSize:'10px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif', color:'#156082' }}>Edit</button>
                            <button onClick={() => deleteRequirement(req.id)}
                              style={{ padding:'4px 8px', background:'#FEF2F2', border:'none', borderRadius:'6px', fontSize:'10px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif', color:'#DC2626' }}>×</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}

                {!reqLoading && filteredReqs.length===0 && (
                  <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'48px', textAlign:'center', color:'#45B6E4' }}>
                    {requirements.length===0 ? 'No requirements yet. Click "Load from Excel" to seed all frameworks.' : 'No requirements match your filter.'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Edit Modal */}
        {editReq && (
          <div style={{ position:'fixed', inset:0, background:'rgba(21,96,130,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(2px)' }}>
            <div style={{ background:'white', borderRadius:'14px', width:'560px', overflow:'hidden', boxShadow:'0 20px 60px rgba(21,96,130,0.25)' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #EDF2F7', display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:'13px', fontWeight:'800', color:'#156082' }}>Edit Requirement</span>
                <button onClick={()=>setEditReq(null)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#45B6E4' }}>×</button>
              </div>
              <EditRequirementForm req={editReq} fwColor={fwColor} onSave={updateRequirement} onCancel={()=>setEditReq(null)}/>
            </div>
          </div>
        )}

        {/* Add Requirement Modal */}
        {showAddReq && (
          <div style={{ position:'fixed', inset:0, background:'rgba(21,96,130,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(2px)' }}>
            <div style={{ background:'white', borderRadius:'14px', width:'560px', overflow:'hidden', boxShadow:'0 20px 60px rgba(21,96,130,0.25)' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #EDF2F7', display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:'13px', fontWeight:'800', color:'#156082' }}>Add Requirement</span>
                <button onClick={()=>setShowAddReq(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#45B6E4' }}>×</button>
              </div>
              <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'12px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Reference Code</label>
                  <input value={newReq.reference_code} onChange={e=>setNewReq(p=>({...p,reference_code:e.target.value}))}
                    placeholder="e.g. A.5.1, Article 21..."
                    style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Requirement *</label>
                  <textarea value={newReq.requirement_text} onChange={e=>setNewReq(p=>({...p,requirement_text:e.target.value}))}
                    placeholder="Describe the requirement..."
                    style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:'80px' }}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Status</label>
                  <div style={{ display:'flex', gap:'6px' }}>
                    {Object.entries(STATUS_CFG).map(([val,cfg])=>(
                      <button key={val} onClick={()=>setNewReq(p=>({...p,status:val}))}
                        style={{ padding:'6px 12px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:'700', fontFamily:'Montserrat, sans-serif',
                          background:newReq.status===val?cfg.color:'#F1F5F9', color:newReq.status===val?'white':cfg.color }}>
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ padding:'14px 20px', borderTop:'1px solid #EDF2F7', background:'#FAFBFC', display:'flex', justifyContent:'flex-end', gap:'8px' }}>
                <button onClick={()=>setShowAddReq(false)} style={{ padding:'8px 16px', background:'white', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'Montserrat, sans-serif', color:'#45B6E4' }}>Cancel</button>
                <button onClick={addRequirement} disabled={!newReq.requirement_text.trim()}
                  style={{ padding:'8px 16px', background:newReq.requirement_text.trim()?fwColor:'#F1F5F9', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:newReq.requirement_text.trim()?'pointer':'not-allowed', fontFamily:'Montserrat, sans-serif', color:newReq.requirement_text.trim()?'white':'#45B6E4' }}>
                  Add Requirement
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </GRCLayout>
  )
}

function EditRequirementForm({ req, fwColor, onSave, onCancel }:any) {
  const [form, setForm] = useState({ status:req.status, evidence:req.evidence||'', requirement_text:req.requirement_text||'', reference_code:req.reference_code||'', owner_email:req.owner_email||'' })
  return (
    <div>
      <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'12px' }}>
        <div>
          <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Reference Code</label>
          <input value={form.reference_code} onChange={e=>setForm(p=>({...p,reference_code:e.target.value}))}
            style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/>
        </div>
        <div>
          <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Requirement Text</label>
          <textarea value={form.requirement_text} onChange={e=>setForm(p=>({...p,requirement_text:e.target.value}))}
            style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:'80px' }}/>
        </div>
        <div>
          <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'6px' }}>Status</label>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {Object.entries(STATUS_CFG).map(([val,cfg])=>(
              <button key={val} onClick={()=>setForm(p=>({...p,status:val}))}
                style={{ padding:'6px 12px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:'700', fontFamily:'Montserrat, sans-serif',
                  background:form.status===val?cfg.color:'#F1F5F9', color:form.status===val?'white':cfg.color }}>
                {cfg.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Evidence / Notes</label>
          <textarea value={form.evidence} onChange={e=>setForm(p=>({...p,evidence:e.target.value}))}
            placeholder="Documentation, links, notes..."
            style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:'60px' }}/>
        </div>
        <div>
          <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Owner Email</label>
          <input value={form.owner_email} onChange={e=>setForm(p=>({...p,owner_email:e.target.value}))}
            placeholder="owner@company.com"
            style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/>
        </div>
      </div>
      <div style={{ padding:'14px 20px', borderTop:'1px solid #EDF2F7', background:'#FAFBFC', display:'flex', justifyContent:'flex-end', gap:'8px' }}>
        <button onClick={onCancel} style={{ padding:'8px 16px', background:'white', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'Montserrat, sans-serif', color:'#45B6E4' }}>Cancel</button>
        <button onClick={()=>onSave(req.id,form)} style={{ padding:'8px 16px', background:fwColor, border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif', color:'white' }}>Save</button>
      </div>
    </div>
  )
}

export default function FrameworksPage() {
  return (
    <Suspense fallback={<GRCLayout><div style={{ padding:'48px', textAlign:'center', color:'#45B6E4' }}>Loading...</div></GRCLayout>}>
      <FrameworksContent/>
    </Suspense>
  )
}
