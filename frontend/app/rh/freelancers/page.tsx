'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { HRLayout } from '@/components/HRLayout'

const API = 'https://api.whubbi.wcomply.com'
const FLAG: Record<string,string> = { france:'🇫🇷', portugal:'🇵🇹', czech_republic:'🇨🇿', romania:'🇷🇴', spain:'🇪🇸' }
const COUNTRIES = ['france','portugal','czech_republic','romania','spain']
const LANGS: Record<string,string> = { france:'fr', portugal:'pt', czech_republic:'cs', romania:'ro', spain:'es' }

const ALL_COLUMNS = [
  { key:'first_name',        label:'First Name' },
  { key:'last_name',         label:'Last Name' },
  { key:'country',           label:'Country' },
  { key:'current_title',     label:'Profile / Title' },
  { key:'email',             label:'Email' },
  { key:'phone',             label:'Phone' },
  { key:'linkedin_url',      label:'LinkedIn' },
  { key:'years_experience',  label:'Experience' },
  { key:'daily_rate',        label:'Daily Rate' },
  { key:'availability_date', label:'Availability' },
  { key:'skills',            label:'Skills' },
  { key:'cv_filename',       label:'CV' },
  { key:'project_count',     label:'Projects' },
]

const DEFAULT_COLUMNS = ['first_name','last_name','country','current_title']
const STORAGE_KEY = 'whubbi_freelancer_columns_v1'

