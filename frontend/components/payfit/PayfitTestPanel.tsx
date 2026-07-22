'use client'
import { useState } from 'react'

const API = 'https://api.whubbi.wcomply.com'

const RESOURCES = [
  { key: 'company',       label: 'Company',       icon: '🏢', desc: 'Confirms the API key + company_id resolve to a real PayFit company.' },
  { key: 'collaborators', label: 'Collaborators',  icon: '👥', desc: 'Requires the collaborators:read scope.' },
  { key: 'collaborator_detail', label: 'Collaborator Detail', icon: '🔎', desc: 'Single collaborator by ID — includes embedded contracts, gated by collaborators:contracts:read.' },
  { key: 'contracts',     label: 'Contracts',      icon: '📄', desc: 'Requires the contracts:read scope.' },
  { key: 'absences',      label: 'Absences',       icon: '🗓️', desc: 'Requires the time:read scope.' },
  { key: 'payslips',      label: 'Payslips',       icon: '💵', desc: 'Requires contracts:payslips:read — uses the most recently synced collaborator.' },
]

type TestResult = {
  resource: string
  success: boolean
  status_code: number | null
  elapsed_ms: number
  error: string | null
  count?: number | null
  sample?: any
}

export function PayfitTestPanel() {
  const [results, setResults] = useState<Record<string, TestResult>>({})
  const [running, setRunning] = useState<Record<string, boolean>>({})

  const runTest = async (key: string) => {
    setRunning(prev => ({ ...prev, [key]: true }))
    try {
      const r = await fetch(`${API}/payfit/test/${key}`)
      const d: TestResult = await r.json()
      setResults(prev => ({ ...prev, [key]: d }))
    } catch (e: any) {
      setResults(prev => ({ ...prev, [key]: { resource: key, success: false, status_code: null, elapsed_ms: 0, error: e.message } }))
    }
    setRunning(prev => ({ ...prev, [key]: false }))
  }

  const runAll = () => RESOURCES.forEach(r => runTest(r.key))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>
          Each test hits PayFit read-only — nothing is written to WHUBBI's database. Use this to verify the API key's granted scopes.
        </p>
        <button onClick={runAll}
          style={{ padding: '7px 16px', background: '#156082', color: 'white', border: 'none', borderRadius: '7px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
          ▶ Run All Tests
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
        {RESOURCES.map(r => {
          const result = results[r.key]
          const isRunning = !!running[r.key]
          return (
            <div key={r.key} style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#156082' }}>{r.icon} {r.label}</div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>{r.desc}</div>
                </div>
                <button onClick={() => runTest(r.key)} disabled={isRunning}
                  style={{ padding: '6px 12px', background: isRunning ? '#F1F5F9' : '#EFF6FF', color: isRunning ? '#94A3B8' : '#156082', border: 'none', borderRadius: '6px', fontSize: '10px', fontWeight: '700', cursor: isRunning ? 'not-allowed' : 'pointer', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {isRunning ? '⏳ Testing…' : '▶ Run Test'}
                </button>
              </div>

              {result && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 9px', borderRadius: '10px',
                      background: result.success ? '#ECFDF5' : '#FEF2F2', color: result.success ? '#059669' : '#DC2626' }}>
                      {result.success ? `✅ ${result.status_code}` : `❌ ${result.status_code ?? 'Error'}`}
                    </span>
                    <span style={{ fontSize: '10px', color: '#94A3B8' }}>{result.elapsed_ms}ms</span>
                    {typeof result.count === 'number' && (
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>· {result.count} item{result.count !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {result.error && (
                    <div style={{ fontSize: '11px', color: '#DC2626', background: '#FEF2F2', padding: '8px 10px', borderRadius: '6px', wordBreak: 'break-word' }}>
                      {result.error}
                    </div>
                  )}
                  {result.success && result.sample !== undefined && (
                    <pre style={{ fontSize: '10px', color: '#3F3F3F', background: '#FAFBFC', padding: '8px 10px', borderRadius: '6px', overflowX: 'auto', maxHeight: '160px', margin: 0, fontFamily: 'monospace' }}>
                      {JSON.stringify(result.sample, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
