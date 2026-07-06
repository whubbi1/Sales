'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { BackendCheck } from '@/components/BackendCheck'
import { companiesAPI, contactsAPI, opportunitiesAPI } from '@/lib/api'

const WON_STATUSES = ['PO Received', 'Contract Finalised']
const CURRENT_YEAR = new Date().getFullYear().toString()

const COMPANY_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  lead:     { bg: '#EFF6FF', color: '#3B82F6' },
  prospect: { bg: '#FFF7ED', color: '#D97706' },
  client:   { bg: '#ECFDF5', color: '#059669' },
  partner:  { bg: '#F5F3FF', color: '#7C3AED' },
}

const OPP_STATUS_STYLE: Record<string, { bg: string; color: string; short: string }> = {
  'Presentation To Be Scheduled': { bg: '#EEF2FF', color: '#4F46E5', short: 'To Schedule' },
  'Presentation Done':            { bg: '#FFF7ED', color: '#D97706', short: 'Presented' },
  'Proposition Ongoing':          { bg: '#FFF7ED', color: '#EA580C', short: 'Prop. Ongoing' },
  'Proposition Accepted':         { bg: '#ECFDF5', color: '#059669', short: 'Prop. Accepted' },
  'Contract Ongoing':             { bg: '#ECFDF5', color: '#059669', short: 'Contract Ongoing' },
  'Contract Finalised':           { bg: '#D1FAE5', color: '#047857', short: 'Finalised' },
  'PO Received':                  { bg: '#D1FAE5', color: '#047857', short: 'PO Received' },
  'Contract Lost':                { bg: '#FEF2F2', color: '#DC2626', short: 'Lost' },
}

