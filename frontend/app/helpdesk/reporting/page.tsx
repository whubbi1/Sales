'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'

const API = 'https://api.whubbi.wcomply.com'

const PRIO_COLOR: Record<string,string> = {critical:'#DC2626',high:'#D97706',medium:'#156082',low:'#45B6E4'}

export default function ReportingPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = async () => {
    setLoading(true)
    const r = await fetch(`${API}/helpdesk/reporting?days=${days}`)
    setData(await r.json())
    setLoading(false)
  }

  useEffect(()=>{load()},[days])

  return (
    <div style={{display:'flex'}}>
      <Sidebar/>
      <main style={{marginLeft:'220px',minHeight:'100vh',width:'calc(100vw - 220px)',background:'#F5F7FA',fontFamily:'Montserrat, sans-serif'}}>
        <div style={{padding:'28px 32px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
            <div>
              <button onClick={()=>router.push('/helpdesk')} style={{background:'none',border:'none',color:'#45B6E4',fontSize:'12px',cursor:'pointer',fontFamily:'Montserrat, sans-serif',fontWeight:'600',padding:0,marginBottom:'4px',display:'block'}}>← Dashboard</button>
              <h1 style={{fontSize:'20px',fontWeight:'800',color:'#156082',margin:0}}>📊 Reports & Analytics</h1>
            </div>
            <div style={{display:'flex',gap:'6px'}}>
              {[7,30,90].map(d=>(
                <button key={d} onClick={()=>setDays(d)} style={{padding:'7px 14px',borderRadius:'7px',border:'none',background:days===d?'#156082':'white',color:days===d?'white':'#45B6E4',fontSize:'12px',fontWeight:'600',cursor:'pointer',fontFamily:'Montserrat, sans-serif',border:days===d?'none':'1.5px solid #45B6E4'}}>
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {loading&&<div style={{textAlign:'center',padding:'48px',color:'#45B6E4'}}>Loading...</div>}

          {!loading&&data&&(<>
            {/* SLA Compliance */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px',marginBottom:'24px'}}>
              {[
                {label:'Total Tickets',value:data.sla?.total||0,color:'#156082'},
                {label:'SLA Compliant',value:data.sla?.compliant||0,color:'#059669'},
                {label:'SLA Breached',value:data.sla?.breached||0,color:'#DC2626'},
                {label:'Compliance Rate',value:`${data.sla?.rate||100}%`,color:data.sla?.rate>=95?'#059669':data.sla?.rate>=80?'#D97706':'#DC2626'},
              ].map(k=>(
                <div key={k.label} style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'18px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',borderTop:`3px solid ${k.color}`}}>
                  <div style={{fontSize:'10px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',marginBottom:'8px'}}>{k.label}</div>
                  <div style={{fontSize:'24px',fontWeight:'800',color:k.color}}>{k.value}</div>
                </div>
              ))}
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',marginBottom:'20px'}}>
              {/* Volume by day */}
              <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                <h3 style={{fontSize:'12px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',marginBottom:'16px'}}>Ticket Volume — Last {days} days</h3>
                {data.volume_by_day?.length===0?(
                  <p style={{color:'#45B6E4',fontSize:'13px'}}>No data yet.</p>
                ):(
                  <div style={{display:'flex',alignItems:'flex-end',gap:'4px',height:'120px'}}>
                    {data.volume_by_day?.map((d:any)=>{
                      const max=Math.max(...(data.volume_by_day||[]).map((x:any)=>x.count),1)
                      const h=Math.max((d.count/max)*100,4)
                      return (
                        <div key={d.date} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'4px'}} title={`${d.date}: ${d.count} tickets`}>
                          <div style={{width:'100%',height:`${h}%`,background:'#156082',borderRadius:'3px 3px 0 0',minHeight:'4px'}}/>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* By category */}
              <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                <h3 style={{fontSize:'12px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',marginBottom:'16px'}}>By Category</h3>
                {data.by_category?.length===0?(
                  <p style={{color:'#45B6E4',fontSize:'13px'}}>No data yet.</p>
                ):(
                  <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                    {data.by_category?.map((c:any)=>{
                      const total=data.sla?.total||1
                      const pct=Math.round((c.c/total)*100)
                      return (
                        <div key={c.name}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                            <span style={{fontSize:'12px',fontWeight:'600',color:'#3F3F3F'}}>{c.icon} {c.name||'Uncategorized'}</span>
                            <span style={{fontSize:'12px',fontWeight:'700',color:'#156082'}}>{c.c}</span>
                          </div>
                          <div style={{height:'6px',background:'#F1F5F9',borderRadius:'3px',overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${pct}%`,background:c.color||'#45B6E4',borderRadius:'3px'}}/>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Avg resolution by priority */}
            <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
              <h3 style={{fontSize:'12px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',marginBottom:'16px'}}>Average Resolution Time by Priority</h3>
              {data.by_priority?.length===0?(
                <p style={{color:'#45B6E4',fontSize:'13px'}}>No resolved tickets yet.</p>
              ):(
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px'}}>
                  {['critical','high','medium','low'].map(p=>{
                    const row=data.by_priority?.find((r:any)=>r.priority===p)
                    return (
                      <div key={p} style={{background:'#F8FAFC',borderRadius:'10px',padding:'16px',textAlign:'center',borderTop:`3px solid ${PRIO_COLOR[p]}`}}>
                        <div style={{fontSize:'10px',fontWeight:'700',textTransform:'uppercase',color:'#45B6E4',marginBottom:'8px',textTransform:'capitalize'}}>{p}</div>
                        <div style={{fontSize:'22px',fontWeight:'800',color:PRIO_COLOR[p]}}>{row?`${row.avg_hours}h`:'—'}</div>
                        <div style={{fontSize:'11px',color:'#45B6E4',marginTop:'4px'}}>{row?`${row.count} resolved`:'no data'}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>)}
        </div>
      </main>
    </div>
  )
}
