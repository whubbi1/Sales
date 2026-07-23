'use client'
// Global "Easy Access" search — dropped into every module's sidebar. Click to open a
// command-palette-style search over every module's functionalities; typing filters by
// module name or item label, results are filtered to what the user actually has access to
// (same "no permission row -> full access, access_mode='none' -> hidden" convention used by
// every use<Module>Perm hook across the app), then navigates on click.
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

type RegistryItem = { label: string; href: string; moduleKey?: string; subKey?: string; roles?: string[] }
type ModuleGroup = { module: string; icon: string; items: RegistryItem[] }

// Mirrors every module Layout's own NAV array — kept in sync manually since each Layout
// defines its nav independently. moduleKey/subKey map to GET /settings/permissions/{email}'s
// MODULES matrix (backend/app/routers/settings.py); items with neither are pages that aren't
// gated anywhere in the app today, so Easy Access doesn't gate them either. Helpdesk uses a
// separate role system (not the permissions matrix), hence its own `roles` field.
const REGISTRY: ModuleGroup[] = [
  { module: 'Sales', icon: '💼', items: [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Companies', href: '/companies' },
    { label: 'Partners', href: '/partners' },
    { label: 'Contacts', href: '/contacts' },
    { label: 'Leads', href: '/leads' },
    { label: 'Opportunities', href: '/opportunities' },
    { label: 'RFP', href: '/rfp' },
    { label: 'Tasks', href: '/tasks' },
    { label: 'Staffing', href: '/staffing' },
    { label: 'CV Database', href: '/cv-database' },
  ] },
  { module: 'Marketing', icon: '📣', items: [
    { label: 'Events', href: '/marketing/events', moduleKey: 'marketing', subKey: 'events' },
    { label: 'Company Website', href: '/marketing/company-website', moduleKey: 'marketing', subKey: 'company_website' },
    { label: 'Competitor Analysis', href: '/marketing/competitor-analysis', moduleKey: 'marketing', subKey: 'competitor_analysis' },
    { label: 'Social Marketing', href: '/marketing/social-marketing', moduleKey: 'marketing', subKey: 'social_marketing' },
    { label: 'Marketing Plan', href: '/marketing/marketing-plan', moduleKey: 'marketing', subKey: 'marketing_plan' },
    { label: 'Marketing Material', href: '/marketing/marketing-material', moduleKey: 'marketing', subKey: 'marketing_material' },
  ] },
  { module: 'Operations', icon: '🛠️', items: [
    { label: 'Projects', href: '/operations/projects', moduleKey: 'operations', subKey: 'projects' },
    { label: 'Internal Projects', href: '/operations/internal-projects', moduleKey: 'operations', subKey: 'internal_projects' },
    { label: 'Licenses', href: '/operations/licenses', moduleKey: 'operations', subKey: 'licenses' },
    { label: 'Staffing', href: '/operations/staffing', moduleKey: 'operations', subKey: 'staffing' },
    { label: 'Timesheets', href: '/operations/timesheets', moduleKey: 'operations', subKey: 'timesheets' },
  ] },
  { module: 'Reporting', icon: '📊', items: [
    { label: 'Reports', href: '/reporting/reports', moduleKey: 'reporting', subKey: 'reports' },
    { label: 'Dashboards', href: '/reporting/dashboards', moduleKey: 'reporting', subKey: 'dashboards' },
  ] },
  { module: 'Finance', icon: '💰', items: [
    { label: 'Suppliers', href: '/finance/suppliers', moduleKey: 'finance', subKey: 'suppliers' },
    { label: 'Contracts', href: '/finance/contracts', moduleKey: 'finance', subKey: 'contracts' },
    { label: 'Purchasing', href: '/finance/purchasing', moduleKey: 'finance', subKey: 'purchasing' },
    { label: 'Invoicing', href: '/finance/invoicing', moduleKey: 'finance', subKey: 'invoices' },
    { label: 'Customers', href: '/finance/customers', moduleKey: 'finance', subKey: 'customers' },
  ] },
  { module: 'Legal', icon: '⚖️', items: [
    { label: 'Legal Entities', href: '/legal/entities' },
    { label: 'Locations', href: '/legal/locations' },
    { label: 'Sales Entities', href: '/legal/sales-entities' },
    { label: 'Operational Teams', href: '/legal/operational-teams' },
    { label: 'Purchasing Entities', href: '/legal/purchasing-entities' },
    { label: 'Template Documents', href: '/legal/templates' },
    { label: 'Admin Cockpit', href: '/legal/admin' },
  ] },
  { module: 'Human Resources', icon: '👥', items: [
    { label: 'Dashboard', href: '/rh' },
    { label: 'Freelancers', href: '/rh/freelancers', moduleKey: 'hr', subKey: 'freelancers' },
    { label: 'Recrutement', href: '/rh/recrutement', moduleKey: 'hr', subKey: 'recrutement' },
    { label: 'Job Positions', href: '/rh/positions', moduleKey: 'hr', subKey: 'positions' },
    { label: 'Job Descriptions', href: '/rh/jobs', moduleKey: 'hr', subKey: 'jobs' },
    { label: 'Onboarding', href: '/rh/onboarding-checklist', moduleKey: 'hr', subKey: 'onboarding' },
    { label: 'Offboarding', href: '/rh/offboarding-checklist', moduleKey: 'hr', subKey: 'offboarding' },
    { label: 'WHUBBI Permissions', href: '/rh/permissions', moduleKey: 'hr', subKey: 'permissions' },
    { label: 'WHUBBI Chat', href: '/rh/chat', moduleKey: 'hr', subKey: 'chat' },
    { label: 'PayFit Integration', href: '/rh/payfit', moduleKey: 'hr', subKey: 'payfit' },
    { label: 'HR Admin Cockpit', href: '/rh/admin', moduleKey: 'hr', subKey: 'admin' },
  ] },
  { module: 'GRC', icon: '🛡️', items: [
    { label: 'Dashboard', href: '/grc' },
    { label: 'Frameworks', href: '/grc/frameworks', moduleKey: 'grc', subKey: 'compliance' },
    { label: 'Mapping', href: '/grc/mapping' },
    { label: 'Risk Register', href: '/grc/risks', moduleKey: 'grc', subKey: 'risks' },
    { label: 'Audits', href: '/grc/audits', moduleKey: 'grc', subKey: 'audits' },
    { label: 'Access Review', href: '/grc/access-review', moduleKey: 'grc', subKey: 'access_review' },
    { label: 'TPRM', href: '/grc/tprm', moduleKey: 'grc', subKey: 'tprm' },
    { label: 'Whistleblowing & Ethics', href: '/grc/whistleblowing', moduleKey: 'grc', subKey: 'whistleblowing' },
    { label: 'Data & Privacy', href: '/grc/data-privacy', moduleKey: 'grc', subKey: 'ropa' },
  ] },
  { module: 'IT', icon: '🖥️', items: [
    { label: 'Equipments', href: '/it/equipments', moduleKey: 'it', subKey: 'assets' },
    { label: 'Software', href: '/it/software', moduleKey: 'it', subKey: 'assets' },
    { label: 'Applications', href: '/it/applications', moduleKey: 'it', subKey: 'assets' },
    { label: 'Company Links', href: '/it/company-links', moduleKey: 'it', subKey: 'assets' },
  ] },
  { module: 'Development', icon: '💻', items: [
    { label: 'Development Requests', href: '/development/requests', moduleKey: 'development', subKey: 'general' },
    { label: 'Development Pipeline', href: '/development/pipeline', moduleKey: 'development', subKey: 'general' },
    { label: 'Test Scripts', href: '/development/test-scripts', moduleKey: 'development', subKey: 'general' },
    { label: 'Test Execution', href: '/development/test-execution', moduleKey: 'development', subKey: 'general' },
    { label: 'Test Plans', href: '/development/test-plans', moduleKey: 'development', subKey: 'test_plans' },
    { label: 'Test Campaigns', href: '/development/test-campaigns', moduleKey: 'development', subKey: 'test_campaigns' },
    { label: 'Remediation Plans', href: '/development/remediation-plans', moduleKey: 'development', subKey: 'remediation' },
  ] },
  { module: 'Training', icon: '🎓', items: [
    { label: 'Dashboard', href: '/training', moduleKey: 'training', subKey: 'manager' },
    { label: 'Training Catalogue', href: '/training/catalogue', moduleKey: 'training', subKey: 'manager' },
    { label: 'Training Plans', href: '/training/plans', moduleKey: 'training', subKey: 'manager' },
    { label: 'Training Assignments', href: '/training/assignments', moduleKey: 'training', subKey: 'manager' },
    { label: 'Training Execution', href: '/training/execution', moduleKey: 'training', subKey: 'manager' },
  ] },
  { module: 'Task Manager', icon: '✅', items: [
    { label: 'My Tasks', href: '/task-manager', moduleKey: 'tasks', subKey: 'manager' },
  ] },
  { module: 'Helpdesk', icon: '🎧', items: [
    { label: 'Dashboard', href: '/helpdesk', roles: ['end_user', 'helpdesk_user', 'administrator'] },
    { label: 'My Tickets', href: '/helpdesk/tickets?mine=1', roles: ['end_user', 'helpdesk_user', 'administrator'] },
    { label: 'All Tickets', href: '/helpdesk/tickets', roles: ['helpdesk_user', 'administrator'] },
    { label: 'Assigned to Me', href: '/helpdesk/tickets/assigned', roles: ['helpdesk_user', 'administrator'] },
    { label: 'Ticket Reporting', href: '/helpdesk/ticket-reporting', roles: ['end_user', 'helpdesk_user', 'administrator'] },
    { label: 'Analytics', href: '/helpdesk/reporting', roles: ['helpdesk_user', 'administrator'] },
    { label: 'Knowledge Base', href: '/helpdesk/knowledge', roles: ['end_user', 'helpdesk_user', 'administrator'] },
    { label: 'Helpdesk Admin Cockpit', href: '/helpdesk/it-admin', roles: ['helpdesk_user', 'administrator'] },
    { label: 'Administration', href: '/helpdesk/admin', roles: ['administrator'] },
  ] },
  { module: 'MyWHUBBI', icon: '👤', items: [
    { label: 'Dashboard', href: '/settings' },
    { label: 'Personal Profile', href: '/settings/profile' },
    { label: 'Licenses & Groups', href: '/settings/licenses' },
    { label: 'Equipments', href: '/settings/equipments' },
    { label: 'Curriculum Vitae', href: '/settings/cv' },
    { label: 'Training', href: '/settings/training' },
    { label: 'Certifications', href: '/settings/certifications' },
    { label: 'PayFit', href: '/settings/payfit' },
    { label: 'Claude / MCP Access', href: '/settings/mcp' },
  ] },
]