function StatCard({ icon, label, count, color, sub, onClick }: {
  icon: string; label: string; count: number | string; color: string
  sub?: { label: string; count: number; bg: string; textColor: string }[]
  onClick?: () => void
}) {
  return (
    <div onClick={onClick} style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: `3px solid ${color}`, cursor: onClick ? 'pointer' : 'default', transition: 'all 0.15s' }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.boxShadow = '0 4px 12px rgba(21,96,130,0.10)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '4px', fontFamily: 'Montserrat, sans-serif' }}>{label}</div>
          <div style={{ fontSize: '32px', fontWeight: '800', color, fontFamily: 'Montserrat, sans-serif', lineHeight: 1 }}>{count}</div>
        </div>
        <span style={{ fontSize: '28px' }}>{icon}</span>
      </div>
      {sub && sub.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {sub.map(s => (
            <span key={s.label} style={{ background: s.bg, color: s.textColor, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
              {s.label}: {s.count}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [opportunities, setOpportunities] = useState<any[]>([])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      companiesAPI.list(),
      contactsAPI.list(),
      opportunitiesAPI.list(),
    ]).then(([c, ct, o]) => {
      setCompanies(Array.isArray(c) ? c : [])
      setContacts(Array.isArray(ct) ? ct : [])
      setOpportunities(Array.isArray(o) ? o : [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const countByStatus = (arr: any[], field: string) =>
    arr.reduce((acc, item) => { const s = item[field] || 'unknown'; acc[s] = (acc[s] || 0) + 1; return acc }, {} as Record<string, number>)

  const companyByStatus = countByStatus(companies, 'status')
  const oppByStatus = countByStatus(opportunities, 'deal_status')

  const wonAll = opportunities.filter(o => WON_STATUSES.includes(o.deal_status) && o.deal_amount)
  const wonYear = wonAll.filter(o => o.closing_date && String(o.closing_date).startsWith(CURRENT_YEAR))
  const openOpps = opportunities.filter(o => !WON_STATUSES.includes(o.deal_status) && o.deal_status !== 'Contract Lost')

  const salesAll  = wonAll.reduce((s, o) => s + (o.deal_amount || 0), 0)
  const salesYear = wonYear.reduce((s, o) => s + (o.deal_amount || 0), 0)
  const openValue = openOpps.reduce((s, o) => s + (o.deal_amount || 0), 0)

  const fmt = (n: number) => `€${n.toLocaleString('en-US', { minimumFractionDigits: 0 })}`

  return (
    <div style={{ display: 'flex' }}>
      <BackendCheck />
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '32px 36px' }}>
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#156082', marginBottom: '4px', fontFamily: 'Montserrat, sans-serif' }}>Sales Dashboard</h1>
            <p style={{ fontSize: '13px', color: '#848EA5', fontFamily: 'Montserrat, sans-serif' }}>Commercial management</p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#45B6E4', fontFamily: 'Montserrat, sans-serif', fontSize: '13px' }}>Loading…</div>
          ) : (<>
            {/* Entity counts */}
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '12px', fontFamily: 'Montserrat, sans-serif' }}>Overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
              <StatCard
                icon="🏢" label="Companies" count={companies.length} color="#156082"
                onClick={() => router.push('/companies')}
                sub={Object.entries(companyByStatus).map(([status, count]) => ({
                  label: status.charAt(0).toUpperCase() + status.slice(1),
                  count: count as number,
                  bg: COMPANY_STATUS_STYLE[status]?.bg || '#F1F5F9',
                  textColor: COMPANY_STATUS_STYLE[status]?.color || '#475569',
                }))}
              />
              <StatCard
                icon="👤" label="Contacts" count={contacts.length} color="#848EA5"
                onClick={() => router.push('/contacts')}
              />
              <StatCard
                icon="💼" label="Opportunities" count={opportunities.length} color="#e97132"
                onClick={() => router.push('/opportunities')}
                sub={Object.entries(oppByStatus).map(([status, count]) => ({
                  label: OPP_STATUS_STYLE[status]?.short || status,
                  count: count as number,
                  bg: OPP_STATUS_STYLE[status]?.bg || '#F1F5F9',
                  textColor: OPP_STATUS_STYLE[status]?.color || '#475569',
                }))}
              />
            </div>

            {/* Sales section */}
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '12px', fontFamily: 'Montserrat, sans-serif' }}>Sales</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {/* All-time */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: '3px solid #059669' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '4px', fontFamily: 'Montserrat, sans-serif' }}>All-time closed won</div>
                <div style={{ fontSize: '36px', fontWeight: '800', color: '#059669', fontFamily: 'Montserrat, sans-serif', lineHeight: 1, marginBottom: '10px' }}>{fmt(salesAll)}</div>
                <div style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'Montserrat, sans-serif' }}>{wonAll.length} deal{wonAll.length !== 1 ? 's' : ''} closed</div>
              </div>

              {/* Current year */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: '3px solid #156082' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '4px', fontFamily: 'Montserrat, sans-serif' }}>{CURRENT_YEAR} closed won</div>
                <div style={{ fontSize: '36px', fontWeight: '800', color: '#156082', fontFamily: 'Montserrat, sans-serif', lineHeight: 1, marginBottom: '10px' }}>{fmt(salesYear)}</div>
                <div style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'Montserrat, sans-serif' }}>{wonYear.length} deal{wonYear.length !== 1 ? 's' : ''} closed this year</div>
              </div>

              {/* Open pipeline */}
              <div onClick={() => router.push('/opportunities')} style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: '3px solid #e97132', cursor: 'pointer' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '4px', fontFamily: 'Montserrat, sans-serif' }}>Open Opportunities</div>
                <div style={{ fontSize: '36px', fontWeight: '800', color: '#e97132', fontFamily: 'Montserrat, sans-serif', lineHeight: 1, marginBottom: '10px' }}>{fmt(openValue)}</div>
                <div style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'Montserrat, sans-serif' }}>{openOpps.length} open deal{openOpps.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          </>)}
        </div>
      </main>
    </div>
  )
}
