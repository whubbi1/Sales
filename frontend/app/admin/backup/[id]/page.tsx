'use client'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

const API = 'https://api.whubbi.wcomply.com'

const STATUS_STYLE: Record<string,{bg:string;color:string;dot:string;label:string}> = {
  success: {bg:'#ECFDF5',color:'#059669',dot:'#10B981',label:'Success'},
  failed:  {bg:'#FEF2F2',color:'#DC2626',dot:'#EF4444',label:'Failed'},
  running: {bg:'#FFF7ED',color:'#D97706',dot:'#F59E0B',label:'Running'},
  unknown: {bg:'#F1F5F9',color:'#45B6E4',dot:'#94A3B8',label:'Unknown'},
}

// Hardcoded admin emails — consistent with other admin pages in this app
const ADMIN_EMAILS = ['william.delcour@wcomply.com']
const CURRENT_USER = 'william.delcour@wcomply.com'

function InlineField({ label, value, onSave, multiline = false, adminOnly = false, isAdmin = false }: {
  label: string
  value: string
  onSave: (v: string) => Promise<void>
  multiline?: boolean
  adminOnly?: boolean
  isAdmin?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<any>(null)

  useEffect(() => { setVal(value ?? '') }, [value])
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  const canEdit = !adminOnly || isAdmin

  const commit = async () => {
    setEditing(false)
    if (val !== (value ?? '')) {
      setSaving(true)
      await onSave(val)
      setSaving(false)
    }
  }

  return (
    <div style={{marginBottom:'20px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
        <span style={{fontSize:'11px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.06em',color:'#45B6E4'}}>{label}</span>
        {adminOnly && <span style={{fontSize:'9px',background:'#FFF7ED',color:'#D97706',padding:'1px 6px',borderRadius:'8px',fontWeight:'700'}}>Admin</span>}
        {saving && <span style={{fontSize:'10px',color:'#45B6E4'}}>Saving…</span>}
      </div>
      {editing && canEdit ? (
        multiline ? (
          <textarea
            ref={inputRef}
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={commit}
            rows={4}
            style={{width:'100%',border:'1.5px solid #45B6E4',borderRadius:'8px',padding:'10px 12px',fontSize:'13px',fontFamily:'Montserrat, sans-serif',resize:'vertical',outline:'none',boxSizing:'border-box',background:'#F0F9FF'}}
          />
        ) : (
          <input
            ref={inputRef}
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={commit}
            style={{width:'100%',border:'1.5px solid #45B6E4',borderRadius:'8px',padding:'8px 12px',fontSize:'13px',fontFamily:'Montserrat, sans-serif',outline:'none',boxSizing:'border-box',background:'#F0F9FF'}}
          />
        )
      ) : (
        <div
          onClick={() => canEdit && setEditing(true)}
          style={{
            padding:'10px 12px',
            borderRadius:'8px',
            border:'1.5px solid #EDF2F7',
            background: canEdit ? 'white' : '#F8FAFC',
            cursor: canEdit ? 'pointer' : 'default',
            fontSize:'13px',
            color: val ? '#2D3748' : '#94A3B8',
            minHeight:'40px',
            lineHeight:'1.5',
            whiteSpace: multiline ? 'pre-wrap' : 'normal',
            transition:'border-color 0.15s',
          }}
          onMouseEnter={e => { if (canEdit) (e.currentTarget as HTMLDivElement).style.borderColor = '#45B6E4' }}
          onMouseLeave={e => { if (canEdit) (e.currentTarget as HTMLDivElement).style.borderColor = '#EDF2F7' }}
        >
          {val || (canEdit ? <span style={{color:'#94A3B8',fontStyle:'italic'}}>Click to add…</span> : <span style={{color:'#94A3B8'}}>—</span>)}
        </div>
      )}
    </div>
  )
}

export default function BackupDetailPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params?.id as string

  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const isAdmin = ADMIN_EMAILS.includes(CURRENT_USER)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/admin/backup/app/${slug}`)
      setDetail(await r.json())
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { if (slug) load() }, [slug])

  const saveField = async (field: 'backup_policy' | 'tool_name', value: string) => {
    await fetch(`${API}/admin/backup/app/${slug}`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ [field]: value, updated_by: CURRENT_USER }),
    })
    setDetail((prev: any) => prev ? {...prev, config: {...prev.config, [field]: value}} : prev)
  }

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#F5F7FA',fontFamily:'Montserrat, sans-serif',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'#45B6E4',fontSize:'14px'}}>Loading…</div>
    </div>
  )

  if (!detail || detail.error) return (
    <div style={{minHeight:'100vh',background:'#F5F7FA',fontFamily:'Montserrat, sans-serif',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'#DC2626',fontSize:'14px'}}>Application not found</div>
    </div>
  )

  const { app, config, history } = detail
  const latest = history?.[0]
  const s = STATUS_STYLE[latest?.status || 'unknown']

  return (
    <div style={{minHeight:'100vh',background:'#F5F7FA',fontFamily:'Montserrat, sans-serif'}}>
      {/* Header */}
      <div style={{background:'#156082',padding:'0 32px',height:'64px',display:'flex',alignItems:'center',gap:'16px'}}>
        <button onClick={()=>router.push('/admin/backup')} style={{border:'none',background:'rgba(255,255,255,0.1)',color:'white',padding:'6px 14px',borderRadius:'6px',cursor:'pointer',fontSize:'12px',fontFamily:'Montserrat, sans-serif',fontWeight:'600'}}>← Backup</button>
        <span style={{fontSize:'22px'}}>{app.icon}</span>
        <span style={{color:'white',fontSize:'15px',fontWeight:'800'}}>{app.name}</span>
      </div>

      <div style={{padding:'28px 32px',maxWidth:'860px'}}>

        {/* Status bar */}
        <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'18px 22px',marginBottom:'20px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',display:'flex',alignItems:'center',gap:'16px'}}>
          <span style={{background:s.bg,color:s.color,padding:'4px 12px',borderRadius:'12px',fontSize:'12px',fontWeight:'700',display:'inline-flex',alignItems:'center',gap:'6px'}}>
            <span style={{width:'8px',height:'8px',borderRadius:'50%',background:s.dot,display:'inline-block'}}/>
            {s.label}
          </span>
          {latest?.backup_date ? (
            <span style={{fontSize:'12px',color:'#45B6E4'}}>Last backup: {new Date(latest.backup_date).toLocaleString()}</span>
          ) : (
            <span style={{fontSize:'12px',color:'#94A3B8'}}>No backup recorded yet</span>
          )}
          {latest?.size_mb && <span style={{fontSize:'12px',color:'#848EA5'}}>{latest.size_mb} MB</span>}
        </div>

        {/* Config card */}
        <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'24px',marginBottom:'20px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
          <h3 style={{fontSize:'12px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',marginBottom:'20px',margin:'0 0 20px 0'}}>Configuration</h3>

          <InlineField
            label="Backup policy"
            value={config?.backup_policy ?? ''}
            onSave={v => saveField('backup_policy', v)}
            multiline={true}
          />

          <InlineField
            label="Tool name"
            value={config?.tool_name ?? ''}
            onSave={v => saveField('tool_name', v)}
            adminOnly={true}
            isAdmin={isAdmin}
          />

          {config?.updated_at && (
            <div style={{fontSize:'10px',color:'#94A3B8',marginTop:'4px'}}>
              Last updated: {new Date(config.updated_at).toLocaleString()} {config.updated_by && `by ${config.updated_by}`}
            </div>
          )}
        </div>

        {/* Backup history */}
        {history?.length > 0 && (
          <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'24px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
            <h3 style={{fontSize:'12px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',margin:'0 0 16px 0'}}>Backup History</h3>
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {history.map((rec: any, i: number) => {
                const rs = STATUS_STYLE[rec.status || 'unknown']
                return (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 12px',background:i===0?'#F0F9FF':'#F8FAFC',borderRadius:'8px',border:`1px solid ${i===0?'#BAE6FD':'#EDF2F7'}`}}>
                    <span style={{background:rs.bg,color:rs.color,padding:'2px 8px',borderRadius:'8px',fontSize:'10px',fontWeight:'700',display:'inline-flex',alignItems:'center',gap:'4px',whiteSpace:'nowrap'}}>
                      <span style={{width:'6px',height:'6px',borderRadius:'50%',background:rs.dot,display:'inline-block'}}/>
                      {rs.label}
                    </span>
                    <span style={{fontSize:'11px',color:'#156082',fontWeight:'600'}}>
                      {rec.backup_date ? new Date(rec.backup_date).toLocaleString() : new Date(rec.created_at).toLocaleString()}
                    </span>
                    {rec.size_mb && <span style={{fontSize:'11px',color:'#45B6E4'}}>{rec.size_mb} MB</span>}
                    {rec.notes && <span style={{fontSize:'11px',color:'#848EA5',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{rec.notes}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
