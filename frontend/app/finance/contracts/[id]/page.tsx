'use client'
// app/finance/contracts/[id]/page.tsx
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { FinanceLayout } from '@/components/FinanceLayout'
import { financeContractsAPI } from '@/lib/api'
import { getStoredUser } from '@/lib/auth'
import { ContractModal } from '@/components/finance/ContractModal'

export default function ContractDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const contractId = Array.isArray(id) ? id[0] : id
  const [contract, setContract] = useState<any>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try {
      setLoading(true)
      const [c, docs] = await Promise.all([
        financeContractsAPI.get(contractId as string),
        financeContractsAPI.getDocuments(contractId as string),
      ])
      setContract(c); setDocuments(docs)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (contractId) load() }, [contractId])

  const handleUpload = async (file: File) => {
    setUploading(true); setUploadError('')
    try {
      const user = getStoredUser()
      await financeContractsAPI.uploadDocument(contractId as string, file, user?.email || '')
      await load()
    } catch (e: any) { setUploadError(e.message) }
    finally { setUploading(false) }
  }

  const removeDoc = async (docId: string) => {
    if (!confirm('Delete this document?')) return
    await financeContractsAPI.deleteDocument(contractId as string, docId)
    load()
  }

  if (loading && !contract) {
    return <FinanceLayout><div style={{ padding: '48px', textAlign: 'center', color: '#9B9B9B' }}>Loading...</div></FinanceLayout>
  }
  if (!contract) {
    return <FinanceLayout><div style={{ padding: '48px', textAlign: 'center', color: '#9B9B9B' }}>Contract not found.</div></FinanceLayout>
  }

  return (
    <FinanceLayout>
      <div style={{ padding: '24px 28px', maxWidth: '900px' }}>
        <button onClick={() => router.push('/finance/contracts')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontWeight: '600', fontSize: '11px', padding: 0, marginBottom: '12px' }}>← Back to Contracts</button>

        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#144766', margin: 0 }}>{contract.contract_name}</h1>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#9B9B9B' }}>{contract.internal_id}</span>
              </div>
              <p style={{ color: '#9B9B9B', fontSize: '12px', margin: 0 }}>{contract.supplier_name} · {contract.start_date} → {contract.end_date || 'no end date'}</p>
            </div>
            <button className="btn-secondary" onClick={() => setShowModal(true)}>Edit</button>
          </div>
          {contract.contract_value != null && (
            <p style={{ fontSize: '13px', fontWeight: '700', color: '#144766', marginTop: '10px' }}>{Number(contract.contract_value).toLocaleString()} EUR</p>
          )}
          {contract.notes && <p style={{ fontSize: '12px', color: '#3F3F3F', marginTop: '10px', whiteSpace: 'pre-wrap' as const }}>{contract.notes}</p>}
        </div>

        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p className="section-label" style={{ margin: 0 }}>Documents</p>
            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading...' : '+ Upload Document'}
            </button>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
          </div>
          {uploadError && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '10px' }}>{uploadError}</div>}
          {documents.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No documents attached yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {documents.map((d: any) => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                  <a href={d.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#219BD6', fontWeight: '600', textDecoration: 'none' }}>📎 {d.filename}</a>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '10px', color: '#9B9B9B' }}>{d.uploaded_by_email}</span>
                    <button onClick={() => removeDoc(d.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '11px', fontWeight: '600' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && <ContractModal contract={contract} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />}
    </FinanceLayout>
  )
}
