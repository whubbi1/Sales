'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { HRLayout } from '@/components/HRLayout'

const API = 'https://api.whubbi.wcomply.com'
const FLAG: Record<string,string> = { france:'🇫🇷', portugal:'🇵🇹', czech_republic:'🇨🇿', romania:'🇷🇴', spain:'🇪🇸' }
const COUNTRIES = ['france','portugal','czech_republic','romania','spain']
const LANGS: Record<string,string> = { france:'fr', portugal:'pt', czech_republic:'cs', romania:'ro', spain:'es' }

export default function FreelancersPage() {
  const router = useRouter()
  const [freelancers, setFreelancers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<any>(null)
  const [cvFile, setCvFile] = useState<File|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    fetch(`${API}/hr/freelancers`).then(r=>r.json()).then(d=>setFreelancers(d.freelancers||[])).finally(()=>setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleCvUpload = async (file: File) => {
    setCvFile(file)
    setExtracting(true)
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch(`${API}/hr/cv/extract`, { method:'POST', body:fd })
    const d = await r.json()
    setExtracted(d.extracted || {})
    setExtracting(false)
  }

  const filtered = freelancers.filter(f =>
    `${f.first_name} ${f.last_name} ${f.current_title} ${(f.skills||[]).join(' ')} ${f.country}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <HRLayout>
      <div style={{ padding:'28px 32px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#156082', marginBottom:'4px' }}>🔗 Freelancer Database</h1>
            <p style={{ fontSize:'12px', color:'#45B6E4' }}>{freelancers.length} freelancers</p>
          </div>
          <button onClick={() => setShowModal(true)}
            style={{ background:'#156082', color:'white', border:'none', padding:'9px 18px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
            + Add Freelancer
          </button>
        </div>

        {/* Search */}
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search by name, skills, country..."
          style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', marginBottom:'16px', outline:'none', boxSizing:'border-box' }}/>

        {loading && <div style={{ textAlign:'center', padding:'48px', color:'#45B6E4' }}>Loading...</div>}

        {/* Grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px' }}>
          {filtered.map(f => (
            <div key={f.id} onClick={() => router.push(`/rh/freelancers/${f.id}`)}
              style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'18px', cursor:'pointer', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', transition:'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.06)'}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px' }}>
                <div style={{ width:'42px', height:'42px', borderRadius:'50%', background:'#156082', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'16px', fontWeight:'700', flexShrink:0 }}>
                  {(f.first_name||'?')[0]}{(f.last_name||'?')[0]}
                </div>
                <div>
                  <div style={{ fontSize:'13px', fontWeight:'800', color:'#156082' }}>{f.first_name} {f.last_name}</div>
                  <div style={{ fontSize:'11px', color:'#45B6E4' }}>{f.current_title||'—'}</div>
                </div>
              </div>
              <div style={{ fontSize:'11px', color:'#45B6E4', marginBottom:'8px' }}>
                {FLAG[f.country]||'🌍'} {f.country} · {f.years_experience||0} yrs exp
                {f.daily_rate && ` · ${f.daily_rate}€/day`}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginBottom:'8px' }}>
                {(f.skills||[]).slice(0,4).map((s:string) => (
                  <span key={s} style={{ background:'#EFF6FF', color:'#156082', padding:'2px 8px', borderRadius:'12px', fontSize:'10px', fontWeight:'600' }}>{s}</span>
                ))}
                {(f.skills||[]).length > 4 && <span style={{ color:'#45B6E4', fontSize:'10px', fontWeight:'600' }}>+{(f.skills||[]).length-4}</span>}
              </div>
              <div style={{ fontSize:'10px', color:'#45B6E4' }}>
                {f.project_count||0} projects · {f.cv_filename ? '📎 CV' : 'No CV'}
              </div>
            </div>
          ))}
          {filtered.length === 0 && !loading && (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'48px', color:'#45B6E4' }}>No freelancers found.</div>
          )}
        </div>

        {/* Add Modal */}
        {showModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(21,96,130,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(2px)' }}>
            <div style={{ background:'white', borderRadius:'14px', width:'640px', maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(21,96,130,0.25)' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #EDF2F7', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>New Freelancer</span>
                <button onClick={() => { setShowModal(false); setExtracted(null); setCvFile(null) }} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#45B6E4' }}>×</button>
              </div>
              <FreelancerForm
                extracted={extracted} cvFile={cvFile} extracting={extracting}
                onCvUpload={handleCvUpload} fileRef={fileRef}
                onSave={async (data:any) => {
                  const r = await fetch(`${API}/hr/freelancers`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })
                  const d = await r.json()
                  if (cvFile && d.id) {
                    const fd = new FormData(); fd.append('file', cvFile)
                    await fetch(`${API}/hr/cv/upload/${d.id}`, { method:'POST', body:fd })
                  }
                  setShowModal(false); setExtracted(null); setCvFile(null); load()
                }}
                onCancel={() => { setShowModal(false); setExtracted(null); setCvFile(null) }}
              />
            </div>
          </div>
        )}
      </div>
    </HRLayout>
  )
}

function FreelancerForm({ extracted, cvFile, extracting, onCvUpload, fileRef, onSave, onCancel }: any) {
  const [form, setForm] = useState({ first_name:'', last_name:'', email:'', phone:'', linkedin_url:'', country:'france', current_title:'', skills:[] as string[], years_experience:0, daily_rate:'', availability_date:'', projects:[] as any[] })
  const [skillInput, setSkillInput] = useState('')

  useEffect(() => {
    if (extracted) setForm(f => ({ ...f, ...extracted, daily_rate: extracted.daily_rate||'', skills: extracted.skills||[], projects: extracted.projects||[] }))
  }, [extracted])

  const addSkill = () => { if (skillInput.trim()) { setForm(f=>({...f,skills:[...f.skills,skillInput.trim()]})); setSkillInput('') } }

  return (
    <div style={{ overflowY:'auto', flex:1 }}>
      <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'12px' }}>
        {/* CV Upload */}
        <div style={{ border:'2px dashed #EDF2F7', borderRadius:'10px', padding:'16px', textAlign:'center', cursor:'pointer', background:'#FAFBFC' }}
          onClick={() => fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept=".pdf" style={{ display:'none' }} onChange={e => e.target.files?.[0] && onCvUpload(e.target.files[0])}/>
          {extracting ? <div style={{ color:'#45B6E4', fontSize:'13px' }}>⏳ Extracting CV data with Claude AI...</div>
          : cvFile ? <div style={{ color:'#059669', fontSize:'13px' }}>✅ {cvFile.name} — data extracted</div>
          : <div style={{ color:'#45B6E4', fontSize:'13px' }}>📄 Upload CV (PDF) — data will be auto-extracted by Claude AI</div>}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          {[['first_name','First Name *'],['last_name','Last Name *'],['email','Email'],['phone','Phone'],['linkedin_url','LinkedIn URL'],['current_title','Current Title']].map(([key,label]) => (
            <div key={key}>
              <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>{label}</label>
              <input value={(form as any)[key]||''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
                style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box' }}/>
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
          <div>
            <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Country</label>
            <select value={form.country} onChange={e=>setForm(f=>({...f,country:e.target.value,language:LANGS[e.target.value]||'fr'}))}
              style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none' }}>
              {COUNTRIES.map(c=><option key={c} value={c}>{FLAG[c]} {c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Years Experience</label>
            <input type="number" value={form.years_experience} onChange={e=>setForm(f=>({...f,years_experience:parseInt(e.target.value)||0}))}
              style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box' }}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Daily Rate (€)</label>
            <input type="number" value={form.daily_rate} onChange={e=>setForm(f=>({...f,daily_rate:e.target.value}))}
              style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box' }}/>
          </div>
        </div>

        {/* Skills */}
        <div>
          <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Skills</label>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'6px' }}>
            {form.skills.map((s,i) => (
              <span key={i} style={{ background:'#EFF6FF', color:'#156082', padding:'3px 10px', borderRadius:'12px', fontSize:'11px', fontWeight:'600', display:'flex', alignItems:'center', gap:'4px' }}>
                {s} <span style={{ cursor:'pointer' }} onClick={()=>setForm(f=>({...f,skills:f.skills.filter((_,j)=>j!==i)}))}>×</span>
              </span>
            ))}
          </div>
          <div style={{ display:'flex', gap:'6px' }}>
            <input value={skillInput} onChange={e=>setSkillInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addSkill()}
              placeholder="Add skill..." style={{ flex:1, padding:'7px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none' }}/>
            <button onClick={addSkill} style={{ padding:'7px 14px', background:'#156082', color:'white', border:'none', borderRadius:'7px', fontSize:'12px', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>+</button>
          </div>
        </div>

        {/* Projects preview */}
        {form.projects.length > 0 && (
          <div>
            <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'8px' }}>Projects from CV ({form.projects.length})</label>
            {form.projects.slice(0,3).map((p,i) => (
              <div key={i} style={{ padding:'8px 12px', background:'#F8FAFC', borderRadius:'8px', marginBottom:'6px', fontSize:'12px' }}>
                <strong>{p.title}</strong> @ {p.company} · {p.start_date} - {p.end_date}
              </div>
            ))}
            {form.projects.length > 3 && <div style={{ fontSize:'11px', color:'#45B6E4' }}>+{form.projects.length-3} more projects</div>}
          </div>
        )}
      </div>
      <div style={{ padding:'14px 20px', borderTop:'1px solid #EDF2F7', background:'#FAFBFC', display:'flex', justifyContent:'flex-end', gap:'8px' }}>
        <button onClick={onCancel} style={{ padding:'8px 16px', background:'white', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'Montserrat, sans-serif', color:'#45B6E4' }}>Cancel</button>
        <button onClick={() => onSave({...form, language: LANGS[form.country]||'fr', cv_extracted: !!cvFile})}
          disabled={!form.first_name||!form.last_name}
          style={{ padding:'8px 16px', background: form.first_name&&form.last_name?'#156082':'#F1F5F9', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor: form.first_name&&form.last_name?'pointer':'not-allowed', fontFamily:'Montserrat, sans-serif', color: form.first_name&&form.last_name?'white':'#45B6E4' }}>
          Save Freelancer
        </button>
      </div>
    </div>
  )
}

