'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { contactsAPI, cleanupAPI } from '@/lib/api'
import { TabNav } from '@/components/shared/RecordLayout'

// Only source types whose source_id IS the parent record's id get a "View" link
// (opportunity_link/partner_link/company_article carry the *link row's* id instead).
const ROUTE_FOR: Record<string, (id: string) => string> = {
  company: id => `/companies/${id}`,
  partner: id => `/partners/${id}`,
  contact: id => `/contacts/${id}`,
  opportunity: id => `/opportunities/${id}`,
}

function LinkedInCheckTab({ contacts }: { contacts: any[] }) {
  const [checking, setChecking] = useState<string | null>(null)
  const [checkAllProgress, setCheckAllProgress] = useState<{ done: number; total: number } | null>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [edits, setEdits] = useState<Record<string, { company: string; title: string }>>({})

  const loadSuggestions = async () => setSuggestions((await cleanupAPI.getSuggestions('pending')).suggestions || [])
  useEffect(() => { loadSuggestions() }, [])

  const checkOne = async (contactId: string) => {
    setChecking(contactId)
    try { await cleanupAPI.linkedinCheck(contactId); await loadSuggestions() }
    catch (e: any) { alert(`Check failed: ${e.message}`) }
    finally { setChecking(null) }
  }

  const checkAll = async () => {
    setCheckAllProgress({ done: 0, total: contacts.length })
    for (let i = 0; i < contacts.length; i++) {
      try { await cleanupAPI.linkedinCheck(contacts[i].id) } catch {}
      setCheckAllProgress({ done: i + 1, total: contacts.length })
    }
    await loadSuggestions()
    setCheckAllProgress(null)
  }

  const review = async (s: any, action: 'accept' | 'deny') => {
    const edit = edits[s.id]
    await cleanupAPI.reviewSuggestion(s.id, {
      action,
      suggested_company: edit?.company ?? s.suggested_company,
      suggested_title: edit?.title ?? s.suggested_title,
    })
    loadSuggestions()
  }

  return (
    <div>
      <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>
        Searches the public web (no LinkedIn login) to see if a contact still appears to work at their company on file, in the same role.
      </p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button className="btn-primary" onClick={checkAll} disabled={!!checkAllProgress}>
          {checkAllProgress ? `Checking… ${checkAllProgress.done}/${checkAllProgress.total}` : `Check All (${contacts.length})`}
        </button>
      </div>

      <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '8px' }}>Suggestions to review ({suggestions.length})</p>
      {suggestions.length === 0 ? <p style={{ fontSize: '13px', color: '#9B9B9B', marginBottom: '20px' }}>No pending suggestions.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          {suggestions.map((s: any) => (
            <div key={s.id} style={{ border: '1px solid #EDF2F7', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontWeight: '700', color: '#144766', fontSize: '13px' }}>{s.first_name} {s.last_name}</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>{s.summary}</div>
                </div>
                <span style={{ background: s.confidence === 'high' ? '#ECFDF5' : s.confidence === 'medium' ? '#FFF7ED' : '#F1F5F9', color: s.confidence === 'high' ? '#059669' : s.confidence === 'medium' ? '#D97706' : '#64748B', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' as const }}>{s.confidence} confidence</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label className="form-label">On file</label>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>{s.current_company || '—'} · {s.current_title || '—'}</div>
                </div>
                <div>
                  <label className="form-label">Suggested (editable)</label>
                  <input className="form-input" style={{ marginBottom: '4px' }} placeholder="Company" defaultValue={s.suggested_company || ''} onChange={e => setEdits(p => ({ ...p, [s.id]: { company: e.target.value, title: p[s.id]?.title ?? s.suggested_title } }))} />
                  <input className="form-input" placeholder="Title" defaultValue={s.suggested_title || ''} onChange={e => setEdits(p => ({ ...p, [s.id]: { title: e.target.value, company: p[s.id]?.company ?? s.suggested_company } }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-primary" onClick={() => review(s, 'accept')}>Accept</button>
                <button className="btn-secondary" onClick={() => review(s, 'deny')}>Deny</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '8px' }}>All contacts</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {contacts.map((c: any) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #F1F5F9', borderRadius: '6px' }}>
            <span style={{ fontSize: '12px', color: '#3F3F3F' }}>{c.first_name} {c.last_name} <span style={{ color: '#94A3B8' }}>· {c.company?.name || c.partner?.name || '—'}</span></span>
            <button onClick={() => checkOne(c.id)} disabled={checking === c.id} style={{ padding: '4px 10px', background: '#EFF6FF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#156082', fontWeight: '700' }}>
              {checking === c.id ? 'Checking…' : 'Check'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmailCheckTab({ contacts }: { contacts: any[] }) {
  const [results, setResults] = useState<Record<string, any>>({})
  const [checkAllProgress, setCheckAllProgress] = useState<{ done: number; total: number } | null>(null)

  const withEmail = contacts.filter(c => c.email)

  const checkOne = async (id: string) => {
    const r = await cleanupAPI.emailCheck(id).catch((e: any) => ({ valid: false, reason: e.message }))
    setResults(p => ({ ...p, [id]: r }))
  }

  const checkAll = async () => {
    setCheckAllProgress({ done: 0, total: withEmail.length })
    for (let i = 0; i < withEmail.length; i++) {
      await checkOne(withEmail[i].id)
      setCheckAllProgress({ done: i + 1, total: withEmail.length })
    }
    setCheckAllProgress(null)
  }

  return (
    <div>
      <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>Checks email syntax and whether the domain has valid mail (MX) records — doesn't confirm the specific mailbox still exists.</p>
      <button className="btn-primary" onClick={checkAll} disabled={!!checkAllProgress} style={{ marginBottom: '14px' }}>
        {checkAllProgress ? `Checking… ${checkAllProgress.done}/${checkAllProgress.total}` : `Check All (${withEmail.length})`}
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {withEmail.map((c: any) => {
          const r = results[c.id]
          return (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #F1F5F9', borderRadius: '6px' }}>
              <span style={{ fontSize: '12px', color: '#3F3F3F' }}>{c.first_name} {c.last_name} <span style={{ color: '#94A3B8' }}>· {c.email}</span></span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {r && (
                  <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 9px', borderRadius: '10px', background: r.valid ? '#ECFDF5' : '#FEF2F2', color: r.valid ? '#059669' : '#DC2626' }} title={r.reason}>
                    {r.valid ? 'Valid' : 'Invalid'}
                  </span>
                )}
                <button onClick={() => checkOne(c.id)} style={{ padding: '4px 10px', background: '#EFF6FF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#156082', fontWeight: '700' }}>Check</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LinkRow({ b, router, tone }: { b: any; router: ReturnType<typeof useRouter>; tone: 'broken' | 'unverifiable' }) {
  const routeFn = ROUTE_FOR[b.source_type]
  const color = tone === 'broken' ? '#DC2626' : '#D97706'
  const bg = tone === 'broken' ? '#FEF2F2' : '#FFFBEB'
  const border = tone === 'broken' ? '#FEE2E2' : '#FDE68A'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: `1px solid ${border}`, background: bg, borderRadius: '8px' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color }}>{b.source_name || '(unnamed)'} <span style={{ fontWeight: '400', color: '#94A3B8', textTransform: 'capitalize' as const }}>· {b.source_type.replace('_', ' ')}</span></div>
        <div style={{ fontSize: '11px', color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.url}</div>
        <div style={{ fontSize: '11px', color }}>{b.status_code ? `HTTP ${b.status_code}` : b.error}</div>
      </div>
      {routeFn && <button onClick={() => router.push(routeFn(b.source_id))} style={{ padding: '5px 10px', background: 'white', border: `1px solid ${color}`, borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color, fontWeight: '700', flexShrink: 0 }}>View</button>}
    </div>
  )
}

function BrokenLinksTab() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const run = async () => {
    setLoading(true)
    try { setResult(await cleanupAPI.brokenLinks()) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>
        Checks every stored link across the Sales module: company/partner websites & LinkedIn pages, contact LinkedIn pages, partner links, and opportunity SharePoint/file links.
      </p>
      <button className="btn-primary" onClick={run} disabled={loading} style={{ marginBottom: '16px' }}>{loading ? 'Checking…' : 'Run Check'}</button>
      {result && (
        <div>
          <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px' }}>
            Checked {result.total_checked} of {result.total_found} links found.
            {result.truncated && <span style={{ color: '#D97706' }}> Stopped at the 200-link cap — run again after fixing some to check the rest.</span>}
            {' '}{result.broken.length} broken, {result.unverifiable?.length || 0} could not be verified.
          </p>
          {result.broken.length === 0 ? <p style={{ fontSize: '13px', color: '#059669', marginBottom: '18px' }}>✅ No broken links found.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
              {result.broken.map((b: any, i: number) => (
                <LinkRow key={i} b={b} router={router} tone="broken" />
              ))}
            </div>
          )}
          {result.unverifiable?.length > 0 && (
            <div>
              <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '8px' }}>
                Could not verify ({result.unverifiable.length}) — LinkedIn and SharePoint block automated, logged-out requests, so these may well be working links. Open them manually to confirm.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {result.unverifiable.map((b: any, i: number) => (
                  <LinkRow key={i} b={b} router={router} tone="unverifiable" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ContactCleanupPage() {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('LinkedIn Check')

  useEffect(() => { contactsAPI.list({}).then(setContacts).catch(() => {}).finally(() => setLoading(false)) }, [])

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '24px 28px' }}>
          <h1 style={{ fontSize: '19px', fontWeight: '800', color: '#156082', marginBottom: '2px' }}>🧹 Contact Clean-up</h1>
          <p style={{ color: '#45B6E4', fontSize: '12px', marginBottom: '20px' }}>Find and fix stale contact data across the Sales module</p>

          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '0 20px', background: '#FAFBFC', borderBottom: '2px solid #E2E8F0' }}>
              <TabNav tabs={['LinkedIn Check', 'Email Check', 'Broken Links']} active={tab} onChange={setTab} />
            </div>
            <div style={{ padding: '20px' }}>
              {loading ? <p style={{ color: '#9B9B9B', fontSize: '13px' }}>Loading...</p> : (
                <>
                  {tab === 'LinkedIn Check' && <LinkedInCheckTab contacts={contacts} />}
                  {tab === 'Email Check' && <EmailCheckTab contacts={contacts} />}
                  {tab === 'Broken Links' && <BrokenLinksTab />}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
