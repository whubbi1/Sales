'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FinanceLayout, useFinancePerm } from '@/components/FinanceLayout'
import { financeCustomersAPI, companiesAPI, projectsAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn, ColumnResizeHandle, REPORT_CELL_STYLE, SortArrow, Pagination } from '@/components/it/ReportBuilder'
import { PageHeader } from '@/components/shared/RecordLayout'

const CONTRACT_TYPES = ['Master Agreement', 'Project Agreement', 'Purchase Order']

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '700', color: '#45B6E4',
  marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
}
const btn: React.CSSProperties = {
  padding: '9px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif',
}

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

function NewContractModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [companies, setCompanies] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    companiesAPI.list({}).then(setCompanies).catch(() => {})
    projectsAPI.list({}).then(setProjects).catch(() => {})
  }, [])

  const companyProjects = projects.filter((p: any) => p.company?.id === form.company_id)

  const submit = async () => {
    if (!form.company_id) { setError('Company is required'); return }
    setSaving(true); setError('')
    try {
      const me = getStoredUser()
      const r = await financeCustomersAPI.create({ ...form, created_by: me?.email || '' })
      onCreated(r.id)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'white' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: 0 }}>New Customer Contract</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Company *</label>
            <select style={{ ...inp, width: '100%' }} value={form.company_id || ''} onChange={e => setForm({ ...form, company_id: e.target.value, project_id: '' })}>
              <option value="">Select a company…</option>
              {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Project (optional — leave blank for a customer-level contract)</label>
            <select style={{ ...inp, width: '100%' }} value={form.project_id || ''} onChange={e => setForm({ ...form, project_id: e.target.value })} disabled={!form.company_id}>
              <option value="">None</option>
              {companyProjects.map((p: any) => <option key={p.id} value={p.id}>{p.project_number} — {p.project_name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Contract Name</label>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.contract_name || ''} onChange={e => setForm({ ...form, contract_name: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>Contract Type</label>
            <select style={{ ...inp, width: '100%' }} value={form.contract_type || ''} onChange={e => setForm({ ...form, contract_type: e.target.value })}>
              <option value="">Select…</option>
              {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Contract Start</label>
              <input type="date" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.contract_start_date || ''} onChange={e => setForm({ ...form, contract_start_date: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Contract End</label>
              <input type="date" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.contract_end_date || ''} onChange={e => setForm({ ...form, contract_end_date: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Signature Date</label>
              <input type="date" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.signature_date || ''} onChange={e => setForm({ ...form, signature_date: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Contract Value</label>
              <input type="number" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={form.contract_value || ''} onChange={e => setForm({ ...form, contract_value: e.target.value })} />
            </div>
          </div>
          <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>Contacts, invoicing conditions/address, and file uploads can be added afterwards on the contract's own page.</p>
          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
            <button onClick={submit} disabled={saving} style={{ ...btn, background: saving ? '#94A3B8' : '#156082', color: 'white' }}>
              {saving ? 'Creating…' : 'Create Contract'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const COLUMNS: ReportColumn[] = [
  { key: 'internal_id', label: 'Contract #', filterable: 'text' },
  { key: 'contract_name', label: 'Name', filterable: 'text' },
  { key: 'company_name', label: 'Company', filterable: 'text' },
  { key: 'linked_project_name', label: 'Project', filterable: 'text' },
  { key: 'contract_type', label: 'Type', filterable: 'select', options: CONTRACT_TYPES },
  { key: 'contract_start_date', label: 'Start' },
  { key: 'contract_end_date', label: 'End' },
  { key: 'contract_value', label: 'Value' },
]

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  internal_id: 110, contract_name: 220, company_name: 180, linked_project_name: 180,
  contract_type: 160, contract_start_date: 120, contract_end_date: 120, contract_value: 120,
}

function ContractManagementContent() {
  const router = useRouter()
  const { canEdit } = useFinancePerm('customers')
  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  const rb = useReportBuilder('finance_customer_contracts', COLUMNS, userEmail)

  const load = () => financeCustomersAPI.list().then(setContracts).catch(() => {}).finally(() => setLoading(false))

  useEffect(() => {
    load()
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  const withDisplay = contracts.map((c: any) => ({ ...c, company_name: c.company_name || '' }))
  const searched = withDisplay.filter(c => !search.trim() || (c.contract_name || '').toLowerCase().includes(search.trim().toLowerCase()) || (c.internal_id || '').toLowerCase().includes(search.trim().toLowerCase()))
  const reported = applyReport(searched, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const pageRows = reported.slice((rb.page - 1) * 20, rb.page * 20)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div>
      <PageHeader
        title="Contract Management"
        count={reported.length}
        search={{ value: search, onChange: setSearch }}
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <ReportPanel columns={COLUMNS} rb={rb} />
            {canEdit && <button className="btn-primary" onClick={() => setShowNew(true)}>+ New Contract</button>}
          </div>
        }
      />

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {COLUMNS.filter(c => isVisible(c.key)).map(c => (
                <th key={c.key} onClick={() => rb.toggleSort(c.key)} style={{ position: 'relative', textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: `${rb.columnWidths[c.key] || DEFAULT_COLUMN_WIDTHS[c.key] || 150}px`, cursor: 'pointer', userSelect: 'none' }}>
                  {c.label}<SortArrow active={rb.sortField === c.key} dir={rb.sortDir} />
                  <ColumnResizeHandle colKey={c.key} rb={rb} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLUMNS.length} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Loading...</td></tr>
            ) : reported.length === 0 ? (
              <tr><td colSpan={COLUMNS.length} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>No customer contracts yet.</td></tr>
            ) : pageRows.map((c: any) => (
              <tr key={c.id} onClick={() => router.push(`/finance/customers/contracts/${c.id}`)} style={{ cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                {isVisible('internal_id') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE, fontWeight: 700, color: '#64748B' }}>{c.internal_id || '—'}</td>}
                {isVisible('contract_name') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE, fontWeight: 600, color: '#144766' }}>{c.contract_name || '—'}</td>}
                {isVisible('company_name') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{c.company_name || '—'}</td>}
                {isVisible('linked_project_name') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{c.linked_project_name || '—'}</td>}
                {isVisible('contract_type') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{c.contract_type || '—'}</td>}
                {isVisible('contract_start_date') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{fmt(c.contract_start_date)}</td>}
                {isVisible('contract_end_date') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{fmt(c.contract_end_date)}</td>}
                {isVisible('contract_value') && <td style={{ padding: '11px 16px', borderBottom: '1px solid #F1F5F9', ...REPORT_CELL_STYLE }}>{c.contract_value ? `€${c.contract_value.toLocaleString('en-US')}` : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={rb.page} setPage={rb.setPage} total={reported.length} />
      </div>

      {showNew && (
        <NewContractModal onClose={() => setShowNew(false)} onCreated={id => { setShowNew(false); router.push(`/finance/customers/contracts/${id}`) }} />
      )}
    </div>
  )
}

function InvoicingStub() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <div style={{ fontSize: '72px', marginBottom: '24px' }}>🚧</div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#156082', marginBottom: '12px' }}>Under Construction</h1>
        <p style={{ fontSize: '14px', color: '#45B6E4', maxWidth: '420px', margin: '0 auto', lineHeight: '1.7' }}>
          Invoicing will be developed later.
        </p>
      </div>
    </div>
  )
}

function CustomersContent() {
  const { level } = useFinancePerm('customers')
  const [tab, setTab] = useState<'contracts' | 'invoicing'>('contracts')

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '10px 18px', border: 'none', borderBottom: active ? '2px solid #156082' : '2px solid transparent',
    background: 'transparent', color: active ? '#156082' : '#94A3B8', fontWeight: active ? '800' : '600',
    fontSize: '13px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
  })

  if (level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )

  return (
    <div style={{ padding: '24px 28px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>🤝 Customers</h1>
      <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 16px' }}>Customer contracts and invoicing</p>

      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #EDF2F7', marginBottom: '20px' }}>
        <button onClick={() => setTab('contracts')} style={tabBtn(tab === 'contracts')}>Contract Management</button>
        <button onClick={() => setTab('invoicing')} style={tabBtn(tab === 'invoicing')}>Invoicing</button>
      </div>

      {tab === 'contracts' ? <ContractManagementContent /> : <InvoicingStub />}
    </div>
  )
}

export default function CustomersPage() {
  return <FinanceLayout><CustomersContent /></FinanceLayout>
}
