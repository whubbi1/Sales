'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { companiesAPI } from '@/lib/api'

const DEAL_TYPES = ['SAP', 'GRC', 'Smart Global Governance', 'SecurityBridge', 'Onapsis', 'BowBridge', 'IBM OpenPages']
const PROJECT_STATUSES = ['Daily Invoicing', 'Project', 'Software Licenses']

export function CompanyServices({ companyId }: { companyId: string }) {
  const [company, setCompany] = useState<any>(null)
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [c, opps] = await Promise.all([companiesAPI.get(companyId), companiesAPI.getOpportunities(companyId)])
    setCompany(c)
    setOpportunities(opps)
  }
  useEffect(() => { load() }, [companyId])

  const toggle = async (dealType: string, projectStatus: string) => {
    if (!company || saving) return
    const current: string[] = company.services_provided?.[dealType] || []
    const next = current.includes(projectStatus) ? current.filter((v: string) => v !== projectStatus) : [...current, projectStatus]
    const services_provided = { ...(company.services_provided || {}), [dealType]: next }
    setSaving(true)
    try {
      await companiesAPI.update(companyId, { services_provided })
      setCompany((p: any) => ({ ...p, services_provided }))
    } finally { setSaving(false) }
  }

  if (!company) return <p style={{ color: '#9B9B9B', fontSize: '12px' }}>Loading...</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {DEAL_TYPES.map(dealType => (
        <div key={dealType}>
          <p className="section-label">{dealType}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {PROJECT_STATUSES.map(projectStatus => {
              const selected = (company.services_provided?.[dealType] || []).includes(projectStatus)
              const finalised = opportunities.filter((o: any) => o.deal_type === dealType && o.project_status === projectStatus && o.deal_status === 'Contract Finalised')
              return (
                <div key={projectStatus}>
                  <span
                    className={`checkbox-chip ${selected ? 'selected' : ''}`}
                    onClick={() => toggle(dealType, projectStatus)}
                    style={{ opacity: saving ? 0.6 : 1 }}
                  >
                    {projectStatus}
                  </span>
                  {finalised.length > 0 && (
                    <div style={{ marginTop: '6px', marginLeft: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {finalised.map((o: any) => (
                        <Link key={o.id} href={`/opportunities/${o.id}`} style={{ fontSize: '11px', color: '#219BD6', fontWeight: '600', textDecoration: 'none' }}>
                          {o.deal_name}{o.deal_amount ? ` — €${o.deal_amount.toLocaleString('en-US')}` : ''}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
