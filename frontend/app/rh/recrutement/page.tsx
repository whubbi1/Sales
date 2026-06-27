'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { HRLayout } from '@/components/HRLayout'

const API = 'https://api.whubbi.wcomply.com'
const FLAG: Record<string,string> = { france:'🇫🇷', portugal:'🇵🇹', czech_republic:'🇨🇿', romania:'🇷🇴', spain:'🇪🇸' }
const COUNTRIES = ['france','portugal','czech_republic','romania','spain']
const LANGS: Record<string,string> = { france:'fr', portugal:'pt', czech_republic:'cs', romania:'ro', spain:'es' }
const STATUSES = ['new','screening','interview_1','interview_2','technical_test','offer','hired','rejected','on_hold']
const STATUS_COLOR: Record<string,string> = { new:'#45B6E4', screening:'#D97706', interview_1:'#7C3AED', interview_2:'#059669', technical_test:'#e97132', offer:'#156082', hired:'#059669', rejected:'#DC2626', on_hold:'#94A3B8' }
const STATUS_LABEL: Record<string,string> = { new:'New', screening:'Screening', interview_1:'Interview 1', interview_2:'Interview 2', technical_test:'Tech Test', offer:'Offer', hired:'Hired', rejected:'Rejected', on_hold:'On Hold' }

