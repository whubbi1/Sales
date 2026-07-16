'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { companiesAPI } from '@/lib/api'
import { RecordLayout, PropertyRow, SidebarSection, SidebarCard, StatusBadge, TabNav } from '@/components/shared/RecordLayout'
import { CompanyModal } from '@/components/companies/CompanyModal'
import { CompanyNotes } from '@/components/companies/CompanyNotes'
import { CompanyArticles } from '@/components/companies/CompanyArticles'
import { CompanyTasks } from '@/components/companies/CompanyTasks'

const LEVEL_COLORS: Record<number, string> = { 1: '#144766', 2: '#1a5a84', 3: '#219BD6', 4: '#7DD3F0' }
const LEVEL_LABELS: Record<number, string> = { 1: 'Group', 2: 'Parent', 3: 'Child', 4: 'Sub-Child' }

export default function CompanyDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [company, setCompany] = useState<any>(null)
  const [allCompanies, setAllCompanies] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [searchType, setSearchType] = useState('')

  const runSearch = async (type: string) => {
    setAiLoading(true); setAiResult(''); setSearchType(type)
    let prompt = ''
    if (type === 'general') {
      prompt = `Search for comprehensive information about the company "${company.name}". Find: website, key executives, recent news, business activities, financial information, and any notable developments.`
    } else if (type === 'sap') {
      prompt = `Search for SAP-related information about "${company.name}". Find: their SAP implementation details, SAP projects, SAP partnerships, ERP systems used, any SAP-related news or case studies, and their digital transformation initiatives.`
    } else if (type === 'cybersecurity') {
      prompt = `Search for cybersecurity information about "${company.name}". Find: any cybersecurity incidents, data breaches, security certifications (ISO 27001, SOC2), their security posture, any partnerships with cybersecurity vendors.`
    } else if (type === 'mergers') {
      prompt = `Search for merger, acquisition, and strategic information about "${company.name}". Find: any recent M&A activity, acquisitions made, companies they were acquired by, partnerships, joint ventures, and strategic alliances.`
    }
    try {
      const { result } = await companiesAPI.research(prompt)
      setAiResult(result)
    } catch (e: any) {
      setAiResult(`Error: ${e.message}`)
    } finally {
      setAiLoading(false)
    }
  }

  const load = async () => {
    try {
      const [c, all, ctcts, opps] = await Promise.all([
        companiesAPI.get(id as string),
        companiesAPI.list({}),
        companiesAPI.getContacts(id as string),
        companiesAPI.getOpportunities(id as string),
      ])
      setCompany(c)
      setAllCompanies(all)
      setContacts(ctcts)
      setOpportunities(opps)
    } catch {
      router.push('/companies')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  if (loading) return (
    <RecordLayout
      leftColumn={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#9B9B9B' }}>Loading...</div>}
      rightColumn={<div />}
    />
  )

  if (!company) return null

  const color = LEVEL_COLORS[company.level] || '#144766'

  const leftColumn = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '11px', color: '#9B9B9B' }}>
        <button onClick={() => router.push('/companies')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontWeight: '600', fontSize: '11px', padding: 0 }}>Companies</button>
        {company.parent && <><span>/</span><Link href={`/companies/${company.parent.id}`} style={{ color: '#219BD6', fontWeight: '600', textDecoration: 'none', fontSize: '11px' }}>{company.parent.name}</Link></>}
        <span>/</span><span style={{ color: '#3F3F3F', fontWeight: '600' }}>{company.name}</span>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1 }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '800', flexShrink: 0 }}>
              {company.name[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#144766', margin: 0 }}>{company.name}</h1>
                {company.internal_id && <span style={{ fontSize: '11px', fontWeight: '600', color: '#9B9B9B' }}>{company.internal_id}</span>}
                <StatusBadge value={company.status} />
                <span style={{ background: color + '22', color, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{LEVEL_LABELS[company.level]}</span>
              </div>
              <p style={{ color: '#9B9B9B', fontSize: '12px', margin: 0 }}>
                {company.main_contact && `${company.main_contact.first_name} ${company.main_contact.last_name} · `}
                {company.sector || 'No sector'}
                {company.country && ` · ${company.country}`}
              </p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11px' }}>
                {company.phone && <span style={{ color: '#6B6B6B' }}>📞 {company.phone}</span>}
                {company.linkedin_url && <a href={company.linkedin_url} target="_blank" rel="noopener" style={{ color: '#219BD6', fontWeight: '600' }}>LinkedIn ↗</a>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowEdit(true)} style={{ background: 'white', color: '#144766', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #CBD5E0', cursor: 'pointer' }}>Edit</button>
            <button onClick={() => { setDeleteConfirm(''); setShowDelete(true) }} style={{ background: 'white', color: '#DC2626', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #FCA5A5', cursor: 'pointer' }}>Delete</button>
          </div>
        </div>
        {(company.main_erp?.length > 0 || company.cybersecurity_solutions?.length > 0 || company.sap_hosting_partner?.length > 0 || company.domain_names?.length > 0) && (
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #F1F5F9', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {company.domain_names?.length > 0 && <div><div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '5px' }}>Domains</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>{company.domain_names.map((d: string) => <span key={d} style={{ background: '#F1F5F9', color: '#475569', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{d}</span>)}</div></div>}
            {company.main_erp?.length > 0 && <div><div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '5px' }}>ERP</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>{company.main_erp.map((v: string) => <span key={v} style={{ background: '#EEF2FF', color: '#4F46E5', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{v}</span>)}</div></div>}
            {company.cybersecurity_solutions?.length > 0 && <div><div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '5px' }}>Cybersecurity</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>{company.cybersecurity_solutions.map((v: string) => <span key={v} style={{ background: '#FFF7ED', color: '#EA580C', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{v}</span>)}</div></div>}
            {company.sap_hosting_partner?.length > 0 && <div><div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '5px' }}>SAP Hosting</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>{company.sap_hosting_partner.map((v: string) => <span key={v} style={{ background: '#ECFDF5', color: '#059669', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{v}</span>)}</div></div>}
          </div>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '0 20px', background: '#FAFBFC', borderBottom: '2px solid #E2E8F0' }}>
          <TabNav tabs={['Overview', 'Research', 'Notes', 'Articles', 'Tasks']} active={tab} onChange={setTab} />
        </div>
        <div style={{ padding: '20px' }}>
          {tab === 'Overview' && <p style={{ color: company.notes ? '#3F3F3F' : '#CBD5E0', fontSize: '13px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{company.notes || 'No general notes.'}</p>}
          {tab === 'Research' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {[
                  { type: 'general',       label: '🌐 General',       color: '#156082' },
                  { type: 'sap',           label: '⚙️ SAP',           color: '#0078D4' },
                  { type: 'cybersecurity', label: '🛡️ Cybersecurity', color: '#DC2626' },
                  { type: 'mergers',       label: '🤝 M&A',           color: '#7C3AED' },
                ].map(btn => (
                  <button key={btn.type} onClick={() => runSearch(btn.type)} disabled={aiLoading}
                    style={{ flex: 1, minWidth: '100px', padding: '9px 8px', background: searchType === btn.type ? btn.color : btn.color + '15', color: searchType === btn.type ? 'white' : btn.color, border: `1.5px solid ${btn.color}30`, borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', transition: 'all 0.15s' }}>
                    {btn.label}
                  </button>
                ))}
              </div>
              {aiLoading && (
                <div style={{ textAlign: 'center', padding: '32px', color: '#45B6E4' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>🤖</div>
                  <div style={{ fontSize: '12px', fontWeight: '600' }}>Claude AI is searching the web...</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>This may take a few seconds</div>
                </div>
              )}
              {aiResult && !aiLoading && (
                <div>
                  <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '10px' }}>
                    {searchType === 'general' ? '🌐 General Information' : searchType === 'sap' ? '⚙️ SAP & ERP' : searchType === 'cybersecurity' ? '🛡️ Cybersecurity' : '🤝 M&A & Partnerships'}
                  </div>
                  <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '14px', fontSize: '12px', color: '#3F3F3F', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                    {aiResult}
                  </div>
                </div>
              )}
              {!aiResult && !aiLoading && (
                <div style={{ textAlign: 'center', padding: '32px', color: '#45B6E4', fontSize: '12px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏢</div>
                  Select a search type above to find information about {company.name}.
                </div>
              )}
            </div>
          )}
          {tab === 'Notes' && <CompanyNotes companyId={id as string} />}
          {tab === 'Articles' && <CompanyArticles companyId={id as string} />}
          {tab === 'Tasks' && <CompanyTasks companyId={id as string} />}
        </div>
      </div>
    </div>
  )

  const rightColumn = (
    <div>
      <SidebarSection title="About this company">
        <PropertyRow label="Status" value={<StatusBadge value={company.status} />} />
        <PropertyRow label="Level" value={LEVEL_LABELS[company.level]} />
        <PropertyRow label="Sector" value={company.sector} />
        <PropertyRow label="Country" value={company.country} />
        <PropertyRow label="Assigned to" value={company.assigned_to} />
        <PropertyRow label="Created" value={new Date(company.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
      </SidebarSection>
      {(company.parent || company.children?.length > 0) && (
        <SidebarSection title="Company Hierarchy">
          {company.parent && <SidebarCard title={company.parent.name} subtitle="Parent company" href={`/companies/${company.parent.id}`} color="#1a5a84" />}
          <SidebarCard title={company.name} subtitle="Current" href={`/companies/${company.id}`} color={color} />
          {company.children?.map((child: any) => <SidebarCard key={child.id} title={child.name} subtitle="Child company" href={`/companies/${child.id}`} color="#219BD6" />)}
        </SidebarSection>
      )}
      <SidebarSection title={`Contacts (${contacts.length})`} onAdd={() => router.push(`/contacts?company_id=${id}`)}>
        {contacts.length === 0 ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No contacts.</p> : contacts.map((c: any) => <SidebarCard key={c.id} title={`${c.first_name} ${c.last_name}`} subtitle={c.job_type || c.email} href={`/contacts/${c.id}`} color="#e97132" />)}
      </SidebarSection>
      <SidebarSection title={`Opportunities (${opportunities.length})`} onAdd={() => router.push(`/opportunities?company_id=${id}`)}>
        {opportunities.length === 0 ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No opportunities.</p> : opportunities.map((o: any) => <SidebarCard key={o.id} title={o.deal_name} subtitle={o.deal_status} href={`/opportunities/${o.id}`} color="#219BD6" />)}
      </SidebarSection>
    </div>
  )

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try {
      await companiesAPI.delete(company.id)
      router.push('/companies')
    } catch {
      setDeleting(false)
    }
  }

  return (
    <>
      <RecordLayout leftColumn={leftColumn} rightColumn={rightColumn} />
      {showEdit && <CompanyModal company={company} companies={allCompanies} onClose={() => setShowEdit(false)} onSave={() => { setShowEdit(false); load() }} />}
      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#DC2626' }}>Delete Company</h2>
              <button onClick={() => setShowDelete(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: '#3F3F3F', marginBottom: '8px' }}>
                You are about to permanently delete <strong>{company.name}</strong>. This action cannot be undone.
              </p>
              <p style={{ fontSize: '13px', color: '#3F3F3F', marginBottom: '12px' }}>
                Type <strong style={{ color: '#DC2626' }}>DELETE</strong> to confirm.
              </p>
              <input
                className="form-input"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDelete()}
                placeholder="Type DELETE to confirm"
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDelete(false)}>Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                style={{ background: deleteConfirm === 'DELETE' ? '#DC2626' : '#FCA5A5', color: 'white', padding: '8px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'not-allowed', transition: 'background 0.15s' }}
              >
                {deleting ? 'Deleting...' : 'Delete Company'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
