'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { HRLayout } from '@/components/HRLayout'

const API = 'https://api.whubbi.wcomply.com'
const FLAG: Record<string,string> = { france:'🇫🇷', portugal:'🇵🇹', czech_republic:'🇨🇿', romania:'🇷🇴', spain:'🇪🇸' }
const STATUSES = ['new','screening','interview_1','interview_2','technical_test','offer','hired','rejected','on_hold']
const STATUS_COLOR: Record<string,string> = { new:'#45B6E4', screening:'#D97706', interview_1:'#7C3AED', interview_2:'#059669', technical_test:'#e97132', offer:'#156082', hired:'#059669', rejected:'#DC2626', on_hold:'#94A3B8' }
const STATUS_LABEL: Record<string,string> = { new:'New', screening:'Screening', interview_1:'Interview 1', interview_2:'Interview 2', technical_test:'Tech Test', offer:'Offer', hired:'Hired', rejected:'Rejected', on_hold:'On Hold' }
const COMMENT_TYPES = ['note','call','email','interview']
const COMMENT_ICONS: Record<string,string> = { note:'📝', call:'📞', email:'✉️', interview:'🎤' }
const COUNTRIES = ['france','portugal','czech_republic','romania','spain']
const CURRENCY: Record<string,string> = { france:'EUR', portugal:'EUR', czech_republic:'CZK', romania:'RON', spain:'EUR' }

