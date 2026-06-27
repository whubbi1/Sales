'use client'
import { useRouter, usePathname } from 'next/navigation'

const NAV = [
  { href: '/rh',              icon: '📊', label: 'Dashboard' },
  { href: '/rh/freelancers',  icon: '🔗', label: 'Freelancers' },
  { href: '/rh/recrutement',  icon: '👥', label: 'Recrutement' },
  { href: '/rh/jobs',         icon: '📋', label: 'Job Descriptions' },
]

export function HRLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const path = usePathname()
  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:'Montserrat, sans-serif' }}>
      <div style={{ width:'220px', background:'#0d2137', position:'fixed', top:0, left:0, height:'100vh', display:'flex', flexDirection:'column', zIndex:100 }}>
        <div style={{ padding:'20px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
            <span style={{ fontSize:'18px' }}>👤</span>
            <span style={{ color:'white', fontSize:'13px', fontWeight:'800', letterSpacing:'0.05em' }}>HR</span>
          </div>
          <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.4)', fontWeight:'500' }}>Human Resources</div>
        </div>
        <nav style={{ flex:1, padding:'12px 8px' }}>
          {NAV.map(item => {
            const active = path === item.href || (item.href !== '/rh' && path.startsWith(item.href))
            return (
              <div key={item.href} onClick={() => router.push(item.href)}
                style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', borderRadius:'8px', cursor:'pointer', marginBottom:'2px',
                  background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: active ? 'white' : 'rgba(255,255,255,0.6)',
                  fontSize:'12px', fontWeight: active ? '700' : '500' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background='rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background='transparent' }}>
                <span style={{ fontSize:'14px' }}>{item.icon}</span>
                {item.label}
                {active && <div style={{ marginLeft:'auto', width:'4px', height:'4px', borderRadius:'50%', background:'#45B6E4' }} />}
              </div>
            )
          })}
        </nav>
        <div style={{ padding:'12px 8px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          <div onClick={() => router.push('/home')}
            style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', borderRadius:'8px', cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize:'12px' }}
            onMouseEnter={e => e.currentTarget.style.color='white'}
            onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.4)'}>
            <span>←</span> All Modules
          </div>
        </div>
      </div>
      <main style={{ marginLeft:'220px', flex:1, background:'#F5F7FA', minHeight:'100vh' }}>
        {children}
      </main>
    </div>
  )
}