function isPermVisible(perms: any, moduleKey?: string, subKey?: string) {
  if (!moduleKey || !subKey) return true
  const p = perms?.[moduleKey]?.[subKey]
  if (!p || p.id == null) return true
  return p.access_mode !== 'none'
}

export function EasyAccessMenu() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [perms, setPerms] = useState<any>(null)
  const [helpdeskRole, setHelpdeskRole] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const user = getStoredUser()
    if (user?.email) {
      fetch(`${API}/settings/permissions/${encodeURIComponent(user.email)}`).then(r => r.json()).then(d => setPerms(d.permissions || {})).catch(() => setPerms({}))
      fetch(`${API}/helpdesk/users/${encodeURIComponent(user.email)}/role`).then(r => r.json()).then(d => setHelpdeskRole(d.role || null)).catch(() => setHelpdeskRole(null))
    } else {
      setPerms({})
    }
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  const q = query.trim().toLowerCase()
  const results = (q.length === 0 || perms === null) ? [] : REGISTRY
    .map(g => ({
      ...g,
      items: g.items.filter(it => {
        if (it.roles) { if (!helpdeskRole || !it.roles.includes(helpdeskRole)) return false }
        else if (!isPermVisible(perms, it.moduleKey, it.subKey)) return false
        return g.module.toLowerCase().includes(q) || it.label.toLowerCase().includes(q)
      }),
    }))
    .filter(g => g.items.length > 0)

  const navigate = (href: string) => {
    setOpen(false); setQuery('')
    router.push(href)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px', borderRadius: '8px', marginBottom: '2px',
        background: 'transparent', color: 'rgba(255,255,255,0.6)',
        fontSize: '12px', fontWeight: 500, border: 'none', cursor: 'pointer',
        fontFamily: 'Montserrat, sans-serif', textAlign: 'left',
      }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        <span style={{ fontSize: '14px', flexShrink: 0 }}>🔎</span>
        Easy Access
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 2000, display: 'flex', justifyContent: 'center', paddingTop: '10vh' }}
          onClick={() => { setOpen(false); setQuery('') }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '480px', maxWidth: '90vw', maxHeight: '70vh', background: 'white', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px' }}>
              <input ref={inputRef} autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Type a module or functionality… (e.g. Oper)"
                style={{ width: '100%', boxSizing: 'border-box', fontSize: '14px', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none' }} />
            </div>
            {q.length > 0 && (
              <div style={{ overflowY: 'auto', borderTop: '1px solid #EDF2F7', flex: 1 }}>
                {perms === null ? (
                  <div style={{ padding: '16px', fontSize: '12px', color: '#9B9B9B' }}>Loading…</div>
                ) : results.length === 0 ? (
                  <div style={{ padding: '16px', fontSize: '12px', color: '#9B9B9B' }}>No matching modules or functionalities.</div>
                ) : results.map(g => (
                  <div key={g.module} style={{ padding: '6px 0' }}>
                    <div style={{ padding: '4px 16px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9B9B9B' }}>{g.icon} {g.module}</div>
                    {g.items.map(it => (
                      <button key={it.href} onClick={() => navigate(it.href)}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', fontSize: '13px', color: '#144766', fontWeight: 600, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {g.module} {it.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
