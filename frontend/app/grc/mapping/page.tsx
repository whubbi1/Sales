'use client'
import { useState, useEffect } from 'react'
import { GRCLayout } from '@/components/GRCLayout'

const API = 'https://api.whubbi.wcomply.com'

const MAPPING_TYPES = [
  { value:'equivalent',  label:'Equivalent',  color:'#059669', desc:'Same requirement covered' },
  { value:'related',     label:'Related',     color:'#156082', desc:'Partially overlapping' },
  { value:'supports',    label:'Supports',    color:'#D97706', desc:'One supports the other' },
]

export default function MappingPage() {
  const [documents, setDocuments] = useState<any[]>([])
  const [frameworks, setFrameworks] = useState<any[]>([])
  const [selectedDoc, setSelectedDoc] = useState<string|null>(null)
  const [docReqs, setDocReqs] = useState<any[]>([])
  const [mappings, setMappings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddMapping, setShowAddMapping] = useState(false)
  const [sourceReq, setSourceReq] = useState('')
  const [targetReq, setTargetReq] = useState('')
  const [mappingType, setMappingType] = useState('related')
  const [mappingNotes, setMappingNotes] = useState('')
  const [searchDoc, setSearchDoc] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`${API}/grc/documents`).then(r=>r.json()),
      fetch(`${API}/grc/frameworks`).then(r=>r.json()),
      fetch(`${API}/grc/mapping`).then(r=>r.json()),
    ]).then(([d,f,m]) => {
      setDocuments(d.documents||[])
      setFrameworks(f.frameworks||[])
      setMappings(m.mappings||[])
    }).finally(()=>setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedDoc) return
    fetch(`${API}/grc/mapping/document/${selectedDoc}`)
      .then(r=>r.json())
      .then(d=>setDocReqs(d.frameworks||[]))
  }, [selectedDoc])

  const addMapping = async () => {
    if (!sourceReq || !targetReq) return
    await fetch(`${API}/grc/mapping`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ source_req_id:sourceReq, target_req_id:targetReq, mapping_type:mappingType, notes:mappingNotes })
    })
    const m = await fetch(`${API}/grc/mapping`).then(r=>r.json())
    setMappings(m.mappings||[])
    setShowAddMapping(false); setSourceReq(''); setTargetReq(''); setMappingNotes('')
  }

  const deleteMapping = async (id: string) => {
    if (!confirm('Remove this mapping?')) return
    await fetch(`${API}/grc/mapping/${id}`, { method:'DELETE' })
    setMappings(prev=>prev.filter(m=>m.id!==id))
  }

  const filteredDocs = documents.filter(d=>
    !searchDoc || d.name.toLowerCase().includes(searchDoc.toLowerCase())
  )

  // Group mappings by document
  const mappingsByDoc = mappings.reduce((acc:any, m) => {
    const doc = m.source_document || 'Other'
    if (!acc[doc]) acc[doc] = []
    acc[doc].push(m)
    return acc
  }, {})

  // Get requirements for source framework selector
  const [sourceFramework, setSourceFramework] = useState('')
  const [targetFramework, setTargetFramework] = useState('')
  const [sourceReqs, setSourceReqs] = useState<any[]>([])
  const [targetReqs, setTargetReqs] = useState<any[]>([])

  useEffect(() => {
    if (sourceFramework) {
      fetch(`${API}/grc/frameworks/${sourceFramework}/requirements`).then(r=>r.json()).then(d=>setSourceReqs(d.requirements||[]))
    }
  }, [sourceFramework])

  useEffect(() => {
    if (targetFramework) {
      fetch(`${API}/grc/frameworks/${targetFramework}/requirements`).then(r=>r.json()).then(d=>setTargetReqs(d.requirements||[]))
    }
  }, [targetFramework])

  return (
    <GRCLayout>
      <div style={{ padding:'28px 32px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#156082', marginBottom:'4px' }}>🔗 Framework Mapping</h1>
            <p style={{ fontSize:'12px', color:'#45B6E4' }}>{mappings.length} mappings · Cross-framework requirement alignment</p>
          </div>
          <button onClick={()=>setShowAddMapping(true)}
            style={{ padding:'9px 18px', background:'#156082', color:'white', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
            + Add Mapping
          </button>
        </div>

        {loading && <div style={{ textAlign:'center', padding:'48px', color:'#45B6E4' }}>Loading...</div>}

        {!loading && (
          <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:'20px' }}>
            {/* Document list */}
            <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', height:'fit-content', maxHeight:'calc(100vh - 200px)', display:'flex', flexDirection:'column' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #EDF2F7', background:'#FAFBFC' }}>
                <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'8px' }}>Documents</div>
                <input value={searchDoc} onChange={e=>setSearchDoc(e.target.value)} placeholder="Search..."
                  style={{ width:'100%', padding:'7px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box' }}/>
              </div>
              <div style={{ overflowY:'auto', flex:1 }}>
                {filteredDocs.map(d=>(
                  <div key={d.id} onClick={()=>setSelectedDoc(d.id)}
                    style={{ padding:'10px 16px', borderBottom:'1px solid #F9FAFB', cursor:'pointer',
                      background:selectedDoc===d.id?'#EFF6FF':'white',
                      borderLeft:`3px solid ${selectedDoc===d.id?'#156082':'transparent'}` }}
                    onMouseEnter={e=>{ if(selectedDoc!==d.id) e.currentTarget.style.background='#FAFBFC' }}
                    onMouseLeave={e=>{ if(selectedDoc!==d.id) e.currentTarget.style.background='white' }}>
                    <div style={{ fontSize:'11px', fontWeight:'600', color:'#3F3F3F', lineHeight:'1.4' }}>{d.name}</div>
                    <div style={{ fontSize:'10px', color:'#45B6E4', marginTop:'2px' }}>{d.requirement_count} requirements</div>
                  </div>
                ))}
                {filteredDocs.length===0&&<div style={{ padding:'24px', textAlign:'center', color:'#45B6E4', fontSize:'12px' }}>No documents found.</div>}
              </div>
            </div>

            {/* Mapping view */}
            <div>
              {selectedDoc && docReqs.length > 0 && (
                <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', marginBottom:'16px' }}>
                  <div style={{ padding:'12px 20px', borderBottom:'1px solid #EDF2F7', background:'#FAFBFC' }}>
                    <div style={{ fontSize:'12px', fontWeight:'700', color:'#156082' }}>Framework Coverage for Selected Document</div>
                  </div>
                  <div style={{ padding:'16px', display:'flex', flexWrap:'wrap', gap:'10px' }}>
                    {docReqs.map((r:any)=>(
                      <div key={r.req_id} style={{ padding:'10px 14px', borderRadius:'10px', border:`1.5px solid ${r.color||'#156082'}`, background:`${r.color||'#156082'}08`, minWidth:'200px', flex:1 }}>
                        <div style={{ fontSize:'11px', fontWeight:'800', color:r.color||'#156082', marginBottom:'4px' }}>{r.framework_name}</div>
                        {r.reference_code && <div style={{ fontSize:'10px', fontWeight:'700', color:r.color||'#156082', background:`${r.color||'#156082'}15`, padding:'2px 6px', borderRadius:'4px', display:'inline-block', marginBottom:'4px' }}>{r.reference_code}</div>}
                        <div style={{ fontSize:'11px', color:'#3F3F3F', lineHeight:'1.5', maxHeight:'60px', overflow:'hidden' }}>{r.requirement_text}</div>
                        <div style={{ marginTop:'6px' }}>
                          <span style={{ fontSize:'9px', fontWeight:'700', padding:'2px 6px', borderRadius:'10px',
                            background:r.status==='compliant'?'#ECFDF5':r.status==='in_progress'?'#FFF7ED':'#F1F5F9',
                            color:r.status==='compliant'?'#059669':r.status==='in_progress'?'#D97706':'#45B6E4' }}>
                            {r.status?.replace('_',' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedDoc && docReqs.length===0 && (
                <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'32px', textAlign:'center', color:'#45B6E4', marginBottom:'16px' }}>
                  No framework requirements for this document yet.
                </div>
              )}

              {/* All mappings */}
              <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ padding:'12px 20px', borderBottom:'1px solid #EDF2F7', background:'#FAFBFC' }}>
                  <div style={{ fontSize:'12px', fontWeight:'700', color:'#156082' }}>All Cross-Framework Mappings ({mappings.length})</div>
                </div>
                {mappings.length===0 && (
                  <div style={{ padding:'48px', textAlign:'center', color:'#45B6E4', fontSize:'13px' }}>
                    No mappings yet.<br/>
                    <span style={{ fontSize:'11px' }}>Click "+ Add Mapping" to create cross-framework links.</span>
                  </div>
                )}
                {mappings.map((m:any,i:number)=>{
                  const mt = MAPPING_TYPES.find(t=>t.value===m.mapping_type)||MAPPING_TYPES[1]
                  return (
                    <div key={m.id} style={{ padding:'14px 20px', borderBottom:'1px solid #F9FAFB', background:i%2===0?'white':'#FAFBFC', display:'flex', alignItems:'flex-start', gap:'16px' }}>
                      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 40px 1fr', gap:'12px', alignItems:'center' }}>
                        <div style={{ padding:'10px 12px', background:`${m.source_color||'#156082'}08`, borderRadius:'8px', border:`1px solid ${m.source_color||'#156082'}30` }}>
                          <div style={{ fontSize:'10px', fontWeight:'800', color:m.source_color||'#156082', marginBottom:'3px' }}>{m.source_framework}</div>
                          <div style={{ fontSize:'10px', color:'#45B6E4', marginBottom:'3px' }}>📄 {m.source_document}</div>
                          {m.source_ref && <div style={{ fontSize:'9px', fontWeight:'700', color:m.source_color||'#156082', background:`${m.source_color||'#156082'}15`, padding:'1px 6px', borderRadius:'4px', display:'inline-block', marginBottom:'3px' }}>{m.source_ref}</div>}
                          <div style={{ fontSize:'11px', color:'#3F3F3F', lineHeight:'1.4' }}>{m.source_text?.substring(0,100)}{m.source_text?.length>100?'...':''}</div>
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:'9px', fontWeight:'700', color:mt.color, background:`${mt.color}15`, padding:'3px 6px', borderRadius:'10px' }}>{mt.label}</div>
                          <div style={{ fontSize:'18px', color:'#45B6E4', marginTop:'4px' }}>⟷</div>
                        </div>
                        <div style={{ padding:'10px 12px', background:`${m.target_color||'#156082'}08`, borderRadius:'8px', border:`1px solid ${m.target_color||'#156082'}30` }}>
                          <div style={{ fontSize:'10px', fontWeight:'800', color:m.target_color||'#156082', marginBottom:'3px' }}>{m.target_framework}</div>
                          <div style={{ fontSize:'10px', color:'#45B6E4', marginBottom:'3px' }}>📄 {m.target_document}</div>
                          {m.target_ref && <div style={{ fontSize:'9px', fontWeight:'700', color:m.target_color||'#156082', background:`${m.target_color||'#156082'}15`, padding:'1px 6px', borderRadius:'4px', display:'inline-block', marginBottom:'3px' }}>{m.target_ref}</div>}
                          <div style={{ fontSize:'11px', color:'#3F3F3F', lineHeight:'1.4' }}>{m.target_text?.substring(0,100)}{m.target_text?.length>100?'...':''}</div>
                        </div>
                      </div>
                      <button onClick={()=>deleteMapping(m.id)}
                        style={{ padding:'4px 8px', background:'#FEF2F2', border:'none', borderRadius:'6px', fontSize:'10px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif', color:'#DC2626', flexShrink:0 }}>×</button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Add Mapping Modal */}
        {showAddMapping && (
          <div style={{ position:'fixed', inset:0, background:'rgba(21,96,130,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(2px)' }}>
            <div style={{ background:'white', borderRadius:'14px', width:'700px', maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(21,96,130,0.25)' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #EDF2F7', display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>🔗 New Cross-Framework Mapping</span>
                <button onClick={()=>setShowAddMapping(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#45B6E4' }}>×</button>
              </div>
              <div style={{ overflowY:'auto', padding:'20px', display:'flex', flexDirection:'column', gap:'16px' }}>
                {/* Mapping type */}
                <div>
                  <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'8px' }}>Mapping Type</label>
                  <div style={{ display:'flex', gap:'8px' }}>
                    {MAPPING_TYPES.map(t=>(
                      <button key={t.value} onClick={()=>setMappingType(t.value)}
                        style={{ flex:1, padding:'10px', borderRadius:'8px', border:`2px solid ${mappingType===t.value?t.color:'#EDF2F7'}`, cursor:'pointer', background:mappingType===t.value?`${t.color}15`:'white', fontFamily:'Montserrat, sans-serif' }}>
                        <div style={{ fontSize:'12px', fontWeight:'700', color:t.color }}>{t.label}</div>
                        <div style={{ fontSize:'10px', color:'#45B6E4', marginTop:'2px' }}>{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Source */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div>
                    <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Source Framework</label>
                    <select value={sourceFramework} onChange={e=>setSourceFramework(e.target.value)}
                      style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none' }}>
                      <option value="">Select framework...</option>
                      {frameworks.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Target Framework</label>
                    <select value={targetFramework} onChange={e=>setTargetFramework(e.target.value)}
                      style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none' }}>
                      <option value="">Select framework...</option>
                      {frameworks.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                </div>
                {/* Requirement selectors */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div>
                    <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Source Requirement</label>
                    <select value={sourceReq} onChange={e=>setSourceReq(e.target.value)}
                      style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', maxHeight:'150px' }}
                      disabled={!sourceFramework}>
                      <option value="">Select requirement...</option>
                      {sourceReqs.map(r=><option key={r.id} value={r.id}>{r.document_name} — {r.reference_code||''} {r.requirement_text?.substring(0,60)}...</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Target Requirement</label>
                    <select value={targetReq} onChange={e=>setTargetReq(e.target.value)}
                      style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none' }}
                      disabled={!targetFramework}>
                      <option value="">Select requirement...</option>
                      {targetReqs.map(r=><option key={r.id} value={r.id}>{r.document_name} — {r.reference_code||''} {r.requirement_text?.substring(0,60)}...</option>)}
                    </select>
                  </div>
                </div>
                {/* Notes */}
                <div>
                  <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Notes (optional)</label>
                  <textarea value={mappingNotes} onChange={e=>setMappingNotes(e.target.value)} placeholder="Explain the relationship between these requirements..."
                    style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:'60px' }}/>
                </div>
              </div>
              <div style={{ padding:'14px 20px', borderTop:'1px solid #EDF2F7', background:'#FAFBFC', display:'flex', justifyContent:'flex-end', gap:'8px' }}>
                <button onClick={()=>setShowAddMapping(false)} style={{ padding:'8px 16px', background:'white', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'Montserrat, sans-serif', color:'#45B6E4' }}>Cancel</button>
                <button onClick={addMapping} disabled={!sourceReq||!targetReq}
                  style={{ padding:'8px 16px', background:sourceReq&&targetReq?'#156082':'#F1F5F9', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:sourceReq&&targetReq?'pointer':'not-allowed', fontFamily:'Montserrat, sans-serif', color:sourceReq&&targetReq?'white':'#45B6E4' }}>
                  Create Mapping
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </GRCLayout>
  )
}
