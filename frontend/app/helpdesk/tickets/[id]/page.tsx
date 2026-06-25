'use client'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'

const API = 'https://api.whubbi.wcomply.com'
const SS: Record<string,{bg:string;color:string;label:string}> = {
  new:{bg:'#EEF2FF',color:'#4F46E5',label:'New'},open:{bg:'#FFF7ED',color:'#D97706',label:'Open'},
  in_progress:{bg:'#EFF6FF',color:'#156082',label:'In Progress'},pending:{bg:'#F5F3FF',color:'#7C3AED',label:'Pending'},
  resolved:{bg:'#ECFDF5',color:'#059669',label:'Resolved'},closed:{bg:'#F1F5F9',color:'#45B6E4',label:'Closed'},
}
const PS: Record<string,{bg:string;color:string}> = {
  critical:{bg:'#FEF2F2',color:'#DC2626'},high:{bg:'#FFF7ED',color:'#D97706'},
  medium:{bg:'#EFF6FF',color:'#156082'},low:{bg:'#F1F5F9',color:'#45B6E4'},
}

export default function TicketDetailPage() {
  const {id} = useParams()
  const router = useRouter()
  const [ticket, setTicket] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [ef, setEf] = useState<any>({})

  const load = async () => {
    const r = await fetch(`${API}/helpdesk/tickets/${id}`)
    const d = await r.json()
    setTicket(d.ticket); setComments(d.comments||[])
    setEf({status:d.ticket?.status,assignee_email:d.ticket?.assignee_email||'',assignee_name:d.ticket?.assignee_name||'',resolution:d.ticket?.resolution||''})
    setLoading(false)
  }

  useEffect(()=>{load()},[id])

  const addComment = async () => {
    if (!comment.trim()) return
    setSubmitting(true)
    await fetch(`${API}/helpdesk/tickets/${id}/comments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:comment,is_internal:isInternal,author_email:'admin@wcomply.com',author_name:'Admin'})})
    setComment(''); setSubmitting(false); load()
  }

  const save = async () => {
    await fetch(`${API}/helpdesk/tickets/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(ef)})
    setEditing(false); load()
  }

  if (loading) return <div style={{display:'flex'}}><Sidebar/><main style={{marginLeft:'220px',padding:'48px',color:'#45B6E4',fontFamily:'Montserrat, sans-serif'}}>Loading...</main></div>
  if (!ticket) return null

  const s=SS[ticket.status]||SS.new; const p=PS[ticket.priority]||PS.medium
  const breached=ticket.sla_deadline&&new Date(ticket.sla_deadline)<new Date()&&!['resolved','closed'].includes(ticket.status)

  return (
    <div style={{display:'flex'}}>
      <Sidebar/>
      <main style={{marginLeft:'220px',minHeight:'100vh',width:'calc(100vw - 220px)',background:'#F5F7FA',fontFamily:'Montserrat, sans-serif'}}>
        <div style={{padding:'24px 32px'}}>
          {/* Breadcrumb */}
          <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'16px',fontSize:'11px'}}>
            <button onClick={()=>router.push('/helpdesk')} style={{border:'none',background:'none',color:'#45B6E4',cursor:'pointer',fontWeight:'600',fontFamily:'Montserrat, sans-serif',fontSize:'11px',padding:0}}>Helpdesk</button>
            <span style={{color:'#45B6E4'}}>/</span>
            <button onClick={()=>router.push('/helpdesk/tickets')} style={{border:'none',background:'none',color:'#45B6E4',cursor:'pointer',fontWeight:'600',fontFamily:'Montserrat, sans-serif',fontSize:'11px',padding:0}}>Tickets</button>
            <span style={{color:'#45B6E4'}}>/</span>
            <span style={{color:'#156082',fontWeight:'700'}}>{ticket.ticket_number}</span>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 290px',gap:'20px',alignItems:'start'}}>
            {/* Left */}
            <div>
              {/* Header card */}
              <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'24px',marginBottom:'16px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px'}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px',flexWrap:'wrap'}}>
                      <span style={{fontSize:'12px',fontWeight:'700',color:'#45B6E4'}}>{ticket.ticket_number}</span>
                      <span style={{background:s.bg,color:s.color,padding:'3px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:'700'}}>{s.label}</span>
                      <span style={{background:p.bg,color:p.color,padding:'3px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:'700',textTransform:'capitalize'}}>{ticket.priority}</span>
                      {ticket.category_name&&<span style={{background:(ticket.category_color||'#45B6E4')+'20',color:ticket.category_color||'#45B6E4',padding:'3px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:'600'}}>{ticket.category_icon} {ticket.category_name}</span>}
                    </div>
                    <h1 style={{fontSize:'17px',fontWeight:'800',color:'#156082',margin:0}}>{ticket.title}</h1>
                  </div>
                  <button onClick={()=>setEditing(!editing)} style={{background:editing?'#e97132':'white',color:editing?'white':'#156082',border:'1.5px solid #45B6E4',padding:'7px 14px',borderRadius:'7px',fontSize:'12px',fontWeight:'600',cursor:'pointer',fontFamily:'Montserrat, sans-serif',flexShrink:0,marginLeft:'12px'}}>
                    {editing?'✕ Cancel':'✎ Edit'}
                  </button>
                </div>
                {ticket.description&&<div style={{background:'#F8FAFC',borderRadius:'8px',padding:'14px',fontSize:'13px',color:'#3F3F3F',lineHeight:'1.7',whiteSpace:'pre-wrap'}}>{ticket.description}</div>}

                {editing&&(
                  <div style={{marginTop:'16px',padding:'16px',background:'#F0F9FF',borderRadius:'10px',border:'1px solid #BAE6FD',display:'flex',flexDirection:'column',gap:'12px'}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                      <div><label className="form-label">Status</label>
                        <select className="form-input" value={ef.status} onChange={e=>setEf((p:any)=>({...p,status:e.target.value}))}>
                          {Object.entries(SS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </div>
                      <div><label className="form-label">Assignee</label><input className="form-input" value={ef.assignee_name} onChange={e=>setEf((p:any)=>({...p,assignee_name:e.target.value}))} placeholder="Agent name"/></div>
                      <div><label className="form-label">Assignee Email</label><input className="form-input" value={ef.assignee_email} onChange={e=>setEf((p:any)=>({...p,assignee_email:e.target.value}))} placeholder="agent@wcomply.com"/></div>
                    </div>
                    {['resolved','closed'].includes(ef.status)&&<div><label className="form-label">Resolution</label><textarea className="form-input" value={ef.resolution} onChange={e=>setEf((p:any)=>({...p,resolution:e.target.value}))} rows={3} placeholder="How was this resolved?"/></div>}
                    <div style={{display:'flex',justifyContent:'flex-end'}}><button onClick={save} style={{background:'#156082',color:'white',border:'none',padding:'8px 20px',borderRadius:'7px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'Montserrat, sans-serif'}}>Save Changes</button></div>
                  </div>
                )}
              </div>

              {/* Comments */}
              <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                <h3 style={{fontSize:'11px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',marginBottom:'20px'}}>Activity & Comments ({comments.length})</h3>
                <div style={{display:'flex',flexDirection:'column',gap:'14px',marginBottom:'20px'}}>
                  {comments.length===0&&<p style={{color:'#45B6E4',fontSize:'13px'}}>No comments yet.</p>}
                  {comments.map((c:any)=>(
                    <div key={c.id} style={{display:'flex',gap:'12px'}}>
                      <div style={{width:'32px',height:'32px',borderRadius:'50%',background:c.is_internal?'#FFF7ED':'#EFF6FF',color:c.is_internal?'#D97706':'#156082',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:'800',flexShrink:0}}>
                        {c.author_name?.[0]?.toUpperCase()||'?'}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
                          <span style={{fontSize:'12px',fontWeight:'700',color:'#156082'}}>{c.author_name||c.author_email}</span>
                          <span style={{fontSize:'11px',color:'#45B6E4'}}>{new Date(c.created_at).toLocaleString()}</span>
                          {c.is_internal&&<span style={{background:'#FFF7ED',color:'#D97706',padding:'1px 7px',borderRadius:'10px',fontSize:'10px',fontWeight:'700'}}>🔒 Internal Note</span>}
                        </div>
                        <div style={{background:c.is_internal?'#FFFBEB':'#F8FAFC',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',color:'#3F3F3F',lineHeight:'1.6',border:`1px solid ${c.is_internal?'#FDE68A':'#EDF2F7'}`,whiteSpace:'pre-wrap'}}>{c.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{borderTop:'1px solid #EDF2F7',paddingTop:'16px'}}>
                  <textarea className="form-input" value={comment} onChange={e=>setComment(e.target.value)} placeholder="Add a reply or note..." rows={3} style={{marginBottom:'10px'}}/>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',fontSize:'12px',color:'#45B6E4',fontWeight:'600'}}>
                      <input type="checkbox" checked={isInternal} onChange={e=>setIsInternal(e.target.checked)}/> Internal note only
                    </label>
                    <button onClick={addComment} disabled={submitting||!comment.trim()} style={{background:'#156082',color:'white',border:'none',padding:'8px 20px',borderRadius:'7px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'Montserrat, sans-serif',opacity:(submitting||!comment.trim())?0.6:1}}>
                      {submitting?'Sending...':isInternal?'🔒 Add Note':'💬 Reply'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
              <div style={{background:breached?'#FEF2F2':'white',borderRadius:'12px',border:`1px solid ${breached?'#FECACA':'#EDF2F7'}`,padding:'16px'}}>
                <div style={{fontSize:'10px',fontWeight:'700',textTransform:'uppercase',color:breached?'#DC2626':'#45B6E4',marginBottom:'8px'}}>SLA Status</div>
                <div style={{fontSize:'13px',fontWeight:'700',color:breached?'#DC2626':'#059669'}}>{breached?'⚠️ SLA Breached':'✅ Within SLA'}</div>
                {ticket.sla_deadline&&<div style={{fontSize:'11px',color:'#45B6E4',marginTop:'4px'}}>Deadline: {new Date(ticket.sla_deadline).toLocaleString()}</div>}
              </div>

              <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'16px'}}>
                <div style={{fontSize:'10px',fontWeight:'700',textTransform:'uppercase',color:'#45B6E4',marginBottom:'12px'}}>Ticket Details</div>
                {[
                  {label:'Requester',value:ticket.requester_name||ticket.requester_email},
                  {label:'Email',value:ticket.requester_email},
                  {label:'Type',value:ticket.requester_type==='internal'?'🏢 Internal':'🌐 External'},
                  {label:'Assignee',value:ticket.assignee_name||ticket.assignee_email||'—'},
                  {label:'Created',value:new Date(ticket.created_at).toLocaleString()},
                  {label:'Updated',value:new Date(ticket.updated_at).toLocaleString()},
                  {label:'Resolved',value:ticket.resolved_at?new Date(ticket.resolved_at).toLocaleString():'—'},
                ].map(item=>(
                  <div key={item.label} style={{padding:'7px 0',borderBottom:'1px solid #F1F5F9'}}>
                    <div style={{fontSize:'10px',fontWeight:'700',textTransform:'uppercase',color:'#45B6E4',marginBottom:'2px'}}>{item.label}</div>
                    <div style={{fontSize:'12px',color:'#3F3F3F',fontWeight:'500'}}>{item.value}</div>
                  </div>
                ))}
              </div>

              {ticket.resolution&&(
                <div style={{background:'#ECFDF5',borderRadius:'12px',border:'1px solid #A7F3D0',padding:'16px'}}>
                  <div style={{fontSize:'10px',fontWeight:'700',textTransform:'uppercase',color:'#059669',marginBottom:'8px'}}>Resolution</div>
                  <p style={{fontSize:'12px',color:'#3F3F3F',lineHeight:'1.6',margin:0,whiteSpace:'pre-wrap'}}>{ticket.resolution}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
