'use client'
import { useState, useEffect } from 'react'
import { HRLayout } from '@/components/HRLayout'

const API = 'https://api.whubbi.wcomply.com'
const CONTRACT_TYPES = ['CDI','CDD','Freelance','Stage','Alternance']
const DEPARTMENTS = ['Engineering','Sales','Finance','HR','Marketing','Operations','Legal','IT','Management']

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editJob, setEditJob] = useState<any>(null)
  const [expanded, setExpanded] = useState<string|null>(null)

  const load = () => { fetch(`${API}/hr/jobs`).then(r=>r.json()).then(d=>setJobs(d.jobs||[])).finally(()=>setLoading(false)) }
  useEffect(() => { load() }, [])

  const save = async (data:any) => {
    if (editJob) { await fetch(`${API}/hr/jobs/${editJob.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }) }
    else { await fetch(`${API}/hr/jobs`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }) }
    setShowModal(false); setEditJob(null); load()
  }

  const del = async (id:string) => {
    if (!confirm('Delete this job description?')) return
    await fetch(`${API}/hr/jobs/${id}`, { method:'DELETE' }); load()
  }

  const STATUS_COLOR: Record<string,{bg:string;color:string}> = { open:{bg:'#ECFDF5',color:'#059669'}, draft:{bg:'#FFF7ED',color:'#D97706'}, closed:{bg:'#F1F5F9',color:'#94A3B8'} }
  const CONTRACT_COLOR: Record<string,string> = { CDI:'#156082', CDD:'#7C3AED', Freelance:'#e97132', Stage:'#059669', Alternance:'#D97706' }

  return (
    <HRLayout>
      <div style={{ padding:'28px 32px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#156082', marginBottom:'4px' }}>📋 Job Descriptions</h1>
            <p style={{ fontSize:'12px', color:'#45B6E4' }}>{jobs.filter(j=>j.status==='open').length} open positions</p>
          </div>
          <button onClick={() => setShowModal(true)} style={{ background:'#156082', color:'white', border:'none', padding:'9px 18px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>+ New Job</button>
        </div>

        {loading && <div style={{ textAlign:'center', padding:'48px', color:'#45B6E4' }}>Loading...</div>}

        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {jobs.map(j => {
            const sc = STATUS_COLOR[j.status]||STATUS_COLOR.draft
            const isOpen = expanded===j.id
            return (
              <div key={j.id} style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }} onClick={()=>setExpanded(isOpen?null:j.id)}>
                  <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                    <div>
                      <div style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>{j.title}</div>
                      <div style={{ fontSize:'11px', color:'#45B6E4' }}>{j.department} · {j.location} · {j.contract_type}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                    {j.salary_min&&j.salary_max&&<span style={{ fontSize:'12px', fontWeight:'600', color:'#3F3F3F' }}>{j.salary_min?.toLocaleString()} — {j.salary_max?.toLocaleString()} €</span>}
                    <span style={{ padding:'3px 10px', borderRadius:'12px', fontSize:'10px', fontWeight:'700', background:sc.bg, color:sc.color }}>{j.status?.charAt(0).toUpperCase()+j.status?.slice(1)}</span>
                    <span style={{ padding:'3px 10px', borderRadius:'12px', fontSize:'10px', fontWeight:'700', background:`${CONTRACT_COLOR[j.contract_type]||'#156082'}15`, color:CONTRACT_COLOR[j.contract_type]||'#156082' }}>{j.contract_type}</span>
                    <span style={{ color:'#45B6E4', fontSize:'14px' }}>{isOpen?'▲':'▼'}</span>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ padding:'0 20px 20px', borderTop:'1px solid #F1F5F9' }}>
                    {j.description&&<p style={{ fontSize:'13px', color:'#3F3F3F', lineHeight:'1.7', margin:'14px 0' }}>{j.description}</p>}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                      {j.responsibilities?.length>0&&(
                        <div>
                          <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'8px' }}>Responsibilities</div>
                          <ul style={{ margin:0, paddingLeft:'18px' }}>
                            {j.responsibilities.map((r:string,i:number)=><li key={i} style={{ fontSize:'12px', color:'#3F3F3F', marginBottom:'4px' }}>{r}</li>)}
                          </ul>
                        </div>
                      )}
                      {j.requirements?.length>0&&(
                        <div>
                          <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'8px' }}>Requirements</div>
                          <ul style={{ margin:0, paddingLeft:'18px' }}>
                            {j.requirements.map((r:string,i:number)=><li key={i} style={{ fontSize:'12px', color:'#3F3F3F', marginBottom:'4px' }}>{r}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:'8px', marginTop:'14px', justifyContent:'flex-end' }}>
                      <button onClick={()=>{setEditJob(j);setShowModal(true)}} style={{ padding:'6px 14px', background:'#EFF6FF', color:'#156082', border:'none', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>Edit</button>
                      <button onClick={()=>del(j.id)} style={{ padding:'6px 14px', background:'#FEF2F2', color:'#DC2626', border:'none', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {jobs.length===0&&!loading&&<div style={{ textAlign:'center', padding:'48px', color:'#45B6E4', background:'white', borderRadius:'12px', border:'1px solid #EDF2F7' }}>No job descriptions yet.</div>}
        </div>

        {showModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(21,96,130,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(2px)' }}>
            <div style={{ background:'white', borderRadius:'14px', width:'620px', maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(21,96,130,0.25)' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #EDF2F7', display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>{editJob?'Edit Job':'New Job Description'}</span>
                <button onClick={()=>{setShowModal(false);setEditJob(null)}} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#45B6E4' }}>×</button>
              </div>
              <JobForm job={editJob} onSave={save} onCancel={()=>{setShowModal(false);setEditJob(null)}}/>
            </div>
          </div>
        )}
      </div>
    </HRLayout>
  )
}

function JobForm({ job, onSave, onCancel }:any) {
  const [form, setForm] = useState({ title:job?.title||'', department:job?.department||'Engineering', location:job?.location||'Remote', contract_type:job?.contract_type||'CDI', status:job?.status||'open', description:job?.description||'', responsibilities:(job?.responsibilities||[]) as string[], requirements:(job?.requirements||[]) as string[], salary_min:job?.salary_min||'', salary_max:job?.salary_max||'' })
  const [respInput, setRespInput] = useState('')
  const [reqInput, setReqInput] = useState('')
  return (
    <div style={{ overflowY:'auto', flex:1 }}>
      <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'12px' }}>
        <div>
          <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Job Title *</label>
          <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'10px' }}>
          {[['department','Department',[...DEPARTMENTS]],['contract_type','Contract',[...CONTRACT_TYPES]],['status','Status',['open','draft','closed']]].map(([key,label,opts]:any)=>(
            <div key={key}>
              <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>{label}</label>
              <select value={(form as any)[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none' }}>
                {opts.map((o:string)=><option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Location</label>
            <input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box' }}/>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
          {[['salary_min','Salary Min (€/yr)'],['salary_max','Salary Max (€/yr)']].map(([key,label])=>(
            <div key={key}>
              <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>{label}</label>
              <input type="number" value={(form as any)[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box' }}/>
            </div>
          ))}
        </div>
        <div>
          <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Description</label>
          <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', resize:'vertical', minHeight:'60px', outline:'none', boxSizing:'border-box' }}/>
        </div>
        {[['responsibilities','Responsibilities',respInput,setRespInput,'resp'],['requirements','Requirements',reqInput,setReqInput,'req']].map(([key,label,inp,setInp,prefix]:any)=>(
          <div key={key}>
            <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>{label}</label>
            {((form as any)[key]||[]).map((r:string,i:number)=>(
              <div key={i} style={{ display:'flex', gap:'6px', marginBottom:'5px' }}>
                <span style={{ flex:1, padding:'6px 10px', background:'#F8FAFC', borderRadius:'7px', fontSize:'12px', color:'#3F3F3F' }}>{r}</span>
                <button onClick={()=>setForm(f=>({...f,[key]:(f as any)[key].filter((_:any,j:number)=>j!==i)}))} style={{ background:'#FEF2F2', color:'#DC2626', border:'none', borderRadius:'7px', padding:'0 10px', cursor:'pointer', fontSize:'14px' }}>×</button>
              </div>
            ))}
            <div style={{ display:'flex', gap:'6px' }}>
              <input value={inp} onChange={(e:any)=>setInp(e.target.value)} onKeyDown={(e:any)=>{if(e.key==='Enter'&&inp.trim()){setForm((f:any)=>({...f,[key]:[...(f[key]||[]),inp.trim()]}));setInp('')}}} placeholder={`Add ${label.toLowerCase().slice(0,-1)}...`} style={{ flex:1, padding:'7px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none' }}/>
              <button onClick={()=>{if(inp.trim()){setForm((f:any)=>({...f,[key]:[...(f[key]||[]),inp.trim()]}));setInp('')}}} style={{ padding:'7px 14px', background:'#156082', color:'white', border:'none', borderRadius:'7px', fontSize:'12px', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>+</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding:'14px 20px', borderTop:'1px solid #EDF2F7', background:'#FAFBFC', display:'flex', justifyContent:'flex-end', gap:'8px' }}>
        <button onClick={onCancel} style={{ padding:'8px 16px', background:'white', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'Montserrat, sans-serif', color:'#45B6E4' }}>Cancel</button>
        <button onClick={()=>onSave(form)} disabled={!form.title} style={{ padding:'8px 16px', background:form.title?'#156082':'#F1F5F9', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:form.title?'pointer':'not-allowed', fontFamily:'Montserrat, sans-serif', color:form.title?'white':'#45B6E4' }}>Save</button>
      </div>
    </div>
  )
}
