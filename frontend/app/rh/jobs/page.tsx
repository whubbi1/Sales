'use client'
import { useState, useEffect } from 'react'
import { HRLayout } from '@/components/HRLayout'

const API = 'https://api.whubbi.wcomply.com'

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editJob, setEditJob] = useState<any>(null)
  const [expanded, setExpanded] = useState<string|null>(null)

  const load = () => {
    fetch(`${API}/hr/jobs`).then(r=>r.json()).then(d=>setJobs(d.jobs||[])).finally(()=>setLoading(false))
  }
  useEffect(() => { load() }, [])

  const del = async (id: string) => {
    if (!confirm('Delete this job description?')) return
    await fetch(`${API}/hr/jobs/${id}`, { method:'DELETE' }); load()
  }

  return (
    <HRLayout>
      <div style={{ padding:'28px 32px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#156082', marginBottom:'4px' }}>📋 Job Descriptions</h1>
            <p style={{ fontSize:'12px', color:'#45B6E4' }}>{jobs.length} position{jobs.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => { setEditJob(null); setShowModal(true) }}
            style={{ background:'#156082', color:'white', border:'none', padding:'9px 18px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
            + New Job
          </button>
        </div>

        {loading && <div style={{ textAlign:'center', padding:'48px', color:'#45B6E4' }}>Loading...</div>}

        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {jobs.map(j => {
            const isOpen = expanded === j.id
            return (
              <div key={j.id} style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}
                  onClick={() => setExpanded(isOpen ? null : j.id)}>
                  <div style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>{j.title}</div>
                  <span style={{ color:'#45B6E4', fontSize:'14px' }}>{isOpen ? '▲' : '▼'}</span>
                </div>
                {isOpen && (
                  <div style={{ padding:'0 20px 20px', borderTop:'1px solid #F1F5F9' }}>
                    {j.description && <p style={{ fontSize:'13px', color:'#3F3F3F', lineHeight:'1.7', margin:'14px 0' }}>{j.description}</p>}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                      {j.responsibilities?.length > 0 && (
                        <div>
                          <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'8px' }}>Responsibilities</div>
                          <ul style={{ margin:0, paddingLeft:'18px' }}>
                            {j.responsibilities.map((r: string, i: number) => <li key={i} style={{ fontSize:'12px', color:'#3F3F3F', marginBottom:'4px' }}>{r}</li>)}
                          </ul>
                        </div>
                      )}
                      {j.requirements?.length > 0 && (
                        <div>
                          <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'8px' }}>Requirements</div>
                          <ul style={{ margin:0, paddingLeft:'18px' }}>
                            {j.requirements.map((r: string, i: number) => <li key={i} style={{ fontSize:'12px', color:'#3F3F3F', marginBottom:'4px' }}>{r}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:'8px', marginTop:'14px', justifyContent:'flex-end' }}>
                      <button onClick={() => { setEditJob(j); setShowModal(true) }}
                        style={{ padding:'6px 14px', background:'#EFF6FF', color:'#156082', border:'none', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>Edit</button>
                      <button onClick={() => del(j.id)}
                        style={{ padding:'6px 14px', background:'#FEF2F2', color:'#DC2626', border:'none', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {jobs.length === 0 && !loading && (
            <div style={{ textAlign:'center', padding:'48px', color:'#45B6E4', background:'white', borderRadius:'12px', border:'1px solid #EDF2F7' }}>No job descriptions yet.</div>
          )}
        </div>

        {showModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(21,96,130,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(2px)' }}>
            <div style={{ background:'white', borderRadius:'14px', width:'620px', maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(21,96,130,0.25)' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #EDF2F7', display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>{editJob ? 'Edit Job' : 'New Job Description'}</span>
                <button onClick={() => { setShowModal(false); setEditJob(null) }} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#45B6E4' }}>×</button>
              </div>
              <JobForm job={editJob}
                onSave={async (data: any) => {
                  try {
                    const url = editJob ? `${API}/hr/jobs/${editJob.id}` : `${API}/hr/jobs`
                    const method = editJob ? 'PUT' : 'POST'
                    const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })
                    if (!r.ok) throw new Error(`Server error ${r.status}`)
                    setShowModal(false); setEditJob(null); load()
                  } catch (e: any) { alert(e.message || 'Failed to save job') }
                }}
                onCancel={() => { setShowModal(false); setEditJob(null) }}
              />
            </div>
          </div>
        )}
      </div>
    </HRLayout>
  )
}

function JobForm({ job, onSave, onCancel }: any) {
  const [form, setForm] = useState({
    title: job?.title || '',
    description: job?.description || '',
    responsibilities: (job?.responsibilities || []) as string[],
    requirements: (job?.requirements || []) as string[],
  })
  const [respInput, setRespInput] = useState('')
  const [reqInput, setReqInput] = useState('')
  const [saving, setSaving] = useState(false)

  const addItem = (key: 'responsibilities' | 'requirements', val: string, clear: () => void) => {
    if (!val.trim()) return
    setForm(f => ({ ...f, [key]: [...f[key], val.trim()] }))
    clear()
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div style={{ overflowY:'auto', flex:1 }}>
      <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
        <div>
          <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Job Title *</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', outline:'none', boxSizing:'border-box' as const }}/>
        </div>
        <div>
          <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', resize:'vertical', minHeight:'70px', outline:'none', boxSizing:'border-box' as const }}/>
        </div>
        {([
          ['responsibilities', 'Responsibilities', respInput, setRespInput],
          ['requirements',     'Requirements',     reqInput,  setReqInput],
        ] as [keyof typeof form, string, string, (v: string) => void][]).map(([key, label, inp, setInp]) => (
          <div key={key}>
            <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>{label}</label>
            {(form[key] as string[]).map((r, i) => (
              <div key={i} style={{ display:'flex', gap:'6px', marginBottom:'5px' }}>
                <span style={{ flex:1, padding:'6px 10px', background:'#F8FAFC', borderRadius:'7px', fontSize:'12px', color:'#3F3F3F' }}>{r}</span>
                <button onClick={() => setForm(f => ({ ...f, [key]: (f[key] as string[]).filter((_, j) => j !== i) }))}
                  style={{ background:'#FEF2F2', color:'#DC2626', border:'none', borderRadius:'7px', padding:'0 10px', cursor:'pointer', fontSize:'14px' }}>×</button>
              </div>
            ))}
            <div style={{ display:'flex', gap:'6px' }}>
              <input value={inp} onChange={e => setInp(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { addItem(key as any, inp, () => setInp('')) } }}
                placeholder={`Add ${label.toLowerCase().slice(0, -1)}...`}
                style={{ flex:1, padding:'7px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none' }}/>
              <button onClick={() => addItem(key as any, inp, () => setInp(''))}
                style={{ padding:'7px 14px', background:'#156082', color:'white', border:'none', borderRadius:'7px', fontSize:'12px', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>+</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding:'14px 20px', borderTop:'1px solid #EDF2F7', background:'#FAFBFC', display:'flex', justifyContent:'flex-end', gap:'8px' }}>
        <button onClick={onCancel}
          style={{ padding:'8px 16px', background:'white', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'Montserrat, sans-serif', color:'#45B6E4' }}>Cancel</button>
        <button onClick={handleSave} disabled={!form.title.trim() || saving}
          style={{ padding:'8px 16px', background: form.title.trim() && !saving ? '#156082' : '#F1F5F9', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor: form.title.trim() && !saving ? 'pointer' : 'not-allowed', fontFamily:'Montserrat, sans-serif', color: form.title.trim() && !saving ? 'white' : '#45B6E4' }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
