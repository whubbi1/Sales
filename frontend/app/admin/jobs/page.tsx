'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

const API = 'https://api.whubbi.wcomply.com'

const STATUS_STYLE: Record<string,{bg:string;color:string;dot:string}> = {
  active:  {bg:'#ECFDF5',color:'#059669',dot:'#10B981'},
  stopped: {bg:'#F1F5F9',color:'#45B6E4',dot:'#94A3B8'},
  error:   {bg:'#FEF2F2',color:'#DC2626',dot:'#EF4444'},
  success: {bg:'#ECFDF5',color:'#059669',dot:'#10B981'},
  failed:  {bg:'#FEF2F2',color:'#DC2626',dot:'#EF4444'},
  running: {bg:'#FFF7ED',color:'#D97706',dot:'#F59E0B'},
}

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [executions, setExecutions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({name:'',description:'',job_type:'lambda',schedule:'',script_url:'',script_content:'',status:'active'})
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await fetch(`${API}/admin/jobs`)
    const d = await r.json()
    setJobs(d.jobs||[])
    setLoading(false)
  }

  const loadJob = async (jobId: string) => {
    const r = await fetch(`${API}/admin/jobs/${jobId}`)
    const d = await r.json()
    setSelected(d.job)
    setExecutions(d.executions||[])
  }

  useEffect(() => { load() }, [])

  const toggleStatus = async (job: any) => {
    const newStatus = job.status === 'active' ? 'stopped' : 'active'
    await fetch(`${API}/admin/jobs/${job.job_id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({status: newStatus})
    })
    load()
    if (selected?.job_id === job.job_id) loadJob(job.job_id)
  }

  const createJob = async () => {
    if (!form.name) return
    setSaving(true)
    await fetch(`${API}/admin/jobs`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form)})
    setSaving(false); setShowNew(false)
    setForm({name:'',description:'',job_type:'lambda',schedule:'',script_url:'',script_content:'',status:'active'})
    load()
  }

  const TYPE_ICON: Record<string,string> = {lambda:'λ', ecs_scheduled:'🐳'}
  const EXEC_STATUS_COLOR: Record<string,string> = {success:'#059669',failed:'#DC2626',running:'#D97706'}

  return (
    <div style={{minHeight:'100vh',background:'#F5F7FA',fontFamily:'Montserrat, sans-serif'}}>
      <div style={{background:'#156082',padding:'0 32px',height:'64px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
          <button onClick={()=>router.push('/admin')} style={{border:'none',background:'rgba(255,255,255,0.1)',color:'white',padding:'6px 14px',borderRadius:'6px',cursor:'pointer',fontSize:'12px',fontFamily:'Montserrat, sans-serif',fontWeight:'600'}}>← Admin</button>
          <span style={{color:'white',fontSize:'15px',fontWeight:'800'}}>⚙️ Background Jobs</span>
        </div>
        <button onClick={()=>setShowNew(true)} style={{background:'#e97132',color:'white',border:'none',padding:'8px 18px',borderRadius:'8px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'Montserrat, sans-serif'}}>+ New Job</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:selected?'380px 1fr':'1fr',gap:'0',minHeight:'calc(100vh - 64px)'}}>
        {/* Jobs list */}
        <div style={{background:'white',borderRight:'1px solid #EDF2F7',overflow:'auto'}}>
          <div style={{padding:'14px 18px',borderBottom:'1px solid #EDF2F7'}}>
            <span style={{fontSize:'11px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4'}}>All Jobs ({jobs.length})</span>
          </div>
          {loading ? <div style={{textAlign:'center',padding:'48px',color:'#45B6E4'}}>Loading...</div> :
          jobs.map(job => {
            const s = STATUS_STYLE[job.status]||STATUS_STYLE.stopped
            const active = selected?.job_id === job.job_id
            return (
              <div key={job.job_id} onClick={()=>loadJob(job.job_id)}
                style={{padding:'14px 18px',borderBottom:'1px solid #F1F5F9',cursor:'pointer',background:active?'#EFF6FF':'white'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'2px'}}>
                      <span style={{fontSize:'10px',fontWeight:'700',color:'#45B6E4'}}>{job.job_id}</span>
                      <span style={{background:'#F1F5F9',color:'#156082',padding:'1px 6px',borderRadius:'6px',fontSize:'10px',fontWeight:'700'}}>{TYPE_ICON[job.job_type]||'⚙️'} {job.job_type}</span>
                    </div>
                    <div style={{fontSize:'13px',fontWeight:'700',color:'#156082'}}>{job.name}</div>
                  </div>
                  <span style={{background:s.bg,color:s.color,padding:'2px 8px',borderRadius:'10px',fontSize:'10px',fontWeight:'700',display:'inline-flex',alignItems:'center',gap:'4px',flexShrink:0}}>
                    <span style={{width:'6px',height:'6px',borderRadius:'50%',background:s.dot,display:'inline-block'}}/>
                    {job.status}
                  </span>
                </div>
                {job.last_run_at && (
                  <div style={{fontSize:'10px',color:'#45B6E4'}}>
                    Last run: {new Date(job.last_run_at).toLocaleString()}
                    {job.last_run_status && <span style={{color:EXEC_STATUS_COLOR[job.last_run_status]||'#45B6E4',marginLeft:'6px',fontWeight:'700'}}>● {job.last_run_status}</span>}
                  </div>
                )}
                {job.schedule && <div style={{fontSize:'10px',color:'#848EA5',marginTop:'2px'}}>⏰ {job.schedule}</div>}
              </div>
            )
          })}
        </div>

        {/* Job detail */}
        {selected && (
          <div style={{padding:'24px 28px',overflow:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'20px'}}>
              <div>
                <div style={{fontSize:'11px',fontWeight:'700',color:'#45B6E4',marginBottom:'4px'}}>{selected.job_id}</div>
                <h1 style={{fontSize:'18px',fontWeight:'800',color:'#156082',margin:'0 0 4px'}}>{selected.name}</h1>
                <p style={{fontSize:'13px',color:'#45B6E4',margin:0}}>{selected.description}</p>
              </div>
              <button onClick={()=>toggleStatus(selected)}
                style={{background:selected.status==='active'?'#FEF2F2':'#ECFDF5',color:selected.status==='active'?'#DC2626':'#059669',border:'none',padding:'8px 16px',borderRadius:'8px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'Montserrat, sans-serif'}}>
                {selected.status==='active'?'⏹ Stop':'▶ Activate'}
              </button>
            </div>

            {/* Details */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'20px'}}>
              {[
                {label:'Type',value:`${TYPE_ICON[selected.job_type]||'⚙️'} ${selected.job_type}`},
                {label:'Schedule',value:selected.schedule||'Manual'},
                {label:'Last Run',value:selected.last_run_at?new Date(selected.last_run_at).toLocaleString():'Never'},
              ].map(item=>(
                <div key={item.label} style={{background:'white',borderRadius:'10px',border:'1px solid #EDF2F7',padding:'14px'}}>
                  <div style={{fontSize:'10px',fontWeight:'700',textTransform:'uppercase',color:'#45B6E4',marginBottom:'4px'}}>{item.label}</div>
                  <div style={{fontSize:'12px',fontWeight:'600',color:'#3F3F3F'}}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Script link */}
            {selected.script_url && (
              <div style={{background:'#F8FAFC',borderRadius:'10px',border:'1px solid #EDF2F7',padding:'14px',marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:'12px',color:'#3F3F3F',fontWeight:'600'}}>📄 Script Reference</span>
                <a href={selected.script_url} target="_blank" rel="noopener" style={{fontSize:'12px',color:'#156082',fontWeight:'700',textDecoration:'none'}}>View Script ↗</a>
              </div>
            )}

            {/* Last 20 executions */}
            <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',overflow:'hidden',marginBottom:'16px'}}>
              <div style={{padding:'14px 18px',borderBottom:'1px solid #EDF2F7'}}>
                <span style={{fontSize:'11px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4'}}>Last 20 Executions</span>
              </div>
              {executions.length === 0 ? (
                <div style={{padding:'32px',textAlign:'center',color:'#45B6E4',fontSize:'13px'}}>No executions yet.</div>
              ) : (
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
                  <thead style={{background:'#FAFBFC'}}>
                    <tr>{['Started','Status','Duration','Triggered By','Output'].map(h=>(
                      <th key={h} style={{padding:'8px 14px',textAlign:'left',fontSize:'10px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',borderBottom:'1px solid #EDF2F7'}}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {executions.map((ex:any,i:number)=>(
                      <tr key={i} style={{borderBottom:'1px solid #F1F5F9'}}>
                        <td style={{padding:'9px 14px',color:'#45B6E4',whiteSpace:'nowrap'}}>{new Date(ex.started_at).toLocaleString()}</td>
                        <td style={{padding:'9px 14px'}}>
                          <span style={{background:STATUS_STYLE[ex.status]?.bg||'#F1F5F9',color:STATUS_STYLE[ex.status]?.color||'#45B6E4',padding:'2px 8px',borderRadius:'10px',fontSize:'10px',fontWeight:'700'}}>{ex.status}</span>
                        </td>
                        <td style={{padding:'9px 14px',color:'#3F3F3F'}}>{ex.duration_ms?`${ex.duration_ms}ms`:'—'}</td>
                        <td style={{padding:'9px 14px',color:'#45B6E4'}}>{ex.triggered_by}</td>
                        <td style={{padding:'9px 14px',color:'#3F3F3F',maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ex.output||ex.error||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Script content */}
            {selected.script_content && (
              <div style={{background:'#0F172A',borderRadius:'12px',padding:'18px',overflow:'auto'}}>
                <div style={{fontSize:'10px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',marginBottom:'10px'}}>Script</div>
                <pre style={{color:'#E2E8F0',fontSize:'12px',lineHeight:'1.6',margin:0,whiteSpace:'pre-wrap'}}>{selected.script_content}</pre>
              </div>
            )}
          </div>
        )}

        {!selected && !loading && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',color:'#45B6E4',fontSize:'13px'}}>
            ← Select a job to view details
          </div>
        )}
      </div>

      {/* New job modal */}
      {showNew && (
        <div style={{position:'fixed',inset:0,background:'rgba(21,96,130,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'20px',backdropFilter:'blur(2px)'}} onClick={()=>setShowNew(false)}>
          <div style={{background:'white',borderRadius:'14px',width:'100%',maxWidth:'580px',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(21,96,130,0.25)'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'18px 24px',borderBottom:'1px solid #EDF2F7',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h2 style={{fontSize:'15px',fontWeight:'800',color:'#156082',margin:0}}>New Background Job</h2>
              <button onClick={()=>setShowNew(false)} style={{border:'none',background:'none',cursor:'pointer',fontSize:'20px',color:'#45B6E4'}}>×</button>
            </div>
            <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:'12px'}}>
              <div><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Job name"/></div>
              <div><label className="form-label">Description</label><textarea className="form-input" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} rows={2}/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div>
                  <label className="form-label">Type</label>
                  <select className="form-input" value={form.job_type} onChange={e=>setForm(p=>({...p,job_type:e.target.value}))}>
                    <option value="lambda">AWS Lambda</option>
                    <option value="ecs_scheduled">ECS Scheduled</option>
                  </select>
                </div>
                <div><label className="form-label">Schedule (cron)</label><input className="form-input" value={form.schedule} onChange={e=>setForm(p=>({...p,schedule:e.target.value}))} placeholder="0 2 * * *"/></div>
              </div>
              <div><label className="form-label">Script URL (GitHub link)</label><input className="form-input" value={form.script_url} onChange={e=>setForm(p=>({...p,script_url:e.target.value}))} placeholder="https://github.com/..."/></div>
              <div><label className="form-label">Script Content</label><textarea className="form-input" value={form.script_content} onChange={e=>setForm(p=>({...p,script_content:e.target.value}))} rows={5} placeholder="#!/bin/bash..."/></div>
            </div>
            <div style={{padding:'14px 24px',borderTop:'1px solid #EDF2F7',display:'flex',justifyContent:'flex-end',gap:'10px',background:'#FAFBFC'}}>
              <button onClick={()=>setShowNew(false)} style={{background:'white',color:'#156082',border:'1.5px solid #45B6E4',padding:'7px 16px',borderRadius:'7px',fontSize:'12px',fontWeight:'600',cursor:'pointer',fontFamily:'Montserrat, sans-serif'}}>Cancel</button>
              <button onClick={createJob} disabled={saving||!form.name} style={{background:'#156082',color:'white',border:'none',padding:'8px 20px',borderRadius:'7px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'Montserrat, sans-serif',opacity:(saving||!form.name)?0.6:1}}>
                {saving?'Creating...':'Create Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
