'use client'
import { useState, useEffect } from 'react'
import { HRLayout } from '@/components/HRLayout'

const API = 'https://api.whubbi.wcomply.com'

const MODULES_META: Record<string, { label: string; icon: string; color: string }> = {
  sales:    { label: 'Sales',            icon: '💼', color: '#156082' },
  finance:  { label: 'Finance',          icon: '💰', color: '#e97132' },
  rh:       { label: 'Human Resources',  icon: '👥', color: '#45B6E4' },
  hr:       { label: 'Human Resources',  icon: '👥', color: '#45B6E4' },
  grc:      { label: 'GRC',              icon: '🛡️', color: '#7C3AED' },
  it:       { label: 'IT',               icon: '🖥️', color: '#45B6E4' },
  helpdesk: { label: 'Helpdesk',         icon: '🎧', color: '#45B6E4' },
  admin:    { label: 'Admin',            icon: '🔧', color: '#45B6E4' },
  legal:    { label: 'Legal',            icon: '⚖️', color: '#1a2744' },
  training: { label: 'Training',         icon: '🎓', color: '#7C3AED' },
  tasks:    { label: 'Task Manager',     icon: '✅', color: '#219BD6' },
  operations: { label: 'Operations',     icon: '🛠️', color: '#059669' },
}

const HR_SUBMODULE_META: Record<string, { label: string; href: string }> = {
  freelancers: { label: 'Freelancers',       href: '/rh/freelancers' },
  recrutement: { label: 'Recrutement',       href: '/rh/recrutement' },
  positions:   { label: 'Job Positions',     href: '/rh/positions' },
  jobs:        { label: 'Job Descriptions',  href: '/rh/jobs' },
  permissions: { label: 'Permissions',       href: '/rh/permissions' },
  chat:        { label: 'WHUBBI Chat',       href: '/rh/chat' },
  admin:       { label: 'HR Admin Cockpit',  href: '/rh/admin' },
}

const LEGAL_SUBMODULE_META: Record<string, { label: string; href: string }> = {
  entities:  { label: 'Legal Entities',        href: '/legal/entities' },
  templates: { label: 'Template Documents',    href: '/legal/templates' },
  admin:     { label: 'Legal Admin Cockpit',   href: '/legal/admin' },
}

const TRAINING_SUBMODULE_META: Record<string, { label: string; href: string }> = {
  manager: { label: 'Training Manager', href: '/training' },
}

const SALES_SUBMODULE_META: Record<string, { label: string; href: string }> = {
  cv_database: { label: 'CV Database', href: '/cv-database' },
}

const DATA_SCOPES  = ['none', 'own', 'team', 'company']
const ACCESS_MODES = ['none', 'view', 'edit']
const LEGAL_ENTITIES = ['all', 'france', 'portugal', 'czech_republic', 'romania', 'spain']
const SCOPE_LABEL:  Record<string, string> = { none:'No Access', own:'Own Data', team:'Team Data', company:'All Company' }
const MODE_LABEL:   Record<string, string> = { none:'None', view:'View Only', edit:'View & Edit' }
const ENTITY_LABEL: Record<string, string> = { all:'🌍 All', france:'🇫🇷 France', portugal:'🇵🇹 Portugal', czech_republic:'🇨🇿 Czech Rep.', romania:'🇷🇴 Romania', spain:'🇪🇸 Spain' }
const SCOPE_COLOR:  Record<string, string> = { none:'#F1F5F9', own:'#EFF6FF', team:'#FFF7ED', company:'#ECFDF5' }
const SCOPE_TEXT:   Record<string, string> = { none:'#848EA5', own:'#156082', team:'#D97706', company:'#059669' }

// Real legal organizational elements a user can be scoped to, assigned once per user
// before any module access is configured. Each maps to a whubbi_org_assignments column.
const ORG_ELEMENT_TYPES: { key: string; label: string; icon: string }[] = [
  { key: 'company_ids',            label: 'Company',            icon: '🏢' },
  { key: 'location_ids',           label: 'Location',           icon: '📍' },
  { key: 'sales_org_ids',          label: 'Sales Organization',  icon: '💼' },
  { key: 'purchasing_org_ids',     label: 'Purchasing Organization', icon: '🛒' },
  { key: 'operational_org_ids',    label: 'Operational Organization', icon: '⚙️' },
]
const EMPTY_ORG_ASSIGNMENTS: Record<string, string[]> = {
  company_ids: [], location_ids: [], sales_org_ids: [], purchasing_org_ids: [], operational_org_ids: [],
}