export default function CandidateDetail() {
  const router = useRouter()
  const { id } = useParams() as { id: string }
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'profile'|'comments'|'proposal'>('profile')
  const [comment, setComment] = useState({ content:'', comment_type:'note', author_email:'william.delcour@wcomply.com', author_name:'William Delcour' })
  const [showProposal, setShowProposal] = useState(false)
  const [proposal, setProposal] = useState({ role:'', responsibilities:[] as string[], salary:'', advantages:[] as string[], start_date:'', country:'', resp_input:'', adv_input:'' })
  const [sending, setSending] = useState(false)
  const [proposalPreview, setProposalPreview] = useState<any>(null)

  const load = () => {
    fetch(`${API}/hr/recruitment/${id}`).then(r=>r.json()).then(setProfile).finally(()=>setLoading(false))
  }
  useEffect(() => { load() }, [id])
  useEffect(() => { if (profile) setProposal(p=>({...p, country:profile.country||'france'})) }, [profile])

  const updateStatus = async (status: string) => {
    await fetch(`${API}/hr/recruitment/${id}/status`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status}) })
    setProfile((p:any)=>({...p, recruitment_status:status}))
  }

  const addComment = async () => {
    if (!comment.content.trim()) return
    await fetch(`${API}/hr/recruitment/${id}/comments`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(comment) })
    setComment(c=>({...c, content:''})); load()
  }

  const createProposal = async () => {
    setSending(true)
    const r = await fetch(`${API}/hr/recruitment/${id}/proposals`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ role:proposal.role, responsibilities:proposal.responsibilities, salary:parseInt(proposal.salary)||0, advantages:proposal.advantages, start_date:proposal.start_date, country:proposal.country })
    })
    const d = await r.json()
    // Get preview
    const prev = await fetch(`${API}/hr/proposals/${d.id}/preview`).then(r=>r.json())
    setProposalPreview({...prev, id:d.id})
    setSending(false)
  }

  const sendProposal = async () => {
    if (!proposalPreview?.id) return
    setSending(true)
    await fetch(`${API}/hr/proposals/${proposalPreview.id}/send`, { method:'POST' })
    setSending(false); setShowProposal(false); setProposalPreview(null); load()
  }

  if (loading) return <HRLayout><div style={{ padding:'48px', textAlign:'center', color:'#45B6E4' }}>Loading...</div></HRLayout>
  if (!profile) return <HRLayout><div style={{ padding:'48px', textAlign:'center', color:'#DC2626' }}>Candidate not found</div></HRLayout>

  return (
    <HRLayout>
      <div style={{ padding:'28px 32px' }}>
        <button onClick={() => router.push('/rh/recrutement')} style={{ background:'none', border:'none', color:'#45B6E4', fontSize:'12px', fontWeight:'600', cursor:'pointer', marginBottom:'16px', fontFamily:'Montserrat, sans-serif', padding:0 }}>← Back</button>

        {/* Header */}
        <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'24px', marginBottom:'20px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
              <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'#7C3AED', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'20px', fontWeight:'800' }}>
                {(profile.first_name||'?')[0]}{(profile.last_name||'?')[0]}
              </div>
              <div>
                <h1 style={{ fontSize:'18px', fontWeight:'800', color:'#156082', margin:'0 0 4px' }}>{profile.first_name} {profile.last_name}</h1>
                <p style={{ fontSize:'13px', color:'#45B6E4', margin:0 }}>{profile.current_title} · {FLAG[profile.country]||'🌍'} {profile.country}</p>
              </div>
            </div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              {profile.cv_sharepoint_url && <a href={profile.cv_sharepoint_url} target="_blank" style={{ padding:'7px 14px', background:'#EFF6FF', color:'#156082', borderRadius:'8px', fontSize:'12px', fontWeight:'700', textDecoration:'none' }}>📄 CV</a>}
              <button onClick={() => setShowProposal(true)} style={{ padding:'7px 14px', background:'#059669', color:'white', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>📄 Send Proposal</button>
            </div>
          </div>

          {/* Status pipeline */}
          <div style={{ marginTop:'20px', paddingTop:'20px', borderTop:'1px solid #F1F5F9' }}>
            <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'10px' }}>Recruitment Status</div>
            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
              {STATUSES.map(s => (
                <button key={s} onClick={() => updateStatus(s)}
                  style={{ padding:'5px 12px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'10px', fontWeight:'700', fontFamily:'Montserrat, sans-serif', transition:'all 0.15s',
                    background: profile.recruitment_status===s ? STATUS_COLOR[s] : `${STATUS_COLOR[s]}15`,
                    color: profile.recruitment_status===s ? 'white' : STATUS_COLOR[s] }}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginTop:'16px', paddingTop:'16px', borderTop:'1px solid #F1F5F9' }}>
            {[{label:'Email',v:profile.email,href:`mailto:${profile.email}`},{label:'Phone',v:profile.phone,href:`tel:${profile.phone}`},{label:'LinkedIn',v:profile.linkedin_url?'Profile':null,href:profile.linkedin_url},{label:'Experience',v:`${profile.years_experience||0} years`}].map(i=>(
              <div key={i.label}>
                <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'3px' }}>{i.label}</div>
                {i.href&&i.v?<a href={i.href} target="_blank" style={{ fontSize:'12px', fontWeight:'600', color:'#156082', textDecoration:'none' }}>{i.v}</a>:<div style={{ fontSize:'12px', fontWeight:'600', color:'#3F3F3F' }}>{i.v||'—'}</div>}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginTop:'12px' }}>
            {(profile.skills||[]).map((s:string)=><span key={s} style={{ background:'#F3F4F6', color:'#7C3AED', padding:'2px 8px', borderRadius:'12px', fontSize:'10px', fontWeight:'600' }}>{s}</span>)}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'0', marginBottom:'16px', background:'white', borderRadius:'10px', border:'1px solid #EDF2F7', overflow:'hidden', width:'fit-content' }}>
          {[{key:'profile',label:'Profile & Projects'},{key:'comments',label:`Comments (${(profile.comments||[]).length})`},{key:'proposal',label:`Proposals (${(profile.proposals||[]).length})`}].map(t=>(
            <button key={t.key} onClick={()=>setActiveTab(t.key as any)}
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
            {(profile.projects||[]).length===0&&<div style={{ padding:'32px', textAlign:'center', color:'#45B6E4', fontSize:'13px' }}>No projects on record.</div>}
            {(profile.projects||[]).map((p:any,i:number)=>(
              <div key={p.id} style={{ padding:'16px 20px', borderBottom:'1px solid #F9FAFB', background:i%2===0?'white':'#FAFBFC' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
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
            {/* Add comment */}
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
                placeholder="Add a note, call log, or interview feedback..."
                style={{ width:'100%', padding:'10px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', resize:'vertical', minHeight:'70px', outline:'none', boxSizing:'border-box' }}/>
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'8px' }}>
                <button onClick={addComment} disabled={!comment.content.trim()}
                  style={{ padding:'7px 16px', background:comment.content.trim()?'#156082':'#F1F5F9', color:comment.content.trim()?'white':'#45B6E4', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:comment.content.trim()?'pointer':'not-allowed', fontFamily:'Montserrat, sans-serif' }}>
                  Add Note
                </button>
              </div>
            </div>
            {/* Comments list */}
            {(profile.comments||[]).map((c:any)=>(
              <div key={c.id} style={{ background:'white', borderRadius:'10px', border:'1px solid #EDF2F7', padding:'14px 18px', marginBottom:'10px', boxShadow:'0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
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
            {(profile.comments||[]).length===0&&<div style={{ textAlign:'center', padding:'32px', color:'#45B6E4', fontSize:'13px' }}>No comments yet.</div>}
          </div>
        )}

        {/* Proposals tab */}
        {activeTab === 'proposal' && (
          <div>
            {(profile.proposals||[]).length===0&&<div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'48px', textAlign:'center', color:'#45B6E4', fontSize:'13px' }}>No proposals sent yet.<br/><button onClick={()=>setShowProposal(true)} style={{ marginTop:'12px', background:'#059669', color:'white', border:'none', padding:'8px 18px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>Create First Proposal</button></div>}
            {(profile.proposals||[]).map((p:any)=>(
              <div key={p.id} style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'18px', marginBottom:'10px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>{p.role}</div>
                    <div style={{ fontSize:'11px', color:'#45B6E4' }}>{p.country} · {p.language} · {p.salary?.toLocaleString()} {CURRENCY[p.country]||'EUR'}/yr</div>
                  </div>
                  <span style={{ padding:'4px 12px', borderRadius:'12px', fontSize:'11px', fontWeight:'700', background:p.status==='signed'?'#ECFDF5':p.status==='sent'?'#EFF6FF':'#F1F5F9', color:p.status==='signed'?'#059669':p.status==='sent'?'#156082':'#94A3B8' }}>
                    {p.status?.charAt(0).toUpperCase()+p.status?.slice(1)}
                  </span>
                </div>
                {p.onboarding_token&&p.status==='signed'&&(
                  <div style={{ marginTop:'10px', padding:'8px 12px', background:'#ECFDF5', borderRadius:'8px', fontSize:'11px', color:'#059669' }}>
                    ✅ Onboarding link: {API}/hr/onboarding/{p.onboarding_token}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Proposal Modal */}
        {showProposal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(21,96,130,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(2px)' }}>
            <div style={{ background:'white', borderRadius:'14px', width:'680px', maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(21,96,130,0.25)' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #EDF2F7', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>📄 {proposalPreview ? 'Preview Proposal' : 'Create Proposal'}</span>
                <button onClick={() => { setShowProposal(false); setProposalPreview(null) }} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#45B6E4' }}>×</button>
              </div>
              <div style={{ overflowY:'auto', flex:1, padding:'20px' }}>
                {!proposalPreview ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                    <div>
                      <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Role / Position *</label>
                      <input value={proposal.role} onChange={e=>setProposal(p=>({...p,role:e.target.value}))} style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
                      <div>
                        <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Country</label>
                        <select value={proposal.country} onChange={e=>setProposal(p=>({...p,country:e.target.value}))} style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', outline:'none' }}>
                          {COUNTRIES.map(c=><option key={c} value={c}>{FLAG[c]} {c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Annual Salary ({CURRENCY[proposal.country]||'EUR'})</label>
                        <input type="number" value={proposal.salary} onChange={e=>setProposal(p=>({...p,salary:e.target.value}))} style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/>
                      </div>
                      <div>
                        <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Start Date</label>
                        <input value={proposal.start_date} onChange={e=>setProposal(p=>({...p,start_date:e.target.value}))} placeholder="e.g. 01/09/2026" style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/>
                      </div>
                    </div>
                    {/* Responsibilities */}
                    <div>
                      <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Responsibilities</label>
                      {proposal.responsibilities.map((r,i)=>(
                        <div key={i} style={{ display:'flex', gap:'6px', marginBottom:'5px' }}>
                          <span style={{ flex:1, padding:'7px 10px', background:'#F8FAFC', borderRadius:'7px', fontSize:'12px', color:'#3F3F3F' }}>{r}</span>
                          <button onClick={()=>setProposal(p=>({...p,responsibilities:p.responsibilities.filter((_,j)=>j!==i)}))} style={{ background:'#FEF2F2', color:'#DC2626', border:'none', borderRadius:'7px', padding:'0 10px', cursor:'pointer' }}>×</button>
                        </div>
                      ))}
                      <div style={{ display:'flex', gap:'6px' }}>
                        <input value={proposal.resp_input} onChange={e=>setProposal(p=>({...p,resp_input:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'&&proposal.resp_input.trim()){setProposal(p=>({...p,responsibilities:[...p.responsibilities,p.resp_input.trim()],resp_input:''}))  }}} placeholder="Add responsibility..." style={{ flex:1, padding:'7px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none' }}/>
                        <button onClick={()=>{if(proposal.resp_input.trim())setProposal(p=>({...p,responsibilities:[...p.responsibilities,p.resp_input.trim()],resp_input:''}))}} style={{ padding:'7px 14px', background:'#156082', color:'white', border:'none', borderRadius:'7px', fontSize:'12px', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>+</button>
                      </div>
                    </div>
                    {/* Advantages */}
                    <div>
                      <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>Company Advantages / Benefits</label>
                      {proposal.advantages.map((a,i)=>(
                        <div key={i} style={{ display:'flex', gap:'6px', marginBottom:'5px' }}>
                          <span style={{ flex:1, padding:'7px 10px', background:'#F8FAFC', borderRadius:'7px', fontSize:'12px', color:'#3F3F3F' }}>{a}</span>
                          <button onClick={()=>setProposal(p=>({...p,advantages:p.advantages.filter((_,j)=>j!==i)}))} style={{ background:'#FEF2F2', color:'#DC2626', border:'none', borderRadius:'7px', padding:'0 10px', cursor:'pointer' }}>×</button>
                        </div>
                      ))}
                      <div style={{ display:'flex', gap:'6px' }}>
                        <input value={proposal.adv_input} onChange={e=>setProposal(p=>({...p,adv_input:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'&&proposal.adv_input.trim()){setProposal(p=>({...p,advantages:[...p.advantages,p.adv_input.trim()],adv_input:''}))  }}} placeholder="e.g. Remote work, Health insurance, 25 days holiday..." style={{ flex:1, padding:'7px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none' }}/>
                        <button onClick={()=>{if(proposal.adv_input.trim())setProposal(p=>({...p,advantages:[...p.advantages,p.adv_input.trim()],adv_input:''}))}} style={{ padding:'7px 14px', background:'#156082', color:'white', border:'none', borderRadius:'7px', fontSize:'12px', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>+</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Preview */
                  <div style={{ background:'#F8FAFC', borderRadius:'10px', padding:'24px', fontFamily:'Arial, sans-serif' }}>
                    <div style={{ textAlign:'center', marginBottom:'20px' }}>
                      <div style={{ fontSize:'20px', fontWeight:'800', color:'#156082' }}>WCOMPLY</div>
                      <div style={{ fontSize:'12px', color:'#45B6E4' }}>Proposal Letter</div>
                    </div>
                    <p style={{ fontSize:'13px', marginBottom:'12px' }}>{proposalPreview.template?.greeting?.replace('{first_name}',profile.first_name).replace('{last_name}',profile.last_name)}</p>
                    <p style={{ fontSize:'13px', marginBottom:'16px', lineHeight:'1.6' }}>{proposalPreview.template?.intro?.replace('{role}',proposalPreview.proposal?.role)}</p>
                    <h4 style={{ fontSize:'13px', fontWeight:'700', color:'#156082', marginBottom:'8px' }}>{proposalPreview.template?.responsibilities_title}</h4>
                    <ul style={{ fontSize:'13px', marginBottom:'16px', paddingLeft:'20px' }}>
                      {(proposalPreview.proposal?.responsibilities||[]).map((r:string,i:number)=><li key={i} style={{ marginBottom:'4px' }}>{r}</li>)}
                    </ul>
                    <h4 style={{ fontSize:'13px', fontWeight:'700', color:'#156082', marginBottom:'4px' }}>{proposalPreview.template?.salary_label}</h4>
                    <p style={{ fontSize:'13px', marginBottom:'16px' }}>{proposalPreview.proposal?.salary?.toLocaleString()} {CURRENCY[proposalPreview.proposal?.country]||'EUR'} / an</p>
                    <h4 style={{ fontSize:'13px', fontWeight:'700', color:'#156082', marginBottom:'8px' }}>{proposalPreview.template?.advantages_title}</h4>
                    <ul style={{ fontSize:'13px', marginBottom:'16px', paddingLeft:'20px' }}>
                      {(proposalPreview.proposal?.advantages||[]).map((a:string,i:number)=><li key={i} style={{ marginBottom:'4px' }}>{a}</li>)}
                    </ul>
                    <p style={{ fontSize:'13px', marginBottom:'12px', lineHeight:'1.6' }}>{proposalPreview.template?.closing}</p>
                    <p style={{ fontSize:'13px', fontWeight:'700', color:'#156082' }}>{proposalPreview.template?.signature}</p>
                    <div style={{ marginTop:'20px', padding:'12px', background:'#ECFDF5', borderRadius:'8px', fontSize:'11px', color:'#059669' }}>
                      ✅ This proposal will be sent via DocuSign for electronic signature to {profile.email}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ padding:'14px 20px', borderTop:'1px solid #EDF2F7', background:'#FAFBFC', display:'flex', justifyContent:'flex-end', gap:'8px' }}>
                {!proposalPreview ? (
                  <>
                    <button onClick={()=>{setShowProposal(false)}} style={{ padding:'8px 16px', background:'white', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'Montserrat, sans-serif', color:'#45B6E4' }}>Cancel</button>
                    <button onClick={createProposal} disabled={!proposal.role||sending}
                      style={{ padding:'8px 16px', background:proposal.role?'#059669':'#F1F5F9', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:proposal.role?'pointer':'not-allowed', fontFamily:'Montserrat, sans-serif', color:proposal.role?'white':'#45B6E4' }}>
                      {sending?'Generating...':'Preview Proposal'}
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={()=>setProposalPreview(null)} style={{ padding:'8px 16px', background:'white', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'Montserrat, sans-serif', color:'#45B6E4' }}>← Edit</button>
                    <button onClick={sendProposal} disabled={sending}
                      style={{ padding:'8px 16px', background:'#059669', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif', color:'white' }}>
                      {sending?'Sending...':'🚀 Send via DocuSign'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </HRLayout>
  )
}
