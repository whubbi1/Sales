'use client'
// app/contacts/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { contactsAPI } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/shared/RecordLayout'
import { ContactModal } from '@/components/contacts/ContactModal'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, REPORT_CELL_STYLE, SortArrow, Pagination } from '@/components/it/ReportBuilder'
import { getStoredUser } from '@/lib/auth'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

async function claudeSearch(prompt: string): Promise<string> {
  const r = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }]
    })
  })
  const d = await r.json()
  return d.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n') || 'No results found.'
}

const COLUMNS: ReportColumn[] = [
  { key: 'internal_id', label: 'ID', filterable: 'text' },
  { key: 'contact_name', label: 'Contact', filterable: 'text' },
  { key: 'company_name', label: 'Company/Partner', filterable: 'text' },
  { key: 'job_name', label: 'Job Title', filterable: 'text' },
  { key: 'job_type', label: 'Job Type', filterable: 'text' },
  { key: 'email', label: 'Email', filterable: 'text' },
  { key: 'lead_status', label: 'Lead Status', filterable: 'select', options: ['New', 'Open', 'Connected'] },
  { key: 'preferred_language', label: 'Language', filterable: 'text' },
]

export default function ContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [nameSearch, setNameSearch] = useState('')
  const [showWebSearch, setShowWebSearch] = useState(false)
  const [selectedContact, setSelectedContact] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState('')

  const searchLinkedIn = async (contact: any) => {
    setAiLoading(true); setAiResult('')
    const result = await claudeSearch(
      `Search for the LinkedIn profile of ${contact.first_name} ${contact.last_name}, ${contact.job_name || ''} at ${contact.company?.name || ''}. Find their LinkedIn URL and verify their current role and company. Return the LinkedIn URL and a summary of their profile.`
    )
    setAiResult(result); setAiLoading(false)
  }

  const checkLinkedIn = async (contact: any) => {
    setAiLoading(true); setAiResult('')
    const result = await claudeSearch(
      `Check the LinkedIn profile at ${contact.linkedin_url} for ${contact.first_name} ${contact.last_name}. Verify: 1) Are they still working at ${contact.company?.name || 'their current company'}? 2) Is their role still ${contact.job_name || 'their current role'}? 3) Any recent job changes? Provide a clear summary.`
    )
    setAiResult(result); setAiLoading(false)
  }

  const webSearch = async (contact: any) => {
    setAiLoading(true); setAiResult('')
    const result = await claudeSearch(
      `Search for information about ${contact.first_name} ${contact.last_name}, ${contact.job_name || 'professional'} at ${contact.company?.name || ''}. Find: LinkedIn profile, recent news, professional background, and any relevant business information.`
    )
    setAiResult(result); setAiLoading(false)
  }

  const rb = useReportBuilder('contact', COLUMNS, userEmail)

  const load = async () => {
    try {
      setLoading(true)
      const data = await contactsAPI.list({})
      setContacts(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  const withDisplay = contacts.map(c => ({
    ...c,
    contact_name: `${c.first_name} ${c.last_name}`,
    company_name: c.company?.name || c.partner?.name || '',
  }))
  const searched = withDisplay.filter(c => !nameSearch.trim() || c.contact_name.toLowerCase().includes(nameSearch.trim().toLowerCase()))
  const reported = applyReport(searched, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const pageRows = reported.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '24px 28px' }}>
          <PageHeader
            title="Contacts"
            count={reported.length}
            search={{ value: nameSearch, onChange: setNameSearch }}
            action={
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-secondary" onClick={() => router.push('/contacts/cleanup')}>🧹 Clean-up</button>
                <ReportPanel columns={COLUMNS} rb={rb} />
                <button className="btn-primary" onClick={() => setShowModal(true)}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  New Contact
                </button>
              </div>
            }
          />

          {/* Table */}
          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#FAFBFC' }}>
                <tr>
                  {COLUMNS.filter(c => isVisible(c.key)).map(c => (
                    <th key={c.key} onClick={() => rb.toggleSort(c.key)} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>{c.label}<SortArrow active={rb.sortField === c.key} dir={rb.sortDir} /></th>
                  ))}
                  <th style={{ borderBottom: '1px solid #E2E8F0' }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Loading...</td></tr>
                ) : reported.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length + 1}><EmptyState icon="👤" title="No contacts yet" description="Create your first contact by clicking New Contact" /></td></tr>
                ) : pageRows.map(contact => (
                  <tr key={contact.id} onClick={() => router.push(`/contacts/${contact.id}`)} style={{ cursor: 'pointer', position: 'relative' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    {isVisible('internal_id') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{contact.internal_id || '—'}</td>
                    )}
                    {isVisible('contact_name') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e97132', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat, sans-serif', fontSize: '13px', flexShrink: 0 }}>
                            {contact.first_name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div>{contact.first_name} {contact.last_name}</div>
                            {contact.mobile_phone && <div>{contact.mobile_phone}</div>}
                          </div>
                        </div>
                      </td>
                    )}
                    {isVisible('company_name') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>
                        {contact.company ? (
                          <span onClick={e => { e.stopPropagation(); router.push(`/companies/${contact.company.id}`) }} style={{ cursor: 'pointer' }}>{contact.company.name}</span>
                        ) : contact.partner ? (
                          <span onClick={e => { e.stopPropagation(); router.push(`/partners/${contact.partner.id}`) }} style={{ cursor: 'pointer' }}>{contact.partner.name}</span>
                        ) : '—'}
                      </td>
                    )}
                    {isVisible('job_name') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{contact.job_name || '—'}</td>
                    )}
                    {isVisible('job_type') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{contact.job_type || '—'}</td>
                    )}
                    {isVisible('email') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{contact.email || '—'}</td>
                    )}
                    {isVisible('lead_status') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{contact.lead_status || 'New'}</td>
                    )}
                    {isVisible('preferred_language') && (
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{contact.preferred_language || '—'}</td>
                    )}
                    <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9' }}>
                      <button onClick={e => { e.stopPropagation(); setSelectedContact(contact); setAiResult(''); setShowWebSearch(true) }}
                        style={{ padding:'4px 10px', background:'#EFF6FF', color:'#156082', border:'none', borderRadius:'6px', fontSize:'10px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif', whiteSpace:'nowrap' }}>
                        🔍 Search
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={rb.page} setPage={rb.setPage} total={reported.length} />
          </div>
        </div>

        {/* Web Search Panel */}
        {selectedContact && showWebSearch && (
          <div style={{ position:'fixed', right:0, top:0, width:'420px', height:'100vh', background:'white', boxShadow:'-4px 0 24px rgba(0,0,0,0.12)', zIndex:200, display:'flex', flexDirection:'column', fontFamily:'Montserrat, sans-serif' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #EDF2F7', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#156082' }}>
              <div>
                <div style={{ fontSize:'13px', fontWeight:'800', color:'white' }}>🔍 {selectedContact.first_name} {selectedContact.last_name}</div>
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.6)', marginTop:'2px' }}>{selectedContact.job_name} · {selectedContact.company?.name}</div>
              </div>
              <button onClick={()=>setShowWebSearch(false)} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'white', width:'28px', height:'28px', borderRadius:'6px', cursor:'pointer', fontSize:'16px' }}>×</button>
            </div>

            <div style={{ padding:'14px', borderBottom:'1px solid #EDF2F7', display:'flex', gap:'8px' }}>
              <button onClick={()=>searchLinkedIn(selectedContact)} disabled={aiLoading}
                style={{ flex:1, padding:'8px', background:'#0077B5', color:'white', border:'none', borderRadius:'8px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
                💼 Find LinkedIn
              </button>
              <button onClick={()=>webSearch(selectedContact)} disabled={aiLoading}
                style={{ flex:1, padding:'8px', background:'#156082', color:'white', border:'none', borderRadius:'8px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
                🌐 Web Search
              </button>
              {selectedContact.linkedin_url && (
                <button onClick={()=>checkLinkedIn(selectedContact)} disabled={aiLoading}
                  style={{ flex:1, padding:'8px', background:'#059669', color:'white', border:'none', borderRadius:'8px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
                  ✅ Check LinkedIn
                </button>
              )}
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'14px' }}>
              {aiLoading && (
                <div style={{ textAlign:'center', padding:'32px', color:'#45B6E4' }}>
                  <div style={{ fontSize:'24px', marginBottom:'8px' }}>🤖</div>
                  <div style={{ fontSize:'12px', fontWeight:'600' }}>Claude AI is searching...</div>
                </div>
              )}
              {aiResult && !aiLoading && (
                <div style={{ background:'#F8FAFC', borderRadius:'10px', padding:'14px', fontSize:'12px', color:'#3F3F3F', lineHeight:'1.7', whiteSpace:'pre-wrap' }}>
                  {aiResult}
                </div>
              )}
              {!aiResult && !aiLoading && (
                <div style={{ textAlign:'center', padding:'32px', color:'#45B6E4', fontSize:'12px' }}>
                  Click a button above to search for information about this contact.
                </div>
              )}
            </div>
          </div>
        )}
        {showModal && <ContactModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />}
      </main>
    </div>
  )
}
