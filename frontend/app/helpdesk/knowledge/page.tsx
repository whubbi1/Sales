'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'

const API = 'https://api.whubbi.wcomply.com'

export default function KnowledgePage() {
  const router = useRouter()
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState({title:'',content:'',category:'',tags:'',author_email:'admin@wcomply.com',author_name:'Admin',published:true})
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    const r = await fetch(`${API}/helpdesk/knowledge?${p}`)
    const d = await r.json()
    setArticles(d.articles||[])
    setLoading(false)
  }

  useEffect(()=>{load()},[search])

  const openArticle = async (id: string) => {
    const r = await fetch(`${API}/helpdesk/knowledge/${id}`)
    setSelected(await r.json())
  }

  const create = async () => {
    if (!form.title||!form.content) return
    setSaving(true)
    await fetch(`${API}/helpdesk/knowledge`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
    setSaving(false); setShowNew(false)
    setForm({title:'',content:'',category:'',tags:'',author_email:'admin@wcomply.com',author_name:'Admin',published:true})
    load()
  }

  const deleteArticle = async (id: string) => {
    if (!confirm('Delete this article?')) return
    await fetch(`${API}/helpdesk/knowledge/${id}`,{method:'DELETE'})
    setSelected(null); load()
  }

  const CATS = ['IT Infrastructure','SAP / ERP','Access & Security','Software','Hardware','General']

  return (
    <div style={{display:'flex'}}>
      <Sidebar/>
      <main style={{marginLeft:'220px',minHeight:'100vh',width:'calc(100vw - 220px)',background:'#F5F7FA',fontFamily:'Montserrat, sans-serif'}}>
        <div style={{padding:'28px 32px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
            <div>
              <button onClick={()=>router.push('/helpdesk')} style={{background:'none',border:'none',color:'#45B6E4',fontSize:'12px',cursor:'pointer',fontFamily:'Montserrat, sans-serif',fontWeight:'600',padding:0,marginBottom:'4px',display:'block'}}>← Dashboard</button>
              <h1 style={{fontSize:'20px',fontWeight:'800',color:'#156082',margin:0}}>📚 Knowledge Base</h1>
            </div>
            <button onClick={()=>setShowNew(true)} style={{background:'#156082',color:'white',border:'none',padding:'9px 20px',borderRadius:'8px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'Montserrat, sans-serif'}}>+ New Article</button>
          </div>

          <input className="form-input" style={{maxWidth:'400px',marginBottom:'20px'}} placeholder="Search articles..." value={search} onChange={e=>setSearch(e.target.value)}/>

          {selected ? (
            <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'28px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'20px'}}>
                <div>
                  <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',color:'#45B6E4',fontSize:'12px',cursor:'pointer',fontFamily:'Montserrat, sans-serif',fontWeight:'600',padding:0,marginBottom:'8px',display:'block'}}>← Back to list</button>
                  <h2 style={{fontSize:'18px',fontWeight:'800',color:'#156082',margin:'0 0 8px'}}>{selected.title}</h2>
                  <div style={{display:'flex',gap:'10px',fontSize:'11px',color:'#45B6E4'}}>
                    {selected.category&&<span style={{background:'#EFF6FF',color:'#156082',padding:'2px 8px',borderRadius:'10px',fontWeight:'600'}}>{selected.category}</span>}
                    <span>👁 {selected.views} views</span>
                    <span>By {selected.author_name}</span>
                    <span>{new Date(selected.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button onClick={()=>deleteArticle(selected.id)} style={{background:'#FEF2F2',color:'#DC2626',border:'none',padding:'7px 14px',borderRadius:'7px',fontSize:'12px',fontWeight:'600',cursor:'pointer',fontFamily:'Montserrat, sans-serif'}}>Delete</button>
              </div>
              {selected.tags&&<div style={{marginBottom:'16px',display:'flex',gap:'6px',flexWrap:'wrap'}}>{selected.tags.split(',').map((t:string)=>t.trim()).filter(Boolean).map((t:string)=><span key={t} style={{background:'#F1F5F9',color:'#45B6E4',padding:'2px 8px',borderRadius:'10px',fontSize:'11px',fontWeight:'600'}}>#{t}</span>)}</div>}
              <div style={{fontSize:'13px',color:'#3F3F3F',lineHeight:'1.8',whiteSpace:'pre-wrap'}}>{selected.content}</div>
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px'}}>
              {loading?<div style={{gridColumn:'1/-1',textAlign:'center',padding:'48px',color:'#45B6E4'}}>Loading...</div>:
               articles.length===0?<div style={{gridColumn:'1/-1',textAlign:'center',padding:'48px',color:'#45B6E4'}}>No articles found.</div>:
               articles.map(a=>(
                <div key={a.id} onClick={()=>openArticle(a.id)} style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'20px',cursor:'pointer',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',transition:'all 0.15s'}}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 12px rgba(21,96,130,0.1)';e.currentTarget.style.transform='translateY(-1px)'}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.06)';e.currentTarget.style.transform='none'}}>
                  {a.category&&<span style={{background:'#EFF6FF',color:'#156082',padding:'2px 8px',borderRadius:'10px',fontSize:'10px',fontWeight:'700',display:'inline-block',marginBottom:'8px'}}>{a.category}</span>}
                  <h3 style={{fontSize:'14px',fontWeight:'700',color:'#156082',margin:'0 0 8px',lineHeight:'1.4'}}>{a.title}</h3>
                  <p style={{fontSize:'12px',color:'#45B6E4',margin:'0 0 12px',lineHeight:'1.5'}}>{a.excerpt}...</p>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'11px',color:'#45B6E4'}}>
                    <span>By {a.author_name}</span>
                    <span>👁 {a.views} views</span>
                  </div>
                  {a.tags&&<div style={{marginTop:'8px',display:'flex',gap:'4px',flexWrap:'wrap'}}>{a.tags.split(',').map((t:string)=>t.trim()).filter(Boolean).slice(0,3).map((t:string)=><span key={t} style={{background:'#F1F5F9',color:'#45B6E4',padding:'1px 6px',borderRadius:'8px',fontSize:'10px'}}>#{t}</span>)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {showNew&&(
          <div style={{position:'fixed',inset:0,background:'rgba(21,96,130,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'20px',backdropFilter:'blur(2px)'}} onClick={()=>setShowNew(false)}>
            <div style={{background:'white',borderRadius:'14px',width:'100%',maxWidth:'640px',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(21,96,130,0.25)'}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:'18px 24px',borderBottom:'1px solid #EDF2F7',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h2 style={{fontSize:'15px',fontWeight:'800',color:'#156082',margin:0}}>New Knowledge Article</h2>
                <button onClick={()=>setShowNew(false)} style={{border:'none',background:'none',cursor:'pointer',fontSize:'20px',color:'#45B6E4'}}>×</button>
              </div>
              <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:'14px'}}>
                <div><label className="form-label">Title *</label><input className="form-input" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Article title"/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                  <div><label className="form-label">Category</label>
                    <select className="form-input" value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>
                      <option value="">Select...</option>
                      {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><label className="form-label">Tags (comma separated)</label><input className="form-input" value={form.tags} onChange={e=>setForm(p=>({...p,tags:e.target.value}))} placeholder="sap, access, vpn"/></div>
                </div>
                <div><label className="form-label">Content *</label><textarea className="form-input" value={form.content} onChange={e=>setForm(p=>({...p,content:e.target.value}))} rows={10} placeholder="Write the article content here..."/></div>
              </div>
              <div style={{padding:'14px 24px',borderTop:'1px solid #EDF2F7',display:'flex',justifyContent:'flex-end',gap:'10px',background:'#FAFBFC'}}>
                <button onClick={()=>setShowNew(false)} style={{background:'white',color:'#156082',border:'1.5px solid #45B6E4',padding:'7px 16px',borderRadius:'7px',fontSize:'12px',fontWeight:'600',cursor:'pointer',fontFamily:'Montserrat, sans-serif'}}>Cancel</button>
                <button onClick={create} disabled={saving||!form.title||!form.content} style={{background:'#156082',color:'white',border:'none',padding:'8px 20px',borderRadius:'7px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'Montserrat, sans-serif',opacity:(saving||!form.title||!form.content)?0.6:1}}>
                  {saving?'Publishing...':'Publish Article'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