export default function PermissionsPage() {
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [permissions, setPermissions] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{text:string;type:'success'|'error'}|null>(null)
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [locations, setLocations] = useState<any[]>([])
  const [mainLocationId, setMainLocationId] = useState('')
  const [mainLocationSaving, setMainLocationSaving] = useState(false)
  const [isExcluded, setIsExcluded] = useState(false)
  const [companies, setCompanies] = useState<any[]>([])
  const [salesOrgs, setSalesOrgs] = useState<any[]>([])
  const [purchasingOrgs, setPurchasingOrgs] = useState<any[]>([])
  const [operationalOrgs, setOperationalOrgs] = useState<any[]>([])
  const [orgAssignments, setOrgAssignments] = useState<Record<string, string[]>>(EMPTY_ORG_ASSIGNMENTS)
  const [orgAssignmentsSaving, setOrgAssignmentsSaving] = useState(false)
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({})

  const loadUsers = () => {
    fetch(`${API}/settings/users`).then(r=>r.json()).then(d=>setUsers(d.users||[])).catch(()=>{})
  }

  useEffect(() => {
    loadUsers()
    fetch(`${API}/legal/locations`).then(r=>r.json()).then(d=>setLocations(d.locations||[])).catch(()=>{})
    fetch(`${API}/legal/entities`).then(r=>r.json()).then(d=>setCompanies(d.entities||[])).catch(()=>{})
    fetch(`${API}/legal/org-entities?category=sales_entity`).then(r=>r.json()).then(d=>setSalesOrgs(d.org_entities||[])).catch(()=>{})
    fetch(`${API}/legal/org-entities?category=purchasing_entity`).then(r=>r.json()).then(d=>setPurchasingOrgs(d.org_entities||[])).catch(()=>{})
    fetch(`${API}/legal/org-entities?category=operational_team`).then(r=>r.json()).then(d=>setOperationalOrgs(d.org_entities||[])).catch(()=>{})
  }, [])

  useEffect(() => {
    if (selectedUser) {
      loadPermissions(selectedUser)
      fetch(`${API}/settings/main-location/${encodeURIComponent(selectedUser)}`).then(r=>r.json()).then(d=>{
        setMainLocationId(d.main_location_id || '')
        setIsExcluded(!!d.is_excluded)
      }).catch(()=>{ setMainLocationId(''); setIsExcluded(false) })
      fetch(`${API}/settings/org-assignments/${encodeURIComponent(selectedUser)}`).then(r=>r.json()).then(d=>{
        setOrgAssignments({ ...EMPTY_ORG_ASSIGNMENTS, ...d })
      }).catch(()=>setOrgAssignments(EMPTY_ORG_ASSIGNMENTS))
    }
  }, [selectedUser])

  const orgElementOptions = (key: string): { id: string; label: string }[] => {
    if (key === 'company_ids') return companies.filter(c => !c.is_archived).map(c => ({ id: c.id, label: `${c.code} — ${c.legal_name}` }))
    if (key === 'location_ids') return locations.filter((l:any) => !l.is_archived).map((l:any) => ({ id: l.id, label: `${l.code} — ${l.location_name}` }))
    if (key === 'sales_org_ids') return salesOrgs.filter(o => !o.is_archived).map(o => ({ id: o.id, label: `${o.code} — ${o.title}` }))
    if (key === 'purchasing_org_ids') return purchasingOrgs.filter(o => !o.is_archived).map(o => ({ id: o.id, label: `${o.code} — ${o.title}` }))
    if (key === 'operational_org_ids') return operationalOrgs.filter(o => !o.is_archived).map(o => ({ id: o.id, label: `${o.code} — ${o.title}` }))
    return []
  }

  const toggleOrgElement = (key: string, id: string) => {
    setOrgAssignments(prev => {
      const current = prev[key] || []
      const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]
      return { ...prev, [key]: next }
    })
  }

  const saveOrgAssignments = async () => {
    setOrgAssignmentsSaving(true)
    try {
      await fetch(`${API}/settings/org-assignments/${encodeURIComponent(selectedUser)}`, {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ ...orgAssignments, updated_by: 'hr_manager' }),
      })
    } finally { setOrgAssignmentsSaving(false) }
  }

  const toggleModuleExpanded = (module: string) =>
    setExpandedModules(prev => ({ ...prev, [module]: !prev[module] }))

  const saveMainLocationCard = async (patch: { locationId?: string; excluded?: boolean }) => {
    const locationId = patch.locationId !== undefined ? patch.locationId : mainLocationId
    const excluded = patch.excluded !== undefined ? patch.excluded : isExcluded
    setMainLocationId(locationId)
    setIsExcluded(excluded)
    setMainLocationSaving(true)
    const loc = locations.find(l => l.id === locationId)
    try {
      await fetch(`${API}/settings/main-location/${encodeURIComponent(selectedUser)}`, {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ main_location_id: locationId || null, main_location_name: loc?.location_name || 'All', is_excluded: excluded }),
      })
    } finally { setMainLocationSaving(false) }
  }
  const saveMainLocation = (locationId: string) => saveMainLocationCard({ locationId })
  const saveExcluded = (excluded: boolean) => saveMainLocationCard({ excluded })

  const loadPermissions = async (email: string) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/settings/permissions/${email}`)
      setPermissions(await r.json())
    } catch {}
    setLoading(false)
  }

  const updatePermission = (module: string, submodule: string, field: string, value: any) => {
    setPermissions((p: any) => ({
      ...p,
      permissions: {
        ...p.permissions,
        [module]: { ...p.permissions[module], [submodule]: { ...p.permissions[module][submodule], [field]: value } }
      }
    }))
  }

  const toggleLegalEntity = (module: string, submodule: string, entity: string) => {
    const current: string[] = permissions.permissions[module][submodule].legal_entities || ['all']
    let next: string[]
    if (entity === 'all') {
      next = ['all']
    } else {
      const withoutAll = current.filter(e => e !== 'all')
      if (withoutAll.includes(entity)) {
        next = withoutAll.filter(e => e !== entity)
        if (next.length === 0) next = ['all']
      } else {
        next = [...withoutAll, entity]
      }
    }
    updatePermission(module, submodule, 'legal_entities', next)
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

  const getSubmoduleLabel = (module: string, sub: string): string => {
    if (module === 'hr')       return HR_SUBMODULE_META[sub]?.label       || sub.replace(/_/g, ' ')
    if (module === 'legal')    return LEGAL_SUBMODULE_META[sub]?.label    || sub.replace(/_/g, ' ')
    if (module === 'training') return TRAINING_SUBMODULE_META[sub]?.label || sub.replace(/_/g, ' ')
    if (module === 'sales')    return SALES_SUBMODULE_META[sub]?.label    || sub.replace(/_/g, ' ')
    return sub.replace(/_/g, ' ')
  }

  const getSubmoduleHref = (module: string, sub: string): string | undefined => {
    if (module === 'hr')       return HR_SUBMODULE_META[sub]?.href
    if (module === 'legal')    return LEGAL_SUBMODULE_META[sub]?.href
    if (module === 'training') return TRAINING_SUBMODULE_META[sub]?.href
    if (module === 'sales')    return SALES_SUBMODULE_META[sub]?.href
    return undefined
  }

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
                style={{ width:'100%', padding:'7px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', boxSizing:'border-box' as const }}/>
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
                  <div style={{ overflow:'hidden', flex:1 }}>
                    <div style={{ fontSize:'12px', fontWeight:'700', color:'#3F3F3F', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.display_name||`${u.first_name} ${u.last_name}`}</div>
                    <div style={{ fontSize:'10px', color:'#45B6E4', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.job_title || u.department || u.email}</div>
                  </div>
                  {u.is_excluded && (
                    <span style={{ fontSize:'9px', fontWeight:'700', color:'#DC2626', background:'#FEF2F2', padding:'2px 7px', borderRadius:'10px', flexShrink:0 }}>Excluded</span>
                  )}
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
                {/* Main Location */}
                <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'14px 20px', marginBottom:'14px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'4px' }}>Main Location</div>
                      <div style={{ fontSize:'11px', color:'#94A3B8' }}>Drives which company links this user sees on the home page</div>
                    </div>
                    <select value={mainLocationId} onChange={e => saveMainLocation(e.target.value)} disabled={mainLocationSaving || isExcluded}
                      style={{ padding:'7px 12px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', minWidth:'200px' }}>
                      <option value="">All Locations</option>
                      {locations.map((l:any) => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                    </select>
                  </div>
                  <div style={{ marginTop:'12px', paddingTop:'12px', borderTop:'1px solid #F1F5F9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color: isExcluded ? '#DC2626' : '#45B6E4', marginBottom:'4px' }}>🚫 Exclude from WHUBBI Access</div>
                      <div style={{ fontSize:'11px', color:'#94A3B8' }}>When enabled, this person cannot log in to WHUBBI or access any module or document</div>
                    </div>
                    <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor: mainLocationSaving ? 'default' : 'pointer', padding:'6px 12px', borderRadius:'20px', background: isExcluded ? '#FEF2F2' : '#F1F5F9' }}>
                      <input type="checkbox" checked={isExcluded} disabled={mainLocationSaving} onChange={e => saveExcluded(e.target.checked)} style={{ margin:0 }} />
                      <span style={{ fontSize:'11px', fontWeight:'700', color: isExcluded ? '#DC2626' : '#64748B' }}>{isExcluded ? 'Excluded' : 'Has Access'}</span>
                    </label>
                  </div>
                </div>

                {/* Organizational Element Assignment — set before granting any module access */}
                <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'14px 20px', marginBottom:'14px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
                    <div>
                      <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'4px' }}>🏛️ Organizational Elements</div>
                      <div style={{ fontSize:'11px', color:'#94A3B8' }}>Assign the legal Company, Location, Sales/Purchasing/Operational Organization(s) this user belongs to. Leave a category empty to grant all.</div>
                    </div>
                    <button onClick={saveOrgAssignments} disabled={orgAssignmentsSaving}
                      style={{ padding:'6px 14px', background: orgAssignmentsSaving ? '#F1F5F9' : '#156082', color: orgAssignmentsSaving ? '#45B6E4' : 'white', border:'none', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor: orgAssignmentsSaving ? 'not-allowed' : 'pointer', fontFamily:'Montserrat, sans-serif', whiteSpace:'nowrap', flexShrink:0 }}>
                      {orgAssignmentsSaving ? '⏳ Saving...' : '💾 Save'}
                    </button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'12px' }}>
                    {ORG_ELEMENT_TYPES.map(({ key, label, icon }) => {
                      const options = orgElementOptions(key)
                      const selected = orgAssignments[key] || []
                      return (
                        <div key={key} style={{ border:'1px solid #F1F5F9', borderRadius:'8px', padding:'10px 12px' }}>
                          <div style={{ fontSize:'11px', fontWeight:'700', color:'#3F3F3F', marginBottom:'6px' }}>{icon} {label}</div>
                          {options.length === 0 && <div style={{ fontSize:'10px', color:'#94A3B8' }}>None defined yet</div>}
                          <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', maxHeight:'110px', overflowY:'auto' }}>
                            {options.map(opt => {
                              const active = selected.includes(opt.id)
                              return (
                                <button key={opt.id} onClick={() => toggleOrgElement(key, opt.id)}
                                  style={{ padding:'3px 8px', borderRadius:'6px', border:`1.5px solid ${active?'#156082':'#EDF2F7'}`, cursor:'pointer', fontSize:'10px', fontWeight:'700', fontFamily:'Montserrat, sans-serif',
                                    background: active ? '#EFF6FF' : 'white', color: active ? '#156082' : '#94A3B8' }}>
                                  {opt.label}
                                </button>
                              )
                            })}
                          </div>
                          {selected.length === 0 && options.length > 0 && (
                            <div style={{ fontSize:'9px', color:'#059669', fontWeight:'700', marginTop:'6px' }}>🌍 All (none selected)</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Header */}
                <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'16px 20px', marginBottom:'14px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:'14px', fontWeight:'800', color:'#156082' }}>{selectedUser}</div>
                    <div style={{ display:'flex', gap:'8px', marginTop:'6px', fontSize:'11px', flexWrap:'wrap' }}>
                      <span style={{ background:'#EFF6FF', color:'#156082', padding:'2px 8px', borderRadius:'10px', fontWeight:'600' }}>Own Data</span>
                      <span style={{ background:'#FFF7ED', color:'#D97706', padding:'2px 8px', borderRadius:'10px', fontWeight:'600' }}>Team Data</span>
                      <span style={{ background:'#ECFDF5', color:'#059669', padding:'2px 8px', borderRadius:'10px', fontWeight:'600' }}>All Company</span>
                      <span style={{ background:'#F3F4F6', color:'#6B7280', padding:'2px 8px', borderRadius:'10px', fontWeight:'600' }}>Legal Entity filter</span>
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
                  const isHR = module === 'hr'
                  const expanded = !!expandedModules[module]
                  return (
                    <div key={module} style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', marginBottom:'12px' }}>
                      <div onClick={() => toggleModuleExpanded(module)}
                        style={{ padding:'12px 20px', background:meta.color+'18', borderBottom: expanded ? '1px solid #EDF2F7' : 'none', display:'flex', alignItems:'center', gap:'10px', cursor:'pointer' }}>
                        <span style={{ fontSize:'18px' }}>{meta.icon}</span>
                        <span style={{ fontSize:'13px', fontWeight:'800', color:meta.color }}>{meta.label}</span>
                        <span style={{ fontSize:'11px', color:'#45B6E4' }}>({Object.keys(submodules).length} submodules)</span>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={meta.color} strokeWidth={2}
                          style={{ marginLeft:'auto', flexShrink:0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                      {expanded && (
                      <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ background:'#FAFBFC' }}>
                            <th style={{ padding:'8px 20px', textAlign:'left', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', width:'18%' }}>Submodule</th>
                            <th style={{ padding:'8px 20px', textAlign:'left', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', width:'28%' }}>Data Scope</th>
                            <th style={{ padding:'8px 20px', textAlign:'left', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', width:'22%' }}>Access Mode</th>
                            <th style={{ padding:'8px 20px', textAlign:'left', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', width:'32%' }}>Legal Entity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(submodules).map(([sub, perm]: [string, any]) => {
                            const subLabel = getSubmoduleLabel(module, sub)
                            const subHref = getSubmoduleHref(module, sub)
                            const selectedEntities: string[] = perm.legal_entities || ['all']
                            return (
                              <tr key={sub} style={{ borderTop:'1px solid #F1F5F9' }}>
                                <td style={{ padding:'10px 20px', fontSize:'12px', fontWeight:'600', color:'#3F3F3F' }}>
                                  {subHref ? (
                                    <a href={subHref} target="_blank" style={{ color:'#156082', textDecoration:'none', fontSize:'12px', fontWeight:'700' }}
                                      onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.textDecoration='underline'}
                                      onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.textDecoration='none'}>
                                      {subLabel} ↗
                                    </a>
                                  ) : (
                                    <span style={{ textTransform:'capitalize' }}>{subLabel}</span>
                                  )}
                                </td>
                                <td style={{ padding:'10px 20px' }}>
                                  <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                                    {DATA_SCOPES.map(scope => (
                                      <button key={scope} onClick={() => updatePermission(module, sub, 'data_scope', scope)}
                                        style={{ padding:'3px 9px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'10px', fontWeight:'700', fontFamily:'Montserrat, sans-serif',
                                          background: perm.data_scope===scope ? SCOPE_COLOR[scope] : '#F1F5F9',
                                          color: perm.data_scope===scope ? SCOPE_TEXT[scope] : '#848EA5' }}>
                                        {SCOPE_LABEL[scope]}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                                <td style={{ padding:'10px 20px' }}>
                                  <div style={{ display:'flex', gap:'4px' }}>
                                    {ACCESS_MODES.map(mode => (
                                      <button key={mode} onClick={() => updatePermission(module, sub, 'access_mode', mode)}
                                        style={{ padding:'3px 9px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'10px', fontWeight:'700', fontFamily:'Montserrat, sans-serif',
                                          background: perm.access_mode===mode ? (mode==='none'?'#F1F5F9':mode==='view'?'#EFF6FF':'#ECFDF5') : '#F1F5F9',
                                          color: perm.access_mode===mode ? (mode==='none'?'#848EA5':mode==='view'?'#156082':'#059669') : '#848EA5' }}>
                                        {mode === 'none' ? 'None' : mode === 'view' ? 'View' : 'Edit'}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                                <td style={{ padding:'10px 20px' }}>
                                  <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                                    {LEGAL_ENTITIES.map(entity => {
                                      const active = selectedEntities.includes(entity)
                                      return (
                                        <button key={entity} onClick={() => toggleLegalEntity(module, sub, entity)}
                                          style={{ padding:'3px 9px', borderRadius:'6px', border:`1.5px solid ${active?'#156082':'#EDF2F7'}`, cursor:'pointer', fontSize:'10px', fontWeight:'700', fontFamily:'Montserrat, sans-serif',
                                            background: active ? '#EFF6FF' : 'white',
                                            color: active ? '#156082' : '#94A3B8' }}>
                                          {ENTITY_LABEL[entity]}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      )}
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
