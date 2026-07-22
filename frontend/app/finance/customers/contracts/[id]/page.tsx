'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { FinanceLayout, useFinancePerm } from '@/components/FinanceLayout'
import { financeCustomersAPI, contactsAPI } from '@/lib/api'

const CONTRACT_TYPES = ['Master Agreement', 'Project Agreement', 'Purchase Order']
const INVOICING_CONDITIONS = ['Monthly', 'On Deliverables', 'Other']

const card: React.CSSProperties = { background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '18px 22px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const lbl: React.CSSProperties = { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '6px' }
const inp: React.CSSProperties = { fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white' }
const btn: React.CSSProperties = { padding: '7px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }

function fmtDate(d: string) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

function EditableCell({ display, editing, canEdit, onStartEdit, children }: any) {
  return editing ? children : (
    <div onClick={() => canEdit && onStartEdit()} title={canEdit ? 'Click to edit' : undefined}
      style={{ fontSize: '12px', color: '#3F3F3F', cursor: canEdit ? 'pointer' : 'default', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', minHeight: '18px' }}
      onMouseEnter={e => canEdit && (e.currentTarget.style.background = '#F1F5F9')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {display || <span style={{ color: '#94A3B8' }}>—</span>}
    </div>
  )
}

function ContractDetailContent() {
  const { id } = useParams()
  const router = useRouter()
  const { level, canEdit } = useFinancePerm('customers')
  const [contract, setContract] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingField, setEditingField] = useState<string | null>(null)

  const [allContacts, setAllContacts] = useState<any[]>([])
  const [addContactId, setAddContactId] = useState('')

  const [showAddLink, setShowAddLink] = useState(false)
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')

  const [uploadingSigned, setUploadingSigned] = useState(false)
  const [uploadingInvoicingDoc, setUploadingInvoicingDoc] = useState(false)
  const signedInputRef = useRef<HTMLInputElement>(null)
  const invoicingDocInputRef = useRef<HTMLInputElement>(null)

  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const c = await financeCustomersAPI.get(id as string)
      setContract(c)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])
  useEffect(() => { contactsAPI.list({}).then(setAllContacts).catch(() => {}) }, [])

  if (level === 'loading' || loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )
  if (!contract) return <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>Contract not found.</div>

  const updateField = async (fields: any) => {
    setError('')
    try {
      const updated = await financeCustomersAPI.update(contract.id, fields)
      setEditingField(null)
      setContract(updated)
    } catch (e: any) { setError(e.message) }
  }

  const linkContact = async () => {
    if (!addContactId) return
    await financeCustomersAPI.linkContact(contract.id, addContactId)
    setAddContactId('')
    load()
  }
  const unlinkContact = async (contactId: string) => {
    await financeCustomersAPI.unlinkContact(contract.id, contactId)
    load()
  }

  const addLink = async () => {
    if (!linkLabel.trim() || !linkUrl.trim()) return
    await financeCustomersAPI.addLink(contract.id, { label: linkLabel.trim(), url: linkUrl.trim() })
    setLinkLabel(''); setLinkUrl(''); setShowAddLink(false)
    load()
  }
  const removeLink = async (linkId: string) => {
    await financeCustomersAPI.removeLink(contract.id, linkId)
    load()
  }

  const uploadSigned = async (file: File) => {
    setUploadingSigned(true)
    try { await financeCustomersAPI.uploadSignedContract(contract.id, file); load() }
    catch (e: any) { setError(e.message) }
    finally { setUploadingSigned(false); if (signedInputRef.current) signedInputRef.current.value = '' }
  }
  const uploadInvoicingDoc = async (file: File) => {
    setUploadingInvoicingDoc(true)
    try { await financeCustomersAPI.uploadInvoicingDocumentation(contract.id, file); load() }
    catch (e: any) { setError(e.message) }
    finally { setUploadingInvoicingDoc(false); if (invoicingDocInputRef.current) invoicingDocInputRef.current.value = '' }
  }

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try { await financeCustomersAPI.delete(contract.id); router.push('/finance/customers') }
    catch (e: any) { setError(e.message); setDeleting(false) }
  }

  const linkedContactIds = new Set((contract.contacts || []).map((c: any) => c.id))
  const availableContacts = allContacts.filter((c: any) => !linkedContactIds.has(c.id))

  return (
    <div style={{ padding: '24px 28px', maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <button onClick={() => router.push('/finance/customers')} style={{ background: 'none', border: 'none', color: '#45B6E4', fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: 0 }}>← Back to Customers</button>
        {canEdit && <button onClick={() => { setDeleteConfirm(''); setShowDelete(true) }} style={{ ...btn, background: 'white', color: '#DC2626', border: '1.5px solid #FCA5A5' }}>Delete Contract</button>}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: '11px', fontWeight: '700' }}>{contract.internal_id}</span>
          {contract.contract_type && <span style={{ background: '#F1F5F9', color: '#3F3F3F', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{contract.contract_type}</span>}
        </div>
        <EditableCell display={<h1 style={{ fontSize: '19px', fontWeight: '800', color: '#156082', margin: '0 0 6px' }}>{contract.contract_name || 'Untitled Contract'}</h1>}
          editing={editingField === 'contract_name'} canEdit={canEdit} onStartEdit={() => setEditingField('contract_name')}>
          <input autoFocus style={{ ...inp, fontSize: '15px', fontWeight: '700', width: '100%', boxSizing: 'border-box' as const }} defaultValue={contract.contract_name || ''}
            onBlur={e => updateField({ contract_name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
        </EditableCell>
        <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0' }}>
          {contract.company_name ? <a href={`/companies/${contract.company_id}`} style={{ color: '#156082', fontWeight: '600' }}>{contract.company_name}</a> : 'No company'}
          {contract.linked_project_name && <> · Project: <a href={`/operations/projects/${contract.project_id}`} style={{ color: '#156082', fontWeight: '600' }}>{contract.linked_project_name}</a></>}
          {contract.opportunity_deal_name && <> · Opportunity: <a href={`/opportunities/${contract.opportunity_id}`} style={{ color: '#156082', fontWeight: '600' }}>{contract.opportunity_deal_name}</a></>}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
          <div>
            <div style={lbl}>Contract Type</div>
            <EditableCell display={contract.contract_type} editing={editingField === 'contract_type'} canEdit={canEdit} onStartEdit={() => setEditingField('contract_type')}>
              <select autoFocus style={{ ...inp, width: '100%' }} defaultValue={contract.contract_type || ''} onChange={e => updateField({ contract_type: e.target.value })} onBlur={() => setEditingField(null)}>
                <option value="">—</option>
                {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </EditableCell>
          </div>
          <div>
            <div style={lbl}>Contract Value</div>
            <EditableCell display={contract.contract_value != null ? `€${contract.contract_value.toLocaleString('en-US')}` : null} editing={editingField === 'contract_value'} canEdit={canEdit} onStartEdit={() => setEditingField('contract_value')}>
              <input autoFocus type="number" style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} defaultValue={contract.contract_value ?? ''}
                onBlur={e => updateField({ contract_value: e.target.value ? parseFloat(e.target.value) : null })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
            </EditableCell>
          </div>
          <div>
            <div style={lbl}>Contract Start</div>
            <EditableCell display={fmtDate(contract.contract_start_date)} editing={editingField === 'contract_start_date'} canEdit={canEdit} onStartEdit={() => setEditingField('contract_start_date')}>
              <input autoFocus type="date" style={inp} defaultValue={contract.contract_start_date ? contract.contract_start_date.slice(0, 10) : ''} onBlur={e => updateField({ contract_start_date: e.target.value || null })} />
            </EditableCell>
          </div>
          <div>
            <div style={lbl}>Contract End</div>
            <EditableCell display={fmtDate(contract.contract_end_date)} editing={editingField === 'contract_end_date'} canEdit={canEdit} onStartEdit={() => setEditingField('contract_end_date')}>
              <input autoFocus type="date" style={inp} defaultValue={contract.contract_end_date ? contract.contract_end_date.slice(0, 10) : ''} onBlur={e => updateField({ contract_end_date: e.target.value || null })} />
            </EditableCell>
          </div>
          <div>
            <div style={lbl}>Date of Signature</div>
            <EditableCell display={fmtDate(contract.signature_date)} editing={editingField === 'signature_date'} canEdit={canEdit} onStartEdit={() => setEditingField('signature_date')}>
              <input autoFocus type="date" style={inp} defaultValue={contract.signature_date ? contract.signature_date.slice(0, 10) : ''} onBlur={e => updateField({ signature_date: e.target.value || null })} />
            </EditableCell>
          </div>
        </div>

        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
          <div style={lbl}>Signed Contract</div>
          {contract.signed_contract_url ? (
            <a href={contract.signed_contract_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#156082', fontWeight: '600' }}>📎 View signed contract</a>
          ) : <span style={{ fontSize: '12px', color: '#94A3B8' }}>No file uploaded.</span>}
          {canEdit && (
            <div style={{ marginTop: '8px' }}>
              <input ref={signedInputRef} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadSigned(f) }} />
              <button onClick={() => signedInputRef.current?.click()} disabled={uploadingSigned} style={{ ...btn, background: '#EFF6FF', color: '#156082' }}>
                {uploadingSigned ? 'Uploading…' : contract.signed_contract_url ? 'Replace file' : '+ Upload signed contract'}
              </button>
            </div>
          )}
        </div>

        {error && <div style={{ marginTop: '12px', background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
      </div>

      <div style={card}>
        <div style={lbl}>Invoicing Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '10px' }}>
          <div>
            <div style={lbl}>Invoicing Conditions</div>
            <EditableCell display={contract.invoicing_conditions} editing={editingField === 'invoicing_conditions'} canEdit={canEdit} onStartEdit={() => setEditingField('invoicing_conditions')}>
              <select autoFocus style={{ ...inp, width: '100%' }} defaultValue={contract.invoicing_conditions || ''} onChange={e => updateField({ invoicing_conditions: e.target.value })} onBlur={() => setEditingField(null)}>
                <option value="">—</option>
                {INVOICING_CONDITIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </EditableCell>
          </div>
          <div>
            <div style={lbl}>Payment Terms</div>
            <EditableCell display={contract.payment_terms} editing={editingField === 'payment_terms'} canEdit={canEdit} onStartEdit={() => setEditingField('payment_terms')}>
              <input autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} defaultValue={contract.payment_terms || ''} placeholder="e.g. Net 30"
                onBlur={e => updateField({ payment_terms: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
            </EditableCell>
          </div>
          <div>
            <div style={lbl}>Invoice Address — Postal</div>
            <EditableCell display={contract.invoice_address_postal} editing={editingField === 'invoice_address_postal'} canEdit={canEdit} onStartEdit={() => setEditingField('invoice_address_postal')}>
              <textarea autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '54px', resize: 'vertical' as const }} defaultValue={contract.invoice_address_postal || ''}
                onBlur={e => updateField({ invoice_address_postal: e.target.value })} />
            </EditableCell>
          </div>
          <div>
            <div style={lbl}>Invoice Address — Email</div>
            <EditableCell display={contract.invoice_address_email} editing={editingField === 'invoice_address_email'} canEdit={canEdit} onStartEdit={() => setEditingField('invoice_address_email')}>
              <input autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} defaultValue={contract.invoice_address_email || ''}
                onBlur={e => updateField({ invoice_address_email: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
            </EditableCell>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={lbl}>Invoice Address — Electronic Invoicing</div>
            <EditableCell display={contract.invoice_address_electronic} editing={editingField === 'invoice_address_electronic'} canEdit={canEdit} onStartEdit={() => setEditingField('invoice_address_electronic')}>
              <textarea autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '54px', resize: 'vertical' as const }} defaultValue={contract.invoice_address_electronic || ''}
                onBlur={e => updateField({ invoice_address_electronic: e.target.value })} />
            </EditableCell>
          </div>
        </div>

        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
          <div style={lbl}>Customer's Invoicing Documentation</div>
          {contract.invoicing_documentation_url ? (
            <a href={contract.invoicing_documentation_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#156082', fontWeight: '600' }}>📎 View document</a>
          ) : <span style={{ fontSize: '12px', color: '#94A3B8' }}>No file uploaded.</span>}
          {canEdit && (
            <div style={{ marginTop: '8px' }}>
              <input ref={invoicingDocInputRef} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadInvoicingDoc(f) }} />
              <button onClick={() => invoicingDocInputRef.current?.click()} disabled={uploadingInvoicingDoc} style={{ ...btn, background: '#EFF6FF', color: '#156082' }}>
                {uploadingInvoicingDoc ? 'Uploading…' : contract.invoicing_documentation_url ? 'Replace file' : '+ Upload documentation'}
              </button>
            </div>
          )}
        </div>

        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={lbl}>Invoicing Platform Links ({(contract.links || []).length})</div>
            {canEdit && !showAddLink && <button onClick={() => setShowAddLink(true)} style={{ ...btn, background: '#EFF6FF', color: '#156082' }}>+ Add Link</button>}
          </div>
          {(contract.links || []).length === 0 && !showAddLink ? (
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No links added yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: showAddLink ? '10px' : 0 }}>
              {(contract.links || []).map((l: any) => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#156082', fontWeight: '600', textDecoration: 'none' }}>🔗 {l.label}</a>
                  {canEdit && <button onClick={() => removeLink(l.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
                </div>
              ))}
            </div>
          )}
          {showAddLink && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input style={{ ...inp, width: '160px' }} placeholder="Label…" value={linkLabel} onChange={e => setLinkLabel(e.target.value)} />
              <input style={{ ...inp, flex: 1 }} placeholder="https://…" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addLink() }} />
              <button onClick={addLink} style={{ ...btn, background: '#156082', color: 'white' }}>Add</button>
              <button onClick={() => { setShowAddLink(false); setLinkLabel(''); setLinkUrl('') }} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={lbl}>Contacts ({(contract.contacts || []).length})</div>
        </div>
        {canEdit && availableContacts.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <select style={{ ...inp, flex: 1 }} value={addContactId} onChange={e => setAddContactId(e.target.value)}>
              <option value="">Select a contact…</option>
              {availableContacts.map((c: any) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
            <button onClick={linkContact} disabled={!addContactId} style={{ ...btn, background: '#156082', color: 'white' }}>+ Link</button>
          </div>
        )}
        {(contract.contacts || []).length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>No contacts linked yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {contract.contacts.map((c: any) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                <a href={`/contacts/${c.id}`} style={{ fontSize: '12px', fontWeight: '600', color: '#156082', textDecoration: 'none' }}>{c.first_name} {c.last_name}</a>
                {canEdit && <button onClick={() => unlinkContact(c.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {showDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowDelete(false) }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#DC2626', margin: 0 }}>Delete Contract</h2>
              <button onClick={() => setShowDelete(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: '#3F3F3F', margin: 0 }}>You are about to permanently delete <strong>{contract.contract_name || contract.internal_id}</strong>. This cannot be undone.</p>
              <div>
                <div style={lbl}>Type DELETE to confirm</div>
                <input autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const }} value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleDelete() }} placeholder="DELETE" />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowDelete(false)} style={{ ...btn, background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
                <button onClick={handleDelete} disabled={deleteConfirm !== 'DELETE' || deleting}
                  style={{ ...btn, background: deleteConfirm === 'DELETE' ? '#DC2626' : '#FCA5A5', color: 'white', cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'not-allowed' }}>
                  {deleting ? 'Deleting…' : 'Delete Contract'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CustomerContractDetailPage() {
  return <FinanceLayout><ContractDetailContent /></FinanceLayout>
}
