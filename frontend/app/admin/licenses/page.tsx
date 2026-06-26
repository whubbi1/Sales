'use client'
import { useRouter } from 'next/navigation'

export default function LicensesPage() {
  const router = useRouter()
  return (
    <div style={{minHeight:'100vh',background:'#F5F7FA',fontFamily:'Montserrat, sans-serif'}}>
      <div style={{background:'#156082',padding:'0 32px',height:'64px',display:'flex',alignItems:'center',gap:'16px'}}>
        <button onClick={()=>router.push('/admin')} style={{border:'none',background:'rgba(255,255,255,0.1)',color:'white',padding:'6px 14px',borderRadius:'6px',cursor:'pointer',fontSize:'12px',fontFamily:'Montserrat, sans-serif',fontWeight:'600'}}>← Admin</button>
        <span style={{color:'white',fontSize:'15px',fontWeight:'800'}}>📋 License Management</span>
      </div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',minHeight:'calc(100vh - 64px)'}}>
        <div style={{textAlign:'center',padding:'48px'}}>
          <div style={{fontSize:'72px',marginBottom:'24px'}}>🚧</div>
          <h1 style={{fontSize:'24px',fontWeight:'800',color:'#156082',marginBottom:'12px'}}>Under Construction</h1>
          <p style={{fontSize:'14px',color:'#45B6E4',maxWidth:'400px',margin:'0 auto',lineHeight:'1.7'}}>
            The License Management module is currently being developed. It will allow you to track and manage all software licenses across WCOMPLY.
          </p>
          <div style={{marginTop:'32px',display:'inline-flex',gap:'12px',padding:'16px 24px',background:'white',borderRadius:'12px',border:'1px solid #EDF2F7'}}>
            {['Microsoft 365','AWS','HubSpot','Payfit','Karanext'].map(app=>(
              <span key={app} style={{background:'#F1F5F9',color:'#45B6E4',padding:'6px 12px',borderRadius:'8px',fontSize:'12px',fontWeight:'600'}}>{app}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
