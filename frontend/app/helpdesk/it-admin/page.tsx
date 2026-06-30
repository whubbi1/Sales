'use client'
import { useState, useEffect, useRef } from 'react'
import HelpdeskLayout from '@/components/HelpdeskLayout'
import { getStoredUser } from '@/lib/auth'
import { API } from '../constants'

const COLORS = ['#DC2626','#D97706','#059669','#45B6E4','#156082','#e97132','#7C3AED','#848EA5','#0F172A','#BE185D']
const ICONS  = ['🎫','🔐','🖱️','💿','🖥️','⚙️','📋','📱','💻','🔷','🛡️','📧','🗂️','🌐','🔧']

function InlineText({ value, onSave, placeholder = '—', style = {}, readOnly = false }: {
  value: string; onSave: (v: string) => void; placeholder?: string; style?: React.CSSProperties; readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing && ref.current) ref.current.focus() }, [editing])
  const commit = () => { setEditing(false); if (draft.trim() !== value) onSave(draft.trim()) }
  return (
    <input ref={ref} value={editing ? draft : (value || placeholder)}
      readOnly={!editing || readOnly} onClick={() => { if (!readOnly) setEditing(true) }}
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
      style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '13px', border: editing ? '1.5px solid #156082' : '1.5px solid transparent', borderRadius: '6px', padding: '3px 7px', outline: 'none', background: editing ? 'white' : 'transparent', cursor: readOnly ? 'default' : (editing ? 'text' : 'pointer'), width: '100%', boxSizing: 'border-box' as const, color: value ? '#1F2937' : '#9CA3AF', ...style }} />
  )
}

type PermLevel = 'loading' | 'none' | 'view' | 'edit'

