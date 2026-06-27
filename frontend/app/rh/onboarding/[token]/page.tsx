'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

const API = 'https://api.whubbi.wcomply.com'
const LANG_LABELS: Record<string,Record<string,string>> = {
  fr: { title:'Bienvenue chez WCOMPLY', subtitle:'Merci d\'avoir accepté notre offre. Veuillez compléter vos informations.', submit:'Envoyer mes informations', success:'Vos informations ont été reçues. L\'équipe RH vous contactera prochainement.', uploading:'Envoi en cours...', upload:'Télécharger', required:'Champs requis' },
  pt: { title:'Bem-vindo à WCOMPLY', subtitle:'Obrigado por aceitar a nossa proposta. Por favor, complete as suas informações.', submit:'Enviar informações', success:'As suas informações foram recebidas. A equipa de RH contactá-lo-á em breve.', uploading:'A enviar...', upload:'Carregar', required:'Campos obrigatórios' },
  cs: { title:'Vítejte v WCOMPLY', subtitle:'Děkujeme za přijetí naší nabídky. Prosím vyplňte své informace.', submit:'Odeslat informace', success:'Vaše informace byly přijaty. Tým HR vás brzy kontaktuje.', uploading:'Odesílání...', upload:'Nahrát', required:'Povinná pole' },
  ro: { title:'Bun venit la WCOMPLY', subtitle:'Vă mulțumim că ați acceptat oferta noastră. Vă rugăm să completați informațiile dumneavoastră.', submit:'Trimiteți informațiile', success:'Informațiile dumneavoastră au fost primite. Echipa HR vă va contacta în curând.', uploading:'Se trimite...', upload:'Încărcați', required:'Câmpuri obligatorii' },
  es: { title:'Bienvenido/a a WCOMPLY', subtitle:'Gracias por aceptar nuestra oferta. Por favor, complete su información.', submit:'Enviar información', success:'Su información ha sido recibida. El equipo de RRHH se pondrá en contacto con usted pronto.', uploading:'Enviando...', upload:'Cargar', required:'Campos requeridos' },
}

export default function OnboardingPage() {
  const { token } = useParams() as { token: string }
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [personalInfo, setPersonalInfo] = useState<Record<string,string>>({})
  const [uploads, setUploads] = useState<Record<string,string>>({})
  const [uploading, setUploading] = useState<Record<string,boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const fileRefs = useRef<Record<string,HTMLInputElement|null>>({})

  useEffect(() => {
    fetch(`${API}/hr/onboarding/${token}`).then(r=>{ if(!r.ok) throw new Error(); return r.json() }).then(setData).catch(()=>setError('Invalid or expired link')).finally(()=>setLoading(false))
  }, [token])

  const uploadDoc = async (docType: string, file: File) => {
    setUploading(u=>({...u,[docType]:true}))
    const fd = new FormData(); fd.append('file', file)
    const r = await fetch(`${API}/hr/onboarding/${token}/upload-document?doc_type=${docType}`, { method:'POST', body:fd })
    if (r.ok) setUploads(u=>({...u,[docType]:file.name}))
    setUploading(u=>({...u,[docType]:false}))
  }

  const submit = async () => {
    await fetch(`${API}/hr/onboarding/${token}/submit`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ personal_info: personalInfo }) })
    setSubmitted(true)
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', fontFamily:'Montserrat, sans-serif', color:'#45B6E4' }}>Loading...</div>
  if (error) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', fontFamily:'Montserrat, sans-serif', color:'#DC2626', textAlign:'center', padding:'32px' }}>{error}</div>

  const lang = data?.language || 'fr'
  const labels = LANG_LABELS[lang] || LANG_LABELS.fr
  const proposal = data?.proposal || {}
  const docLabels = data?.doc_labels || {}
  const requiredDocs = data?.required_docs || []

  if (submitted) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#F5F7FA', fontFamily:'Montserrat, sans-serif' }}>
      <div style={{ background:'white', borderRadius:'16px', padding:'48px', maxWidth:'500px', textAlign:'center', boxShadow:'0 4px 20px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize:'48px', marginBottom:'16px' }}>✅</div>
        <h2 style={{ fontSize:'18px', fontWeight:'800', color:'#156082', marginBottom:'12px' }}>{labels.success}</h2>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#F5F7FA', fontFamily:'Montserrat, sans-serif', padding:'40px 20px' }}>
      <div style={{ maxWidth:'620px', margin:'0 auto' }}>
        {/* Header */}
        <div style={{ background:'white', borderRadius:'16px', padding:'32px', marginBottom:'20px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', textAlign:'center' }}>
          <div style={{ fontSize:'24px', fontWeight:'900', color:'#156082', marginBottom:'8px' }}>WCOMPLY</div>
          <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#3F3F3F', marginBottom:'8px' }}>{labels.title}</h1>
          <p style={{ fontSize:'13px', color:'#45B6E4', margin:0 }}>{labels.subtitle}</p>
          <div style={{ marginTop:'16px', padding:'12px', background:'#EFF6FF', borderRadius:'10px', fontSize:'13px', color:'#156082', fontWeight:'600' }}>
            {proposal.role} — {proposal.start_date}
          </div>
        </div>

        {/* Personal Info */}
        <div style={{ background:'white', borderRadius:'12px', padding:'24px', marginBottom:'16px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize:'13px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'16px' }}>Personal Information</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {['personal_mobile','bank_iban','bank_name'].map(field=>(
              <div key={field}>
                <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'5px' }}>
                  {field.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}
                </label>
                <input value={personalInfo[field]||''} onChange={e=>setPersonalInfo(p=>({...p,[field]:e.target.value}))}
                  style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #EDF2F7', borderRadius:'8px', fontFamily:'Montserrat, sans-serif', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/>
              </div>
            ))}
          </div>
        </div>

        {/* Document uploads */}
        <div style={{ background:'white', borderRadius:'12px', padding:'24px', marginBottom:'24px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize:'13px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'16px' }}>Required Documents</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {requiredDocs.map((doc:string) => (
              <div key={doc} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', border:'1.5px solid #EDF2F7', borderRadius:'10px', background:uploads[doc]?'#ECFDF5':'white' }}>
                <div>
                  <div style={{ fontSize:'13px', fontWeight:'600', color:'#3F3F3F' }}>{docLabels[doc]||doc}</div>
                  {uploads[doc]&&<div style={{ fontSize:'11px', color:'#059669', marginTop:'2px' }}>✅ {uploads[doc]}</div>}
                </div>
                <div>
                  <input ref={el=>{fileRefs.current[doc]=el}} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:'none' }}
                    onChange={e=>e.target.files?.[0]&&uploadDoc(doc,e.target.files[0])}/>
                  <button onClick={()=>fileRefs.current[doc]?.click()} disabled={uploading[doc]}
                    style={{ padding:'7px 16px', background:uploads[doc]?'#ECFDF5':'#EFF6FF', color:uploads[doc]?'#059669':'#156082', border:`1px solid ${uploads[doc]?'#059669':'#156082'}`, borderRadius:'8px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
                    {uploading[doc]?labels.uploading:uploads[doc]?'✅ Uploaded':labels.upload}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={submit}
          style={{ width:'100%', padding:'14px', background:'#156082', color:'white', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'800', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
          {labels.submit}
        </button>
      </div>
    </div>
  )
}
