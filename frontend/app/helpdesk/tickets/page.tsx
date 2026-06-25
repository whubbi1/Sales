'use client'
import { useRouter } from 'next/navigation'
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

export default function TicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filters, setFilters] = useState({status:'',priority:'',search:''})
  const [form, setForm] = useState({title:'',description:'',category_id:'',priority:'medium',requester_email:'',requester_name:'',requester_type:'internal',assignee_email:'',assignee_name:''})
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (filters.status) p.set('status',filters.status)
    if (filters.priority) p.set('priority',filters.priority)
    if (filters.search) p.set('search',filters.search)
    const r = await fetch(`${API}/helpdesk/tickets?${p}`)
    const d = await r.json()
    setTickets(d.tickets||[]); setTotal(d.total||0); setLoading(false)
  }

  useEffect(()=>{load()},[filters])
  useEffect(()=>{fetch(`${API}/helpdesk/categories`).then(r=>r.json()).then(d=>setCategories(d.categories||[]))},[])

  const create = async () => {
    if (!form.title||!form.requester_email) return
    setSaving(true)
    await fetch(`${API}/helpdesk/tickets`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
    setSaving(false); setShowModal(false)
    setForm({title:'',description:'',category_id:'',priority:'medium',requester_email:'',requester_name:'',requester_type:'internal',assignee_email:'',assignee_name:''})
    load()
  }

  return (
    <div style={{display:'flex'}}>
      <Sidebar/>
      <main style={{marginLeft:'220px',minHeight:'100vh',width:'calc(100vw - 220px)',background:'#F5F7FA',fontFamily:'Montserrat, sans-serif'}}>
        <div style={{padding:'28px 32px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
            <div>
              <button onClick={()=>router.push('/helpdesk')} style={{background:'none',border:'none',color:'#45B6E4',fontSize:'12px',cursor:'pointer',fontFamily:'Montserrat, sans-serif',fontWeight:'600',padding:0,marginBottom:'4px',display:'block'}}>← Dashboard</button>
              <h1 style={{fontSize:'20px',fontWeight:'800',color:'#156082',margin:0}}>All Tickets ({total})</h1>
            </div>
            <button onClick={()=>setShowModal(true)} style={{background:'#156082',color:'white',border:'none',padding:'9px 20px',borderRadius:'8px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'Montserrat, sans-serif'}}>+ New Ticket</button>
          </div>

          {/* Filters */}
          <div style={{display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap'}}>
            <input className="form-input" style={{maxWidth:'260px'}} placeholder="Search..." value={filters.search} onChange={e=>setFilters(p=>({...p,search:e.target.value}))}/>
            <select className="form-input" style={{width:'160px'}} value={filters.status} onChange={e=>setFilters(p=>({...p,status:e.target.value}))}>
              <option value="">All statuses</option>
              {Object.entries(SS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="form-input" style={{width:'150px'}} value={filters.priority} onChange={e=>setFilters(p=>({...p,priority:e.target.value}))}>
              <option value="">All priorities</option>
              {['critical','high','medium','low'].map(p=><option key={p} value={p} style={{textTransform:'capitalize'}}>{p}</option>)}
            </select>
          </div>

          <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
              <thead style={{background:'#FAFBFC'}}>
                <tr>{['#','Title','Category','Priority','Status','Requester','Assignee','Created','SLA'].map(h=>(
                  <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:'10px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',borderBottom:'1px solid #EDF2F7',whiteSpace:'nowrap'}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {loading?<tr><td colSpan={9} style={{textAlign:'center',padding:'48px',color:'#45B6E4'}}>Loading...</td></tr>:
                 tickets.length===0?<tr><td colSpan={9} style={{textAlign:'center',padding:'48px',color:'#45B6E4'}}>No tickets found.</td></tr>:
                 tickets.map(t=>{
                  const p=PS[t.priority]||PS.medium; const s=SS[t.status]||SS.new
                  const breached=t.sla_deadline&&new Date(t.sla_deadline)<new Date()&&!['resolved','closed'].includes(t.status)
                  return (
                    <tr key={t.id} onClick={()=>router.push(`/helpdesk/tickets/${t.id}`)} style={{cursor:'pointer',borderBottom:'1px solid #F1F5F9'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#F8FAFC'}
                      onMouseLeave={e=>e.currentTarget.style.background='white'}>
                      <td style={{padding:'10px 14px',fontWeight:'700',color:'#156082',whiteSpace:'nowrap'}}>{t.ticket_number}</td>
                      <td style={{padding:'10px 14px',color:'#3F3F3F',maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</td>
                      <td style={{padding:'10px 14px'}}>{t.category_name&&<span style={{background:(t.category_color||'#45B6E4')+'20',color:t.category_color||'#45B6E4',padding:'2px 7px',borderRadius:'10px',fontSize:'11px',fontWeight:'600'}}>{t.category_icon} {t.category_name}</span>}</td>
                      <td style={{padding:'10px 14px'}}><span style={{background:p.bg,color:p.color,padding:'2px 8px',borderRadius:'10px',fontSize:'11px',fontWeight:'700',textTransform:'capitalize'}}>{t.priority}</span></td>
                      <td style={{padding:'10px 14px'}}><span style={{background:s.bg,color:s.color,padding:'2px 8px',borderRadius:'10px',fontSize:'11px',fontWeight:'700'}}>{s.label}</span></td>
                      <td style={{padding:'10px 14px',color:'#3F3F3F'}}>{t.requester_name||t.requester_email}</td>
                      <td style={{padding:'10px 14px',color:'#45B6E4'}}>{t.assignee_name||'—'}</td>
                      <td style={{padding:'10px 14px',color:'#45B6E4',whiteSpace:'nowrap'}}>{new Date(t.created_at).toLocaleDateString()}</td>
                      <td style={{padding:'10px 14px',whiteSpace:'nowrap'}}><span style={{color:breached?'#DC2626':'#059669',fontWeight:'700',fontSize:'11px'}}>{breached?'⚠️ Breached':'✅ OK'}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {showModal&&(
          <div style={{position:'fixed',inset:0,background:'rgba(21,96,130,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'20px',backdropFilter:'blur(2px)'}} onClick={()=>setShowModal(false)}>
            <div style={{background:'white',borderRadius:'14px',width:'100%',maxWidth:'580px',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(21,96,130,0.25)'}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:'18px 24px',borderBottom:'1px solid #EDF2F7',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h2 style={{fontSize:'15px',fontWeight:'800',color:'#156082',margin:0}}>New Support Ticket</h2>
                <button onClick={()=>setShowModal(false)} style={{border:'none',background:'none',cursor:'pointer',fontSize:'20px',color:'#45B6E4'}}>×</button>
              </div>
              <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:'14px'}}>
                <div><label className="form-label">Title *</label><input className="form-input" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Brief description of the issue"/></div>
                <div><label className="form-label">Description</label><textarea className="form-input" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Detailed description..." rows={3}/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                  <div><label className="form-label">Category</label>
                    <select className="form-input" value={form.category_id} onChange={e=>setForm(p=>({...p,category_id:e.target.value}))}>
                      <option value="">Select...</option>
                      {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                  </div>
                  <div><label className="form-label">Priority</label>
                    <select className="form-input" value={form.priority} onChange={e=>setForm(p=>({...p,priority:e.target.value}))}>
                      {['critical','high','medium','low'].map(p=><option key={p} value={p} style={{textTransform:'capitalize'}}>{p}</option>)}
                    </select>
                  </div>
                  <div><label className="form-label">Requester Email *</label><input className="form-input" type="email" value={form.requester_email} onChange={e=>setForm(p=>({...p,requester_email:e.target.value}))} placeholder="user@wcomply.com"/></div>
                  <div><label className="form-label">Requester Name</label><input className="form-input" value={form.requester_name} onChange={e=>setForm(p=>({...p,requester_name:e.target.value}))} placeholder="Full name"/></div>
                  <div><label className="form-label">Requester Type</label>
                    <select className="form-input" value={form.requester_type} onChange={e=>setForm(p=>({...p,requester_type:e.target.value}))}>
                      <option value="internal">Internal (WCOMPLY)</option>
                      <option value="external">External (Client)</option>
                    </select>
                  </div>
                  <div><label className="form-label">Assign To</label><input className="form-input" value={form.assignee_name} onChange={e=>setForm(p=>({...p,assignee_name:e.target.value}))} placeholder="Agent name"/></div>
                </div>
              </div>
              <div style={{padding:'14px 24px',borderTop:'1px solid #EDF2F7',display:'flex',justifyContent:'flex-end',gap:'10px',background:'#FAFBFC'}}>
                <button onClick={()=>setShowModal(false)} style={{background:'white',color:'#156082',border:'1.5px solid #45B6E4',padding:'7px 16px',borderRadius:'7px',fontSize:'12px',fontWeight:'600',cursor:'pointer',fontFamily:'Montserrat, sans-serif'}}>Cancel</button>
                <button onClick={create} disabled={saving||!form.title||!form.requester_email} style={{background:'#156082',color:'white',border:'none',padding:'8px 20px',borderRadius:'7px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'Montserrat, sans-serif',opacity:(saving||!form.title||!form.requester_email)?0.6:1}}>
                  {saving?'Creating...':'Create Ticket'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
