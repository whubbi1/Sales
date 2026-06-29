'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { HRLayout } from '@/components/HRLayout'

const API = 'https://api.whubbi.wcomply.com'
const FLAG: Record<string,string> = { france:'🇫🇷', portugal:'🇵🇹', czech_republic:'🇨🇿', romania:'🇷🇴', spain:'🇪🇸' }
const COUNTRIES = ['france','portugal','czech_republic','romania','spain']
const LANGS: Record<string,string> = { france:'fr', portugal:'pt', czech_republic:'cs', romania:'ro', spain:'es' }
const COMMENT_TYPES = ['note','call','email','interview']
const COMMENT_ICONS: Record<string,string> = { note:'📝', call:'📞', email:'✉️', interview:'🎤' }
const CURRENT_USER = { email:'william.delcour@wcomply.com', name:'William Delcour' }
const DOC_TYPES = [
  { value:'cv',          label:'CV / Resume',  icon:'📄' },
  { value:'contract',    label:'Contract',      icon:'📋' },
  { value:'id',          label:'ID Document',   icon:'🪪' },
  { value:'certificate', label:'Certificate',   icon:'🏆' },
  { value:'portfolio',   label:'Portfolio',     icon:'🎨' },
  { value:'other',       label:'Other',         icon:'📎' },
]
const DOC_ICON: Record<string,string> = Object.fromEntries(DOC_TYPES.map(d=>[d.value, d.icon]))

function InlineField({ label, value, onSave, type='text', href, displayAs }: any) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setVal(value ?? '') }, [value])

  const commit = async () => {
    setEditing(false)
    const newVal = type === 'number' ? (parseInt(String(val)) || 0) : val
    if (String(newVal) !== String(value ?? '')) {
      setSaving(true); await onSave(newVal); setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'3px', display:'flex', alignItems:'center', gap:'4px' }}>
        {label}{saving && <span style={{ fontSize:'9px', color:'#94A3B8', fontWeight:'400', textTransform:'none' }}>saving…</span>}
      </div>
      {editing ? (
        <input type={type} value={val} autoFocus
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => e.key === 'Enter' && commit()}
          style={{ fontSize:'12px', fontWeight:'600', border:'1px solid #45B6E4', borderRadius:'5px', padding:'3px 7px', outline:'none', fontFamily:'Montserrat, sans-serif', width:'100%', boxSizing:'border-box' as const }}/>
      ) : (
        <div onClick={() => setEditing(true)}
          style={{ fontSize:'12px', fontWeight:'600', color:'#3F3F3F', cursor:'text', padding:'3px 4px', borderRadius:'4px', minHeight:'20px', width:'100%' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F0F9FF'; (e.currentTarget as HTMLDivElement).style.outline = '1px dashed #CBD5E1' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; (e.currentTarget as HTMLDivElement).style.outline = 'none' }}>
          {displayAs || (value ? (href ? <a href={href} target="_blank" onClick={e=>e.stopPropagation()} style={{ color:'#156082', textDecoration:'none' }}>{value}</a> : String(value)) : <span style={{ color:'#CBD5E1' }}>—</span>)}
        </div>
      )}
    </div>
  )
}

