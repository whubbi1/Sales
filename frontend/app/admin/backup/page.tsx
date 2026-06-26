'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

const API = 'https://api.whubbi.wcomply.com'

const STATUS_STYLE: Record<string,{bg:string;color:string;dot:string;label:string}> = {
  success: {bg:'#ECFDF5',color:'#059669',dot:'#10B981',label:'Success'},
  failed:  {bg:'#FEF2F2',color:'#DC2626',dot:'#EF4444',label:'Failed'},
  running: {bg:'#FFF7ED',color:'#D97706',dot:'#F59E0B',label:'Running'},
  unknown: {bg:'#F1F5F9',color:'#45B6E4',dot:'#94A3B8',label:'Unknown'},
}

export default function BackupPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string|null>(null)
  const [showUpdate, setShowUpdate] = useState<string|null>(null)
  const [form, setForm] = useState({status:'success',backup_date:'',size_mb:'',location:'',notes:''})
  const [triggering, setTriggering] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/admin/backup/overview`)
      setData(await r.json())
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const getRecord = (appName: string) => data?.records?.find((r:any) => r.application === appName)

  const triggerBackup = async () => {
    setTriggering(true)
    await fetch(`${API}/admin/backup/trigger`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})})
    setTriggering(false)
    setTimeout(load, 3000)
  }

  const updateRecord = async (appName: string) => {
    setUpdating(appName)
    await fetch(`${API}/admin/backup/record`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({application:appName, ...form, size_mb: form.size_mb ? parseInt(form.size_mb) : null})
    })
    setUpdating(null); setShowUpdate(null)
    setForm({status:'success',backup_date:'',size_mb:'',location:'',notes:''})
    load()
  }

  return (
    <div style={{minHeight:'100vh',background:'#F5F7FA',fontFamily:'Montserrat, sans-serif'}}>
      <div style={{background:'#156082',padding:'0 32px',height:'64px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
          <button onClick={()=>router.push('/admin')} style={{border:'none',background:'rgba(255,255,255,0.1)',color:'white',padding:'6px 14px',borderRadius:'6px',cursor:'pointer',fontSize:'12px',fontFamily:'Montserrat, sans-serif',fontWeight:'600'}}>← Admin</button>
          <span style={{color:'white',fontSize:'15px',fontWeight:'800'}}>💾 Backup Management</span>
        </div>
        <button onClick={triggerBackup} disabled={triggering} style={{background:'#e97132',color:'white',border:'none',padding:'8px 18px',borderRadius:'8px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'Montserrat, sans-serif',opacity:triggering?0.6:1}}>
          {triggering?'⏳ Triggering...':'▶ Trigger WHUBBI Backup'}
        </button>
      </div>

      <div style={{padding:'24px 32px'}}>
        {loading && <div style={{textAlign:'center',padding:'48px',color:'#45B6E4'}}>Loading...</div>}

        {!loading && data && (<>
          {/* Overview cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'14px',marginBottom:'28px'}}>
            {data.applications?.map((app:any) => {
              const record = getRecord(app.name)
              const s = STATUS_STYLE[record?.status||'unknown']
              return (
                <div key={app.name} style={{background:'white',borderRadius:'12px',border:`1px solid ${s.bg}`,padding:'18px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',position:'relative',overflow:'hidden'}}>
                  <div style={{position:'absolute',top:0,left:0,right:0,height:'3px',background:s.dot}}/>
                  <div style={{fontSize:'28px',marginBottom:'10px'}}>{app.icon}</div>
                  <div style={{fontSize:'13px',fontWeight:'700',color:'#156082',marginBottom:'6px'}}>{app.name}</div>
                  <div style={{marginBottom:'8px'}}>
                    <span style={{background:s.bg,color:s.color,padding:'2px 8px',borderRadius:'10px',fontSize:'10px',fontWeight:'700',display:'inline-flex',alignItems:'center',gap:'4px'}}>
                      <span style={{width:'6px',height:'6px',borderRadius:'50%',background:s.dot,display:'inline-block'}}/>
                      {s.label}
                    </span>
                  </div>
                  {record?.backup_date ? (
                    <div style={{fontSize:'10px',color:'#45B6E4'}}>Last: {new Date(record.backup_date).toLocaleDateString()}</div>
                  ) : (
                    <div style={{fontSize:'10px',color:'#848EA5'}}>No backup recorded</div>
                  )}
                  {!app.auto && (
                    <button onClick={()=>setShowUpdate(app.name)} style={{marginTop:'10px',width:'100%',background:'#F1F5F9',color:'#156082',border:'none',padding:'5px',borderRadius:'6px',fontSize:'11px',fontWeight:'600',cursor:'pointer',fontFamily:'Montserrat, sans-serif'}}>
                      Update Status
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* WHUBBI RDS Snapshots */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',marginBottom:'20px'}}>
            <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
              <h3 style={{fontSize:'12px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',marginBottom:'16px'}}>🗄️ RDS Automated Snapshots (WHUBBI)</h3>
              {data.whubbi_rds?.error ? (
                <p style={{color:'#45B6E4',fontSize:'13px'}}>⚠️ {data.whubbi_rds.error}</p>
              ) : data.whubbi_rds?.auto_snapshots?.length === 0 ? (
                <p style={{color:'#45B6E4',fontSize:'13px'}}>No automated snapshots found.</p>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  {data.whubbi_rds?.auto_snapshots?.map((snap:any,i:number) => (
                    <div key={snap.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:i===0?'#ECFDF5':'#F8FAFC',borderRadius:'8px',border:`1px solid ${i===0?'#A7F3D0':'#EDF2F7'}`}}>
                      <div>
                        <div style={{fontSize:'11px',fontWeight:'600',color:'#156082'}}>{snap.id}</div>
                        <div style={{fontSize:'10px',color:'#45B6E4'}}>{new Date(snap.created).toLocaleString()}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <span style={{background:'#ECFDF5',color:'#059669',padding:'2px 7px',borderRadius:'8px',fontSize:'10px',fontWeight:'700'}}>{snap.status}</span>
                        <div style={{fontSize:'10px',color:'#45B6E4',marginTop:'2px'}}>{snap.size_gb} GB</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
              <h3 style={{fontSize:'12px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',marginBottom:'16px'}}>📦 S3 Backup Files</h3>
              {data.s3_backups?.length === 0 ? (
                <div>
                  <p style={{color:'#45B6E4',fontSize:'13px',marginBottom:'12px'}}>No S3 backups yet.</p>
                  <div style={{background:'#F0F9FF',borderRadius:'8px',padding:'12px',border:'1px solid #BAE6FD'}}>
                    <p style={{fontSize:'11px',color:'#156082',fontWeight:'700',marginBottom:'6px'}}>WHUBBI Backup Strategy:</p>
                    <ul style={{fontSize:'11px',color:'#3F3F3F',lineHeight:'1.8',paddingLeft:'16px',margin:0}}>
                      <li>✅ RDS automated snapshots (7 days retention)</li>
                      <li>🔄 Daily pg_dump → S3 (scheduled job JOB-001)</li>
                      <li>✅ Code in GitHub (master branch)</li>
                      <li>✅ Docker images in ECR (last 10 versions)</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  {data.s3_backups?.map((f:any,i:number) => (
                    <div key={f.key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:i===0?'#ECFDF5':'#F8FAFC',borderRadius:'8px',border:'1px solid #EDF2F7'}}>
                      <div>
                        <div style={{fontSize:'11px',fontWeight:'600',color:'#156082'}}>{f.key.split('/').pop()}</div>
                        <div style={{fontSize:'10px',color:'#45B6E4'}}>{new Date(f.last_modified).toLocaleString()}</div>
                      </div>
                      <span style={{fontSize:'11px',fontWeight:'600',color:'#45B6E4'}}>{f.size_mb} MB</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>)}
      </div>

      {/* Update modal */}
      {showUpdate && (
        <div style={{position:'fixed',inset:0,background:'rgba(21,96,130,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,backdropFilter:'blur(2px)'}} onClick={()=>setShowUpdate(null)}>
          <div style={{background:'white',borderRadius:'14px',width:'100%',maxWidth:'480px',boxShadow:'0 20px 60px rgba(21,96,130,0.25)'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'18px 24px',borderBottom:'1px solid #EDF2F7',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h2 style={{fontSize:'15px',fontWeight:'800',color:'#156082',margin:0}}>Update Backup — {showUpdate}</h2>
              <button onClick={()=>setShowUpdate(null)} style={{border:'none',background:'none',cursor:'pointer',fontSize:'20px',color:'#45B6E4'}}>×</button>
            </div>
            <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:'12px'}}>
              <div>
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="running">Running</option>
                </select>
              </div>
              <div><label className="form-label">Backup Date</label><input className="form-input" type="datetime-local" value={form.backup_date} onChange={e=>setForm(p=>({...p,backup_date:e.target.value}))}/></div>
              <div><label className="form-label">Size (MB)</label><input className="form-input" type="number" value={form.size_mb} onChange={e=>setForm(p=>({...p,size_mb:e.target.value}))} placeholder="e.g. 1024"/></div>
              <div><label className="form-label">Location / Reference</label><input className="form-input" value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} placeholder="e.g. SharePoint backup folder, export URL..."/></div>
              <div><label className="form-label">Notes</label><textarea className="form-input" value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} rows={2} placeholder="Additional notes..."/></div>
            </div>
            <div style={{padding:'14px 24px',borderTop:'1px solid #EDF2F7',display:'flex',justifyContent:'flex-end',gap:'10px',background:'#FAFBFC'}}>
              <button onClick={()=>setShowUpdate(null)} style={{background:'white',color:'#156082',border:'1.5px solid #45B6E4',padding:'7px 16px',borderRadius:'7px',fontSize:'12px',fontWeight:'600',cursor:'pointer',fontFamily:'Montserrat, sans-serif'}}>Cancel</button>
              <button onClick={()=>updateRecord(showUpdate!)} disabled={!!updating} style={{background:'#156082',color:'white',border:'none',padding:'8px 20px',borderRadius:'7px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'Montserrat, sans-serif'}}>
                {updating?'Saving...':'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
