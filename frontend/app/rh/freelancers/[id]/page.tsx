'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { HRLayout } from '@/components/HRLayout'

const API = 'https://api.whubbi.wcomply.com'
const FLAG: Record<string,string> = { france:'🇫🇷', portugal:'🇵🇹', czech_republic:'🇨🇿', romania:'🇷🇴', spain:'🇪🇸' }
const COUNTRIES = ['france','portugal','czech_republic','romania','spain']
const LANGS: Record<string,string> = { france:'fr', portugal:'pt', czech_republic:'cs', romania:'ro', spain:'es' }

export default function FreelancerDetail() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})
  const [skillInput, setSkillInput] = useState('')
  const [cvFile, setCvFile] = useState<File|null>(null)
  const [extracting, setExtracting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`${API}/hr/freelancers/${id}`).then(r=>r.json()).then(d=>{ setProfile(d); setForm(d) }).finally(()=>setLoading(false))
  }, [id])

  const handleCvUpload = async (file: File) => {
    setCvFile(file)
    setExtracting(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const r = await fetch(`${API}/hr/cv/extract`, { method:'POST', body:fd })
      const d = await r.json()
      const ex = d.extracted || {}
      setForm((f: any) => ({
        ...f,
        ...(ex.first_name ? { first_name: ex.first_name } : {}),
        ...(ex.last_name ? { last_name: ex.last_name } : {}),
        ...(ex.email ? { email: ex.email } : {}),
        ...(ex.phone ? { phone: ex.phone } : {}),
        ...(ex.linkedin_url ? { linkedin_url: ex.linkedin_url } : {}),
        ...(ex.current_title ? { current_title: ex.current_title } : {}),
        ...(ex.years_experience ? { years_experience: ex.years_experience } : {}),
        ...(ex.daily_rate ? { daily_rate: ex.daily_rate } : {}),
        ...(ex.skills?.length ? { skills: ex.skills } : {}),
        ...(ex.projects?.length ? { projects: ex.projects } : {}),
      }))
    } catch {}
    setExtracting(false)
  }

  const save = async () => {
    await fetch(`${API}/hr/freelancers/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ...form, language: LANGS[form.country]||'fr' }) })
    if (cvFile) {
      const fd = new FormData(); fd.append('file', cvFile)
      await fetch(`${API}/hr/cv/upload/${id}`, { method:'POST', body:fd })
    }
    setProfile({ ...profile, ...form }); setEditing(false); setCvFile(null)
  }

  const addSkill = () => {
    if (skillInput.trim()) { setForm((f: any) => ({ ...f, skills: [...(f.skills||[]), skillInput.trim()] })); setSkillInput('') }
  }

  if (loading) return <HRLayout><div style={{ padding:'48px', textAlign:'center', color:'#45B6E4' }}>Loading...</div></HRLayout>
  if (!profile) return <HRLayout><div style={{ padding:'48px', textAlign:'center', color:'#DC2626' }}>Profile not found</div></HRLayout>

  const inp = (field: string, placeholder?: string, type?: string) => (
    <input type={type||'text'} value={form[field]||''} onChange={e=>setForm((f: any)=>({...f,[field]:type==='number'?Number(e.target.value):e.target.value}))}
      placeholder={placeholder}
      style={{ width:'100%', padding:'7px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box' as const }}/>
  )

  return (
    <HRLayout>
      <div style={{ padding:'28px 32px' }}>
        {/* Back */}
        <button onClick={() => router.push('/rh/freelancers')}
          style={{ background:'none', border:'none', color:'#45B6E4', fontSize:'12px', fontWeight:'600', cursor:'pointer', marginBottom:'16px', fontFamily:'Montserrat, sans-serif', padding:0 }}>
          ← Back to freelancers
        </button>

        {/* Header */}
        <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'24px', marginBottom:'20px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: editing ? '20px' : '0' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
              <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'#156082', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'22px', fontWeight:'800', flexShrink:0 }}>
                {(form.first_name||profile.first_name||'?')[0]}{(form.last_name||profile.last_name||'?')[0]}
              </div>
              <div>
                <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#156082', margin:'0 0 4px' }}>{profile.first_name} {profile.last_name}</h1>
                <p style={{ fontSize:'13px', color:'#45B6E4', margin:0 }}>{profile.current_title}</p>
              </div>
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              {profile.cv_sharepoint_url && (
                <a href={profile.cv_sharepoint_url} target="_blank" style={{ padding:'7px 14px', background:'#EFF6FF', color:'#156082', borderRadius:'8px', fontSize:'12px', fontWeight:'700', textDecoration:'none' }}>📄 View CV</a>
              )}
              {editing
                ? <>
                    <button onClick={save} style={{ padding:'7px 14px', background:'#059669', color:'white', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>Save</button>
                    <button onClick={() => { setEditing(false); setForm(profile); setCvFile(null) }} style={{ padding:'7px 14px', background:'#F1F5F9', color:'#45B6E4', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>Cancel</button>
                  </>
                : <button onClick={() => setEditing(true)} style={{ padding:'7px 14px', background:'#156082', color:'white', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>Edit</button>}
            </div>
          </div>

          {/* Edit form */}
          {editing && (
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              {/* CV re-upload */}
              <div style={{ border:'2px dashed #EDF2F7', borderRadius:'10px', padding:'12px 16px', textAlign:'center', cursor:'pointer', background:'#FAFBFC' }}
                onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.odt,.rtf" style={{ display:'none' }} onChange={e => e.target.files?.[0] && handleCvUpload(e.target.files[0])}/>
                {extracting ? <span style={{ color:'#45B6E4', fontSize:'12px' }}>⏳ Extracting CV data...</span>
                : cvFile ? <span style={{ color:'#059669', fontSize:'12px' }}>✅ {cvFile.name} — fields updated from CV</span>
                : <span style={{ color:'#45B6E4', fontSize:'12px' }}>📄 Upload new CV (PDF, Word, ODT) to auto-fill fields</span>}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div><label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase' as const, letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'4px' }}>First Name</label>{inp('first_name')}</div>
                <div><label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase' as const, letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'4px' }}>Last Name</label>{inp('last_name')}</div>
                <div><label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase' as const, letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'4px' }}>Current Title</label>{inp('current_title')}</div>
                <div><label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase' as const, letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'4px' }}>Email</label>{inp('email','email@example.com')}</div>
                <div><label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase' as const, letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'4px' }}>Phone</label>{inp('phone','+33 6 00 00 00 00')}</div>
                <div><label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase' as const, letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'4px' }}>LinkedIn URL</label>{inp('linkedin_url','https://linkedin.com/in/...')}</div>
                <div>
                  <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase' as const, letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'4px' }}>Country</label>
                  <select value={form.country||'france'} onChange={e=>setForm((f: any)=>({...f,country:e.target.value}))}
                    style={{ width:'100%', padding:'7px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none' }}>
                    {COUNTRIES.map(c=><option key={c} value={c}>{FLAG[c]} {c}</option>)}
                  </select>
                </div>
                <div><label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase' as const, letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'4px' }}>Years Experience</label>{inp('years_experience','0','number')}</div>
                <div><label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase' as const, letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'4px' }}>Daily Rate (€)</label>{inp('daily_rate','500','number')}</div>
              </div>

              {/* Skills */}
              <div>
                <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase' as const, letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'6px' }}>Skills</label>
                <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginBottom:'6px' }}>
                  {(form.skills||[]).map((s: string, i: number) => (
                    <span key={i} style={{ background:'#EFF6FF', color:'#156082', padding:'3px 10px', borderRadius:'12px', fontSize:'11px', fontWeight:'600', display:'flex', alignItems:'center', gap:'4px' }}>
                      {s} <span style={{ cursor:'pointer' }} onClick={()=>setForm((f: any)=>({...f,skills:f.skills.filter((_: any,j: number)=>j!==i)}))}>×</span>
                    </span>
                  ))}
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  <input value={skillInput} onChange={e=>setSkillInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addSkill()}
                    placeholder="Add skill..." style={{ flex:1, padding:'7px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none' }}/>
                  <button onClick={addSkill} style={{ padding:'7px 14px', background:'#156082', color:'white', border:'none', borderRadius:'7px', fontSize:'12px', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>+</button>
                </div>
              </div>
            </div>
          )}

          {/* Read-only contact info */}
          {!editing && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginTop:'20px', paddingTop:'20px', borderTop:'1px solid #F1F5F9' }}>
                {[
                  { label:'Email', value: profile.email, href:`mailto:${profile.email}` },
                  { label:'Phone', value: profile.phone, href:`tel:${profile.phone}` },
                  { label:'LinkedIn', value: profile.linkedin_url?'View Profile':null, href:profile.linkedin_url },
                  { label:'Country', value: `${FLAG[profile.country]||'🌍'} ${profile.country}` },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase' as const, letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'4px' }}>{item.label}</div>
                    {item.href && item.value
                      ? <a href={item.href} target="_blank" style={{ fontSize:'13px', fontWeight:'600', color:'#156082', textDecoration:'none' }}>{item.value}</a>
                      : <div style={{ fontSize:'13px', fontWeight:'600', color:'#3F3F3F' }}>{item.value||'—'}</div>}
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:'16px', marginTop:'16px', paddingTop:'16px', borderTop:'1px solid #F1F5F9', flexWrap:'wrap', alignItems:'center' }}>
                <div style={{ fontSize:'11px', color:'#45B6E4', fontWeight:'600' }}>
                  {profile.years_experience||0} yrs · {profile.daily_rate?`${profile.daily_rate}€/day`:'Rate N/A'}
                </div>
                {(profile.skills||[]).map((s:string) => (
                  <span key={s} style={{ background:'#EFF6FF', color:'#156082', padding:'3px 10px', borderRadius:'12px', fontSize:'11px', fontWeight:'600' }}>{s}</span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Projects */}
        <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #F1F5F9', background:'#FAFBFC' }}>
            <h3 style={{ fontSize:'12px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4' }}>
              Project History ({(profile.projects||[]).length})
            </h3>
          </div>
          {(profile.projects||[]).length === 0 && <div style={{ padding:'32px', textAlign:'center', color:'#45B6E4', fontSize:'13px' }}>No projects on record.</div>}
          {(profile.projects||[]).map((p:any,i:number) => (
            <div key={p.id} style={{ padding:'16px 20px', borderBottom:'1px solid #F9FAFB', background:i%2===0?'white':'#FAFBFC' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
                <div>
                  <span style={{ fontSize:'13px', fontWeight:'700', color:'#156082' }}>{p.title}</span>
                  <span style={{ fontSize:'12px', color:'#45B6E4', marginLeft:'8px' }}>@ {p.company}</span>
                </div>
                <span style={{ fontSize:'11px', color:'#94A3B8', whiteSpace:'nowrap', marginLeft:'12px' }}>{p.start_date} — {p.end_date}</span>
              </div>
              {p.description && <p style={{ fontSize:'12px', color:'#3F3F3F', margin:'0 0 8px', lineHeight:'1.6' }}>{p.description}</p>}
              {(p.technologies||[]).length > 0 && (
                <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                  {(p.technologies||[]).map((t:string) => (
                    <span key={t} style={{ background:'#F1F5F9', color:'#45B6E4', padding:'2px 8px', borderRadius:'12px', fontSize:'10px', fontWeight:'600' }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </HRLayout>
  )
}