export default function HelpdeskAdminCockpitPage() {
  const [tab, setTab] = useState<'categories' | 'groups'>('categories')
  const [permLevel, setPermLevel] = useState<PermLevel>('loading')

  // Categories state
  const [categories, setCategories] = useState<any[]>([])
  const [catLoading, setCatLoading] = useState(true)
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [newCatName, setNewCatName] = useState(''); const [newCatIcon, setNewCatIcon] = useState('🎫'); const [newCatColor, setNewCatColor] = useState('#45B6E4'); const [addingCat, setAddingCat] = useState(false)
  const [newSubName, setNewSubName] = useState<Record<string, string>>({})

  // Groups state
  const [groups, setGroups] = useState<any[]>([])
  const [msUsers, setMsUsers] = useState<any[]>([])
  const [grpLoading, setGrpLoading] = useState(false)
  const [expandedGrp, setExpandedGrp] = useState<string | null>(null)
  const [newGrpName, setNewGrpName] = useState(''); const [newGrpDesc, setNewGrpDesc] = useState(''); const [addingGrp, setAddingGrp] = useState(false)
  const [addMemberEmail, setAddMemberEmail] = useState<Record<string, string>>({})
  const [userSearch, setUserSearch] = useState<Record<string, string>>({})

  useEffect(() => {
    const user = getStoredUser()
    if (!user) { setPermLevel('none'); return }

    // Check permissions for helpdesk.admin_cockpit
    fetch(`${API}/settings/permissions/${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(data => {
        const perm = data?.permissions?.helpdesk?.admin_cockpit
        // id === null means never explicitly configured → default to 'edit' (role-based access applies)
        if (!perm || perm.id === null) { setPermLevel('edit'); return }
        if (perm.access_mode === 'edit') setPermLevel('edit')
        else if (perm.access_mode === 'view') setPermLevel('view')
        else setPermLevel('none')
      })
      .catch(() => setPermLevel('edit')) // on error, fallback to allow

    loadCategories()
  }, [])

  useEffect(() => { if (tab === 'groups' && groups.length === 0) loadGroups() }, [tab])

  const canEdit = permLevel === 'edit'

  const loadCategories = () => {
    setCatLoading(true)
    fetch(`${API}/helpdesk/categories`).then(r => r.json()).then(d => setCategories(d.categories || [])).finally(() => setCatLoading(false))
  }

  const loadGroups = () => {
    setGrpLoading(true)
    Promise.all([
      fetch(`${API}/helpdesk/groups`).then(r => r.json()),
      fetch(`${API}/settings/users`).then(r => r.json()),
    ]).then(([gd, ud]) => {
      setGroups(gd.groups || [])
      setMsUsers(ud.users || [])
    }).finally(() => setGrpLoading(false))
  }

  // ── Categories ────────────────────────────────────────────
  const saveCategory = async (id: string, field: string, value: string) => {
    if (!canEdit) return
    const cat = categories.find(c => c.id === id); if (!cat) return
    const updated = { ...cat, [field]: value }
    setCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
    await fetch(`${API}/helpdesk/categories/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: updated.name, color: updated.color, icon: updated.icon, group_id: updated.group_id || '' }) })
  }

  const createCategory = async () => {
    if (!canEdit || !newCatName.trim()) return; setAddingCat(true)
    await fetch(`${API}/helpdesk/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newCatName.trim(), icon: newCatIcon, color: newCatColor, description: '' }) })
    setNewCatName(''); setAddingCat(false); loadCategories()
  }

  const deleteCategory = async (id: string) => {
    if (!canEdit) return
    if (!confirm('Delete this category and all its subcategories?')) return
    await fetch(`${API}/helpdesk/categories/${id}`, { method: 'DELETE' })
    setCategories(prev => prev.filter(c => c.id !== id))
    if (expandedCat === id) setExpandedCat(null)
  }

  const addSubcategory = async (parentId: string, parentColor: string) => {
    if (!canEdit) return
    const name = (newSubName[parentId] || '').trim(); if (!name) return
    await fetch(`${API}/helpdesk/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, icon: '📱', color: parentColor, description: '', parent_id: parentId }) })
    setNewSubName(prev => ({ ...prev, [parentId]: '' })); loadCategories()
  }

  const saveSubcategory = async (parentId: string, subId: string, name: string) => {
    if (!canEdit) return
    setCategories(prev => prev.map(c => c.id === parentId ? { ...c, subcategories: (c.subcategories || []).map((s: any) => s.id === subId ? { ...s, name } : s) } : c))
    await fetch(`${API}/helpdesk/categories/${subId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
  }

  const deleteSubcategory = async (subId: string) => {
    if (!canEdit) return
    await fetch(`${API}/helpdesk/categories/${subId}`, { method: 'DELETE' })
    setCategories(prev => prev.map(c => ({ ...c, subcategories: (c.subcategories || []).filter((s: any) => s.id !== subId) })))
  }

  // ── Groups ────────────────────────────────────────────────
  const createGroup = async () => {
    if (!canEdit || !newGrpName.trim()) return; setAddingGrp(true)
    await fetch(`${API}/helpdesk/groups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newGrpName.trim(), description: newGrpDesc.trim() }) })
    setNewGrpName(''); setNewGrpDesc(''); setAddingGrp(false); loadGroups()
  }

  const setDefaultGroup = async (gid: string, grp: any) => {
    if (!canEdit) return
    setGroups(prev => prev.map(g => ({ ...g, is_default: g.id === gid })))
    await fetch(`${API}/helpdesk/groups/${gid}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: grp.name, description: grp.description || '', is_default: true }) })
  }

  const addMember = async (gid: string) => {
    if (!canEdit) return
    const email = (addMemberEmail[gid] || '').trim(); if (!email) return
    const user = msUsers.find(u => u.email === email)
    const name = user?.display_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || email
    await fetch(`${API}/helpdesk/groups/${gid}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_email: email, user_name: name }) })
    setAddMemberEmail(prev => ({ ...prev, [gid]: '' })); setUserSearch(prev => ({ ...prev, [gid]: '' })); loadGroups()
  }

  const removeMember = async (gid: string, email: string) => {
    if (!canEdit) return
    await fetch(`${API}/helpdesk/groups/${gid}/members/${encodeURIComponent(email)}`, { method: 'DELETE' })
    setGroups(prev => prev.map(g => g.id === gid ? { ...g, members: g.members.filter((m: any) => m.user_email !== email) } : g))
  }

  const setResponsible = async (gid: string, memberEmail: string, memberName: string) => {
    if (!canEdit) return
    setGroups(prev => prev.map(g => g.id === gid ? { ...g, members: g.members.map((m: any) => ({ ...m, is_responsible: m.user_email === memberEmail })) } : g))
    await fetch(`${API}/helpdesk/groups/${gid}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_email: memberEmail, user_name: memberName, is_responsible: true }) })
  }

  const tabBtn = (active: boolean) => ({ padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontSize: '12px', fontWeight: active ? '700' : '500', background: active ? '#156082' : 'white', color: active ? 'white' : '#64748B', transition: 'all 0.15s' } as React.CSSProperties)

  if (permLevel === 'loading') return (
    <HelpdeskLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#45B6E4', fontFamily: 'Montserrat, sans-serif' }}>Loading…</div>
    </HelpdeskLayout>
  )

  if (permLevel === 'none') return (
    <HelpdeskLayout>
      <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'Montserrat, sans-serif' }}>
        <div style={{ fontSize: '40px', marginBottom: '14px' }}>🔒</div>
        <div style={{ fontSize: '16px', fontWeight: '700', color: '#156082', marginBottom: '8px' }}>Access Restricted</div>
        <div style={{ fontSize: '13px', color: '#94A3B8' }}>You don't have permission to access the Helpdesk Admin Cockpit.<br/>Contact your HR manager to request access via the Permissions page.</div>
      </div>
    </HelpdeskLayout>
  )

  return (
    <HelpdeskLayout>
      <div style={{ padding: '24px 28px' }}>
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>🔧 Helpdesk Admin Cockpit</h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>Manage categories, subcategories, and support groups</p>
          </div>
          {permLevel === 'view' && (
            <span style={{ background: '#FFF7ED', color: '#D97706', fontSize: '10px', fontWeight: '700', padding: '3px 10px', borderRadius: '8px', letterSpacing: '0.05em' }}>VIEW ONLY</span>
          )}
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '22px', background: '#F1F5F9', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
          <button style={tabBtn(tab === 'categories')} onClick={() => setTab('categories')}>📋 Categories</button>
          <button style={tabBtn(tab === 'groups')} onClick={() => setTab('groups')}>👥 Groups</button>
        </div>

        {/* ── CATEGORIES TAB ── */}
        {tab === 'categories' && (<>
          {canEdit && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '16px 20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '12px' }}>Add Category</div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Name *</label>
                  <input value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createCategory()} placeholder="e.g. Network"
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'Montserrat, sans-serif', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Icon</label>
                  <select value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} style={{ padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'Montserrat, sans-serif', fontSize: '16px', outline: 'none', background: 'white', cursor: 'pointer' }}>
                    {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Color</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {COLORS.map(c => <button key={c} onClick={() => setNewCatColor(c)} style={{ width: '20px', height: '20px', borderRadius: '4px', background: c, border: newCatColor === c ? '2px solid #1F2937' : '2px solid transparent', cursor: 'pointer' }} />)}
                  </div>
                </div>
                <button onClick={createCategory} disabled={!newCatName.trim() || addingCat}
                  style={{ padding: '9px 18px', background: newCatName.trim() ? '#156082' : '#F1F5F9', color: newCatName.trim() ? 'white' : '#94A3B8', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '700', cursor: newCatName.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
                  {addingCat ? 'Adding…' : '+ Add'}
                </button>
              </div>
            </div>
          )}

          {catLoading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {categories.map(cat => {
              const expanded = expandedCat === cat.id
              return (
                <div key={cat.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '12px', background: expanded ? '#F0F7FF' : 'white' }}>
                    {canEdit ? (
                      <select value={cat.icon} onChange={e => saveCategory(cat.id, 'icon', e.target.value)} style={{ fontSize: '18px', border: 'none', background: 'transparent', cursor: 'pointer', padding: '0', outline: 'none', width: '32px' }}>
                        {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    ) : <span style={{ fontSize: '18px' }}>{cat.icon}</span>}
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }} onClick={e => e.stopPropagation()}>
                      <InlineText value={cat.name || ''} placeholder="Category name" onSave={v => saveCategory(cat.id, 'name', v)} readOnly={!canEdit} style={{ fontSize: '13px', fontWeight: '700', color: cat.color }} />
                    </div>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: '3px' }}>
                        {COLORS.map(c => <button key={c} onClick={() => saveCategory(cat.id, 'color', c)} style={{ width: '14px', height: '14px', borderRadius: '3px', background: c, border: cat.color === c ? '2px solid #1F2937' : '1px solid transparent', cursor: 'pointer' }} />)}
                      </div>
                    )}
                    <span style={{ fontSize: '11px', color: '#94A3B8', flexShrink: 0 }}>{cat.subcategories?.length || 0} subs</span>
                    <button onClick={() => setExpandedCat(expanded ? null : cat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94A3B8' }}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                    {canEdit && <button onClick={() => deleteCategory(cat.id)} style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', width: '26px', height: '26px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>}
                  </div>
                  {expanded && (
                    <div style={{ borderTop: '1px solid #EDF2F7', padding: '14px 18px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '10px' }}>Subcategories</div>
                      {(cat.subcategories || []).map((sub: any) => (
                        <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '14px' }}>{sub.icon || '📱'}</span>
                          <div style={{ flex: 1 }}><InlineText value={sub.name || ''} placeholder="Subcategory name" onSave={v => saveSubcategory(cat.id, sub.id, v)} readOnly={!canEdit} style={{ fontSize: '12px' }} /></div>
                          {canEdit && <button onClick={() => deleteSubcategory(sub.id)} style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', width: '24px', height: '24px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>}
                        </div>
                      ))}
                      {canEdit && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <input value={newSubName[cat.id] || ''} onChange={e => setNewSubName(prev => ({ ...prev, [cat.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addSubcategory(cat.id, cat.color)} placeholder="New subcategory name…"
                            style={{ flex: 1, padding: '6px 10px', border: '1.5px solid #EDF2F7', borderRadius: '6px', fontFamily: 'Montserrat, sans-serif', fontSize: '12px', outline: 'none' }} />
                          <button onClick={() => addSubcategory(cat.id, cat.color)} disabled={!(newSubName[cat.id] || '').trim()}
                            style={{ padding: '6px 14px', background: (newSubName[cat.id] || '').trim() ? '#156082' : '#F1F5F9', color: (newSubName[cat.id] || '').trim() ? 'white' : '#94A3B8', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>+ Add</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>)}

        {/* ── GROUPS TAB ── */}
        {tab === 'groups' && (<>
          {canEdit && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '16px 20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '12px' }}>Add Group</div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Name *</label>
                  <input value={newGrpName} onChange={e => setNewGrpName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createGroup()} placeholder="e.g. IT Support Level 2"
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'Montserrat, sans-serif', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const }} />
                </div>
                <div style={{ flex: 2, minWidth: '220px' }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Description</label>
                  <input value={newGrpDesc} onChange={e => setNewGrpDesc(e.target.value)} placeholder="Optional description"
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'Montserrat, sans-serif', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const }} />
                </div>
                <button onClick={createGroup} disabled={!newGrpName.trim() || addingGrp}
                  style={{ padding: '9px 18px', background: newGrpName.trim() ? '#156082' : '#F1F5F9', color: newGrpName.trim() ? 'white' : '#94A3B8', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '700', cursor: newGrpName.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
                  {addingGrp ? 'Adding…' : '+ Add'}
                </button>
              </div>
            </div>
          )}

          {grpLoading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {groups.map(grp => {
              const expanded = expandedGrp === grp.id
              const memberEmails = (grp.members || []).map((m: any) => m.user_email)
              const searchQ = (userSearch[grp.id] || '').toLowerCase()
              const availableUsers = msUsers.filter(u =>
                !memberEmails.includes(u.email) &&
                (!searchQ || (u.display_name || '').toLowerCase().includes(searchQ) || (u.email || '').toLowerCase().includes(searchQ) || (u.job_title || '').toLowerCase().includes(searchQ))
              )
              return (
                <div key={grp.id} style={{ background: 'white', borderRadius: '12px', border: `1px solid ${grp.is_default ? '#BAE6FD' : '#EDF2F7'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '12px', background: grp.is_default ? '#EFF6FF' : (expanded ? '#F0F7FF' : 'white') }}>
                    <span style={{ fontSize: '18px' }}>👥</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#156082' }}>{grp.name}</span>
                        {grp.is_default && <span style={{ background: '#156082', color: 'white', fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '8px', letterSpacing: '0.05em' }}>DEFAULT</span>}
                      </div>
                      {grp.description && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>{grp.description}</div>}
                    </div>
                    <span style={{ fontSize: '11px', color: '#94A3B8', flexShrink: 0 }}>{grp.members?.length || 0} member{grp.members?.length !== 1 ? 's' : ''}</span>
                    {canEdit && !grp.is_default && (
                      <button onClick={() => setDefaultGroup(grp.id, grp)}
                        style={{ fontSize: '11px', color: '#45B6E4', background: '#EFF6FF', border: '1px solid #BAE6FD', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
                        Set as default
                      </button>
                    )}
                    <button onClick={() => setExpandedGrp(expanded ? null : grp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94A3B8' }}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                  </div>

                  {expanded && (
                    <div style={{ borderTop: '1px solid #EDF2F7', padding: '14px 18px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '10px' }}>Members</div>
                      {(grp.members || []).length === 0 && <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '10px' }}>No members yet.</div>}
                      {(grp.members || []).map((m: any) => (
                        <div key={m.user_email} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', padding: '6px 10px', background: '#F8FAFC', borderRadius: '8px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#156082', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}>
                            {(m.user_name || m.user_email)[0]?.toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#1E293B' }}>{m.user_name || m.user_email}</div>
                            <div style={{ fontSize: '10px', color: '#94A3B8' }}>{m.user_email}</div>
                          </div>
                          {m.is_responsible && <span style={{ background: '#FFF7ED', color: '#D97706', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '8px' }}>⭐ Responsible</span>}
                          {canEdit && !m.is_responsible && (
                            <button onClick={() => setResponsible(grp.id, m.user_email, m.user_name || m.user_email)}
                              style={{ fontSize: '10px', color: '#D97706', background: 'transparent', border: '1px solid #FDE68A', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                              Set responsible
                            </button>
                          )}
                          {canEdit && (
                            <button onClick={() => removeMember(grp.id, m.user_email)}
                              style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', width: '24px', height: '24px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                          )}
                        </div>
                      ))}

                      {canEdit && (
                        <div style={{ marginTop: '12px' }}>
                          <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '8px' }}>Add from Microsoft AD</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <input
                              value={userSearch[grp.id] || ''}
                              onChange={e => setUserSearch(prev => ({ ...prev, [grp.id]: e.target.value }))}
                              placeholder="Search by name, email, job title…"
                              style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'Montserrat, sans-serif', fontSize: '12px', outline: 'none', boxSizing: 'border-box' as const }}
                            />
                            {(userSearch[grp.id] || '').length > 0 && (
                              availableUsers.length > 0 ? (
                                <div style={{ background: 'white', border: '1px solid #EDF2F7', borderRadius: '8px', overflow: 'hidden', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                                  {availableUsers.slice(0, 20).map(u => {
                                    const name = u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email
                                    return (
                                      <div key={u.email}
                                        onClick={() => { setAddMemberEmail(prev => ({ ...prev, [grp.id]: u.email })); setUserSearch(prev => ({ ...prev, [grp.id]: name })) }}
                                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '10px' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#F0F7FF'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#E0F2FE', color: '#156082', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
                                          {name[0]?.toUpperCase()}
                                        </div>
                                        <div>
                                          <div style={{ fontSize: '12px', fontWeight: '600', color: '#1E293B' }}>{name}</div>
                                          <div style={{ fontSize: '10px', color: '#94A3B8' }}>{u.email}{u.job_title ? ` · ${u.job_title}` : ''}{u.department ? ` · ${u.department}` : ''}</div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <div style={{ fontSize: '12px', color: '#94A3B8', padding: '6px 0' }}>No matching users found.</div>
                              )
                            )}
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input
                                value={addMemberEmail[grp.id] || ''}
                                onChange={e => setAddMemberEmail(prev => ({ ...prev, [grp.id]: e.target.value }))}
                                placeholder="Email address (or select above)"
                                style={{ flex: 1, padding: '7px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'Montserrat, sans-serif', fontSize: '12px', outline: 'none' }}
                              />
                              <button onClick={() => addMember(grp.id)} disabled={!(addMemberEmail[grp.id] || '').trim()}
                                style={{ padding: '7px 16px', background: (addMemberEmail[grp.id] || '').trim() ? '#156082' : '#F1F5F9', color: (addMemberEmail[grp.id] || '').trim() ? 'white' : '#94A3B8', border: 'none', borderRadius: '7px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>+ Add Member</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>)}
      </div>
    </HelpdeskLayout>
  )
}