function cellValue(col: string, f: any) {
  switch (col) {
    case 'country':
      return <span style={{ whiteSpace:'nowrap' }}>{FLAG[f.country]||'🌍'} {f.country||'—'}</span>
    case 'linkedin_url':
      return f.linkedin_url
        ? <a href={f.linkedin_url} target="_blank" onClick={e=>e.stopPropagation()} style={{ color:'#156082', textDecoration:'none', fontWeight:'600' }}>Profile ↗</a>
        : <span style={{ color:'#CBD5E1' }}>—</span>
    case 'cv_filename':
      return f.cv_sharepoint_url
        ? <a href={f.cv_sharepoint_url} target="_blank" onClick={e=>e.stopPropagation()} style={{ color:'#156082', textDecoration:'none', fontWeight:'600' }}>📎 {f.cv_filename||'CV'}</a>
        : <span style={{ color:'#CBD5E1' }}>—</span>
    case 'email':
      return f.email
        ? <a href={`mailto:${f.email}`} onClick={e=>e.stopPropagation()} style={{ color:'#156082', textDecoration:'none' }}>{f.email}</a>
        : <span style={{ color:'#CBD5E1' }}>—</span>
    case 'phone':
      return f.phone
        ? <a href={`tel:${f.phone}`} onClick={e=>e.stopPropagation()} style={{ color:'#3F3F3F', textDecoration:'none' }}>{f.phone}</a>
        : <span style={{ color:'#CBD5E1' }}>—</span>
    case 'years_experience':
      return <span>{f.years_experience||0} yrs</span>
    case 'daily_rate':
      return f.daily_rate ? <span>{f.daily_rate}€/day</span> : <span style={{ color:'#CBD5E1' }}>—</span>
    case 'availability_date':
      return f.availability_date
        ? <span>{new Date(f.availability_date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</span>
        : <span style={{ color:'#CBD5E1' }}>—</span>
    case 'skills':
      return (
        <div style={{ display:'flex', gap:'3px', flexWrap:'wrap', maxWidth:'220px' }}>
          {(f.skills||[]).slice(0,3).map((s:string) => (
            <span key={s} style={{ background:'#EFF6FF', color:'#156082', padding:'1px 7px', borderRadius:'10px', fontSize:'10px', fontWeight:'600', whiteSpace:'nowrap' }}>{s}</span>
          ))}
          {(f.skills||[]).length > 3 && <span style={{ fontSize:'10px', color:'#45B6E4', fontWeight:'600' }}>+{(f.skills||[]).length-3}</span>}
        </div>
      )
    case 'project_count':
      return <span>{f.project_count||0}</span>
    default:
      return <span>{f[col]||<span style={{ color:'#CBD5E1' }}>—</span>}</span>
  }
}

export default function FreelancersPage() {
  const router = useRouter()
  const [freelancers, setFreelancers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [search, setSearch] = useState('')
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS)
  const [dragCol, setDragCol] = useState<string|null>(null)
  const [dragOver, setDragOver] = useState<string|null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<any>(null)
  const [extractError, setExtractError] = useState('')
  const [cvFile, setCvFile] = useState<File|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setColumns(JSON.parse(saved))
    } catch {}
  }, [])

  const load = () => {
    fetch(`${API}/hr/freelancers`).then(r=>r.json()).then(d=>setFreelancers(d.freelancers||[])).finally(()=>setLoading(false))
  }
  useEffect(() => { load() }, [])

  const saveColumns = (cols: string[]) => {
    setColumns(cols)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cols)) } catch {}
  }

  const toggleColumn = (key: string) => {
    const next = columns.includes(key) ? columns.filter(c=>c!==key) : [...columns, key]
    saveColumns(next)
  }

  const handleDragStart = (col: string) => { setDragCol(col) }
  const handleDragOver = (e: React.DragEvent, col: string) => {
    e.preventDefault()
    setDragOver(col)
    if (!dragCol || dragCol === col) return
    const from = columns.indexOf(dragCol)
    const to = columns.indexOf(col)
    if (from === -1 || to === -1) return
    const next = [...columns]
    next.splice(from, 1)
    next.splice(to, 0, dragCol)
    setColumns(next)
  }
  const handleDrop = () => {
    setDragCol(null); setDragOver(null)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(columns)) } catch {}
  }

  const handleCvUpload = async (file: File) => {
    setCvFile(file); setExtracting(true); setExtractError('')
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch(`${API}/hr/cv/extract`, { method:'POST', body:fd })
      const d = await r.json()
      if (d.error) { setExtractError(d.error); setExtracted({}) }
      else setExtracted(d.extracted || {})
    } catch { setExtractError('Extraction failed — fill fields manually'); setExtracted({}) }
    finally { setExtracting(false) }
  }

  const filtered = freelancers.filter(f =>
    `${f.first_name} ${f.last_name} ${f.current_title} ${(f.skills||[]).join(' ')} ${f.country}`.toLowerCase().includes(search.toLowerCase())
  )

  const colDef = (key: string) => ALL_COLUMNS.find(c => c.key === key)

  return (
    <HRLayout>
      <div style={{ padding:'28px 32px' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#156082', marginBottom:'4px' }}>🔗 Freelancer Database</h1>
            <p style={{ fontSize:'12px', color:'#45B6E4' }}>{filtered.length} freelancer{filtered.length!==1?'s':''}</p>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => setShowCustomize(v => !v)}
              style={{ background: showCustomize ? '#EFF6FF' : 'white', color:'#156082', border:`1.5px solid ${showCustomize?'#156082':'#EDF2F7'}`, padding:'8px 16px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
              ⚙ Columns ({columns.length})
            </button>
            <button onClick={() => setShowModal(true)}
              style={{ background:'#156082', color:'white', border:'none', padding:'9px 18px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
              + Add Freelancer
            </button>
          </div>
        </div>

        {/* Column customizer panel */}
        {showCustomize && (
          <div style={{ background:'white', border:'1px solid #EDF2F7', borderRadius:'12px', padding:'18px 20px', marginBottom:'16px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
              <span style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4' }}>Customize Columns</span>
              <span style={{ fontSize:'11px', color:'#94A3B8' }}>Click to toggle · Drag to reorder · Saved automatically</span>
            </div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              {ALL_COLUMNS.map(col => {
                const active = columns.includes(col.key)
                const pos = columns.indexOf(col.key)
                const isDraggingOver = dragOver === col.key && dragCol !== col.key
                return (
                  <div key={col.key}
                    draggable={active}
                    onDragStart={() => handleDragStart(col.key)}
                    onDragOver={e => active && handleDragOver(e, col.key)}
                    onDrop={handleDrop}
                    onDragEnd={handleDrop}
                    onClick={() => toggleColumn(col.key)}
                    style={{
                      display:'flex', alignItems:'center', gap:'5px',
                      padding:'6px 12px', borderRadius:'20px',
                      border:`1.5px solid ${isDraggingOver ? '#156082' : active ? '#45B6E4' : '#EDF2F7'}`,
                      background: isDraggingOver ? '#EFF6FF' : active ? '#F0F9FF' : 'white',
                      cursor: active ? 'grab' : 'pointer',
                      fontSize:'11px', fontWeight:'700',
                      color: active ? '#156082' : '#94A3B8',
                      userSelect:'none' as const,
                      opacity: dragCol === col.key ? 0.5 : 1,
                      transition:'all 0.1s',
                    }}>
                    {active && <span style={{ fontSize:'9px', color:'#94A3B8', minWidth:'12px', textAlign:'center' }}>{pos+1}</span>}
                    {active && <span style={{ color:'#CBD5E1', fontSize:'11px', letterSpacing:'-1px' }}>⋮⋮</span>}
                    {col.label}
                    {active && <span style={{ color:'#45B6E4', fontSize:'12px' }}>✓</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Search */}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, skills, country..."
          style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', marginBottom:'12px', outline:'none', boxSizing:'border-box' as const }}/>

        {/* Report table */}
        <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:'48px', color:'#45B6E4' }}>Loading...</div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'Montserrat, sans-serif' }}>
                <thead>
                  <tr style={{ background:'#FAFBFC', borderBottom:'2px solid #EDF2F7' }}>
                    {columns.map(col => (
                      <th key={col} style={{ padding:'10px 16px', textAlign:'left', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', whiteSpace:'nowrap' }}>
                        {colDef(col)?.label || col}
                      </th>
                    ))}
                    <th style={{ padding:'10px 16px', width:'40px' }}/>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f, i) => (
                    <tr key={f.id}
                      onClick={() => router.push(`/rh/freelancers/${f.id}`)}
                      style={{ borderBottom:'1px solid #F9FAFB', cursor:'pointer', background: i%2===0 ? 'white' : '#FAFBFC' }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background='#EFF6FF'}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = i%2===0 ? 'white' : '#FAFBFC'}>
                      {columns.map(col => (
                        <td key={col} style={{ padding:'11px 16px', fontSize:'12px', color:'#3F3F3F', fontWeight: (col==='first_name'||col==='last_name') ? '700' : '500', whiteSpace: col==='skills' ? 'normal' : 'nowrap', maxWidth: col==='current_title' ? '200px' : undefined, overflow:'hidden', textOverflow:'ellipsis' }}>
                          {cellValue(col, f)}
                        </td>
                      ))}
                      <td style={{ padding:'11px 16px', textAlign:'right' }}>
                        <span style={{ color:'#CBD5E1', fontSize:'16px' }}>›</span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={columns.length + 1} style={{ padding:'48px', textAlign:'center', color:'#45B6E4', fontSize:'13px' }}>
                        No freelancers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Modal */}
        {showModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(21,96,130,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(2px)' }}>
            <div style={{ background:'white', borderRadius:'14px', width:'640px', maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(21,96,130,0.25)' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #EDF2F7', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>New Freelancer</span>
                <button onClick={() => { setShowModal(false); setExtracted(null); setCvFile(null); setExtractError('') }} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#45B6E4' }}>×</button>
              </div>
              <FreelancerForm
                extracted={extracted} cvFile={cvFile} extracting={extracting} extractError={extractError}
                onCvUpload={handleCvUpload} fileRef={fileRef}
                onSave={async (data:any) => {
                  try {
                    const r = await fetch(`${API}/hr/freelancers`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })
                    if (!r.ok) throw new Error(`Server error ${r.status}`)
                    const d = await r.json()
                    if (cvFile && d.id) {
                      const fd = new FormData(); fd.append('file', cvFile)
                      await fetch(`${API}/hr/cv/upload/${d.id}`, { method:'POST', body:fd })
                    }
                    setShowModal(false); setExtracted(null); setCvFile(null); setExtractError(''); load()
                  } catch (e: any) { alert(`Save failed: ${e.message}`) }
                }}
                onCancel={() => { setShowModal(false); setExtracted(null); setCvFile(null); setExtractError('') }}
              />
            </div>
          </div>
        )}
      </div>
    </HRLayout>
  )
}

function FreelancerForm({ extracted, cvFile, extracting, extractError, onCvUpload, fileRef, onSave, onCancel }: any) {
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
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.odt,.rtf" style={{ display:'none' }} onChange={e => e.target.files?.[0] && onCvUpload(e.target.files[0])}/>
          {extracting ? <div style={{ color:'#45B6E4', fontSize:'13px' }}>⏳ Extracting CV data with Claude AI...</div>
          : extractError ? <div style={{ color:'#D97706', fontSize:'13px' }}>⚠️ {extractError} — fill fields manually below</div>
          : cvFile && extracted && Object.keys(extracted).length > 0 ? <div style={{ color:'#059669', fontSize:'13px' }}>✅ {cvFile.name} — fields auto-filled</div>
          : cvFile ? <div style={{ color:'#45B6E4', fontSize:'13px' }}>📎 {cvFile.name} — fill fields manually</div>
          : <div style={{ color:'#45B6E4', fontSize:'13px' }}>📄 Upload CV (PDF) — fields will be auto-filled by Claude AI</div>}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          {([['first_name','First Name *'],['last_name','Last Name *'],['email','Email'],['phone','Phone'],['linkedin_url','LinkedIn URL'],['current_title','Current Title']] as [string,string][]).map(([key,label]) => (
            <div key={key}>
              <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>{label}</label>
              <input value={(form as any)[key]||''} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
                style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box' as const }}/>
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
              style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box' as const }}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Daily Rate (€)</label>
            <input type="number" value={form.daily_rate} onChange={e=>setForm(f=>({...f,daily_rate:e.target.value}))}
              style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box' as const }}/>
          </div>
        </div>

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

        {form.projects.length > 0 && (
          <div>
            <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'8px' }}>Projects from CV ({form.projects.length})</label>
            {form.projects.slice(0,3).map((p,i) => (
              <div key={i} style={{ padding:'8px 12px', background:'#F8FAFC', borderRadius:'8px', marginBottom:'6px', fontSize:'12px' }}>
                <strong>{p.title}</strong> @ {p.company} · {p.start_date} – {p.end_date}
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
