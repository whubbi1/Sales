'use client'
import { useState, useEffect } from 'react'
import { HRLayout } from '@/components/HRLayout'

const API = 'https://api.whubbi.wcomply.com'

const MODULES_META: Record<string, { label: string; icon: string; color: string }> = {
  sales:    { label: 'Sales',            icon: '💼', color: '#156082' },
  finance:  { label: 'Finance',          icon: '💰', color: '#e97132' },
  rh:       { label: 'Human Resources',  icon: '👥', color: '#45B6E4' },
  grc:      { label: 'GRC',              icon: '🛡️', color: '#7C3AED' },
  it:       { label: 'IT',               icon: '🖥️', color: '#45B6E4' },
  helpdesk: { label: 'Helpdesk',         icon: '🎧', color: '#45B6E4' },
  admin:    { label: 'Admin',            icon: '🔧', color: '#45B6E4' },
}

const DATA_SCOPES  = ['none', 'own', 'team', 'company']
const ACCESS_MODES = ['none', 'view', 'edit']
const SCOPE_LABEL: Record<string, string> = { none:'No Access', own:'Own Data', team:'Team Data', company:'All Company' }
const MODE_LABEL:  Record<string, string> = { none:'None', view:'View Only', edit:'View & Edit' }
const SCOPE_COLOR: Record<string, string> = { none:'#F1F5F9', own:'#EFF6FF', team:'#FFF7ED', company:'#ECFDF5' }
const SCOPE_TEXT:  Record<string, string> = { none:'#848EA5', own:'#156082', team:'#D97706', company:'#059669' }

