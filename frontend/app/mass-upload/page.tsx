'use client'
import { useState, useRef } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { PageHeader } from '@/components/shared/RecordLayout'
import { massUploadAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'

const card: React.CSSProperties = { background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px 24px', marginBottom: '16px' }
const lbl: React.CSSProperties = { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '8px' }
const inp: React.CSSProperties = { fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white' }
const step: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }
const stepNum = (active: boolean, done: boolean): React.CSSProperties => ({
  width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '11px', fontWeight: '800', color: 'white', background: done ? '#059669' : active ? '#156082' : '#CBD5E0', flexShrink: 0,
})

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export default function MassUploadPage() {
  const [entityType, setEntityType] = useState('')
  const [fields, setFields] = useState<any[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<any>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const ENTITIES = [
    { key: 'companies', label: 'Companies' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'partners', label: 'Partners' },
  ]

  const reset = () => {
    setFile(null); setParsed(null); setMapping({}); setResult(null); setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const chooseEntity = async (key: string) => {
    setEntityType(key)
    reset()
    if (!key) { setFields([]); return }
    try {
      const { fields: f } = await massUploadAPI.getFields(key)
      setFields(f)
    } catch (e: any) { setError(e.message) }
  }

  const uploadFile = async (f: File) => {
    setFile(f); setParsing(true); setError(''); setParsed(null); setResult(null)
    try {
      const me = getStoredUser()
      const data = await massUploadAPI.parse(f, me?.email || '')
      setParsed(data)
      // Best-effort auto-mapping: match each field's key/label against the file's headers.
      const guess: Record<string, string> = {}
      fields.forEach(fld => {
        const targets = [normalize(fld.key), normalize(fld.label)]
        const match = data.headers.find((h: string) => targets.includes(normalize(h)))
        if (match) guess[fld.key] = match
      })
      setMapping(guess)
    } catch (e: any) { setError(e.message); setFile(null) }
    finally { setParsing(false) }
  }

  const setFieldMapping = (fieldKey: string, header: string) => {
    setMapping(prev => {
      const next = { ...prev }
      if (header) next[fieldKey] = header
      else delete next[fieldKey]
      return next
    })
  }

  const missingRequired = fields.filter(f => f.required && !mapping[f.key])

  const runImport = async () => {
    if (!parsed || missingRequired.length > 0) return
    setImporting(true); setError('')
    try {
      const r = await massUploadAPI.import(parsed.session_id, entityType, mapping)
      setResult(r)
    } catch (e: any) { setError(e.message) }
    finally { setImporting(false) }
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '24px 28px', maxWidth: '920px' }}>
          <PageHeader title="Mass Upload" />
          <p style={{ fontSize: '12px', color: '#64748B', marginTop: '-10px', marginBottom: '20px' }}>
            Bulk-create records from a spreadsheet: pick what you're importing, upload a CSV or Excel file, then match its columns to WHUBBI's fields.
          </p>

          <div style={card}>
            <div style={step}><span style={stepNum(!entityType, !!entityType)}>1</span><div style={lbl}>What are you importing?</div></div>
            <select style={{ ...inp, width: '280px' }} value={entityType} onChange={e => chooseEntity(e.target.value)}>
              <option value="">Select data type…</option>
              {ENTITIES.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
            </select>
          </div>

          {entityType && (
            <div style={card}>
              <div style={step}><span style={stepNum(!parsed, !!parsed)}>2</span><div style={lbl}>Upload a file (.csv or .xlsx)</div></div>
              <label style={{ display: 'inline-block', padding: '9px 16px', background: '#EFF6FF', color: '#156082', borderRadius: '8px', cursor: parsing ? 'default' : 'pointer', fontSize: '12px', fontWeight: '700' }}>
                {parsing ? 'Reading file…' : file ? `📄 ${file.name} (change)` : '+ Choose File'}
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xlsm" style={{ display: 'none' }} disabled={parsing}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} />
              </label>
              {parsed && <span style={{ marginLeft: '12px', fontSize: '12px', color: '#059669', fontWeight: '600' }}>{parsed.row_count} row{parsed.row_count !== 1 ? 's' : ''} found</span>}
            </div>
          )}

          {parsed && !result && (
            <div style={card}>
              <div style={step}><span style={stepNum(true, false)}>3</span><div style={lbl}>Match columns to WHUBBI fields</div></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                {fields.map(f => (
                  <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '260px', fontSize: '12px', color: '#3F3F3F', fontWeight: '600' }}>
                      {f.label}{f.required && <span style={{ color: '#DC2626' }}> *</span>}
                    </div>
                    <select style={{ ...inp, flex: 1 }} value={mapping[f.key] || ''} onChange={e => setFieldMapping(f.key, e.target.value)}>
                      <option value="">— Don't import —</option>
                      {parsed.headers.map((h: string) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div style={lbl}>Preview (first {parsed.preview.length} rows)</div>
              <div style={{ overflowX: 'auto', border: '1px solid #EDF2F7', borderRadius: '8px', marginBottom: '18px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead style={{ background: '#FAFBFC' }}>
                    <tr>{parsed.headers.map((h: string) => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #EDF2F7', color: '#45B6E4', fontWeight: '700', whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {parsed.preview.map((row: any, i: number) => (
                      <tr key={i}>
                        {parsed.headers.map((h: string) => <td key={h} style={{ padding: '7px 10px', borderBottom: '1px solid #F8FAFC', color: '#3F3F3F', whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row[h] ?? ''}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {missingRequired.length > 0 && (
                <p style={{ fontSize: '12px', color: '#DC2626', marginBottom: '12px' }}>
                  Still need to map: {missingRequired.map(f => f.label).join(', ')}
                </p>
              )}
              <button onClick={runImport} disabled={importing || missingRequired.length > 0}
                style={{ padding: '10px 20px', background: importing || missingRequired.length > 0 ? '#94A3B8' : '#156082', color: 'white', border: 'none', borderRadius: '8px', cursor: importing || missingRequired.length > 0 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
                {importing ? 'Importing…' : `Import ${parsed.row_count} row${parsed.row_count !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {result && (
            <div style={card}>
              <div style={{ display: 'flex', gap: '20px', marginBottom: result.errors?.length ? '16px' : 0 }}>
                <div><div style={{ fontSize: '22px', fontWeight: '800', color: '#059669' }}>{result.created}</div><div style={{ fontSize: '11px', color: '#64748B' }}>Created</div></div>
                <div><div style={{ fontSize: '22px', fontWeight: '800', color: result.failed ? '#DC2626' : '#94A3B8' }}>{result.failed}</div><div style={{ fontSize: '11px', color: '#64748B' }}>Failed</div></div>
                <div><div style={{ fontSize: '22px', fontWeight: '800', color: '#3F3F3F' }}>{result.total}</div><div style={{ fontSize: '11px', color: '#64748B' }}>Total Rows</div></div>
              </div>
              {result.errors?.length > 0 && (
                <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #FECACA', background: '#FEF2F2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                  {result.errors.map((e: any, i: number) => (
                    <div key={i} style={{ fontSize: '11px', color: '#991B1B', padding: '3px 0' }}>Row {e.row}: {e.error}</div>
                  ))}
                </div>
              )}
              <button onClick={() => { setEntityType(''); setFields([]); reset() }}
                style={{ padding: '9px 18px', background: '#F1F5F9', color: '#156082', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
                Upload Another File
              </button>
            </div>
          )}

          {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>{error}</div>}
        </div>
      </main>
    </div>
  )
}
