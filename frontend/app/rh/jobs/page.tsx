'use client'
import { useState, useEffect } from 'react'
import { HRLayout } from '@/components/HRLayout'

const API = 'https://api.whubbi.wcomply.com'

const BTN = (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'ghost'|'danger'|'export' }) => {
  const { variant = 'ghost', style, ...rest } = props
  const base: React.CSSProperties = { fontFamily:'Montserrat, sans-serif', fontSize:'11px', fontWeight:'700', border:'none', borderRadius:'7px', cursor:'pointer', padding:'6px 13px', ...style }
  const vars: Record<string, React.CSSProperties> = {
    primary: { background:'#156082', color:'white' },
    ghost:   { background:'#EFF6FF', color:'#156082' },
    danger:  { background:'#FEF2F2', color:'#DC2626' },
    export:  { background:'#F0FDF4', color:'#15803D' },
  }
  return <button style={{ ...base, ...vars[variant] }} {...rest} />
}

export default function JobsPage() {
  const [jobs, setJobs]           = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editJob, setEditJob]     = useState<any>(null)
  const [expanded, setExpanded]   = useState<string|null>(null)
  const [companyDesc, setCompanyDesc] = useState('')
  const [descSaving, setDescSaving]   = useState(false)
  const [descSaved, setDescSaved]     = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`${API}/hr/jobs`).then(r => r.json()).then(d => setJobs(d.jobs || [])).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    fetch(`${API}/hr/settings/company-description`).then(r => r.json()).then(d => setCompanyDesc(d.description || ''))
  }, [])

  const del = async (id: string) => {
    if (!confirm('Delete this job description?')) return
    await fetch(`${API}/hr/jobs/${id}`, { method: 'DELETE' })
    load()
  }

  const downloadExport = async (job: any, format: 'pdf'|'docx') => {
    const res = await fetch(`${API}/hr/jobs/${job.id}/export?format=${format}`)
    if (!res.ok) { alert('Export failed'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${job.title.replace(/ /g,'_')}_job_description.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const saveCompanyDesc = async () => {
    setDescSaving(true)
    await fetch(`${API}/hr/settings/company-description`, {
      method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ description: companyDesc })
    })
    setDescSaving(false); setDescSaved(true)
    setTimeout(() => setDescSaved(false), 2000)
  }

  return (
    <HRLayout>
      <div style={{ padding:'28px 32px' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
          <div>
            <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#156082', marginBottom:'4px' }}>📋 Job Descriptions</h1>
            <p style={{ fontSize:'12px', color:'#45B6E4' }}>{jobs.length} description{jobs.length !== 1 ? 's' : ''}</p>
          </div>
          <BTN variant="primary" style={{ fontSize:'12px', padding:'9px 18px' }}
            onClick={() => { setEditJob(null); setShowModal(true) }}>
            + New Job Description
          </BTN>
        </div>

        {loading && <div style={{ textAlign:'center', padding:'48px', color:'#45B6E4' }}>Loading...</div>}

        {/* Job cards */}
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'40px' }}>
          {jobs.map(j => {
            const isOpen = expanded === j.id
            return (
              <div key={j.id} style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', userSelect:'none' }}
                  onClick={() => setExpanded(isOpen ? null : j.id)}>
                  <div style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>{j.title}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ fontSize:'10px', fontWeight:'700', color:'#45B6E4', background:'#EFF6FF', padding:'3px 9px', borderRadius:'20px' }}>
                      {j.status || 'open'}
                    </span>
                    <span style={{ color:'#45B6E4', fontSize:'13px' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop:'1px solid #F1F5F9' }}>
                    <div style={{ padding:'20px' }}>
                      {/* Description */}
                      {j.description && (
                        <Section label="Description">
                          <p style={{ fontSize:'13px', color:'#3F3F3F', lineHeight:'1.7', margin:0, whiteSpace:'pre-wrap' }}>{j.description}</p>
                        </Section>
                      )}

                      {/* Qualifications */}
                      {j.qualifications && (
                        <Section label="Qualifications">
                          <p style={{ fontSize:'13px', color:'#3F3F3F', lineHeight:'1.7', margin:0, whiteSpace:'pre-wrap' }}>{j.qualifications}</p>
                        </Section>
                      )}

                      {/* Must have + Nice to have */}
                      {(j.must_have?.length > 0 || j.nice_to_have?.length > 0) && (
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginTop: j.description || j.qualifications ? '16px' : 0 }}>
                          {j.must_have?.length > 0 && (
                            <div>
                              <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#156082', marginBottom:'8px' }}>
                                Must Have Competences
                              </div>
                              <ul style={{ margin:0, paddingLeft:'18px', display:'flex', flexDirection:'column', gap:'4px' }}>
                                {j.must_have.map((r: string, i: number) => (
                                  <li key={i} style={{ fontSize:'12px', color:'#3F3F3F' }}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {j.nice_to_have?.length > 0 && (
                            <div>
                              <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'8px' }}>
                                Nice to Have Competences
                              </div>
                              <ul style={{ margin:0, paddingLeft:'18px', display:'flex', flexDirection:'column', gap:'4px' }}>
                                {j.nice_to_have.map((r: string, i: number) => (
                                  <li key={i} style={{ fontSize:'12px', color:'#3F3F3F' }}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action bar */}
                    <div style={{ padding:'12px 20px', background:'#FAFBFC', borderTop:'1px solid #F1F5F9', display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                      <BTN variant="export" onClick={() => downloadExport(j, 'pdf')}>📄 PDF</BTN>
                      <BTN variant="export" onClick={() => downloadExport(j, 'docx')}>📝 Word</BTN>
                      <BTN variant="ghost" onClick={() => { setEditJob(j); setShowModal(true) }}>Edit</BTN>
                      <BTN variant="danger" onClick={() => del(j.id)}>Delete</BTN>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {jobs.length === 0 && !loading && (
            <div style={{ textAlign:'center', padding:'48px', color:'#45B6E4', background:'white', borderRadius:'12px', border:'1px solid #EDF2F7' }}>
              No job descriptions yet.
            </div>
          )}
        </div>

        {/* Company description section */}
        <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid #F1F5F9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>🏢 About WCOMPLY</div>
              <div style={{ fontSize:'11px', color:'#45B6E4', marginTop:'2px' }}>Included at the bottom of every exported job description</div>
            </div>
            <BTN variant="primary" onClick={saveCompanyDesc} disabled={descSaving}
              style={{ fontSize:'11px', padding:'7px 16px', opacity: descSaving ? 0.7 : 1 }}>
              {descSaved ? '✓ Saved' : descSaving ? 'Saving...' : 'Save'}
            </BTN>
          </div>
          <div style={{ padding:'16px 20px' }}>
            <textarea
              value={companyDesc}
              onChange={e => { setCompanyDesc(e.target.value); setDescSaved(false) }}
              placeholder="Enter a description of WCOMPLY to be included in all exported job descriptions..."
              style={{ width:'100%', minHeight:'120px', padding:'10px 14px', border:'1.5px solid #EDF2F7', borderRadius:'8px',
                fontFamily:'Montserrat, sans-serif', fontSize:'12px', lineHeight:'1.7', resize:'vertical', outline:'none',
                boxSizing:'border-box', color:'#3F3F3F' }}
            />
          </div>
        </div>
      </div>

      {/* Create / Edit modal */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(21,96,130,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(2px)' }}>
          <div style={{ background:'white', borderRadius:'14px', width:'680px', maxHeight:'93vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(21,96,130,0.25)' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #EDF2F7', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>
                {editJob ? 'Edit Job Description' : 'New Job Description'}
              </span>
              <button onClick={() => { setShowModal(false); setEditJob(null) }}
                style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#45B6E4', lineHeight:1 }}>×</button>
            </div>
            <JobForm
              job={editJob}
              onSave={async (data: any) => {
                const url    = editJob ? `${API}/hr/jobs/${editJob.id}` : `${API}/hr/jobs`
                const method = editJob ? 'PUT' : 'POST'
                const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) })
                if (!r.ok) throw new Error(`Server error ${r.status}`)
                setShowModal(false); setEditJob(null); load()
              }}
              onCancel={() => { setShowModal(false); setEditJob(null) }}
            />
          </div>
        </div>
      )}
    </HRLayout>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:'16px' }}>
      <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'6px' }}>{label}</div>
      {children}
    </div>
  )
}

function JobForm({ job, onSave, onCancel }: { job: any; onSave: (d: any) => Promise<void>; onCancel: () => void }) {
  const toText = (arr: string[]) => (arr || []).join('\n')
  const toArr  = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean)

  const [title,         setTitle]         = useState(job?.title          || '')
  const [description,   setDescription]   = useState(job?.description    || '')
  const [qualifications,setQualifications]= useState(job?.qualifications || '')
  const [mustText,      setMustText]      = useState(toText(job?.must_have    || []))
  const [niceText,      setNiceText]      = useState(toText(job?.nice_to_have || []))
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true); setError('')
    try {
      await onSave({
        title,
        description,
        qualifications,
        must_have:    toArr(mustText),
        nice_to_have: toArr(niceText),
      })
    } catch (e: any) { setError(e.message || 'Failed to save'); setSaving(false) }
  }

  const TA_STYLE: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1.5px solid #EDF2F7', borderRadius: '8px',
    fontFamily: 'Montserrat, sans-serif', fontSize: '12px', outline: 'none',
    boxSizing: 'border-box', color: '#3F3F3F', resize: 'vertical',
    minHeight: '160px', lineHeight: '1.7',
  }

  const fields: [string, string, string, string, (v: string) => void][] = [
    ['Description',            '#45B6E4', 'Role overview, context, team...',                        description,    setDescription],
    ['Qualifications',         '#45B6E4', 'Education, years of experience, certifications...',      qualifications, setQualifications],
    ['Must Have Competences',  '#156082', 'One competence per line...',                             mustText,       setMustText],
    ['Nice to Have Competences','#45B6E4','One competence per line...',                             niceText,       setNiceText],
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div style={{ overflowY:'auto', flex:1, padding:'20px', display:'flex', flexDirection:'column', gap:'16px' }}>

        {/* Title */}
        <div>
          <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Job Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Software Engineer"
            style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px',
              fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box', color:'#3F3F3F' }} />
        </div>

        {/* 4 equal textareas */}
        {fields.map(([label, color, placeholder, value, setter]) => (
          <div key={label}>
            <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color, marginBottom:'5px' }}>
              {label}
              {(label === 'Must Have Competences' || label === 'Nice to Have Competences') && (
                <span style={{ marginLeft:'6px', fontSize:'9px', fontWeight:'400', textTransform:'none', color:'#94A3B8' }}>one per line</span>
              )}
            </label>
            <textarea value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} style={TA_STYLE} />
          </div>
        ))}

        {error && <div style={{ color:'#DC2626', fontSize:'12px' }}>{error}</div>}
      </div>

      <div style={{ padding:'14px 20px', borderTop:'1px solid #EDF2F7', background:'#FAFBFC', display:'flex', justifyContent:'flex-end', gap:'8px', flexShrink:0 }}>
        <BTN variant="ghost" onClick={onCancel} style={{ border:'1.5px solid #EDF2F7' }}>Cancel</BTN>
        <BTN variant="primary" onClick={handleSave} disabled={!title.trim() || saving}
          style={{ opacity: !title.trim() || saving ? 0.6 : 1, cursor: !title.trim() || saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving...' : 'Save'}
        </BTN>
      </div>
    </div>
  )
}
