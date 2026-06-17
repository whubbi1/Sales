'use client'

export async function generateStaticParams() { return [] }
// app/companies/[id]/page.tsx
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
    } catch { router.push('/companies') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  if (loading) return (
    <RecordLayout
      leftColumn={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#9B9B9B' }}>Loading...</div>}
      rightColumn={<div />}
    />
  )

  const color = LEVEL_COLORS[company.level] || '#144766'

  const leftColumn = (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '11px', color: '#9B9B9B' }}>
        <button onClick={() => router.push('/companies')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontWeight: '600', fontSize: '11px', padding: 0 }}>Companies</button>
        {company.parent && <><span>/</span><Link href={`/companies/${company.parent.id}`} style={{ color: '#219BD6', fontWeight: '600', textDecoration: 'none', fontSize: '11px' }}>{company.parent.name}</Link></>}
        <span>/</span><span style={{ color: '#3F3F3F', fontWeight: '600' }}>{company.name}</span>
      </div>

      {/* Header */}
      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1 }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '800', flexShrink: 0 }}>
              {company.name[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#144766', margin: 0 }}>{company.name}</h1>
                <StatusBadge value={company.status} />
                <span style={{ background: color + '22', color, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{LEVEL_LABELS[company.level]}</span>
              </div>
              <p style={{ color: '#9B9B9B', fontSize: '12px', margin: 0 }}>
                {company.contact_name && `${company.contact_name} · `}
                {company.sector || 'No sector'}
                {company.country && ` · ${company.country}`}
                {company.assigned_to && ` · ${company.assigned_to}`}
              </p>
              {(company.phone || company.linkedin_url) && (
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11px' }}>
                  {company.phone && <span style={{ color: '#6B6B6B' }}>📞 {company.phone}</span>}
                  {company.linkedin_url && <a href={company.linkedin_url} target="_blank" rel="noopener" style={{ color: '#219BD6', textDecoration: 'none', fontWeight: '600' }}>LinkedIn ↗</a>}
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setShowEdit(true)} style={{ background: 'white', color: '#144766', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #CBD5E0', cursor: 'pointer', flexShrink: 0 }}>Edit</button>
        </div>

        {/* Tags */}
        {(company.main_erp?.length > 0 || company.cybersecurity_solutions?.length > 0 || company.sap_hosting_partner?.length > 0 || company.domain_names?.length > 0) && (
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #F1F5F9', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {company.domain_names?.length > 0 && (
              <div>
                <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '5px' }}>Domains</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {company.domain_names.map((d: string) => <span key={d} style={{ background: '#F1F5F9', color: '#475569', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{d}</span>)}
                </div>
              </div>
            )}
            {company.main_erp?.length > 0 && (
              <div>
                <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '5px' }}>ERP</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {company.main_erp.map((v: string) => <span key={v} style={{ background: '#EEF2FF', color: '#4F46E5', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{v}</span>)}
                </div>
              </div>
            )}
            {company.cybersecurity_solutions?.length > 0 && (
              <div>
                <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '5px' }}>Cybersecurity</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {company.cybersecurity_solutions.map((v: string) => <span key={v} style={{ background: '#FFF7ED', color: '#EA580C', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{v}</span>)}
                </div>
              </div>
            )}
            {company.sap_hosting_partner?.length > 0 && (
              <div>
                <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '5px' }}>SAP Hosting</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {company.sap_hosting_partner.map((v: string) => <span key={v} style={{ background: '#ECFDF5', color: '#059669', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{v}</span>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '0 20px', background: '#FAFBFC', borderBottom: '2px solid #E2E8F0' }}>
          <TabNav tabs={['Overview', 'Notes', 'Articles', 'Tasks']} active={tab} onChange={setTab} />
        </div>
        <div style={{ padding: '20px' }}>
          {tab === 'Overview' && (
            <div>
              <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '10px' }}>General Notes</p>
              <p style={{ color: company.notes ? '#3F3F3F' : '#CBD5E0', fontSize: '13px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                {company.notes || 'No general notes. Click "Edit" to add some.'}
              </p>
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
      {/* About */}
      <SidebarSection title="About this company">
        <PropertyRow label="Status" value={<StatusBadge value={company.status} />} />
        <PropertyRow label="Level" value={LEVEL_LABELS[company.level]} />
        <PropertyRow label="Sector" value={company.sector} />
        <PropertyRow label="Country" value={company.country} />
        <PropertyRow label="Assigned to" value={company.assigned_to} />
        <PropertyRow label="Created" value={new Date(company.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
      </SidebarSection>

      {/* Hierarchy */}
      {(company.parent || company.children?.length > 0) && (
        <SidebarSection title="Company Hierarchy">
          {company.parent && <SidebarCard title={company.parent.name} subtitle="Parent company" href={`/companies/${company.parent.id}`} color="#1a5a84" />}
          <SidebarCard title={company.name} subtitle="Current" href={`/companies/${company.id}`} color={color} />
          {company.children?.map((child: any) => (
            <SidebarCard key={child.id} title={child.name} subtitle="Child company" href={`/companies/${child.id}`} color="#219BD6" />
          ))}
        </SidebarSection>
      )}

      {/* Contacts */}
      <SidebarSection title={`Contacts (${contacts.length})`} onAdd={() => router.push(`/contacts/new?company_id=${id}`)}>
        {contacts.length === 0
          ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No contacts associated.</p>
          : contacts.map((c: any) => (
            <SidebarCard key={c.id} title={`${c.first_name} ${c.last_name}`} subtitle={c.job_type || c.email} href={`/contacts/${c.id}`} color="#e97132" />
          ))
        }
      </SidebarSection>

      {/* Deals */}
      <SidebarSection title={`Deals (${opportunities.length})`} onAdd={() => router.push(`/opportunities/new?company_id=${id}`)}>
        {opportunities.length === 0
          ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No deals associated.</p>
          : opportunities.map((o: any) => (
            <SidebarCard key={o.id} title={o.deal_name} subtitle={o.deal_status} href={`/opportunities/${o.id}`} color="#219BD6" />
          ))
        }
      </SidebarSection>
    </div>
  )

  return (
    <>
      <RecordLayout leftColumn={leftColumn} rightColumn={rightColumn} />
      {showEdit && <CompanyModal company={company} companies={allCompanies} onClose={() => setShowEdit(false)} onSave={() => { setShowEdit(false); load() }} />}
    </>
  )
}
