'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import HelpdeskLayout from '@/components/HelpdeskLayout'
import { getStoredUser } from '@/lib/auth'
import { API, STATUS_STYLE, PRIORITY_STYLE, BTN } from '../constants'

const FILTER_STORAGE = (e: string) => `hd_filters_${e}`
const LAYOUTS_STORAGE = (e: string) => `hd_layouts_${e}`

interface Filters { status: string; priority: string; search: string; mine: boolean }
const DEFAULT_FILTERS: Filters = { status: '', priority: '', search: '', mine: false }

const TICKET_TYPES = [
  { value: 'incident_request',    label: 'Incident Request' },
  { value: 'change_request',      label: 'Change Request' },
  { value: 'information_request', label: 'Information Request' },
]

export default function TicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [savedLayouts, setSavedLayouts] = useState<{ name: string; filters: Filters }[]>([])
  const [showLayoutMenu, setShowLayoutMenu] = useState(false)
  const [layoutName, setLayoutName] = useState('')
  const [savingLayout, setSavingLayout] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [form, setForm] = useState({
    title: '', description: '', category_id: '', subcategory_id: '',
    priority: 'medium', ticket_type: '',
    requester_email: '', requester_name: '',
    requester_type: 'internal', assignee_name: '', group_id: ''
  })
  const [subcategories, setSubcategories] = useState<any[]>([])
  const [lookupLoading, setLookupLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const emailDebounce = useRef<any>(null)
  const readyRef = useRef(false)
  const emailRef = useRef('')

  useEffect(() => {
    const user = getStoredUser()
    if (!user) return
    emailRef.current = user.email
    setUserEmail(user.email)
    setForm(p => ({
      ...p,
      requester_email: user.email,
      requester_name: user.name,
      requester_type: user.email.toLowerCase().endsWith('@wcomply.com') ? 'internal' : 'external',
    }))

    // Load saved filters
    try {
      const saved = localStorage.getItem(FILTER_STORAGE(user.email))
      if (saved) setFilters(JSON.parse(saved))
    } catch {}

    // Load saved layouts
    try {
      const savedL = localStorage.getItem(LAYOUTS_STORAGE(user.email))
      if (savedL) setSavedLayouts(JSON.parse(savedL))
    } catch {}

    // Handle URL params
    const params = new URLSearchParams(window.location.search)
    if (params.get('mine') === '1') setFilters(prev => ({ ...prev, mine: true }))
    if (params.get('new') === '1') setShowModal(true)

    fetch(`${API}/helpdesk/categories`).then(r => r.json()).then(d => setCategories(d.categories || []))
    fetch(`${API}/helpdesk/groups`).then(r => r.json()).then(d => setGroups(d.groups || []))
    readyRef.current = true
  }, [])

  const applyFilter = (next: Filters) => {
    setFilters(next)
    if (emailRef.current) localStorage.setItem(FILTER_STORAGE(emailRef.current), JSON.stringify(next))
  }

  const updateFilter = (key: keyof Filters, value: any) => applyFilter({ ...filters, [key]: value })

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS)
    if (emailRef.current) localStorage.removeItem(FILTER_STORAGE(emailRef.current))
  }

  const saveLayout = () => {
    if (!layoutName.trim() || !emailRef.current) return
    const next = [...savedLayouts.filter(l => l.name !== layoutName.trim()), { name: layoutName.trim(), filters }]
    setSavedLayouts(next)
    localStorage.setItem(LAYOUTS_STORAGE(emailRef.current), JSON.stringify(next))
    setLayoutName(''); setSavingLayout(false)
  }

  const deleteLayout = (name: string) => {
    const next = savedLayouts.filter(l => l.name !== name)
    setSavedLayouts(next)
    if (emailRef.current) localStorage.setItem(LAYOUTS_STORAGE(emailRef.current), JSON.stringify(next))
  }

  const load = async (f = filters, email = emailRef.current) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (f.status)   p.set('status', f.status)
    if (f.priority) p.set('priority', f.priority)
    if (f.search)   p.set('search', f.search)
    if (f.mine && email) p.set('requester_email', email)
    const r = await fetch(`${API}/helpdesk/tickets?${p}`)
    const d = await r.json()
    setTickets(d.tickets || []); setTotal(d.total || 0); setLoading(false)
  }

  useEffect(() => {
    if (readyRef.current) load(filters, emailRef.current)
  }, [filters])

  useEffect(() => {
    if (userEmail) load(filters, userEmail)
  }, [userEmail])

  const handleEmailChange = (email: string) => {
    setForm(p => ({ ...p, requester_email: email }))
    if (emailDebounce.current) clearTimeout(emailDebounce.current)
    if (email.includes('@') && email.endsWith('@wcomply.com')) {
      emailDebounce.current = setTimeout(async () => {
        setLookupLoading(true)
        try {
          const r = await fetch(`${API}/helpdesk/lookup/user?email=${encodeURIComponent(email)}`)
          const d = await r.json()
          if (d.found) setForm(p => ({ ...p, requester_name: d.name, requester_type: 'internal' }))
        } catch {}
        setLookupLoading(false)
      }, 600)
    } else if (!email.endsWith('@wcomply.com') && email.includes('@')) {
      setForm(p => ({ ...p, requester_type: 'external' }))
    }
  }

  const handleCategoryChange = (catId: string) => {
    const cat = categories.find(c => c.id === catId)
    setForm(p => ({ ...p, category_id: catId, subcategory_id: '', group_id: cat?.group_id || '' }))
    setSubcategories(cat?.subcategories || [])
  }

  const create = async () => {
    if (!form.title || !form.requester_email || !form.ticket_type) return
    setSaving(true)
    const r = await fetch(`${API}/helpdesk/tickets`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    })
    const d = await r.json()
    setSaving(false)
    if (d.status === 'ok') { setShowModal(false); router.push(`/helpdesk/tickets/${d.id}`) }
  }

  const hasFilter = !!(filters.status || filters.priority || filters.search || filters.mine)

  const inp = { fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties

  return (
    <HelpdeskLayout>
      <div style={{ padding: '24px 28px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 20px' }}>Tickets ({total})</h1>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...inp, width: '220px' }} placeholder="Search..." value={filters.search} onChange={e => updateFilter('search', e.target.value)} />
          <select style={{ ...inp, width: '155px' }} value={filters.status} onChange={e => updateFilter('status', e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{(v as any).label}</option>)}
          </select>
          <select style={{ ...inp, width: '145px' }} value={filters.priority} onChange={e => updateFilter('priority', e.target.value)}>
            <option value="">All priorities</option>
            {['critical','high','medium','low'].map(p => <option key={p} value={p} style={{ textTransform: 'capitalize' }}>{p}</option>)}
          </select>
          <button onClick={() => updateFilter('mine', !filters.mine)}
            style={{ ...inp, background: filters.mine ? '#156082' : 'white', color: filters.mine ? 'white' : '#64748B', border: filters.mine ? '1px solid #156082' : '1px solid #E2E8F0', cursor: 'pointer', fontWeight: filters.mine ? '700' : '400', whiteSpace: 'nowrap' }}>
            🎫 My Tickets
          </button>
          {hasFilter && (
            <button onClick={clearFilters} style={{ ...inp, background: '#F1F5F9', color: '#64748B', cursor: 'pointer' }}>× Clear</button>
          )}

          {/* Layout save/load */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              style={{ ...inp, background: 'white', color: '#45B6E4', border: '1px solid #E2E8F0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ⊞ Layouts {savedLayouts.length > 0 && <span style={{ background: '#EFF6FF', borderRadius: '8px', padding: '0 5px', fontSize: '10px', fontWeight: '700', color: '#156082' }}>{savedLayouts.length}</span>}
            </button>
            {showLayoutMenu && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: 'white', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, minWidth: '220px', padding: '10px' }}>
                {savedLayouts.length > 0 && (
                  <>
                    <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '6px' }}>Saved</div>
                    {savedLayouts.map(l => (
                      <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <button onClick={() => { applyFilter(l.filters); setShowLayoutMenu(false) }}
                          style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#1E293B', fontFamily: 'Montserrat, sans-serif', padding: '4px 6px', borderRadius: '6px' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                          {l.name}
                        </button>
                        <button onClick={() => deleteLayout(l.name)}
                          style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '13px', padding: '2px 4px', borderRadius: '4px' }}>×</button>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px solid #EDF2F7', marginTop: '8px', paddingTop: '8px' }} />
                  </>
                )}
                {savingLayout ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input autoFocus value={layoutName} onChange={e => setLayoutName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveLayout(); if (e.key === 'Escape') setSavingLayout(false) }}
                      placeholder="Layout name…"
                      style={{ flex: 1, padding: '5px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '12px', fontFamily: 'Montserrat, sans-serif', outline: 'none' }} />
                    <button onClick={saveLayout} style={{ background: '#156082', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>Save</button>
                  </div>
                ) : (
                  <button onClick={() => setSavingLayout(true)}
                    style={{ width: '100%', background: '#EFF6FF', color: '#156082', border: 'none', borderRadius: '6px', padding: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                    + Save current filter
                  </button>
                )}
              </div>
            )}
          </div>

          <button onClick={() => setShowModal(true)} style={{ ...BTN.primary, marginLeft: 'auto' }}>+ New Ticket</button>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ background: '#FAFBFC' }}>
              <tr>{['#','Title','Type','Category','Priority','Status','Group','Requester','Created','SLA'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading...</td></tr>
              : tickets.length === 0 ? <tr><td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>No tickets found.</td></tr>
              : tickets.map(t => {
                const p = PRIORITY_STYLE[t.priority]||PRIORITY_STYLE.medium
                const s = STATUS_STYLE[t.status]||STATUS_STYLE.new
                const breached = t.sla_deadline && new Date(t.sla_deadline) < new Date() && !['resolved','closed'].includes(t.status)
                const typeLabel = t.ticket_type === 'change_request' ? 'Change' : t.ticket_type === 'information_request' ? 'Info' : 'Incident'
                return (
                  <tr key={t.id} onClick={() => router.push(`/helpdesk/tickets/${t.id}`)} style={{ cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <td style={{ padding: '9px 12px', fontWeight: '700', color: '#156082', whiteSpace: 'nowrap' }}>{t.ticket_number}</td>
                    <td style={{ padding: '9px 12px', color: '#3F3F3F', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                    <td style={{ padding: '9px 12px' }}>{t.ticket_type && <span style={{ background: '#F1F5F9', color: '#45B6E4', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600', whiteSpace: 'nowrap' }}>{typeLabel}</span>}</td>
                    <td style={{ padding: '9px 12px' }}>
                      {t.category_name && <span style={{ background: (t.category_color||'#45B6E4')+'20', color: t.category_color||'#45B6E4', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{t.category_icon} {t.category_name}</span>}
                      {t.subcategory_name && <span style={{ background: '#F1F5F9', color: '#45B6E4', padding: '2px 6px', borderRadius: '8px', fontSize: '10px', marginLeft: '4px' }}>{t.subcategory_name}</span>}
                    </td>
                    <td style={{ padding: '9px 12px' }}><span style={{ background: p.bg, color: p.color, padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', textTransform: 'capitalize' }}>{t.priority}</span></td>
                    <td style={{ padding: '9px 12px' }}><span style={{ background: s.bg, color: s.color, padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{s.label}</span></td>
                    <td style={{ padding: '9px 12px', color: '#45B6E4', fontSize: '11px' }}>{t.group_name||'—'}</td>
                    <td style={{ padding: '9px 12px', color: '#3F3F3F' }}>{t.requester_name||t.requester_email}</td>
                    <td style={{ padding: '9px 12px', color: '#45B6E4', whiteSpace: 'nowrap' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}><span style={{ color: breached?'#DC2626':'#059669', fontWeight: '700', fontSize: '11px' }}>{breached?'⚠️':'✅'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(21,96,130,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(2px)' }} onClick={() => setShowModal(false)}>
          <div style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '620px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(21,96,130,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>New Support Ticket</h2>
              <button onClick={() => setShowModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#45B6E4' }}>×</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Ticket Type *</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  {TICKET_TYPES.map(tt => (
                    <button key={tt.value} type="button" onClick={() => setForm(p => ({ ...p, ticket_type: tt.value }))}
                      style={{ flex: 1, padding: '9px 8px', borderRadius: '8px', border: `2px solid ${form.ticket_type === tt.value ? '#156082' : '#EDF2F7'}`,
                        background: form.ticket_type === tt.value ? '#EFF6FF' : 'white',
                        color: form.ticket_type === tt.value ? '#156082' : '#64748B',
                        fontSize: '11px', fontWeight: form.ticket_type === tt.value ? '700' : '400',
                        cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', textAlign: 'center' as const, lineHeight: '1.3' }}>
                      {tt.label}
                    </button>
                  ))}
                </div>
                {!form.ticket_type && <p style={{ fontSize: '10px', color: '#DC2626', margin: '4px 0 0' }}>Please select a ticket type</p>}
              </div>

              <div style={{ background: '#F0F9FF', borderRadius: '10px', padding: '14px', border: '1px solid #BAE6FD' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#156082' }}>Requester</span>
                  <span style={{ fontSize: '10px', color: '#45B6E4' }}>Pre-filled from your account — editable</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="form-label">Email *</label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-input" type="email" value={form.requester_email} onChange={e => handleEmailChange(e.target.value)} placeholder="user@wcomply.com" />
                      {lookupLoading && <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#45B6E4' }}>↻</span>}
                    </div>
                  </div>
                  <div><label className="form-label">Name</label><input className="form-input" value={form.requester_name} onChange={e => setForm(p => ({ ...p, requester_name: e.target.value }))} placeholder="Full name" /></div>
                  <div>
                    <label className="form-label">Organisation</label>
                    <select className="form-input" value={form.requester_type} onChange={e => setForm(p => ({ ...p, requester_type: e.target.value }))}>
                      <option value="internal">Internal (WCOMPLY)</option>
                      <option value="external">External (Client)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div><label className="form-label">Title *</label><input className="form-input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Brief description of the issue" /></div>
              <div><label className="form-label">Description</label><textarea className="form-input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Detailed description..." /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Category</label>
                  <select className="form-input" value={form.category_id} onChange={e => handleCategoryChange(e.target.value)}>
                    <option value="">Select category...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
                {subcategories.length > 0 && (
                  <div>
                    <label className="form-label">Sub-category</label>
                    <select className="form-input" value={form.subcategory_id} onChange={e => setForm(p => ({ ...p, subcategory_id: e.target.value }))}>
                      <option value="">Select...</option>
                      {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="form-label">Priority</label>
                  <select className="form-input" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                    {['critical','high','medium','low'].map(p => <option key={p} value={p} style={{ textTransform: 'capitalize' }}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Assign to Group</label>
                  <select className="form-input" value={form.group_id} onChange={e => setForm(p => ({ ...p, group_id: e.target.value }))}>
                    <option value="">Auto (from category)</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid #EDF2F7', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#FAFBFC' }}>
              <button onClick={() => setShowModal(false)} style={BTN.secondary}>Cancel</button>
              <button onClick={create} disabled={saving || !form.title || !form.requester_email || !form.ticket_type}
                style={{ ...BTN.primary, opacity: (saving || !form.title || !form.requester_email || !form.ticket_type) ? 0.6 : 1 }}>
                {saving ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </HelpdeskLayout>
  )
}