function DeleteModal({ name, onConfirm, onCancel, deleting }: any) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(220,38,38,0.18)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, backdropFilter:'blur(2px)' }}>
      <div style={{ background:'white', borderRadius:'14px', width:'460px', boxShadow:'0 20px 60px rgba(0,0,0,0.18)', overflow:'hidden' }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #FEE2E2', background:'#FFF5F5' }}>
          <div style={{ fontSize:'14px', fontWeight:'800', color:'#DC2626', marginBottom:'4px' }}>⚠️ Delete Freelancer Profile</div>
          <div style={{ fontSize:'12px', color:'#B91C1C' }}>This action cannot be undone</div>
        </div>
        <div style={{ padding:'20px 24px' }}>
          <p style={{ fontSize:'13px', color:'#3F3F3F', marginBottom:'12px' }}>
            You are about to permanently delete <strong>{name}</strong>'s profile.
          </p>
          <div style={{ background:'#FEF2F2', borderRadius:'8px', padding:'12px 14px', fontSize:'12px', color:'#B91C1C', lineHeight:'1.7' }}>
            This will also delete:<br/>
            • All documents stored in the <strong>SharePoint folder</strong> for this freelancer<br/>
            • All comments and project history<br/>
            • The SharePoint directory <strong>{name}/</strong>
          </div>
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid #FEE2E2', display:'flex', justifyContent:'flex-end', gap:'8px' }}>
          <button onClick={onCancel} style={{ padding:'8px 16px', background:'white', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'Montserrat, sans-serif', color:'#45B6E4' }}>Cancel</button>
          <button onClick={onConfirm} disabled={deleting}
            style={{ padding:'8px 18px', background:'#DC2626', color:'white', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:deleting?'not-allowed':'pointer', fontFamily:'Montserrat, sans-serif', opacity:deleting?0.7:1 }}>
            {deleting ? 'Deleting…' : '🗑 Delete profile & SharePoint data'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FreelancerDetail() {
  const router = useRouter()
  const { id } = useParams() as { id: string }
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [autoSaving, setAutoSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile'|'comments'|'documents'>('profile')
  const [comment, setComment] = useState({ content:'', comment_type:'note', author_email:CURRENT_USER.email, author_name:CURRENT_USER.name })
  const [addingSkill, setAddingSkill] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [docUploading, setDocUploading] = useState(false)
  const [cvExtracting, setCvExtracting] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadDocType, setUploadDocType] = useState('other')
  const [pendingFile, setPendingFile] = useState<File|null>(null)
  const cvRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)

  const load = () => {
    fetch(`${API}/hr/freelancers/${id}`).then(r=>r.json()).then(d=>setProfile(d)).finally(()=>setLoading(false))
  }
  useEffect(() => { load() }, [id])

  const patchField = async (field: string, value: any) => {
    if (!profile) return
    setAutoSaving(true)
    try {
      const updated = { ...profile, [field]: value }
      if (field === 'country') updated.language = LANGS[value] || 'fr'
      await fetch(`${API}/hr/freelancers/${id}`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...updated, language: updated.language || LANGS[profile.country] || 'fr' })
      })
      setProfile((p:any) => ({ ...p, [field]: value, ...(field==='country' ? {language:LANGS[value]||'fr'} : {}) }))
    } finally { setAutoSaving(false) }
  }

  const addSkill = async () => {
    if (!skillInput.trim()) return
    const newSkills = [...(profile.skills||[]), skillInput.trim()]
    setSkillInput(''); setAddingSkill(false)
    await patchField('skills', newSkills)
  }
  const removeSkill = async (i: number) => {
    await patchField('skills', (profile.skills||[]).filter((_:any,j:number)=>j!==i))
  }

  const handleCvUpload = async (file: File) => {
    setCvExtracting(true); setUploadError('')
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await fetch(`${API}/hr/cv/extract`, { method:'POST', body:fd })
      const d = await r.json()
      const ex = d.extracted || {}
      const updates: any = {}
      if (ex.first_name)       updates.first_name = ex.first_name
      if (ex.last_name)        updates.last_name = ex.last_name
      if (ex.email)            updates.email = ex.email
      if (ex.phone)            updates.phone = ex.phone
      if (ex.linkedin_url)     updates.linkedin_url = ex.linkedin_url
      if (ex.current_title)    updates.current_title = ex.current_title
      if (ex.years_experience) updates.years_experience = ex.years_experience
      if (ex.daily_rate)       updates.daily_rate = ex.daily_rate
      if (ex.skills?.length)   updates.skills = ex.skills
      if (Object.keys(updates).length > 0) {
        setAutoSaving(true)
        await fetch(`${API}/hr/freelancers/${id}`, {
          method:'PUT', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ ...profile, ...updates, language: LANGS[profile.country]||'fr' })
        })
        setProfile((p:any) => ({ ...p, ...updates }))
        setAutoSaving(false)
      }
    } catch {}
    const fd2 = new FormData(); fd2.append('file', file)
    const uploadRes = await fetch(`${API}/hr/cv/upload/${id}`, { method:'POST', body:fd2 })
    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}))
      setUploadError(`CV upload failed: ${err.detail || uploadRes.status}`)
    }
    setCvExtracting(false); load()
  }

  const uploadDocument = async (file: File, docType: string) => {
    setDocUploading(true); setUploadError('')
    const fd = new FormData(); fd.append('file', file); fd.append('doc_type', docType)
    try {
      const res = await fetch(`${API}/hr/freelancers/${id}/documents`, { method:'POST', body:fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setUploadError(`Upload failed: ${err.detail || res.status}`)
      } else {
        setShowUploadModal(false); setPendingFile(null); load()
      }
    } catch(e: any) {
      setUploadError(`Upload failed: ${e.message}`)
    } finally { setDocUploading(false) }
  }

  const deleteDocument = async (docId: string) => {
    if (!confirm('Delete this document? It will also be removed from S3.')) return
    await fetch(`${API}/hr/freelancers/${id}/documents/${docId}`, { method:'DELETE' })
    load()
  }
  }

  const addComment = async () => {
    if (!comment.content.trim()) return
    await fetch(`${API}/hr/freelancers/${id}/comments`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(comment) })
    setComment(c=>({...c, content:''})); load()
  }

  const handleDelete = async () => {
    setDeleting(true)
    await fetch(`${API}/hr/freelancers/${id}`, { method:'DELETE' })
    router.push('/rh/freelancers')
  }

  if (loading) {
    return (
      <HRLayout>
        <div style={{ padding:'48px', textAlign:'center', color:'#45B6E4' }}>Loading...</div>
      </HRLayout>
    )
  }
  if (!profile) {
    return (
      <HRLayout>
        <div style={{ padding:'48px', textAlign:'center', color:'#DC2626' }}>Profile not found</div>
      </HRLayout>
    )
  }

  return (
    <HRLayout>
      <div style={{ padding:'28px 32px' }}>
        <button onClick={() => router.push('/rh/freelancers')}
          style={{ background:'none', border:'none', color:'#45B6E4', fontSize:'12px', fontWeight:'600', cursor:'pointer', marginBottom:'16px', fontFamily:'Montserrat, sans-serif', padding:0 }}>
          ← Back to freelancers
        </button>

        {/* Header card */}
        <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'24px', marginBottom:'20px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
              <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'#156082', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'20px', fontWeight:'800', flexShrink:0 }}>
                {(profile.first_name||'?')[0]}{(profile.last_name||'?')[0]}
              </div>
              <div>
                <div style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap' }}>
                  <InlineField label="" value={profile.first_name} onSave={(v:string)=>patchField('first_name',v)}
                    displayAs={<span style={{ fontSize:'18px', fontWeight:'800', color:'#156082' }}>{profile.first_name}</span>}/>
                  <InlineField label="" value={profile.last_name} onSave={(v:string)=>patchField('last_name',v)}
                    displayAs={<span style={{ fontSize:'18px', fontWeight:'800', color:'#156082' }}>{profile.last_name}</span>}/>
                  {autoSaving && <span style={{ fontSize:'10px', color:'#94A3B8' }}>saving…</span>}
                </div>
                <InlineField label="" value={profile.current_title} onSave={(v:string)=>patchField('current_title',v)}
                  displayAs={<span style={{ fontSize:'13px', color:'#45B6E4' }}>{profile.current_title||'Click to add title'} · {FLAG[profile.country]||'🌍'} {profile.country}</span>}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              {profile.cv_sharepoint_url && (
                <a href={profile.cv_sharepoint_url} target="_blank" style={{ padding:'7px 14px', background:'#EFF6FF', color:'#156082', borderRadius:'8px', fontSize:'12px', fontWeight:'700', textDecoration:'none' }}>📄 View CV</a>
              )}
              <button onClick={() => setShowDelete(true)}
                style={{ padding:'7px 14px', background:'#FEF2F2', color:'#DC2626', border:'1px solid #FECACA', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
                🗑 Delete
              </button>
            </div>
          </div>

          {/* Contact grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:'14px', paddingBottom:'16px', borderBottom:'1px solid #F1F5F9', marginBottom:'16px' }}>
            <InlineField label="Email" value={profile.email} onSave={(v:string)=>patchField('email',v)} href={profile.email?`mailto:${profile.email}`:undefined}/>
            <InlineField label="Phone" value={profile.phone} onSave={(v:string)=>patchField('phone',v)} href={profile.phone?`tel:${profile.phone}`:undefined}/>
            <InlineField label="LinkedIn" value={profile.linkedin_url} onSave={(v:string)=>patchField('linkedin_url',v)}
              displayAs={profile.linkedin_url ? <a href={profile.linkedin_url} target="_blank" onClick={e=>e.stopPropagation()} style={{ fontSize:'12px', fontWeight:'600', color:'#156082', textDecoration:'none' }}>Profile ↗</a> : <span style={{ color:'#CBD5E1', fontSize:'12px' }}>—</span>}/>
            <InlineField label="Experience (yrs)" value={profile.years_experience} onSave={(v:number)=>patchField('years_experience',v)} type="number"
              displayAs={<span style={{ fontSize:'12px', fontWeight:'600', color:'#3F3F3F' }}>{profile.years_experience||0} years</span>}/>
            <InlineField label="Daily Rate (€)" value={profile.daily_rate} onSave={(v:number)=>patchField('daily_rate',v)} type="number"
              displayAs={<span style={{ fontSize:'12px', fontWeight:'600', color:'#3F3F3F' }}>{profile.daily_rate ? `${profile.daily_rate}€/day` : '—'}</span>}/>
            <InlineField label="Available From" value={profile.availability_date ? profile.availability_date.split('T')[0] : ''} onSave={(v:string)=>patchField('availability_date',v)} type="date"
              displayAs={<span style={{ fontSize:'12px', fontWeight:'600', color:'#3F3F3F' }}>{profile.availability_date ? new Date(profile.availability_date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</span>}/>
            <div>
              <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'3px' }}>Country</div>
              <select value={profile.country||'france'} onChange={e=>patchField('country',e.target.value)}
                style={{ fontSize:'12px', fontWeight:'600', border:'1px solid #EDF2F7', borderRadius:'6px', padding:'3px 7px', outline:'none', fontFamily:'Montserrat, sans-serif', color:'#3F3F3F', background:'white', cursor:'pointer', width:'100%' }}>
                {COUNTRIES.map(c=><option key={c} value={c}>{FLAG[c]} {c}</option>)}
              </select>
            </div>
          </div>

          {/* Skills */}
          <div>
            <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'8px' }}>Skills</div>
            <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', alignItems:'center' }}>
              {(profile.skills||[]).map((s:string, i:number) => (
                <span key={i} style={{ background:'#EFF6FF', color:'#156082', padding:'3px 8px', borderRadius:'12px', fontSize:'11px', fontWeight:'600', display:'flex', alignItems:'center', gap:'3px' }}>
                  {s}<span onClick={()=>removeSkill(i)} style={{ cursor:'pointer', fontSize:'13px', lineHeight:'1', opacity:0.6 }}>×</span>
                </span>
              ))}
              {addingSkill ? (
                <input value={skillInput} onChange={e=>setSkillInput(e.target.value)} autoFocus
                  onBlur={()=>{ if(skillInput.trim()) addSkill(); else setAddingSkill(false) }}
                  onKeyDown={e=>{ if(e.key==='Enter') addSkill(); if(e.key==='Escape'){setAddingSkill(false);setSkillInput('')} }}
                  placeholder="skill…" style={{ padding:'3px 8px', border:'1.5px solid #156082', borderRadius:'12px', fontSize:'11px', outline:'none', fontFamily:'Montserrat, sans-serif', width:'90px' }}/>
              ) : (
                <span onClick={()=>setAddingSkill(true)} style={{ padding:'3px 10px', borderRadius:'12px', fontSize:'11px', fontWeight:'600', color:'#156082', background:'white', cursor:'pointer', border:'1.5px dashed #156082' }}>+ Add</span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', marginBottom:'16px', background:'white', borderRadius:'10px', border:'1px solid #EDF2F7', overflow:'hidden', width:'fit-content' }}>
          {([
            { key:'profile',   label:`Profile & Projects` },
            { key:'comments',  label:`Comments (${(profile.comments||[]).length})` },
            { key:'documents', label:`Documents (${(profile.documents||[]).length + (profile.cv_sharepoint_url?1:0)})` },
          ] as const).map(t=>(
            <button key={t.key} onClick={()=>setActiveTab(t.key)}
              style={{ padding:'9px 18px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'700', fontFamily:'Montserrat, sans-serif', background:activeTab===t.key?'#156082':'transparent', color:activeTab===t.key?'white':'#45B6E4' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {activeTab === 'profile' && (
          <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #F1F5F9', background:'#FAFBFC' }}>
              <h3 style={{ fontSize:'12px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4' }}>Project History ({(profile.projects||[]).length})</h3>
            </div>
            {(profile.projects||[]).length===0 && <div style={{ padding:'32px', textAlign:'center', color:'#45B6E4', fontSize:'13px' }}>No projects on record.</div>}
            {(profile.projects||[]).map((p:any,i:number)=>(
              <div key={p.id} style={{ padding:'16px 20px', borderBottom:'1px solid #F9FAFB', background:i%2===0?'white':'#FAFBFC' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px', flexWrap:'wrap', gap:'4px' }}>
                  <div><span style={{ fontSize:'13px', fontWeight:'700', color:'#156082' }}>{p.title}</span><span style={{ fontSize:'12px', color:'#45B6E4', marginLeft:'8px' }}>@ {p.company}</span></div>
                  <span style={{ fontSize:'11px', color:'#94A3B8' }}>{p.start_date} — {p.end_date}</span>
                </div>
                {p.description&&<p style={{ fontSize:'12px', color:'#3F3F3F', margin:'0 0 8px', lineHeight:'1.6' }}>{p.description}</p>}
                <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                  {(p.technologies||[]).map((t:string)=><span key={t} style={{ background:'#F1F5F9', color:'#45B6E4', padding:'2px 8px', borderRadius:'12px', fontSize:'10px', fontWeight:'600' }}>{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comments tab */}
        {activeTab === 'comments' && (
          <div>
            <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'16px', marginBottom:'14px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display:'flex', gap:'6px', marginBottom:'10px' }}>
                {COMMENT_TYPES.map(t=>(
                  <button key={t} onClick={()=>setComment(c=>({...c,comment_type:t}))}
                    style={{ padding:'5px 12px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:'700', fontFamily:'Montserrat, sans-serif', background:comment.comment_type===t?'#156082':'#F1F5F9', color:comment.comment_type===t?'white':'#45B6E4' }}>
                    {COMMENT_ICONS[t]} {t.charAt(0).toUpperCase()+t.slice(1)}
                  </button>
                ))}
              </div>
              <textarea value={comment.content} onChange={e=>setComment(c=>({...c,content:e.target.value}))}
                placeholder="Add a note, call log, or interview feedback…"
                style={{ width:'100%', padding:'10px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', resize:'vertical', minHeight:'70px', outline:'none', boxSizing:'border-box' as const }}/>
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'8px' }}>
                <button onClick={addComment} disabled={!comment.content.trim()}
                  style={{ padding:'7px 16px', background:comment.content.trim()?'#156082':'#F1F5F9', color:comment.content.trim()?'white':'#45B6E4', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:comment.content.trim()?'pointer':'not-allowed', fontFamily:'Montserrat, sans-serif' }}>
                  Add Note
                </button>
              </div>
            </div>
            {(profile.comments||[]).map((c:any)=>(
              <div key={c.id} style={{ background:'white', borderRadius:'10px', border:'1px solid #EDF2F7', padding:'14px 18px', marginBottom:'10px', boxShadow:'0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px', flexWrap:'wrap', gap:'4px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ fontSize:'14px' }}>{COMMENT_ICONS[c.comment_type]||'📝'}</span>
                    <span style={{ fontSize:'12px', fontWeight:'700', color:'#156082' }}>{c.author_name}</span>
                    <span style={{ padding:'2px 8px', borderRadius:'10px', background:'#EFF6FF', color:'#156082', fontSize:'10px', fontWeight:'600' }}>{c.comment_type}</span>
                  </div>
                  <span style={{ fontSize:'11px', color:'#94A3B8' }}>{c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'}</span>
                </div>
                <p style={{ fontSize:'12px', color:'#3F3F3F', margin:0, lineHeight:'1.6' }}>{c.content}</p>
              </div>
            ))}
            {(profile.comments||[]).length===0 && <div style={{ textAlign:'center', padding:'32px', color:'#45B6E4', fontSize:'13px' }}>No comments yet.</div>}
          </div>
        )}

        {/* Documents tab */}
        {activeTab === 'documents' && (
          <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #F1F5F9', background:'#FAFBFC', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4' }}>Documents · S3</span>
              <button onClick={() => { setShowUploadModal(true); setPendingFile(null); setUploadDocType('other'); setUploadError('') }}
                style={{ padding:'6px 14px', background:'#156082', color:'white', border:'none', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
                + Add document
              </button>
            </div>

            {/* CV row */}
            <div style={{ padding:'12px 20px', borderBottom:'1px solid #F9FAFB', display:'flex', alignItems:'center', gap:'12px' }}>
              <span style={{ fontSize:'18px', width:'24px', textAlign:'center' }}>📄</span>
              <div style={{ flex:1, minWidth:0 }}>
                {profile.cv_sharepoint_url ? (
                  <a href={profile.cv_sharepoint_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize:'13px', fontWeight:'700', color:'#156082', textDecoration:'none' }}>
                    {profile.cv_filename || 'CV'}
                  </a>
                ) : (
                  <span style={{ fontSize:'13px', color:'#94A3B8' }}>No CV uploaded</span>
                )}
              </div>
              <span style={{ background:'#EFF6FF', color:'#156082', padding:'2px 8px', borderRadius:'10px', fontSize:'10px', fontWeight:'700', flexShrink:0 }}>CV / Resume</span>
              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                {profile.cv_sharepoint_url && (
                  <a href={profile.cv_sharepoint_url} target="_blank" rel="noopener noreferrer"
                    style={{ padding:'4px 10px', background:'#EFF6FF', color:'#156082', borderRadius:'6px', fontSize:'11px', fontWeight:'700', textDecoration:'none' }}>
                    Open ↗
                  </a>
                )}
                <button onClick={() => cvRef.current?.click()}
                  style={{ padding:'4px 10px', background:'#F1F5F9', color:'#45B6E4', border:'none', borderRadius:'6px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
                  {cvExtracting ? '⏳' : profile.cv_sharepoint_url ? 'Replace' : 'Upload'}
                </button>
              </div>
              <input ref={cvRef} type="file" accept=".pdf,.doc,.docx,.odt,.rtf" style={{ display:'none' }}
                onChange={e => e.target.files?.[0] && handleCvUpload(e.target.files[0])}/>
            </div>

            {/* Other documents */}
            {(profile.documents||[]).map((doc:any, i:number) => (
              <div key={doc.id} style={{ padding:'12px 20px', borderBottom:'1px solid #F9FAFB', display:'flex', alignItems:'center', gap:'12px', background: i%2===0 ? 'white' : '#FAFBFC' }}>
                <span style={{ fontSize:'18px', width:'24px', textAlign:'center' }}>{DOC_ICON[doc.doc_type||'other']||'📎'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'13px', fontWeight:'600', color:'#3F3F3F', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.filename}</div>
                  {doc.uploaded_at && <div style={{ fontSize:'10px', color:'#94A3B8' }}>{new Date(doc.uploaded_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</div>}
                </div>
                <span style={{ background:'#F3F4F6', color:'#45B6E4', padding:'2px 8px', borderRadius:'10px', fontSize:'10px', fontWeight:'600', flexShrink:0 }}>
                  {DOC_TYPES.find(t=>t.value===doc.doc_type)?.label || 'Other'}
                </span>
                <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                  <a href={doc.sharepoint_url} target="_blank" rel="noopener noreferrer"
                    style={{ padding:'4px 10px', background:'#EFF6FF', color:'#156082', borderRadius:'6px', fontSize:'11px', fontWeight:'700', textDecoration:'none' }}>
                    Open ↗
                  </a>
                  <button onClick={() => deleteDocument(doc.id)}
                    style={{ padding:'4px 8px', background:'#FEF2F2', color:'#DC2626', border:'none', borderRadius:'6px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
                    ×
                  </button>
                </div>
              </div>
            ))}

            {(profile.documents||[]).length === 0 && !profile.cv_sharepoint_url && (
              <div style={{ padding:'32px', textAlign:'center', color:'#94A3B8', fontSize:'13px' }}>No documents yet.</div>
            )}

            {uploadError && (
              <div style={{ margin:'12px 20px', padding:'10px 14px', background:'#FEF2F2', borderRadius:'8px', fontSize:'12px', color:'#DC2626', fontWeight:'600' }}>
                ⚠ {uploadError}
              </div>
            )}
          </div>
        )}

        {/* Upload document modal */}
        {showUploadModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(21,96,130,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, backdropFilter:'blur(2px)' }}
            onClick={e => { if(e.target===e.currentTarget){ setShowUploadModal(false); setPendingFile(null) } }}>
            <div style={{ background:'white', borderRadius:'14px', width:'440px', overflow:'hidden', boxShadow:'0 20px 60px rgba(21,96,130,0.25)' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #EDF2F7', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>Upload Document</span>
                <button onClick={() => { setShowUploadModal(false); setPendingFile(null) }} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#45B6E4' }}>×</button>
              </div>
              <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
                <div>
                  <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'8px' }}>Document type</div>
                  <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                    {DOC_TYPES.map(t => (
                      <button key={t.value} onClick={() => setUploadDocType(t.value)}
                        style={{ padding:'6px 12px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:'700', fontFamily:'Montserrat, sans-serif',
                          background: uploadDocType===t.value ? '#156082' : '#F1F5F9',
                          color: uploadDocType===t.value ? 'white' : '#45B6E4' }}>
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'8px' }}>File</div>
                  <div style={{ border:'1.5px dashed #EDF2F7', borderRadius:'8px', padding:'16px', textAlign:'center', cursor:'pointer' }}
                    onClick={() => docRef.current?.click()}
                    onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor='#45B6E4'}
                    onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor='#EDF2F7'}>
                    <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.odt,.rtf,.xls,.xlsx,.png,.jpg,.jpeg" style={{ display:'none' }}
                      onChange={e => e.target.files?.[0] && setPendingFile(e.target.files[0])}/>
                    {pendingFile
                      ? <span style={{ fontSize:'12px', fontWeight:'600', color:'#156082' }}>📎 {pendingFile.name}</span>
                      : <span style={{ fontSize:'12px', color:'#94A3B8' }}>Click to choose a file</span>}
                  </div>
                </div>
                {uploadError && (
                  <div style={{ padding:'10px 14px', background:'#FEF2F2', borderRadius:'8px', fontSize:'12px', color:'#DC2626', fontWeight:'600' }}>⚠ {uploadError}</div>
                )}
              </div>
              <div style={{ padding:'14px 20px', borderTop:'1px solid #EDF2F7', background:'#FAFBFC', display:'flex', justifyContent:'flex-end', gap:'8px' }}>
                <button onClick={() => { setShowUploadModal(false); setPendingFile(null) }}
                  style={{ padding:'8px 16px', background:'white', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'Montserrat, sans-serif', color:'#45B6E4' }}>
                  Cancel
                </button>
                <button onClick={() => pendingFile && uploadDocument(pendingFile, uploadDocType)}
                  disabled={!pendingFile || docUploading}
                  style={{ padding:'8px 20px', background: pendingFile && !docUploading ? '#156082' : '#F1F5F9', color: pendingFile && !docUploading ? 'white' : '#94A3B8', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor: pendingFile && !docUploading ? 'pointer' : 'not-allowed', fontFamily:'Montserrat, sans-serif' }}>
                  {docUploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDelete && (
          <DeleteModal
            name={`${profile.first_name} ${profile.last_name}`}
            onConfirm={handleDelete}
            onCancel={() => setShowDelete(false)}
            deleting={deleting}
          />
        )}
      </div>
    </HRLayout>
  )
}
