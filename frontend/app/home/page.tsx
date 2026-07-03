'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'
const MODULE_LINE_COLOR = '#156082'

const MODULES = [
  { id:'settings', title:'MyWHUBBI', description:'Manage your profile, preferences, notifications and account settings.',           icon:'⚙️', href:'/settings',  color:'#45B6E4', available:true  },
  { id:'task-manager', title:'Task Manager',    description:'Cross-module workflow tasks, subtasks, delegation and Teams-connected updates.',      icon:'✅', href:'/task-manager', color:'#219BD6', available:true  },
  { id:'sales',    title:'Sales',            description:'Manage companies, contacts and opportunities. Track your commercial pipeline.',   icon:'💼', href:'/dashboard', color:'#156082', available:true  },
  { id:'finance',  title:'Finance',           description:'Financial management, invoicing, budgets and cash flow monitoring.',              icon:'💰', href:'/finance',   color:'#e97132', available:false },
  { id:'legal',       title:'Legal',            description:'Legal entities, template documents and compliance. Manage WCOMPLY legal structure.', icon:'⚖️', href:'/legal',        color:'#1a2744', available:true  },
  { id:'rh',       title:'Human Resources',   description:'Manage employees, contracts, onboarding and HR processes.',                       icon:'👥', href:'/rh',        color:'#45B6E4', available:true  },
  { id:'grc',      title:'GRC',               description:'Governance, Risk and Compliance. Manage audits, risks and regulatory frameworks.', icon:'🛡️', href:'/grc',       color:'#7C3AED', available:true  },
  { id:'it',       title:'IT',                description:'IT asset management, incidents, access control and infrastructure monitoring.',    icon:'🖥️', href:'/it',        color:'#45B6E4', available:true  },
  { id:'training',    title:'Training',         description:'Training catalogue, function-based plans, assignments and completion follow-up.',    icon:'🎓', href:'/training',    color:'#7C3AED', available:true  },
  { id:'helpdesk',    title:'Helpdesk',          description:'Support tickets, incident tracking and knowledge base management.',               icon:'🎧', href:'/helpdesk',     color:'#45B6E4', available:true  },
  { id:'development', title:'Development',      description:'Development requests, pipelines, test scripts and test execution tracking.',        icon:'💻', href:'/development', color:'#156082', available:true  },
  { id:'admin',    title:'Admin Cockpit',     description:'Service health, cost tracking, error logs and system administration.',             icon:'🔧', href:'/admin',     color:'#45B6E4', available:true  },
]
const DEFAULT_ORDER = MODULES.map(m => m.id)

interface CompanyLink { id: string; label: string; url: string; icon: string; location_id: string | null; location_name: string }

