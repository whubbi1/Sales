'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import HelpdeskLayout from '@/components/HelpdeskLayout'
import { fetchUserAttributes } from 'aws-amplify/auth'
const API = 'https://api.whubbi.wcomply.com'

const PRIO_COLOR: Record<string,string> = { critical:'#DC2626', high:'#D97706', medium:'#156082', low:'#45B6E4' }
const STATUS_COLOR: Record<string,{bg:string;color:string}> = {
  open:        { bg:'#EFF6FF', color:'#156082' },
  in_progress: { bg:'#FFF7ED', color:'#D97706' },
  resolved:    { bg:'#ECFDF5', color:'#059669' },
  closed:      { bg:'#F1F5F9', color:'#94A3B8' },
  on_hold:     { bg:'#FDF4FF', color:'#7C3AED' },
}

export default function MyTicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Basic search
  const [search, setSearch] = useState('')
  // Advanced filters
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => {
    fetchUserAttributes().then(attrs => {
      const email = attrs.email || ''
      setUserEmail(email)
      if (email) loadTickets(email)
    }).catch(() => {})

    fetch(`${API}/helpdesk/categories`).then(r=>r.json()).then(d=>setCategories(d.categories||[])).catch(()=>{})
  }, [])

  const loadTickets = (email: string) => {
    setLoading(true)
    fetch(`${API}/helpdesk/tickets?requester_email=${encodeURIComponent(email)}&limit=100`)
      .then(r => r.json())
      .then(d => setTickets(d.tickets || []))
      .finally(() => setLoading(false))
  }

  const filtered = tickets.filter(t => {
    const matchSearch = !search || `${t.ticket_number} ${t.title} ${t.description}`.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || t.status === filterStatus
    const matchPriority = !filterPriority || t.priority === filterPriority
    const matchCategory = !filterCategory || String(t.category_id) === filterCategory
    const matchDateFrom = !filterDateFrom || new Date(t.created_at) >= new Date(filterDateFrom)
    const matchDateTo = !filterDateTo || new Date(t.created_at) <= new Date(filterDateTo + 'T23:59:59')
    return matchSearch && matchStatus && matchPriority && matchCategory && matchDateFrom && matchDateTo
  })

  const resetFilters = () => {
    setSearch(''); setFilterStatus(''); setFilterPriority('')
    setFilterDateFrom(''); setFilterDateTo(''); setFilterCategory('')
  }

  const hasActiveFilters = search || filterStatus || filterPriority || filterDateFrom || filterDateTo || filterCategory

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px',
    fontFamily: 'Montserrat, sans-serif', fontSize: '12px', outline: 'none', width: '100%', boxSizing: 'border-box'
  }
  const selectStyle: React.CSSProperties = { ...inputStyle, background: 'white', cursor: 'pointer' }

  return (
    <HelpdeskLayout>
      <div style={{ padding: '24px 28px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#156082', margin:0 }}>🎫 My Tickets</h1>
            <p style={{ fontSize:'12px', color:'#45B6E4', margin:'4px 0 0' }}>{filtered.length} ticket{filtered.length!==1?'s':''}</p>
          </div>
          <button onClick={() => router.push('/helpdesk/tickets/new')}
            style={{ background:'#156082', color:'white', border:'none', padding:'9px 18px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
            + New Ticket
          </button>
        </div>

        {/* Search bar */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by ticket number, title..."
            style={{ flex:1, padding:'9px 14px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', outline:'none' }}/>
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            style={{ padding:'9px 16px', borderRadius:'8px', border:`1.5px solid ${showAdvanced?'#156082':'#EDF2F7'}`, background:showAdvanced?'#EFF6FF':'white', color:showAdvanced?'#156082':'#45B6E4', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif', whiteSpace:'nowrap' }}>
            🔍 {showAdvanced ? 'Hide filters' : 'More criteria'}
            {hasActiveFilters && !showAdvanced && <span style={{ marginLeft:'6px', background:'#156082', color:'white', borderRadius:'10px', padding:'1px 6px', fontSize:'10px' }}>●</span>}
          </button>
          {hasActiveFilters && (
            <button onClick={resetFilters}
              style={{ padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #FEE2E2', background:'#FEF2F2', color:'#DC2626', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
              ✕ Clear
            </button>
          )}
        </div>

        {/* Advanced filters panel */}
        {showAdvanced && (
          <div style={{ background:'white', borderRadius:'10px', border:'1.5px solid #EDF2F7', padding:'16px', marginBottom:'16px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'12px' }}>Advanced search criteria</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:'10px' }}>
              <div>
                <label style={{ display:'block', fontSize:'10px', fontWeight:'700', color:'#45B6E4', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Status</label>
                <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={selectStyle}>
                  <option value="">All statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="on_hold">On Hold</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'10px', fontWeight:'700', color:'#45B6E4', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Priority</label>
                <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} style={selectStyle}>
                  <option value="">All priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'10px', fontWeight:'700', color:'#45B6E4', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Category</label>
                <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)} style={selectStyle}>
                  <option value="">All categories</option>
                  {categories.map((c:any) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'10px', fontWeight:'700', color:'#45B6E4', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Date from</label>
                <input type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} style={inputStyle}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'10px', fontWeight:'700', color:'#45B6E4', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Date to</label>
                <input type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)} style={inputStyle}/>
              </div>
            </div>
          </div>
        )}

        {loading && <div style={{ textAlign:'center', padding:'48px', color:'#45B6E4' }}>Loading your tickets...</div>}

        {!loading && filtered.length === 0 && (
          <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'48px', textAlign:'center', color:'#45B6E4' }}>
            {hasActiveFilters ? 'No tickets match your search criteria.' : 'You have no tickets yet.'}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
            {filtered.map((t:any, i:number) => {
              const sc = STATUS_COLOR[t.status] || STATUS_COLOR.open
              const slaBreached = t.sla_deadline && new Date(t.sla_deadline) < new Date() && !['resolved','closed'].includes(t.status)
              return (
                <div key={t.id} onClick={() => router.push(`/helpdesk/tickets/${t.id}`)}
                  style={{ display:'flex', alignItems:'center', padding:'14px 20px', borderBottom:'1px solid #F9FAFB', cursor:'pointer', background:i%2===0?'white':'#FAFBFC', gap:'14px' }}
                  onMouseEnter={e => e.currentTarget.style.background='#F0F7FF'}
                  onMouseLeave={e => e.currentTarget.style.background=i%2===0?'white':'#FAFBFC'}>
                  <div style={{ minWidth:'110px' }}>
                    <div style={{ fontSize:'12px', fontWeight:'700', color:'#156082' }}>{t.ticket_number}</div>
                    <div style={{ fontSize:'10px', color:'#94A3B8', marginTop:'2px' }}>
                      {t.created_at ? new Date(t.created_at).toLocaleDateString('fr-FR') : '—'}
                    </div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'13px', fontWeight:'600', color:'#3F3F3F', marginBottom:'3px' }}>{t.title}</div>
                    {t.category_name && <div style={{ fontSize:'11px', color:'#45B6E4' }}>{t.category_icon} {t.category_name}</div>}
                  </div>
                  <div style={{ display:'flex', gap:'6px', alignItems:'center', flexShrink:0 }}>
                    {slaBreached && <span style={{ fontSize:'10px', fontWeight:'700', color:'#DC2626', background:'#FEF2F2', padding:'2px 7px', borderRadius:'10px' }}>⚠️ SLA</span>}
                    <span style={{ padding:'3px 10px', borderRadius:'12px', fontSize:'10px', fontWeight:'700', background:`${PRIO_COLOR[t.priority]}15`, color:PRIO_COLOR[t.priority] }}>
                      {t.priority?.charAt(0).toUpperCase()+t.priority?.slice(1)}
                    </span>
                    <span style={{ padding:'3px 10px', borderRadius:'12px', fontSize:'10px', fontWeight:'700', background:sc.bg, color:sc.color }}>
                      {t.status?.replace('_',' ').replace(/\b\w/g,(l:string)=>l.toUpperCase())}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </HelpdeskLayout>
  )
}
