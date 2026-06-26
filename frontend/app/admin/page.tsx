'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { adminAPI, microsoftAPI } from '@/lib/adminApi'

const SERVICE_ICONS: Record<string,string> = {
  ecs:'🐳',rds:'🗄️',amplify:'⚡',alb:'⚖️',cognito:'🔐',ecr:'📦',cloudwatch:'📊',
}
const MS_ICONS: Record<string,string> = {
  "Microsoft Teams":"👥","Exchange Online":"📧","SharePoint Online":"📁",
  "Microsoft 365 suite":"🏢","Azure Active Directory":"🔐","OneDrive for Business":"☁️",
}
const STATUS_STYLE: Record<string,{bg:string;color:string;dot:string;label:string}> = {
  healthy: {bg:'#ECFDF5',color:'#059669',dot:'#10B981',label:'Healthy'},
  up:      {bg:'#ECFDF5',color:'#059669',dot:'#10B981',label:'Up'},
  degraded:{bg:'#FEF2F2',color:'#DC2626',dot:'#EF4444',label:'Degraded'},
  warning: {bg:'#FFF7ED',color:'#D97706',dot:'#F59E0B',label:'Warning'},
  slow:    {bg:'#FFF7ED',color:'#D97706',dot:'#F59E0B',label:'Slow'},
  down:    {bg:'#FEF2F2',color:'#DC2626',dot:'#EF4444',label:'Down'},
  unknown: {bg:'#F1F5F9',color:'#45B6E4',dot:'#45B6E4',label:'Unknown'},
  ok:      {bg:'#ECFDF5',color:'#059669',dot:'#10B981',label:'OK'},
  full:    {bg:'#FEF2F2',color:'#DC2626',dot:'#EF4444',label:'Full'},
}

const StatusBadge = ({status}:{status:string}) => {
  const s = STATUS_STYLE[status]||STATUS_STYLE.unknown
  return (
    <span style={{background:s.bg,color:s.color,padding:'3px 10px',borderRadius:'20px',fontSize:'10px',fontWeight:'700',textTransform:'uppercase',display:'inline-flex',alignItems:'center',gap:'5px'}}>
      <span style={{width:'6px',height:'6px',borderRadius:'50%',background:s.dot,display:'inline-block'}}/>{s.label}
    </span>
  )
}

const KPI = ({label,value,sub,color='#156082'}:any) => (
  <div style={{textAlign:'center'}}>
    <div style={{fontSize:'9px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',marginBottom:'4px'}}>{label}</div>
    <div style={{fontSize:'20px',fontWeight:'800',color}}>{value}</div>
    {sub&&<div style={{fontSize:'10px',color:'#45B6E4',marginTop:'2px'}}>{sub}</div>}
  </div>
)

const TABS = [
  {id:'aws-health', label:'AWS Health',      icon:'☁️'},
  {id:'ms-health',  label:'Microsoft 365',   icon:'🏢'},
  {id:'aws-costs',  label:'AWS Costs',       icon:'💰'},
  {id:'ms-costs',   label:'MS Costs',        icon:'💳'},
  {id:'urls',       label:'URL Monitoring',  icon:'🌐'},
  {id:'logs',       label:'Error Logs',      icon:'🔍'},
]

const QUICK_LINKS = [
  {href:'/admin/backup',   icon:'💾', label:'Backup',           desc:'Backup status & management'},
  {href:'/admin/jobs',     icon:'⚙️', label:'Background Jobs',  desc:'Scheduled tasks & execution logs'},
  {href:'/admin/licenses', icon:'📋', label:'License Mgmt',     desc:'Software licenses — coming soon'},
]