export default function RecruitmentPage() {
  const router = useRouter()
  const [candidates, setCandidates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<any>(null)
  const [cvFile, setCvFile] = useState<File|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    const url = filterStatus !== 'all' ? `${API}/hr/recruitment?status=${filterStatus}` : `${API}/hr/recruitment`
    fetch(url).then(r=>r.json()).then(d=>setCandidates(d.candidates||[])).finally(()=>setLoading(false))
  }
  useEffect(() => { load() }, [filterStatus])

  const handleCvUpload = async (file: File) => {
    setCvFile(file); setExtracting(true)
    const fd = new FormData(); fd.append('file', file)
    const r = await fetch(`${API}/hr/cv/extract`, { method:'POST', body:fd })
    const d = await r.json()
    setExtracted(d.extracted||{}); setExtracting(false)
  }

  const grouped = STATUSES.reduce((acc:any, s) => {
    acc[s] = candidates.filter(c => c.recruitment_status === s)
    return acc
  }, {})

  const filtered = candidates.filter(c =>
    `${c.first_name} ${c.last_name} ${c.current_title} ${c.country}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <HRLayout>
      <div style={{ padding:'28px 32px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#156082', marginBottom:'4px' }}>👥 Internal Recruitment</h1>
            <p style={{ fontSize:'12px', color:'#45B6E4' }}>{candidates.length} candidates</p>
          </div>
          <button onClick={() => setShowModal(true)}
            style={{ background:'#156082', color:'white', border:'none', padding:'9px 18px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
            + Add Candidate
          </button>
        </div>

        {/* Search + filter */}
        <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search candidates..."
            style={{ flex:1, minWidth:'200px', padding:'9px 14px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', outline:'none' }}/>
          <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
            {['all',...STATUSES].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={{ padding:'6px 12px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'10px', fontWeight:'700', fontFamily:'Montserrat, sans-serif',
                  background: filterStatus===s ? (STATUS_COLOR[s]||'#156082') : '#F1F5F9',
                  color: filterStatus===s ? 'white' : '#45B6E4' }}>
                {s==='all'?'All':STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {loading && <div style={{ textAlign:'center', padding:'48px', color:'#45B6E4' }}>Loading...</div>}

        {/* Kanban view */}
        {filterStatus === 'all' && !loading && (
          <div style={{ display:'flex', gap:'12px', overflowX:'auto', paddingBottom:'8px' }}>
            {['new','screening','interview_1','interview_2','offer','hired'].map(status => (
              <div key={status} style={{ minWidth:'200px', background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ padding:'10px 14px', borderBottom:'1px solid #F1F5F9', background: `${STATUS_COLOR[status]}15`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'11px', fontWeight:'700', color: STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</span>
                  <span style={{ fontSize:'11px', fontWeight:'800', color: STATUS_COLOR[status], background:`${STATUS_COLOR[status]}25`, padding:'2px 8px', borderRadius:'10px' }}>{(grouped[status]||[]).length}</span>
                </div>
                <div style={{ padding:'8px', maxHeight:'400px', overflowY:'auto' }}>
                  {(grouped[status]||[]).filter((c:any) => `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())).map((c:any) => (
                    <div key={c.id} onClick={() => router.push(`/rh/recrutement/${c.id}`)}
                      style={{ padding:'10px', borderRadius:'8px', border:'1px solid #F1F5F9', marginBottom:'6px', cursor:'pointer', background:'white' }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor='#45B6E4'}
                      onMouseLeave={e=>e.currentTarget.style.borderColor='#F1F5F9'}>
                      <div style={{ fontSize:'12px', fontWeight:'700', color:'#156082' }}>{c.first_name} {c.last_name}</div>
                      <div style={{ fontSize:'10px', color:'#45B6E4' }}>{c.current_title||'—'}</div>
                      <div style={{ fontSize:'10px', color:'#94A3B8', marginTop:'4px' }}>{FLAG[c.country]||'🌍'} {c.country}</div>
                    </div>
                  ))}
                  {(grouped[status]||[]).length === 0 && <div style={{ padding:'16px', textAlign:'center', fontSize:'11px', color:'#94A3B8' }}>Empty</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List view when filtered */}
        {filterStatus !== 'all' && !loading && (
          <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
            {filtered.length === 0 && <div style={{ padding:'48px', textAlign:'center', color:'#45B6E4' }}>No candidates with this status.</div>}
            {filtered.map((c:any,i:number) => (
              <div key={c.id} onClick={() => router.push(`/rh/recrutement/${c.id}`)}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid #F9FAFB', cursor:'pointer', background:i%2===0?'white':'#FAFBFC' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ width:'38px', height:'38px', borderRadius:'50%', background:'#7C3AED', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'14px', fontWeight:'700' }}>
                    {(c.first_name||'?')[0]}{(c.last_name||'?')[0]}
                  </div>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:'700', color:'#3F3F3F' }}>{c.first_name} {c.last_name}</div>
                    <div style={{ fontSize:'11px', color:'#45B6E4' }}>{c.current_title} · {FLAG[c.country]||'🌍'} {c.country}</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  <span style={{ fontSize:'11px', color:'#45B6E4' }}>{c.comment_count||0} notes</span>
                  <span style={{ padding:'3px 10px', borderRadius:'12px', fontSize:'10px', fontWeight:'700', background:`${STATUS_COLOR[c.recruitment_status]||'#94A3B8'}15`, color: STATUS_COLOR[c.recruitment_status]||'#94A3B8' }}>
                    {STATUS_LABEL[c.recruitment_status]||c.recruitment_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Modal */}
        {showModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(21,96,130,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(2px)' }}>
            <div style={{ background:'white', borderRadius:'14px', width:'640px', maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(21,96,130,0.25)' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #EDF2F7', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>New Candidate</span>
                <button onClick={() => { setShowModal(false); setExtracted(null); setCvFile(null) }} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#45B6E4' }}>×</button>
              </div>
              <CandidateForm extracted={extracted} cvFile={cvFile} extracting={extracting} onCvUpload={handleCvUpload} fileRef={fileRef}
                onSave={async (data:any) => {
                  const r = await fetch(`${API}/hr/recruitment`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })
                  const d = await r.json()
                  if (cvFile && d.id) { const fd = new FormData(); fd.append('file', cvFile); await fetch(`${API}/hr/cv/upload/${d.id}`, { method:'POST', body:fd }) }
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

function CandidateForm({ extracted, cvFile, extracting, onCvUpload, fileRef, onSave, onCancel }: any) {
  const [form, setForm] = useState({ first_name:'', last_name:'', email:'', phone:'', linkedin_url:'', country:'france', current_title:'', skills:[] as string[], years_experience:0, recruitment_status:'new', projects:[] as any[] })
  const [skillInput, setSkillInput] = useState('')
  useEffect(() => { if (extracted) setForm(f=>({...f,...extracted,skills:extracted.skills||[],projects:extracted.projects||[]})) }, [extracted])
  const addSkill = () => { if (skillInput.trim()) { setForm(f=>({...f,skills:[...f.skills,skillInput.trim()]})); setSkillInput('') } }
  return (
    <div style={{ overflowY:'auto', flex:1 }}>
      <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'12px' }}>
        <div style={{ border:'2px dashed #EDF2F7', borderRadius:'10px', padding:'16px', textAlign:'center', cursor:'pointer', background:'#FAFBFC' }} onClick={() => fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept=".pdf" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&onCvUpload(e.target.files[0])}/>
          {extracting ? <div style={{ color:'#45B6E4', fontSize:'13px' }}>⏳ Extracting CV with Claude AI...</div>
          : cvFile ? <div style={{ color:'#059669', fontSize:'13px' }}>✅ {cvFile.name} — data extracted</div>
          : <div style={{ color:'#45B6E4', fontSize:'13px' }}>📄 Upload CV (PDF) — auto-extracted by Claude AI</div>}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          {[['first_name','First Name *'],['last_name','Last Name *'],['email','Email'],['phone','Phone'],['linkedin_url','LinkedIn URL'],['current_title','Current Title']].map(([key,label]) => (
            <div key={key}>
              <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>{label}</label>
              <input value={(form as any)[key]||''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box' }}/>
            </div>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
          <div>
            <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Country</label>
            <select value={form.country} onChange={e=>setForm(f=>({...f,country:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none' }}>
              {COUNTRIES.map(c=><option key={c} value={c}>{FLAG[c]} {c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Years Exp.</label>
            <input type="number" value={form.years_experience} onChange={e=>setForm(f=>({...f,years_experience:parseInt(e.target.value)||0}))} style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box' }}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Initial Status</label>
            <select value={form.recruitment_status} onChange={e=>setForm(f=>({...f,recruitment_status:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none' }}>
              {STATUSES.map(s=><option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Skills</label>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'6px' }}>
            {form.skills.map((s,i)=><span key={i} style={{ background:'#F3F4F6', color:'#7C3AED', padding:'3px 10px', borderRadius:'12px', fontSize:'11px', fontWeight:'600', display:'flex', alignItems:'center', gap:'4px' }}>{s}<span style={{ cursor:'pointer' }} onClick={()=>setForm(f=>({...f,skills:f.skills.filter((_,j)=>j!==i)}))}>×</span></span>)}
          </div>
          <div style={{ display:'flex', gap:'6px' }}>
            <input value={skillInput} onChange={e=>setSkillInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addSkill()} placeholder="Add skill..." style={{ flex:1, padding:'7px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none' }}/>
            <button onClick={addSkill} style={{ padding:'7px 14px', background:'#7C3AED', color:'white', border:'none', borderRadius:'7px', fontSize:'12px', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>+</button>
          </div>
        </div>
        {form.projects.length > 0 && (
          <div>
            <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'8px' }}>Projects from CV ({form.projects.length})</label>
            {form.projects.slice(0,2).map((p,i)=><div key={i} style={{ padding:'8px 12px', background:'#F8FAFC', borderRadius:'8px', marginBottom:'6px', fontSize:'12px' }}><strong>{p.title}</strong> @ {p.company}</div>)}
          </div>
        )}
      </div>
      <div style={{ padding:'14px 20px', borderTop:'1px solid #EDF2F7', background:'#FAFBFC', display:'flex', justifyContent:'flex-end', gap:'8px' }}>
        <button onClick={onCancel} style={{ padding:'8px 16px', background:'white', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'Montserrat, sans-serif', color:'#45B6E4' }}>Cancel</button>
        <button onClick={() => onSave({...form, language:LANGS[form.country]||'fr', cv_extracted:!!cvFile})} disabled={!form.first_name||!form.last_name}
          style={{ padding:'8px 16px', background:form.first_name&&form.last_name?'#7C3AED':'#F1F5F9', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:form.first_name&&form.last_name?'pointer':'not-allowed', fontFamily:'Montserrat, sans-serif', color:form.first_name&&form.last_name?'white':'#45B6E4' }}>
          Save Candidate
        </button>
      </div>
    </div>
  )
}

const STATUS_LABEL: Record<string,string> = { new:'New', screening:'Screening', interview_1:'Interview 1', interview_2:'Interview 2', technical_test:'Tech Test', offer:'Offer', hired:'Hired', rejected:'Rejected', on_hold:'On Hold' }
const STATUS_COLOR: Record<string,string> = { new:'#45B6E4', screening:'#D97706', interview_1:'#7C3AED', interview_2:'#059669', technical_test:'#e97132', offer:'#156082', hired:'#059669', rejected:'#DC2626', on_hold:'#94A3B8' }
