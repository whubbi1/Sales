'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { HRLayout } from '@/components/HRLayout'

const API = 'https://api.whubbi.wcomply.com'
const FLAG: Record<string,string> = { france:'🇫🇷', portugal:'🇵🇹', czech_republic:'🇨🇿', romania:'🇷🇴', spain:'🇪🇸', '':'🌍' }
const STATUS_COLOR: Record<string,string> = { new:'#45B6E4', screening:'#D97706', interview_1:'#7C3AED', interview_2:'#059669', technical_test:'#e97132', offer:'#156082', hired:'#059669', rejected:'#DC2626', on_hold:'#94A3B8' }

export default function HRDashboard() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/hr/dashboard`).then(r=>r.json()).then(setData).finally(()=>setLoading(false))
  }, [])

  return (
    <HRLayout>
      <div style={{ padding:'28px 32px' }}>
        <div style={{ marginBottom:'24px' }}>
          <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#156082', marginBottom:'4px' }}>HR Dashboard</h1>
          <p style={{ fontSize:'12px', color:'#45B6E4' }}>Recruitment & HR overview</p>
        </div>
        {loading && <div style={{ textAlign:'center', padding:'48px', color:'#45B6E4' }}>Loading...</div>}
        {!loading && data && (<>
          {/* KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'24px' }}>
            {[
              { label:'Freelancers', value: data.stats?.freelancers||0, icon:'🔗', color:'#156082', href:'/rh/freelancers' },
              { label:'Candidates', value: data.stats?.internal_candidates||0, icon:'👥', color:'#7C3AED', href:'/rh/recrutement' },
              { label:'Open Jobs', value: data.stats?.open_jobs||0, icon:'📋', color:'#059669', href:'/rh/jobs' },
              { label:'Pending Proposals', value: data.stats?.pending_proposals||0, icon:'📄', color:'#D97706', href:'/rh/recrutement' },
            ].map(kpi => (
              <div key={kpi.label} onClick={() => router.push(kpi.href)}
                style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'18px', cursor:'pointer', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', borderTop:`3px solid ${kpi.color}` }}>
                <div style={{ fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'8px' }}>{kpi.icon} {kpi.label}</div>
                <div style={{ fontSize:'28px', fontWeight:'900', color:kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'20px' }}>
            {/* Pipeline */}
            <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'20px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize:'12px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'14px' }}>👥 Recruitment Pipeline</h3>
              {Object.entries(data.by_status||{}).length === 0 && <p style={{ color:'#45B6E4', fontSize:'13px' }}>No candidates yet.</p>}
              {Object.entries(data.by_status||{}).map(([status, count]: any) => (
                <div key={status} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #F9FAFB' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: STATUS_COLOR[status]||'#94A3B8' }}/>
                    <span style={{ fontSize:'12px', fontWeight:'600', color:'#3F3F3F', textTransform:'capitalize' }}>{status.replace('_',' ')}</span>
                  </div>
                  <span style={{ fontSize:'13px', fontWeight:'800', color: STATUS_COLOR[status]||'#94A3B8' }}>{count}</span>
                </div>
              ))}
            </div>

            {/* By country */}
            <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'20px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize:'12px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'14px' }}>🌍 By Country</h3>
              {(data.by_country||[]).length === 0 && <p style={{ color:'#45B6E4', fontSize:'13px' }}>No data yet.</p>}
              {(data.by_country||[]).map((r:any) => (
                <div key={r.country} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #F9FAFB' }}>
                  <span style={{ fontSize:'12px', color:'#3F3F3F' }}>{FLAG[r.country]||'🌍'} {r.country}</span>
                  <span style={{ fontSize:'13px', fontWeight:'800', color:'#156082' }}>{r.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent */}
          <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #F1F5F9', background:'#FAFBFC' }}>
              <h3 style={{ fontSize:'12px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4' }}>🕐 Recent Profiles</h3>
            </div>
            {(data.recent||[]).map((p:any, i:number) => (
              <div key={p.id} onClick={() => router.push(p.profile_type==='freelancer'?`/rh/freelancers/${p.id}`:`/rh/recrutement/${p.id}`)}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', borderBottom:'1px solid #F9FAFB', cursor:'pointer', background: i%2===0?'white':'#FAFBFC' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'#156082', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'14px', fontWeight:'700' }}>
                    {(p.first_name||'?')[0]}{(p.last_name||'?')[0]}
                  </div>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:'700', color:'#3F3F3F' }}>{p.first_name} {p.last_name}</div>
                    <div style={{ fontSize:'11px', color:'#45B6E4' }}>{FLAG[p.country]||'🌍'} {p.country}</div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ padding:'3px 10px', borderRadius:'12px', fontSize:'10px', fontWeight:'700', background: p.profile_type==='freelancer'?'#EFF6FF':'#F3F4F6', color: p.profile_type==='freelancer'?'#156082':'#7C3AED' }}>
                    {p.profile_type}
                  </span>
                  {p.recruitment_status && <span style={{ padding:'3px 10px', borderRadius:'12px', fontSize:'10px', fontWeight:'700', background:`${STATUS_COLOR[p.recruitment_status]||'#94A3B8'}15`, color: STATUS_COLOR[p.recruitment_status]||'#94A3B8' }}>{p.recruitment_status}</span>}
                </div>
              </div>
            ))}
          </div>
        </>)}
      </div>
    </HRLayout>
  )
}