export default function AdminCockpitPage() {
  const router = useRouter()
  const [tab, setTab] = useState('aws-health')
  const [data, setData] = useState<Record<string,any>>({})
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [newUrl, setNewUrl] = useState({name:'',url:''})
  const [showAddUrl, setShowAddUrl] = useState(false)
  const [ecsAction, setEcsAction] = useState<string|null>(null)
  const [ecsMessage, setEcsMessage] = useState<{text:string;type:'success'|'error'}|null>(null)

  const loadTab = useCallback(async (t:string,force=false) => {
    if(data[t]&&!force) return
    setLoading(true)
    try {
      let result:any=null
      if(t==='aws-health')  result=await adminAPI.getHealth()
      if(t==='aws-costs')   result=await adminAPI.getCosts()
      if(t==='logs')        result=await adminAPI.getLogs()
      if(t==='urls')        result=await adminAPI.getURLs()
      if(t==='ms-health'){
        const [h,i,l]=await Promise.all([microsoftAPI.getHealth(),microsoftAPI.getIncidents(),microsoftAPI.getLicenses()])
        result={health:h,incidents:i,licenses:l}
      }
      if(t==='ms-costs')    result=await microsoftAPI.getCosts()
      if(result) setData(p=>({...p,[t]:result}))
    } catch(e){console.error(e)}
    setLoading(false)
    setLastRefresh(new Date())
  },[data])

  const refresh = useCallback(async()=>{setData({});setLoading(true);setTimeout(()=>loadTab(tab,true),100)},[tab])
  useEffect(()=>{loadTab(tab)},[tab])

  const controlECS = async(action:'start'|'stop'|'restart')=>{
    const msgs:Record<string,string>={
      stop:'⚠️ This will stop the WHUBBI backend. Confirm?',
      restart:'Restart the WHUBBI backend? (~2 min downtime)',
      start:'Start the WHUBBI backend?',
    }
    if(!window.confirm(msgs[action])) return
    setEcsAction(action); setEcsMessage(null)
    try {
      const res=await fetch(`https://api.whubbi.wcomply.com/ecs/${action}`,{method:'POST'})
      const d=await res.json()
      setEcsMessage(d.status==='ok'?{text:d.message,type:'success'}:{text:d.message||'Failed',type:'error'})
      if(d.status==='ok') setTimeout(()=>{loadTab('aws-health',true);setEcsMessage(null)},5000)
    }catch(e:any){setEcsMessage({text:e.message,type:'error'})}
    setEcsAction(null)
  }

  const runChecks=async()=>{
    setChecking(true)
    await adminAPI.runChecks()
    setData(p=>({...p,urls:undefined}))
    await loadTab('urls',true)
    setChecking(false)
  }

  const addURL=async()=>{
    if(!newUrl.name||!newUrl.url) return
    await adminAPI.addURL(newUrl)
    setNewUrl({name:'',url:''});setShowAddUrl(false)
    setData(p=>({...p,urls:undefined}))
    await loadTab('urls',true)
  }

  const d=data[tab]
  const awsHealth=data['aws-health']

  return (
    <div style={{minHeight:'100vh',background:'#F5F7FA',fontFamily:'Montserrat, sans-serif'}}>
      {/* Header */}
      <div style={{background:'#156082',padding:'0 32px',height:'64px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
          <button onClick={()=>router.push('/home')} style={{border:'none',background:'rgba(255,255,255,0.1)',color:'white',padding:'6px 14px',borderRadius:'6px',cursor:'pointer',fontSize:'12px',fontFamily:'Montserrat, sans-serif',fontWeight:'600'}}>← Back</button>
          <span style={{color:'white',fontSize:'15px',fontWeight:'800'}}>🔧 Admin Cockpit</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <span style={{color:'rgba(255,255,255,0.5)',fontSize:'11px'}}>{lastRefresh.toLocaleTimeString()}</span>
          <button onClick={refresh} style={{border:'1px solid rgba(255,255,255,0.3)',background:'transparent',color:'white',padding:'6px 14px',borderRadius:'6px',cursor:'pointer',fontSize:'12px',fontFamily:'Montserrat, sans-serif',fontWeight:'600'}}>↻ Refresh</button>
        </div>
      </div>

      {awsHealth&&(
        <div style={{background:'white',borderBottom:'1px solid #EDF2F7',padding:'10px 32px',display:'flex',gap:'24px',alignItems:'center'}}>
          <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
            <div style={{width:'10px',height:'10px',borderRadius:'50%',background:awsHealth.summary?.healthy===awsHealth.summary?.total?'#10B981':'#F59E0B'}}/>
            <span style={{fontSize:'13px',fontWeight:'700',color:'#156082'}}>
              {awsHealth.summary?.healthy===awsHealth.summary?.total?'All AWS Systems Operational':`${awsHealth.summary?.degraded} Service(s) Degraded`}
            </span>
          </div>
          <span style={{color:'#45B6E4',fontSize:'12px'}}>{awsHealth.summary?.healthy}/{awsHealth.summary?.total} healthy</span>
        </div>
      )}

      <div style={{padding:'24px 32px'}}>
        {/* Quick links */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'24px'}}>
          {QUICK_LINKS.map(link=>(
            <div key={link.href} onClick={()=>router.push(link.href)}
              style={{background:'white',borderRadius:'10px',border:'1px solid #EDF2F7',padding:'16px',cursor:'pointer',display:'flex',alignItems:'center',gap:'14px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',transition:'all 0.15s'}}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 12px rgba(21,96,130,0.1)';e.currentTarget.style.transform='translateY(-1px)'}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.06)';e.currentTarget.style.transform='none'}}>
              <span style={{fontSize:'28px'}}>{link.icon}</span>
              <div>
                <div style={{fontSize:'13px',fontWeight:'700',color:'#156082'}}>{link.label}</div>
                <div style={{fontSize:'11px',color:'#45B6E4'}}>{link.desc}</div>
              </div>
              <svg style={{marginLeft:'auto',flexShrink:0}} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#45B6E4" strokeWidth={2}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          ))}
        </div>

        {/* ECS message */}
        {ecsMessage&&(
          <div style={{marginBottom:'16px',padding:'12px 16px',borderRadius:'10px',background:ecsMessage.type==='success'?'#ECFDF5':'#FEF2F2',color:ecsMessage.type==='success'?'#059669':'#DC2626',fontSize:'13px',fontWeight:'600',border:`1px solid ${ecsMessage.type==='success'?'#A7F3D0':'#FECACA'}`}}>
            {ecsMessage.type==='success'?'✅':'❌'} {ecsMessage.text}
          </div>
        )}

        {/* Tabs */}
        <div style={{display:'flex',gap:'3px',marginBottom:'24px',background:'white',padding:'4px',borderRadius:'10px',border:'1px solid #EDF2F7',width:'fit-content',flexWrap:'wrap'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'7px 14px',borderRadius:'7px',border:'none',background:tab===t.id?'#156082':'transparent',color:tab===t.id?'white':'#45B6E4',fontSize:'12px',fontWeight:'600',cursor:'pointer',fontFamily:'Montserrat, sans-serif',display:'flex',alignItems:'center',gap:'5px',transition:'all 0.12s'}}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading&&<div style={{textAlign:'center',padding:'48px',color:'#45B6E4',fontSize:'13px'}}>Loading...</div>}

        {/* AWS Health */}
        {!loading&&tab==='aws-health'&&d&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px'}}>
            {d.services?.map((svc:any)=>(
              <div key={svc.name} style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'12px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                    <span style={{fontSize:'24px'}}>{SERVICE_ICONS[svc.type]||'⚙️'}</span>
                    <span style={{fontSize:'13px',fontWeight:'700',color:'#156082'}}>{svc.name}</span>
                  </div>
                  <StatusBadge status={svc.status}/>
                </div>
                <p style={{fontSize:'12px',color:'#45B6E4',margin:0}}>{svc.details}</p>
                {svc.taskDef&&<p style={{fontSize:'11px',color:'#45B6E4',marginTop:'4px'}}>Task: {svc.taskDef}</p>}
                {svc.engine&&<p style={{fontSize:'11px',color:'#45B6E4',marginTop:'4px'}}>{svc.engine}</p>}
                {svc.type==='ecs'&&(
                  <div style={{marginTop:'14px',paddingTop:'12px',borderTop:'1px solid #EDF2F7'}}>
                    <div style={{fontSize:'9px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',marginBottom:'8px'}}>Application Control</div>
                    <div style={{display:'flex',gap:'6px'}}>
                      <button onClick={()=>controlECS('restart')} disabled={ecsAction!==null} title="Force new deployment" style={{flex:1,padding:'7px 4px',borderRadius:'6px',border:'none',background:'#EFF6FF',color:'#156082',fontSize:'11px',fontWeight:'700',cursor:ecsAction?'not-allowed':'pointer',fontFamily:'Montserrat, sans-serif',opacity:ecsAction?0.6:1}}>
                        {ecsAction==='restart'?'⏳':'↻'} Restart
                      </button>
                      <button onClick={()=>controlECS('stop')} disabled={ecsAction!==null||svc.status==='down'} title="Stop all containers" style={{flex:1,padding:'7px 4px',borderRadius:'6px',border:'none',background:'#FEF2F2',color:'#DC2626',fontSize:'11px',fontWeight:'700',cursor:(ecsAction||svc.status==='down')?'not-allowed':'pointer',fontFamily:'Montserrat, sans-serif',opacity:(ecsAction||svc.status==='down')?0.6:1}}>
                        {ecsAction==='stop'?'⏳':'⏹'} Stop
                      </button>
                      <button onClick={()=>controlECS('start')} disabled={ecsAction!==null||svc.status==='healthy'} title="Start containers" style={{flex:1,padding:'7px 4px',borderRadius:'6px',border:'none',background:'#ECFDF5',color:'#059669',fontSize:'11px',fontWeight:'700',cursor:(ecsAction||svc.status==='healthy')?'not-allowed':'pointer',fontFamily:'Montserrat, sans-serif',opacity:(ecsAction||svc.status==='healthy')?0.6:1}}>
                        {ecsAction==='start'?'⏳':'▶'} Start
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Microsoft 365 */}
        {!loading&&tab==='ms-health'&&d&&(
          <div>
            {d.health?.error?(
              <div style={{background:'#FEF2F2',border:'1px solid #FECACA',color:'#DC2626',padding:'16px',borderRadius:'10px',fontSize:'13px'}}>⚠️ {d.health.error}</div>
            ):(<>
              <h2 style={{fontSize:'13px',fontWeight:'700',color:'#156082',marginBottom:'16px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Service Health</h2>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'14px',marginBottom:'24px'}}>
                {d.health?.services?.map((svc:any)=>(
                  <div key={svc.name} style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'18px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        <span style={{fontSize:'20px'}}>{MS_ICONS[svc.name]||'📦'}</span>
                        <span style={{fontSize:'13px',fontWeight:'700',color:'#156082'}}>{svc.name}</span>
                      </div>
                      <StatusBadge status={svc.status}/>
                    </div>
                    <p style={{fontSize:'11px',color:'#45B6E4',margin:0}}>{svc.ms_status?.replace(/([A-Z])/g,' $1').trim()}</p>
                  </div>
                ))}
              </div>
              {d.incidents?.total>0&&(<>
                <h2 style={{fontSize:'13px',fontWeight:'700',color:'#DC2626',marginBottom:'16px',textTransform:'uppercase',letterSpacing:'0.05em'}}>⚠️ Active Incidents ({d.incidents.total})</h2>
                <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'24px'}}>
                  {d.incidents?.incidents?.map((inc:any)=>(
                    <div key={inc.id} style={{background:'white',borderRadius:'10px',border:'1px solid #FECACA',padding:'16px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                        <div><span style={{fontSize:'13px',fontWeight:'700',color:'#DC2626'}}>{inc.title}</span><span style={{fontSize:'11px',color:'#45B6E4',marginLeft:'8px'}}>{inc.service}</span></div>
                        <span style={{fontSize:'10px',color:'#45B6E4'}}>{new Date(inc.start).toLocaleString()}</span>
                      </div>
                      {inc.impact_description&&<p style={{fontSize:'12px',color:'#3F3F3F',margin:0}}>{inc.impact_description}</p>}
                    </div>
                  ))}
                </div>
              </>)}
              <h2 style={{fontSize:'13px',fontWeight:'700',color:'#156082',marginBottom:'16px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Licenses</h2>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'14px'}}>
                {d.licenses?.licenses?.map((lic:any)=>(
                  <div key={lic.name} style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'16px'}}>
                    <div style={{fontSize:'11px',fontWeight:'700',color:'#45B6E4',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.05em'}}>{lic.name}</div>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                      <span style={{fontSize:'13px',fontWeight:'600',color:'#3F3F3F'}}>{lic.consumed}/{lic.total}</span>
                      <StatusBadge status={lic.status}/>
                    </div>
                    <div style={{height:'6px',background:'#F1F5F9',borderRadius:'3px',overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${lic.total>0?(lic.consumed/lic.total)*100:0}%`,background:lic.status==='full'?'#DC2626':'#156082',borderRadius:'3px'}}/>
                    </div>
                    <p style={{fontSize:'11px',color:'#45B6E4',marginTop:'4px'}}>{lic.available} available</p>
                  </div>
                ))}
              </div>
            </>)}
          </div>
        )}

        {/* AWS Costs */}
        {!loading&&tab==='aws-costs'&&d&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px',marginBottom:'24px'}}>
              {[
                {label:'Current Month',value:`$${d.current_month?.toFixed(2)||'0.00'}`,color:'#156082',sub:`${d.period?.start} → today`},
                {label:'Estimated Month',value:`$${d.estimated_month?.toFixed(2)||'0.00'}`,color:'#e97132',sub:'Projected total'},
                {label:'Daily Average',value:`$${d.daily?.length>0?(d.current_month/d.daily.length).toFixed(2):'0.00'}`,color:'#45B6E4',sub:'Last 30 days'},
              ].map(stat=>(
                <div key={stat.label} style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'20px'}}>
                  <div style={{fontSize:'10px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',marginBottom:'8px'}}>{stat.label}</div>
                  <div style={{fontSize:'28px',fontWeight:'800',color:stat.color}}>{stat.value}</div>
                  <div style={{fontSize:'11px',color:'#45B6E4',marginTop:'4px'}}>{stat.sub}</div>
                </div>
              ))}
            </div>
            <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'20px'}}>
              <h3 style={{fontSize:'13px',fontWeight:'700',color:'#156082',marginBottom:'16px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Cost by Service</h3>
              {d.by_service?.length===0?<p style={{color:'#45B6E4'}}>No data.{d.error&&` ${d.error}`}</p>:(
                <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                  {d.by_service?.map((item:any)=>{
                    const pct=d.current_month>0?(item.cost/d.current_month)*100:0
                    return (
                      <div key={item.service}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                          <span style={{fontSize:'13px',fontWeight:'600',color:'#3F3F3F'}}>{item.service}</span>
                          <span style={{fontSize:'13px',fontWeight:'700',color:'#156082'}}>${item.cost.toFixed(2)}</span>
                        </div>
                        <div style={{height:'6px',background:'#F1F5F9',borderRadius:'3px',overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${pct}%`,background:'#156082',borderRadius:'3px'}}/>
                        </div>
                        <span style={{fontSize:'10px',color:'#45B6E4'}}>{pct.toFixed(1)}%</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Microsoft Costs */}
        {!loading&&tab==='ms-costs'&&d&&(
          <div>
            {d.error?(
              <div style={{background:'#F5F7FA',border:'1px solid #EDF2F7',padding:'16px',borderRadius:'10px',fontSize:'13px',color:'#45B6E4'}}>ℹ️ {d.error}</div>
            ):(<>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'16px',marginBottom:'24px'}}>
                <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'20px'}}>
                  <div style={{fontSize:'10px',fontWeight:'700',textTransform:'uppercase',color:'#45B6E4',marginBottom:'8px'}}>Total This Month</div>
                  <div style={{fontSize:'28px',fontWeight:'800',color:'#156082'}}>${d.total?.toFixed(2)}</div>
                  <div style={{fontSize:'11px',color:'#45B6E4',marginTop:'4px'}}>{d.subscription}</div>
                </div>
                <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'20px'}}>
                  <div style={{fontSize:'10px',fontWeight:'700',textTransform:'uppercase',color:'#45B6E4',marginBottom:'8px'}}>Period</div>
                  <div style={{fontSize:'14px',fontWeight:'700',color:'#156082'}}>{d.period?.start} → {d.period?.end}</div>
                </div>
              </div>
              <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'20px'}}>
                <h3 style={{fontSize:'13px',fontWeight:'700',color:'#156082',marginBottom:'16px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Azure Cost by Service</h3>
                {d.costs?.length===0?<p style={{color:'#45B6E4'}}>No cost data.</p>:d.costs?.map((item:any)=>{
                  const pct=d.total>0?(item.cost/d.total)*100:0
                  return (
                    <div key={item.service} style={{marginBottom:'10px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                        <span style={{fontSize:'13px',fontWeight:'600',color:'#3F3F3F'}}>{item.service}</span>
                        <span style={{fontSize:'13px',fontWeight:'700',color:'#156082'}}>${item.cost.toFixed(2)}</span>
                      </div>
                      <div style={{height:'6px',background:'#F1F5F9',borderRadius:'3px',overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${pct}%`,background:'#e97132',borderRadius:'3px'}}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>)}
          </div>
        )}

        {/* URL Monitoring */}
        {!loading&&tab==='urls'&&d&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
              <div>
                <h2 style={{fontSize:'15px',fontWeight:'700',color:'#156082',margin:0}}>URL Monitoring</h2>
                <p style={{fontSize:'12px',color:'#45B6E4',margin:'4px 0 0'}}>Auto-checks every hour</p>
              </div>
              <div style={{display:'flex',gap:'10px'}}>
                <button onClick={runChecks} disabled={checking} style={{background:'#45B6E4',color:'white',border:'none',padding:'8px 16px',borderRadius:'7px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'Montserrat, sans-serif'}}>
                  {checking?'⏳ Checking...':'▶ Run Now'}
                </button>
                <button onClick={()=>setShowAddUrl(!showAddUrl)} style={{background:'#156082',color:'white',border:'none',padding:'8px 16px',borderRadius:'7px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'Montserrat, sans-serif'}}>+ Add URL</button>
              </div>
            </div>
            {showAddUrl&&(
              <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'20px',marginBottom:'20px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 2fr auto',gap:'10px',alignItems:'end'}}>
                  <div><label className="form-label">Name</label><input className="form-input" value={newUrl.name} onChange={e=>setNewUrl(p=>({...p,name:e.target.value}))} placeholder="My Website"/></div>
                  <div><label className="form-label">URL</label><input className="form-input" value={newUrl.url} onChange={e=>setNewUrl(p=>({...p,url:e.target.value}))} placeholder="https://example.com"/></div>
                  <button onClick={addURL} style={{background:'#156082',color:'white',border:'none',padding:'8px 16px',borderRadius:'7px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'Montserrat, sans-serif',height:'36px'}}>Add</button>
                </div>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'16px'}}>
              {(d.urls||[]).map((u:any,i:number)=>{
                const s=STATUS_STYLE[u.status]||STATUS_STYLE.unknown
                const avail=u.availability??100
                const availColor=avail>=99?'#059669':avail>=95?'#D97706':'#DC2626'
                return (
                  <div key={u.id||i} style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',position:'relative'}}>
                    <div style={{position:'absolute',top:0,left:0,right:0,height:'3px',background:s.dot,borderRadius:'12px 12px 0 0'}}/>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'14px'}}>
                      <div style={{flex:1,minWidth:0}}>
                        <h3 style={{fontSize:'14px',fontWeight:'700',color:'#156082',margin:'0 0 4px'}}>{u.name}</h3>
                        <a href={u.url} target="_blank" rel="noopener noreferrer" style={{fontSize:'11px',color:'#45B6E4',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:'4px'}}>
                          🔗 {u.url}
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0,marginLeft:'12px'}}>
                        <StatusBadge status={u.status}/>
                        {u.id&&!u.id.startsWith('default')&&(
                          <button onClick={()=>adminAPI.deleteURL(u.id).then(()=>{setData(p=>({...p,urls:undefined}));loadTab('urls',true)})} style={{border:'none',background:'#FEF2F2',cursor:'pointer',color:'#DC2626',fontSize:'11px',padding:'4px 8px',borderRadius:'6px',fontWeight:'700',fontFamily:'Montserrat, sans-serif'}}>✕</button>
                        )}
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',padding:'14px',background:'#F8FAFC',borderRadius:'8px',marginBottom:'12px'}}>
                      <KPI label="Availability" value={`${avail}%`} color={availColor} sub="Last 24h"/>
                      <KPI label="Avg Response" value={u.avg_response_time?`${u.avg_response_time}ms`:'—'} color={u.avg_response_time>2000?'#D97706':'#059669'} sub="Last 24h"/>
                      <KPI label="HTTP" value={u.status_code||'—'} color={!u.status_code||u.status_code<400?'#059669':'#DC2626'} sub="Latest"/>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'11px',color:'#45B6E4'}}>
                      <span>Last: {u.last_checked?new Date(u.last_checked).toLocaleString():'Never'}</span>
                      <span>{u.checks_count||0} checks</span>
                    </div>
                    {u.error&&<p style={{fontSize:'11px',color:'#DC2626',marginTop:'8px',background:'#FEF2F2',padding:'6px 8px',borderRadius:'6px',margin:'8px 0 0'}}>{u.error}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Error Logs */}
        {!loading&&tab==='logs'&&d&&(
          <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #EDF2F7',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:'13px',fontWeight:'700',color:'#156082'}}>Error Logs</span>
              <span style={{fontSize:'12px',color:'#45B6E4'}}>{d.total} entries</span>
            </div>
            {d.logs?.length===0?(
              <div style={{padding:'48px',textAlign:'center',color:'#45B6E4'}}>No errors. 🎉</div>
            ):(
              <div style={{overflow:'auto',maxHeight:'600px'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
                  <thead style={{background:'#FAFBFC',position:'sticky',top:0}}>
                    <tr>{['Timestamp','Level','User','Page','Service','Message'].map(h=>(
                      <th key={h} style={{padding:'10px 16px',textAlign:'left',fontSize:'10px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',borderBottom:'1px solid #EDF2F7',whiteSpace:'nowrap'}}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {d.logs?.map((log:any,i:number)=>(
                      <tr key={i} style={{borderBottom:'1px solid #F1F5F9'}}>
                        <td style={{padding:'10px 16px',color:'#45B6E4',whiteSpace:'nowrap'}}>{new Date(log.timestamp).toLocaleString()}</td>
                        <td style={{padding:'10px 16px'}}><span style={{background:log.level==='ERROR'?'#FEF2F2':'#FFF7ED',color:log.level==='ERROR'?'#DC2626':'#D97706',padding:'2px 8px',borderRadius:'10px',fontSize:'10px',fontWeight:'700'}}>{log.level}</span></td>
                        <td style={{padding:'10px 16px',color:'#3F3F3F',fontWeight:'500'}}>{log.user}</td>
                        <td style={{padding:'10px 16px',color:'#45B6E4'}}>{log.page}</td>
                        <td style={{padding:'10px 16px',color:'#45B6E4'}}>{log.service}</td>
                        <td style={{padding:'10px 16px',color:'#3F3F3F',maxWidth:'300px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
