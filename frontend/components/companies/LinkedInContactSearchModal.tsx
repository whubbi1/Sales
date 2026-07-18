'use client'
import { useState } from 'react'
import { companiesAPI, contactsAPI } from '@/lib/api'

const DEFAULT_FUNCTIONS = ['CIO', 'CISO', 'SAP', 'SAP GRC', 'Risk Manager', 'DPO', 'Compliance Manager']
const JOB_TYPES = ['CIO', 'CTO', 'CISO', 'SAP Manager', 'SAP Architect', 'SAP GRC', 'SAP Security Manager', 'SAP Technical Manager', 'Cybersecurity Architect', 'SOC Manager', 'Internal Audit', 'CFO', 'Partner', 'Buyer', 'Other']

interface FoundPerson {
  first_name: string
  last_name: string
  job_title: string
  location: string
  linkedin_url: string
}

interface ReviewForm extends FoundPerson {
  job_type: string
  email: string
  mobile_phone: string
}

export function LinkedInContactSearchModal({ companyId, onClose, onCreated }: { companyId: string; onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<'functions' | 'results' | 'review'>('functions')
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([...DEFAULT_FUNCTIONS])
  const [customFunction, setCustomFunction] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [results, setResults] = useState<FoundPerson[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [reviewForms, setReviewForms] = useState<ReviewForm[]>([])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const toggleFunction = (fn: string) => {
    setSelectedFunctions(p => p.includes(fn) ? p.filter(f => f !== fn) : [...p, fn])
  }
  const addCustomFunction = () => {
    const v = customFunction.trim()
    if (v && !selectedFunctions.includes(v)) {
      setSelectedFunctions(p => [...p, v])
      setCustomFunction('')
    }
  }

  const runSearch = async () => {
    if (selectedFunctions.length === 0) return
    setSearching(true); setSearchError('')
    try {
      const { results: found } = await companiesAPI.searchLinkedInPeople(companyId, selectedFunctions)
      setResults(found || [])
      setSelected(new Set())
      setStep('results')
    } catch (e: any) { setSearchError(e.message) }
    finally { setSearching(false) }
  }

  const toggleSelect = (i: number) => {
    setSelected(p => { const next = new Set(p); next.has(i) ? next.delete(i) : next.add(i); return next })
  }

  const goToReview = () => {
    const picked = [...selected].map(i => results[i])
    setReviewForms(picked.map(p => ({ ...p, job_type: JOB_TYPES.includes(p.job_title) ? p.job_title : '', email: '', mobile_phone: '' })))
    setStep('review')
  }

  const updateReviewForm = (i: number, fields: Partial<ReviewForm>) => {
    setReviewForms(prev => prev.map((f, idx) => idx === i ? { ...f, ...fields } : f))
  }

  const createContacts = async () => {
    setCreating(true); setCreateError('')
    try {
      for (const f of reviewForms) {
        await contactsAPI.create({
          first_name: f.first_name,
          last_name: f.last_name,
          job_name: f.job_title,
          job_type: f.job_type || null,
          email: f.email || null,
          mobile_phone: f.mobile_phone || null,
          linkedin_url: f.linkedin_url,
          company_id: companyId,
        })
      }
      onCreated()
    } catch (e: any) { setCreateError(e.message) }
    finally { setCreating(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>🔍 Search LinkedIn for Contacts</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>

        {step === 'functions' && (
          <>
            <div className="modal-body">
              <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>Which functions should we look for at this company?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                {selectedFunctions.map(fn => (
                  <span key={fn} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#EEF2FF', color: '#4F46E5', padding: '5px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                    {fn}
                    <button onClick={() => toggleFunction(fn)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#4F46E5', fontSize: '13px', lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                {DEFAULT_FUNCTIONS.filter(fn => !selectedFunctions.includes(fn)).map(fn => (
                  <button key={fn} onClick={() => toggleFunction(fn)} className="checkbox-chip">{fn}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="form-input" style={{ flex: 1 }} placeholder="Add a custom function…" value={customFunction} onChange={e => setCustomFunction(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomFunction()} />
                <button className="btn-secondary" onClick={addCustomFunction}>Add</button>
              </div>
              {searchError && <p style={{ color: '#DC2626', fontSize: '12px', marginTop: '12px' }}>{searchError}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={runSearch} disabled={searching || selectedFunctions.length === 0}>{searching ? 'Searching…' : '🔍 Search LinkedIn'}</button>
            </div>
          </>
        )}

        {step === 'results' && (
          <>
            <div className="modal-body">
              <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>
                Click a row to open their LinkedIn profile. Check the ones you'd like to add as Contacts.
              </p>
              {results.length === 0 ? (
                <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No profiles found for those functions.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {results.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', border: '1px solid #EDF2F7', borderRadius: '8px', background: selected.has(i) ? '#F5F3FF' : 'white' }}>
                      <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelect(i)} />
                      <div onClick={() => window.open(p.linkedin_url, '_blank', 'noopener')} style={{ flex: 1, cursor: 'pointer' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#156082' }}>{p.first_name} {p.last_name}</div>
                        <div style={{ fontSize: '11px', color: '#9B9B9B' }}>{p.job_title}{p.location && ` · ${p.location}`}</div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#219BD6' }}>LinkedIn ↗</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setStep('functions')}>Back</button>
              <button className="btn-primary" onClick={goToReview} disabled={selected.size === 0}>Continue with {selected.size} selected</button>
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            <div className="modal-body">
              <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>
                Add any details LinkedIn couldn't tell us (email, phone, job type) before creating these contacts.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {reviewForms.map((f, i) => (
                  <div key={i} style={{ border: '1px solid #EDF2F7', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#144766', marginBottom: '8px' }}>{f.first_name} {f.last_name}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label className="form-label">Job Type</label>
                        <select className="form-input" value={f.job_type} onChange={e => updateReviewForm(i, { job_type: e.target.value })}>
                          <option value="">Select…</option>
                          {JOB_TYPES.map(jt => <option key={jt} value={jt}>{jt}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Job Title (LinkedIn)</label>
                        <input className="form-input" value={f.job_title} onChange={e => updateReviewForm(i, { job_title: e.target.value })} />
                      </div>
                      <div>
                        <label className="form-label">Email</label>
                        <input className="form-input" value={f.email} onChange={e => updateReviewForm(i, { email: e.target.value })} placeholder="Not found on LinkedIn — add manually" />
                      </div>
                      <div>
                        <label className="form-label">Mobile Phone</label>
                        <input className="form-input" value={f.mobile_phone} onChange={e => updateReviewForm(i, { mobile_phone: e.target.value })} placeholder="Not found on LinkedIn — add manually" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {createError && <p style={{ color: '#DC2626', fontSize: '12px', marginTop: '12px' }}>{createError}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setStep('results')}>Back</button>
              <button className="btn-primary" onClick={createContacts} disabled={creating}>{creating ? 'Creating…' : `Create ${reviewForms.length} Contact${reviewForms.length !== 1 ? 's' : ''}`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