export default function PermissionsPage() {
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [permissions, setPermissions] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{text:string;type:'success'|'error'}|null>(null)
  const [search, setSearch] = useState('')

  const [syncing, setSyncing] = useState(false)

  const loadUsers = () => {
    fetch(`${API}/settings/users`).then(r=>r.json()).then(d=>setUsers(d.users||[])).catch(()=>{})
  }

  useEffect(() => { loadUsers() }, [])

  useEffect(() => {
    if (selectedUser) loadPermissions(selectedUser)
  }, [selectedUser])

  const loadPermissions = async (email: string) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/settings/permissions/${email}`)
      setPermissions(await r.json())
    } catch {}
    setLoading(false)
  }

  const updatePermission = (module: string, submodule: string, field: string, value: string) => {
    setPermissions((p: any) => ({
      ...p,
      permissions: {
        ...p.permissions,
        [module]: { ...p.permissions[module], [submodule]: { ...p.permissions[module][submodule], [field]: value } }
      }
    }))
  }

  const savePermissions = async () => {
    setSaving(true)
    try {
      const r = await fetch(`${API}/settings/permissions/${selectedUser}`, {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ permissions: permissions.permissions, granted_by: 'hr_manager' })
      })
      const d = await r.json()
      setMessage({ text: `${d.updated} permissions saved successfully!`, type: 'success' })
      setTimeout(() => setMessage(null), 3000)
    } catch (e: any) {
      setMessage({ text: e.message, type: 'error' })
    }
    setSaving(false)
  }

  const filteredUsers = users.filter(u =>
    `${u.display_name} ${u.email} ${u.job_title}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <HRLayout>
      <div style={{ padding:'28px 32px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
          <div>
            <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#156082', marginBottom:'4px' }}>🔐 WHUBBI Permissions</h1>
            <p style={{ fontSize:'12px', color:'#45B6E4' }}>Manage user access rights across all modules — HR Manager only</p>
          </div>
          <button
            onClick={async () => { setSyncing(true); await fetch(`${API}/settings/users`); loadUsers(); setSyncing(false) }}
            disabled={syncing}
            style={{ background:'#156082', color:'white', border:'none', padding:'8px 16px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor: syncing ? 'not-allowed' : 'pointer', fontFamily:'Montserrat, sans-serif', opacity: syncing ? 0.7 : 1 }}>
            {syncing ? '⏳ Syncing...' : '🔄 Sync MS AD Users'}
          </button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:'20px' }}>
          {/* User list */}
          <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', height:'fit-content' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #F1F5F9', background:'#FAFBFC' }}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users..."
                style={{ width:'100%', padding:'7px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box' }}/>
            </div>
            {filteredUsers.length === 0 && (
              <div style={{ padding:'24px', textAlign:'center', color:'#45B6E4', fontSize:'12px' }}>
                No users found.<br/>
                <span style={{ fontSize:'11px', color:'#94A3B8' }}>Users sync from Microsoft automatically.</span>
              </div>
            )}
            {filteredUsers.map(u => (
              <div key={u.email} onClick={() => setSelectedUser(u.email)}
                style={{ padding:'12px 16px', borderBottom:'1px solid #F9FAFB', cursor:'pointer',
                  background: selectedUser===u.email ? '#EFF6FF' : 'white',
                  borderLeft: selectedUser===u.email ? '3px solid #156082' : '3px solid transparent' }}
                onMouseEnter={e => { if (selectedUser!==u.email) e.currentTarget.style.background='#FAFBFC' }}
                onMouseLeave={e => { if (selectedUser!==u.email) e.currentTarget.style.background='white' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ width:'34px', height:'34px', borderRadius:'50%', background:'#156082', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'13px', fontWeight:'700', flexShrink:0 }}>
                    {(u.first_name||u.email||'?')[0].toUpperCase()}
                  </div>
                  <div style={{ overflow:'hidden' }}>
                    <div style={{ fontSize:'12px', fontWeight:'700', color:'#3F3F3F', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.display_name||`${u.first_name} ${u.last_name}`}</div>
                    <div style={{ fontSize:'10px', color:'#45B6E4', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.job_title || u.department || u.email}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Permissions panel */}
          <div>
            {!selectedUser && (
              <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'48px', textAlign:'center', color:'#45B6E4', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize:'32px', marginBottom:'12px' }}>👈</div>
                Select a user to manage their permissions.
              </div>
            )}

            {selectedUser && loading && (
              <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'48px', textAlign:'center', color:'#45B6E4' }}>Loading...</div>
            )}

            {selectedUser && !loading && permissions && (
              <div>
                {/* Header */}
                <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'16px 20px', marginBottom:'14px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>{selectedUser}</div>
                    <div style={{ display:'flex', gap:'10px', marginTop:'6px', fontSize:'11px', color:'#45B6E4' }}>
                      <span style={{ background:'#EFF6FF', color:'#156082', padding:'2px 8px', borderRadius:'10px', fontWeight:'600' }}>Own</span>
                      <span style={{ background:'#FFF7ED', color:'#D97706', padding:'2px 8px', borderRadius:'10px', fontWeight:'600' }}>Team</span>
                      <span style={{ background:'#ECFDF5', color:'#059669', padding:'2px 8px', borderRadius:'10px', fontWeight:'600' }}>Company</span>
                    </div>
                  </div>
                  <button onClick={savePermissions} disabled={saving}
                    style={{ padding:'9px 20px', background:saving?'#F1F5F9':'#156082', color:saving?'#45B6E4':'white', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:saving?'not-allowed':'pointer', fontFamily:'Montserrat, sans-serif' }}>
                    {saving ? '⏳ Saving...' : '💾 Save Permissions'}
                  </button>
                </div>

                {message && (
                  <div style={{ padding:'12px 16px', borderRadius:'8px', marginBottom:'14px', background:message.type==='success'?'#ECFDF5':'#FEF2F2', color:message.type==='success'?'#059669':'#DC2626', fontSize:'12px', fontWeight:'600' }}>
                    {message.type==='success'?'✅':'❌'} {message.text}
                  </div>
                )}

                {/* Module permissions */}
                {Object.entries(permissions.permissions || {}).map(([module, submodules]: [string, any]) => {
                  const meta = MODULES_META[module] || { label:module, icon:'📦', color:'#45B6E4' }
                  return (
                    <div key={module} style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', marginBottom:'12px' }}>
                      <div style={{ padding:'12px 20px', background:meta.color+'10', borderBottom:'1px solid #EDF2F7', display:'flex', alignItems:'center', gap:'10px' }}>
                        <span style={{ fontSize:'18px' }}>{meta.icon}</span>
                        <span style={{ fontSize:'13px', fontWeight:'800', color:meta.color }}>{meta.label}</span>
                        <span style={{ fontSize:'11px', color:'#45B6E4' }}>({Object.keys(submodules).length} submodules)</span>
                      </div>
                      <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ background:'#FAFBFC' }}>
                            <th style={{ padding:'8px 20px', textAlign:'left', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', width:'25%' }}>Submodule</th>
                            <th style={{ padding:'8px 20px', textAlign:'left', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', width:'40%' }}>Data Scope</th>
                            <th style={{ padding:'8px 20px', textAlign:'left', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', width:'35%' }}>Access Mode</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(submodules).map(([sub, perm]: [string, any]) => (
                            <tr key={sub} style={{ borderTop:'1px solid #F1F5F9' }}>
                              <td style={{ padding:'10px 20px', fontSize:'12px', fontWeight:'600', color:'#3F3F3F', textTransform:'capitalize' }}>{sub.replace(/_/g,' ')}</td>
                              <td style={{ padding:'10px 20px' }}>
                                <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
                                  {DATA_SCOPES.map(scope => (
                                    <button key={scope} onClick={() => updatePermission(module, sub, 'data_scope', scope)}
                                      style={{ padding:'4px 10px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'10px', fontWeight:'700', fontFamily:'Montserrat, sans-serif',
                                        background: perm.data_scope===scope ? SCOPE_COLOR[scope] : '#F1F5F9',
                                        color: perm.data_scope===scope ? SCOPE_TEXT[scope] : '#848EA5' }}>
                                      {SCOPE_LABEL[scope]}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td style={{ padding:'10px 20px' }}>
                                <div style={{ display:'flex', gap:'5px' }}>
                                  {ACCESS_MODES.map(mode => (
                                    <button key={mode} onClick={() => updatePermission(module, sub, 'access_mode', mode)}
                                      style={{ padding:'4px 10px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'10px', fontWeight:'700', fontFamily:'Montserrat, sans-serif',
                                        background: perm.access_mode===mode ? (mode==='none'?'#F1F5F9':mode==='view'?'#EFF6FF':'#ECFDF5') : '#F1F5F9',
                                        color: perm.access_mode===mode ? (mode==='none'?'#848EA5':mode==='view'?'#156082':'#059669') : '#848EA5' }}>
                                      {MODE_LABEL[mode]}
                                    </button>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </HRLayout>
  )
}
