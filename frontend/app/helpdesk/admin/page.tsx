'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { API, BTN } from '../constants'

export default function HelpdeskAdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'categories'|'groups'|'users'>('categories')
  const [categories, setCategories] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Forms
  const [newCat, setNewCat] = useState({ name:'',description:'',color:'#45B6E4',icon:'🎫',parent_id:'',group_id:'' })
  const [newGroup, setNewGroup] = useState({ name:'',description:'',responsible_email:'',responsible_name:'' })
  const [newMember, setNewMember] = useState({ group_id:'',user_email:'',user_name:'',is_responsible:false })
  const [newUser, setNewUser] = useState({ user_email:'',user_name:'',role:'end_user' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const [c,g,u] = await Promise.all([
      fetch(`${API}/helpdesk/categories`).then(r=>r.json()),
      fetch(`${API}/helpdesk/groups`).then(r=>r.json()),
      fetch(`${API}/helpdesk/users`).then(r=>r.json()),
    ])
    setCategories(c.categories||[]); setGroups(g.groups||[]); setUsers(u.users||[])
    setLoading(false)
  }

  useEffect(()=>{load()},[])

  const createCategory = async () => {
    if (!newCat.name) return
    setSaving(true)
    await fetch(`${API}/helpdesk/categories`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newCat)})
    setNewCat({name:'',description:'',color:'#45B6E4',icon:'🎫',parent_id:'',group_id:''})
    setSaving(false); load()
  }

  const assignGroupToCategory = async (catId: string, groupId: string) => {
    await fetch(`${API}/helpdesk/categories/${catId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({group_id:groupId})})
    load()
  }

  const deleteCategory = async (catId: string) => {
    if (!confirm('Delete this category?')) return
    await fetch(`${API}/helpdesk/categories/${catId}`,{method:'DELETE'})
    load()
  }

  const createGroup = async () => {
    if (!newGroup.name) return
    setSaving(true)
    await fetch(`${API}/helpdesk/groups`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newGroup)})
    setNewGroup({name:'',description:'',responsible_email:'',responsible_name:''})
    setSaving(false); load()
  }

  const addMember = async () => {
    if (!newMember.group_id||!newMember.user_email) return
    setSaving(true)
    await fetch(`${API}/helpdesk/groups/${newMember.group_id}/members`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newMember)})
    setNewMember({group_id:'',user_email:'',user_name:'',is_responsible:false})
    setSaving(false); load()
  }

  const removeMember = async (gid: string, email: string) => {
    await fetch(`${API}/helpdesk/groups/${gid}/members/${encodeURIComponent(email)}`,{method:'DELETE'})
    load()
  }

  const upsertUser = async () => {
    if (!newUser.user_email) return
    setSaving(true)
    await fetch(`${API}/helpdesk/users`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newUser)})
    setNewUser({user_email:'',user_name:'',role:'end_user'})
    setSaving(false); load()
  }

  const TABS = [
    {id:'categories',label:'Categories & Groups',icon:'🏷️'},
    {id:'groups',label:'Groups & Members',icon:'👥'},
    {id:'users',label:'User Roles',icon:'🔐'},
  ]

  return (
    <div style={{display:'flex'}}>
      <Sidebar/>
      <main style={{marginLeft:'220px',minHeight:'100vh',width:'calc(100vw - 220px)',background:'#F5F7FA',fontFamily:'Montserrat, sans-serif'}}>
        <div style={{padding:'24px 28px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
            <div>
              <button onClick={()=>router.push('/helpdesk')} style={{background:'none',border:'none',color:'#45B6E4',fontSize:'12px',cursor:'pointer',fontFamily:'Montserrat, sans-serif',fontWeight:'600',padding:0,marginBottom:'4px',display:'block'}}>← Dashboard</button>
              <h1 style={{fontSize:'20px',fontWeight:'800',color:'#156082',margin:0}}>⚙️ Helpdesk Administration</h1>
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:'flex',gap:'4px',marginBottom:'24px',background:'white',padding:'4px',borderRadius:'10px',border:'1px solid #EDF2F7',width:'fit-content'}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id as any)} style={{padding:'7px 16px',borderRadius:'7px',border:'none',background:tab===t.id?'#156082':'transparent',color:tab===t.id?'white':'#45B6E4',fontSize:'12px',fontWeight:'600',cursor:'pointer',fontFamily:'Montserrat, sans-serif',display:'flex',alignItems:'center',gap:'5px'}}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {loading&&<div style={{textAlign:'center',padding:'48px',color:'#45B6E4'}}>Loading...</div>}

          {/* Categories tab */}
          {!loading&&tab==='categories'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:'20px'}}>
              {/* Category list */}
              <div>
                <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                  <div style={{padding:'14px 18px',borderBottom:'1px solid #EDF2F7'}}>
                    <span style={{fontSize:'12px',fontWeight:'700',color:'#156082'}}>Categories ({categories.length})</span>
                  </div>
                  {categories.map(cat=>(
                    <div key={cat.id}>
                      <div style={{padding:'12px 18px',borderBottom:'1px solid #F1F5F9',display:'flex',justifyContent:'space-between',alignItems:'center',background:cat.sub_count>0?'#FAFBFC':'white'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'10px',flex:1}}>
                          <span style={{fontSize:'18px'}}>{cat.icon}</span>
                          <div>
                            <span style={{fontSize:'13px',fontWeight:'700',color:'#156082'}}>{cat.name}</span>
                            {cat.sub_count>0&&<span style={{fontSize:'10px',color:'#45B6E4',marginLeft:'8px'}}>{cat.sub_count} subcategories</span>}
                          </div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                          <select style={{padding:'4px 8px',borderRadius:'6px',border:'1px solid #45B6E4',fontSize:'11px',fontFamily:'Montserrat, sans-serif',color:'#3F3F3F',minWidth:'140px'}}
                            value={cat.group_id||''} onChange={e=>assignGroupToCategory(cat.id,e.target.value)}>
                            <option value="">No group</option>
                            {groups.map((g:any)=><option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                          <button onClick={()=>deleteCategory(cat.id)} style={{...BTN.danger,padding:'4px 8px',fontSize:'11px'}}>✕</button>
                        </div>
                      </div>
                      {cat.subcategories?.map((sub:any)=>(
                        <div key={sub.id} style={{padding:'9px 18px 9px 46px',borderBottom:'1px solid #F1F5F9',display:'flex',justifyContent:'space-between',alignItems:'center',background:'white'}}>
                          <div style={{display:'flex',alignItems:'center',gap:'8px',flex:1}}>
                            <span style={{fontSize:'14px'}}>{sub.icon}</span>
                            <span style={{fontSize:'12px',color:'#3F3F3F',fontWeight:'500'}}>{sub.name}</span>
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <select style={{padding:'4px 8px',borderRadius:'6px',border:'1px solid #45B6E4',fontSize:'11px',fontFamily:'Montserrat, sans-serif',color:'#3F3F3F',minWidth:'140px'}}
                              value={sub.group_id||''} onChange={e=>assignGroupToCategory(sub.id,e.target.value)}>
                              <option value="">Inherit from parent</option>
                              {groups.map((g:any)=><option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                            <button onClick={()=>deleteCategory(sub.id)} style={{...BTN.danger,padding:'4px 8px',fontSize:'11px'}}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Add category form */}
              <div>
                <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'18px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                  <h3 style={{fontSize:'12px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',marginBottom:'14px'}}>Add Category or Sub-category</h3>
                  <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                    <div><label className="form-label">Name *</label><input className="form-input" value={newCat.name} onChange={e=>setNewCat(p=>({...p,name:e.target.value}))} placeholder="Category name"/></div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                      <div><label className="form-label">Icon</label><input className="form-input" value={newCat.icon} onChange={e=>setNewCat(p=>({...p,icon:e.target.value}))} placeholder="🎫"/></div>
                      <div><label className="form-label">Color</label><input className="form-input" type="color" value={newCat.color} onChange={e=>setNewCat(p=>({...p,color:e.target.value}))}/></div>
                    </div>
                    <div>
                      <label className="form-label">Parent Category (for sub-category)</label>
                      <select className="form-input" value={newCat.parent_id} onChange={e=>setNewCat(p=>({...p,parent_id:e.target.value}))}>
                        <option value="">None (top-level category)</option>
                        {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Assign Group</label>
                      <select className="form-input" value={newCat.group_id} onChange={e=>setNewCat(p=>({...p,group_id:e.target.value}))}>
                        <option value="">No group (inherit or default)</option>
                        {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                    <button onClick={createCategory} disabled={saving||!newCat.name} style={{...BTN.primary,opacity:(saving||!newCat.name)?0.6:1}}>
                      {saving?'Creating...':'+ Add'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Groups tab */}
          {!loading&&tab==='groups'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:'20px'}}>
              <div>
                {groups.map(g=>(
                  <div key={g.id} style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'18px',marginBottom:'14px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'12px'}}>
                      <div>
                        <h3 style={{fontSize:'14px',fontWeight:'700',color:'#156082',margin:'0 0 4px'}}>{g.name}</h3>
                        {g.responsible_name&&<p style={{fontSize:'12px',color:'#45B6E4',margin:0}}>⭐ Responsible: {g.responsible_name}</p>}
                      </div>
                      <span style={{background:'#EFF6FF',color:'#156082',padding:'2px 8px',borderRadius:'10px',fontSize:'11px',fontWeight:'600'}}>{g.members?.length||0} members</span>
                    </div>
                    {g.members?.length===0?(
                      <p style={{fontSize:'12px',color:'#45B6E4'}}>No members yet.</p>
                    ):(
                      <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                        {g.members?.map((m:any)=>(
                          <div key={m.user_email} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',background:'#F8FAFC',borderRadius:'7px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                              <div style={{width:'28px',height:'28px',borderRadius:'50%',background:'#156082',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:'800'}}>{m.user_name?.[0]?.toUpperCase()||'?'}</div>
                              <div>
                                <div style={{fontSize:'12px',fontWeight:'600',color:'#3F3F3F'}}>{m.user_name} {m.is_responsible&&'⭐'}</div>
                                <div style={{fontSize:'11px',color:'#45B6E4'}}>{m.user_email}</div>
                              </div>
                            </div>
                            <button onClick={()=>removeMember(g.id,m.user_email)} style={{...BTN.danger,padding:'4px 8px',fontSize:'11px'}}>Remove</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
                {/* New group */}
                <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'18px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                  <h3 style={{fontSize:'12px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',marginBottom:'14px'}}>Create Group</h3>
                  <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                    <div><label className="form-label">Name *</label><input className="form-input" value={newGroup.name} onChange={e=>setNewGroup(p=>({...p,name:e.target.value}))} placeholder="Group name"/></div>
                    <div><label className="form-label">Responsible Email</label><input className="form-input" value={newGroup.responsible_email} onChange={e=>setNewGroup(p=>({...p,responsible_email:e.target.value}))} placeholder="responsible@wcomply.com"/></div>
                    <div><label className="form-label">Responsible Name</label><input className="form-input" value={newGroup.responsible_name} onChange={e=>setNewGroup(p=>({...p,responsible_name:e.target.value}))} placeholder="Full name"/></div>
                    <button onClick={createGroup} disabled={saving||!newGroup.name} style={{...BTN.primary,opacity:(saving||!newGroup.name)?0.6:1}}>{saving?'Creating...':'+ Create Group'}</button>
                  </div>
                </div>

                {/* Add member */}
                <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'18px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                  <h3 style={{fontSize:'12px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',marginBottom:'14px'}}>Add Member to Group</h3>
                  <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                    <div>
                      <label className="form-label">Group *</label>
                      <select className="form-input" value={newMember.group_id} onChange={e=>setNewMember(p=>({...p,group_id:e.target.value}))}>
                        <option value="">Select group...</option>
                        {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                    <div><label className="form-label">User Email *</label><input className="form-input" value={newMember.user_email} onChange={e=>setNewMember(p=>({...p,user_email:e.target.value}))} placeholder="user@wcomply.com"/></div>
                    <div><label className="form-label">User Name</label><input className="form-input" value={newMember.user_name} onChange={e=>setNewMember(p=>({...p,user_name:e.target.value}))} placeholder="Full name"/></div>
                    <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',fontSize:'12px',color:'#45B6E4',fontWeight:'600'}}>
                      <input type="checkbox" checked={newMember.is_responsible} onChange={e=>setNewMember(p=>({...p,is_responsible:e.target.checked}))}/>
                      ⭐ Set as responsible
                    </label>
                    <button onClick={addMember} disabled={saving||!newMember.group_id||!newMember.user_email} style={{...BTN.primary,opacity:(saving||!newMember.group_id||!newMember.user_email)?0.6:1}}>{saving?'Adding...':'+ Add Member'}</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Users tab */}
          {!loading&&tab==='users'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:'20px'}}>
              <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
                  <thead style={{background:'#FAFBFC'}}>
                    <tr>{['User','Email','Role','Action'].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:'10px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',borderBottom:'1px solid #EDF2F7'}}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {users.length===0?<tr><td colSpan={4} style={{textAlign:'center',padding:'48px',color:'#45B6E4'}}>No users configured yet.</td></tr>:
                    users.map((u:any)=>{
                      const roleColor: Record<string,string> = {administrator:'#DC2626',helpdesk_user:'#156082',end_user:'#45B6E4'}
                      return (
                        <tr key={u.user_email} style={{borderBottom:'1px solid #F1F5F9'}}>
                          <td style={{padding:'10px 14px',fontWeight:'600',color:'#3F3F3F'}}>{u.user_name||'—'}</td>
                          <td style={{padding:'10px 14px',color:'#45B6E4'}}>{u.user_email}</td>
                          <td style={{padding:'10px 14px'}}>
                            <span style={{background:roleColor[u.role]+'20',color:roleColor[u.role],padding:'2px 8px',borderRadius:'10px',fontSize:'11px',fontWeight:'700',textTransform:'capitalize'}}>
                              {u.role.replace('_',' ')}
                            </span>
                          </td>
                          <td style={{padding:'10px 14px'}}>
                            <select style={{padding:'4px 8px',borderRadius:'6px',border:'1px solid #45B6E4',fontSize:'11px',fontFamily:'Montserrat, sans-serif'}}
                              value={u.role} onChange={async e=>{
                                await fetch(`${API}/helpdesk/users`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...u,role:e.target.value})})
                                load()
                              }}>
                              <option value="end_user">End User</option>
                              <option value="helpdesk_user">Helpdesk User</option>
                              <option value="administrator">Administrator</option>
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{background:'white',borderRadius:'12px',border:'1px solid #EDF2F7',padding:'18px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                <h3 style={{fontSize:'12px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.07em',color:'#45B6E4',marginBottom:'14px'}}>Add / Update User</h3>
                <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                  <div><label className="form-label">Email *</label><input className="form-input" value={newUser.user_email} onChange={e=>setNewUser(p=>({...p,user_email:e.target.value}))} placeholder="user@wcomply.com"/></div>
                  <div><label className="form-label">Name</label><input className="form-input" value={newUser.user_name} onChange={e=>setNewUser(p=>({...p,user_name:e.target.value}))} placeholder="Full name"/></div>
                  <div>
                    <label className="form-label">Role</label>
                    <select className="form-input" value={newUser.role} onChange={e=>setNewUser(p=>({...p,role:e.target.value}))}>
                      <option value="end_user">End User — Create & view own tickets</option>
                      <option value="helpdesk_user">Helpdesk User — View all, edit assigned</option>
                      <option value="administrator">Administrator — Full access</option>
                    </select>
                  </div>
                  <button onClick={upsertUser} disabled={saving||!newUser.user_email} style={{...BTN.primary,opacity:(saving||!newUser.user_email)?0.6:1}}>{saving?'Saving...':'Save User'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
