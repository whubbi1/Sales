'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { HRLayout } from '@/components/HRLayout'

const API = 'https://api.whubbi.wcomply.com'
const FLAG: Record<string,string> = { france:'🇫🇷', portugal:'🇵🇹', czech_republic:'🇨🇿', romania:'🇷🇴', spain:'🇪🇸' }
const COUNTRIES = ['france','portugal','czech_republic','romania','spain']
const STATUSES = [
  { value:'open',    label:'Open',    color:'#059669', bg:'#ECFDF5' },
  { value:'on_hold', label:'On Hold', color:'#D97706', bg:'#FFF7ED' },
  { value:'closed',  label:'Closed',  color:'#94A3B8', bg:'#F1F5F9' },
]
const STAGE_COLORS: Record<string,string> = {
  new:'#45B6E4', screening:'#7C3AED', interview:'#e97132', technical:'#156082', offer:'#059669'
}

const EMPTY_FORM = { title:'', country:'france', job_description_id:'', status:'open' }

export default function JobPositionsPage() {
  const router = useRouter()
  const [positions, setPositions] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPos, setEditingPos] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [filterCountry, setFilterCountry] = useState('all')
  const [filterStatus, setFilterStatus] = useState('open')

  const load = async () => {
    setLoading(true)
    const [posRes, jobRes] = await Promise.all([
      fetch(`${API}/hr/positions`).then(r=>r.json()),
      fetch(`${API}/hr/jobs`).then(r=>r.json()),
    ])
    setPositions(posRes.positions || [])
    setJobs(jobRes.jobs || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditingPos(null); setForm(EMPTY_FORM); setSaveError(''); setShowModal(true) }
  const openEdit = (pos: any) => {
    setEditingPos(pos)
    setForm({ title: pos.title, country: pos.country, job_description_id: pos.job_description_id||'', status: pos.status })
    setSaveError(''); setShowModal(true)
  }

  const [saveError, setSaveError] = useState('')

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true); setSaveError('')
    try {
      const body = { ...form, job_description_id: form.job_description_id || null }
      const url = editingPos ? `${API}/hr/positions/${editingPos.id}` : `${API}/hr/positions`
      const method = editingPos ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSaveError(err.detail || `Server error ${res.status}`)
        return
      }
      setShowModal(false); setSaveError(''); load()
    } catch(e: any) {
      setSaveError(e.message || 'Network error — check your connection')
    } finally {
      setSaving(false)
    }
  }

  const deletePos = async (id: string) => {
    if (!confirm('Delete this position?')) return
    await fetch(`${API}/hr/positions/${id}`, { method:'DELETE' })
    load()
  }

  const filtered = positions.filter(p =>
    (filterCountry === 'all' || p.country === filterCountry) &&
    (filterStatus === 'all' || p.status === filterStatus)
  )

  // Group by country for display
  const byCountry = COUNTRIES.reduce((acc: any, c) => {
    const ps = filtered.filter(p => p.country === c)
    if (ps.length) acc[c] = ps
    return acc
  }, {} as Record<string, any[]>)

  // Summary stats
  const totalOpen = positions.filter(p => p.status === 'open').length
  const totalCandidates = positions.reduce((s, p) => s + (p.total_count || 0), 0)
  const totalHired = positions.reduce((s, p) => s + (p.hired_count || 0), 0)
  const totalActive = positions.reduce((s, p) => s + (p.active_count || 0), 0)

  return (
    <HRLayout>
      <div style={{ padding:'28px 32px' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
          <div>
            <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#156082', marginBottom:'4px' }}>💼 Job Positions</h1>
            <p style={{ fontSize:'12px', color:'#45B6E4' }}>Open roles per country · assign candidates · track pipeline</p>
          </div>
          <button onClick={openCreate}
            style={{ background:'#156082', color:'white', border:'none', padding:'9px 18px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif', flexShrink:0 }}>
            + New Position
          </button>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'14px', marginBottom:'24px' }}>
          {[
            { label:'Open Positions', value: totalOpen, color:'#156082', icon:'💼' },
            { label:'Active Candidates', value: totalActive, color:'#45B6E4', icon:'👥' },
            { label:'Total Candidates', value: totalCandidates, color:'#7C3AED', icon:'📊' },
            { label:'Hired', value: totalHired, color:'#059669', icon:'✅' },
          ].map(s => (
            <div key={s.label} style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'16px 20px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:'22px', marginBottom:'6px' }}>{s.icon}</div>
              <div style={{ fontSize:'22px', fontWeight:'800', color: s.color }}>{s.value}</div>
              <div style={{ fontSize:'11px', color:'#94A3B8', fontWeight:'600' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'20px', flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:'11px', fontWeight:'700', color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.05em' }}>Filter:</span>
          {['all','open','on_hold','closed'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding:'5px 12px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:'700', fontFamily:'Montserrat, sans-serif',
                background: filterStatus===s ? '#156082' : '#F1F5F9', color: filterStatus===s ? 'white' : '#45B6E4' }}>
              {s === 'all' ? 'All' : s === 'open' ? 'Open' : s === 'on_hold' ? 'On Hold' : 'Closed'}
            </button>
          ))}
          <span style={{ width:'1px', height:'20px', background:'#EDF2F7', margin:'0 4px' }}/>
          {['all',...COUNTRIES].map(c => (
            <button key={c} onClick={() => setFilterCountry(c)}
              style={{ padding:'5px 12px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:'700', fontFamily:'Montserrat, sans-serif',
                background: filterCountry===c ? '#45B6E4' : '#F1F5F9', color: filterCountry===c ? 'white' : '#45B6E4' }}>
              {c === 'all' ? 'All Countries' : `${FLAG[c]} ${c}`}
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign:'center', padding:'48px', color:'#45B6E4' }}>Loading...</div>}

        {!loading && filtered.length === 0 && (
          <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'48px', textAlign:'center' }}>
            <div style={{ fontSize:'32px', marginBottom:'12px' }}>💼</div>
            <div style={{ fontSize:'14px', fontWeight:'700', color:'#156082', marginBottom:'6px' }}>No positions yet</div>
            <div style={{ fontSize:'12px', color:'#45B6E4', marginBottom:'16px' }}>Create your first open position to start tracking candidates.</div>
            <button onClick={openCreate} style={{ background:'#156082', color:'white', border:'none', padding:'9px 18px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>+ New Position</button>
          </div>
        )}

        {/* Positions grouped by country */}
        {!loading && Object.entries(byCountry).map(([country, pos]) => (
          <div key={country} style={{ marginBottom:'24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
              <span style={{ fontSize:'18px' }}>{FLAG[country]||'🌍'}</span>
              <span style={{ fontSize:'13px', fontWeight:'800', color:'#156082', textTransform:'capitalize' }}>{country.replace('_',' ')}</span>
              <span style={{ background:'#EFF6FF', color:'#156082', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:'700' }}>{(pos as any[]).length}</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {(pos as any[]).map((p: any) => {
                const st = STATUSES.find(s => s.value === p.status) || STATUSES[0]
                return (
                  <div key={p.id} style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'16px 20px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'12px' }}>
                      {/* Left: title + meta */}
                      <div style={{ flex:1, minWidth:'200px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px', flexWrap:'wrap' }}>
                          <span style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>{p.title}</span>
                          <span style={{ background: st.bg, color: st.color, padding:'2px 8px', borderRadius:'10px', fontSize:'10px', fontWeight:'700' }}>{st.label}</span>
                          {p.jd_title && (
                            <span style={{ background:'#F3F4F6', color:'#7C3AED', padding:'2px 8px', borderRadius:'10px', fontSize:'10px', fontWeight:'600' }}>
                              📋 {p.jd_title}
                            </span>
                          )}
                        </div>

                        {/* Pipeline breakdown */}
                        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                          {[
                            { key:'cnt_new',       label:'New',       color:'#45B6E4', val: p.cnt_new || 0 },
                            { key:'cnt_screening', label:'Screening', color:'#7C3AED', val: p.cnt_screening || 0 },
                            { key:'cnt_interview', label:'Interview', color:'#e97132', val: p.cnt_interview || 0 },
                            { key:'cnt_technical', label:'Tech Test', color:'#156082', val: p.cnt_technical || 0 },
                            { key:'cnt_offer',     label:'Offer',     color:'#059669', val: p.cnt_offer || 0 },
                            { key:'hired_count',   label:'Hired',     color:'#059669', val: p.hired_count || 0 },
                          ].filter(s => s.val > 0).map(s => (
                            <span key={s.key} style={{ background:`${s.color}15`, color: s.color, padding:'2px 9px', borderRadius:'10px', fontSize:'11px', fontWeight:'700' }}>
                              {s.val} {s.label}
                            </span>
                          ))}
                          {p.total_count === 0 && (
                            <span style={{ fontSize:'11px', color:'#94A3B8', fontStyle:'italic' }}>No candidates assigned yet</span>
                          )}
                        </div>
                      </div>

                      {/* Right: total + actions */}
                      <div style={{ display:'flex', alignItems:'center', gap:'12px', flexShrink:0 }}>
                        {p.total_count > 0 && (
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontSize:'20px', fontWeight:'800', color:'#156082' }}>{p.total_count}</div>
                            <div style={{ fontSize:'10px', color:'#94A3B8', fontWeight:'600' }}>TOTAL</div>
                          </div>
                        )}
                        <div style={{ display:'flex', gap:'6px' }}>
                          <button onClick={() => router.push(`/rh/recrutement?position=${p.id}`)}
                            style={{ padding:'6px 12px', background:'#EFF6FF', color:'#156082', border:'none', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
                            👥 Candidates
                          </button>
                          <button onClick={() => openEdit(p)}
                            style={{ padding:'6px 12px', background:'#F1F5F9', color:'#45B6E4', border:'none', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
                            ✏️ Edit
                          </button>
                          <button onClick={() => deletePos(p.id)}
                            style={{ padding:'6px 10px', background:'#FEF2F2', color:'#DC2626', border:'none', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(21,96,130,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ background:'white', borderRadius:'14px', width:'480px', overflow:'hidden', boxShadow:'0 20px 60px rgba(21,96,130,0.25)' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #EDF2F7', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>{editingPos ? '✏️ Edit Position' : '+ New Position'}</span>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#45B6E4' }}>×</button>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Position Title *</label>
                <input value={form.title} onChange={e=>setForm((f:any)=>({...f,title:e.target.value}))}
                  placeholder="e.g. Senior Developer, HR Manager..."
                  style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', outline:'none', boxSizing:'border-box' as const }}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Country</label>
                  <select value={form.country} onChange={e=>setForm((f:any)=>({...f,country:e.target.value}))}
                    style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', outline:'none' }}>
                    {COUNTRIES.map(c=><option key={c} value={c}>{FLAG[c]} {c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Status</label>
                  <select value={form.status} onChange={e=>setForm((f:any)=>({...f,status:e.target.value}))}
                    style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', outline:'none' }}>
                    {STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Job Description</label>
                <select value={form.job_description_id} onChange={e=>setForm((f:any)=>({...f,job_description_id:e.target.value}))}
                  style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', outline:'none' }}>
                  <option value="">— Not linked —</option>
                  {jobs.map((j:any)=><option key={j.id} value={j.id}>{j.title} ({j.status})</option>)}
                </select>
                <div style={{ fontSize:'10px', color:'#94A3B8', marginTop:'4px' }}>Link to a Job Description to define responsibilities and requirements</div>
              </div>
            </div>
            {saveError && (
              <div style={{ padding:'10px 20px', background:'#FEF2F2', borderTop:'1px solid #FECACA' }}>
                <span style={{ fontSize:'12px', color:'#DC2626', fontWeight:'600' }}>⚠ {saveError}</span>
              </div>
            )}
            <div style={{ padding:'14px 20px', borderTop:'1px solid #EDF2F7', background:'#FAFBFC', display:'flex', justifyContent:'flex-end', gap:'8px' }}>
              <button onClick={() => { setShowModal(false); setSaveError('') }} style={{ padding:'8px 16px', background:'white', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'Montserrat, sans-serif', color:'#45B6E4' }}>Cancel</button>
              <button onClick={save} disabled={!form.title.trim() || saving}
                style={{ padding:'8px 20px', background: form.title.trim() && !saving ? '#156082' : '#F1F5F9', color: form.title.trim() && !saving ? 'white' : '#94A3B8', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor: form.title.trim() && !saving ? 'pointer' : 'not-allowed', fontFamily:'Montserrat, sans-serif' }}>
                {saving ? 'Saving…' : editingPos ? 'Save Changes' : 'Create Position'}
              </button>
            </div>
          </div>
        </div>
      )}
    </HRLayout>
  )
}