export default function HomePage() {
  const router = useRouter()
  const [backendStatus, setBackendStatus] = useState<'checking'|'up'|'down'>('checking')
  const [companyLinks, setCompanyLinks] = useState<CompanyLink[]>([])
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER)
  const [dragId, setDragId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API}/health`, { signal: AbortSignal.timeout(5000) })
      .then(r => setBackendStatus(r.ok ? 'up' : 'down'))
      .catch(() => setBackendStatus('down'))

    const user = getStoredUser()
    if (user) {
      setUserName(user.name || user.email)
      setUserEmail(user.email)

      try {
        const raw = localStorage.getItem(`home_module_order_${user.email}`)
        if (raw) {
          const saved: string[] = JSON.parse(raw)
          const validIds = new Set(DEFAULT_ORDER)
          if (Array.isArray(saved) && saved.length === DEFAULT_ORDER.length && saved.every(id => validIds.has(id))) {
            setOrder(saved)
          }
        }
      } catch {}

      fetch(`${API}/settings/main-location/${encodeURIComponent(user.email)}`)
        .then(r => r.json())
        .then(loc => {
          fetch(`${API}/settings/company-links`)
            .then(r => r.json())
            .then(d => {
              const all: CompanyLink[] = d.links || []
              const filtered = all.filter(l => !l.location_id || l.location_name === 'All' || l.location_id === loc.main_location_id)
              setCompanyLinks(filtered)
            })
            .catch(() => {})
        })
        .catch(() => {})
    }
  }, [])

  const orderedModules = order.map(id => MODULES.find(m => m.id === id)).filter((m): m is typeof MODULES[number] => !!m)

  const reorder = (overId: string) => {
    if (!dragId || dragId === overId) return
    setOrder(prev => {
      const next = [...prev]
      const from = next.indexOf(dragId)
      const to = next.indexOf(overId)
      if (from === -1 || to === -1) return prev
      next.splice(from, 1)
      next.splice(to, 0, dragId)
      return next
    })
  }
  const persistOrder = (finalOrder: string[]) => {
    if (userEmail) localStorage.setItem(`home_module_order_${userEmail}`, JSON.stringify(finalOrder))
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F5F7FA', fontFamily:'Montserrat, sans-serif' }}>
      {/* Header */}
      <div style={{ background:'#156082', padding:'16px 40px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          <img src="/logo.png" alt="WCOMPLY" style={{ height:'72px', objectFit:'contain' }}/>
          <div>
            <div style={{ color:'white', fontSize:'17px', fontWeight:'800', letterSpacing:'0.04em' }}>WCOMPLY BUSINESS PLATFORM</div>
            <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'12px', marginTop:'2px' }}>Select a module to get started</div>
          </div>
        </div>
        <div style={{ textAlign:'right' as const }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', justifyContent:'flex-end' }}>
            <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: backendStatus==='up'?'#10B981':backendStatus==='down'?'#EF4444':'#F59E0B' }}/>
            <span style={{ color:'rgba(255,255,255,0.6)', fontSize:'11px' }}>
              {backendStatus==='up'?'All systems operational':backendStatus==='down'?'Backend unavailable':'Checking...'}
            </span>
          </div>
          {userName && <div style={{ color:'rgba(255,255,255,0.85)', fontSize:'12px', fontWeight:'600', marginTop:'4px' }}>{userName}</div>}
        </div>
      </div>

      <div style={{ padding:'40px', maxWidth:'1400px', margin:'0 auto', display:'grid', gridTemplateColumns:'220px 1fr', gap:'32px', alignItems:'start' }}>

        {/* Company Links — left menu */}
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', position:'sticky', top:'24px' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid #EDF2F7', background:'#F8FAFC' }}>
            <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4' }}>🔗 Company Links</div>
          </div>
          <div style={{ padding:'8px' }}>
            {companyLinks.length === 0 ? (
              <div style={{ padding:'16px 12px', fontSize:'11px', color:'#94A3B8', textAlign:'center' as const }}>No links available.</div>
            ) : companyLinks.map(link => (
              <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', borderRadius:'8px', textDecoration:'none', color:'#3F3F3F', fontSize:'12px', fontWeight:'600', transition:'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background='#F0F7FF'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <span style={{ fontSize:'16px' }}>{link.icon || '🔗'}</span>
                <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{link.label}</span>
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#45B6E4" strokeWidth={2.5}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            ))}
          </div>
        </div>

        {/* Modules grid */}
        <div>
          <p style={{ fontSize:'11px', color:'#94A3B8', margin:'0 0 10px' }}>Drag a tile to reorder your modules.</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'18px' }}>
            {orderedModules.map(mod => (
              <div key={mod.id} onClick={() => mod.available && router.push(mod.href)}
                draggable
                onDragStart={() => setDragId(mod.id)}
                onDragOver={e => e.preventDefault()}
                onDragEnter={() => reorder(mod.id)}
                onDrop={() => { persistOrder(order); setDragId(null) }}
                onDragEnd={() => { persistOrder(order); setDragId(null) }}
                style={{ background:'white', borderRadius:'14px', border:'1px solid #EDF2F7', padding:'24px', cursor:'grab', opacity:dragId===mod.id?0.4:mod.available?1:0.7, boxShadow:'0 1px 3px rgba(0,0,0,0.06)', transition:'box-shadow 0.15s, transform 0.15s', position:'relative', overflow:'hidden' }}
                onMouseEnter={e => { if (mod.available) { e.currentTarget.style.boxShadow='0 8px 24px rgba(21,96,130,0.15)'; e.currentTarget.style.transform='translateY(-2px)' }}}
                onMouseLeave={e => { e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform='none' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:MODULE_LINE_COLOR }}/>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px' }}>
                  <div style={{ width:'44px', height:'44px', borderRadius:'10px', background:mod.color+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px' }}>{mod.icon}</div>
                  <span style={{ background:mod.available?mod.color+'15':'#F1F5F9', color:mod.available?mod.color:'#45B6E4', padding:'2px 8px', borderRadius:'20px', fontSize:'9px', fontWeight:'700', textTransform:'uppercase' }}>{mod.available?'Active':'Soon'}</span>
                </div>
                <h2 style={{ fontSize:'13px', fontWeight:'800', color:'#156082', margin:'0 0 6px' }}>{mod.title}</h2>
                <p style={{ fontSize:'11px', color:'#45B6E4', margin:0, lineHeight:'1.6' }}>{mod.description}</p>
                {mod.available && <div style={{ marginTop:'16px', display:'flex', alignItems:'center', gap:'5px', color:mod.color, fontSize:'11px', fontWeight:'700' }}>Open<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
