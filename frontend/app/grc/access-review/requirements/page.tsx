'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GRCLayout, useGRCPerm } from '@/components/GRCLayout'
import { grcAccessReviewAPI } from '@/lib/api'

const API = 'https://api.whubbi.wcomply.com'

const REQ_STATUS_LABEL: Record<string, string> = { not_started: 'Not Started', in_progress: 'In Progress', compliant: 'Compliant', not_applicable: 'Not Applicable' }
const REQ_STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  not_started: { bg: '#F1F5F9', color: '#475569' }, in_progress: { bg: '#FFF7ED', color: '#D97706' },
  compliant: { bg: '#ECFDF5', color: '#059669' }, not_applicable: { bg: '#F1F5F9', color: '#94A3B8' },
}

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
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

function AccessReviewRequirementsContent() {
  const router = useRouter()
  const { level, canEdit } = useGRCPerm('access_review')
  const [requirements, setRequirements] = useState<any[]>([])
  const [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null)

  const load = async (all: boolean) => {
    setLoading(true)
    try {
      const d = await grcAccessReviewAPI.requirements(all)
      setRequirements(d.requirements || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load(showAll) }, [showAll])

  if (level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )

  const isEditing = (id: string, field: string) => editing?.id === id && editing.field === field

  const patchRequirement = async (req: any, fields: any) => {
    await fetch(`${API}/grc/requirements/${req.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requirement_text: req.requirement_text, reference_code: req.reference_code,
        status: req.status, evidence: req.evidence, owner_email: req.owner_email,
        ...fields,
      }),
    })
    setEditing(null)
    load(showAll)
  }

  const tagAccessControl = async (req: any, tagged: boolean) => {
    await grcAccessReviewAPI.setRequirementCategory(req.id, tagged ? 'access_control' : '')
    load(showAll)
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <button onClick={() => router.push('/grc/access-review')} style={{ background: 'none', border: 'none', color: '#45B6E4', fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: 0, marginBottom: '14px' }}>← Back to Access Review</button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>📐 Access Review Requirements</h1>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>Compliance requirements tied to access control — why these reviews are mandated, and how they're tracked.</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#3F3F3F', cursor: 'pointer' }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          Browse all requirements
        </label>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflowX: 'auto', overflowY: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', maxWidth: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#FAFBFC' }}>
            <tr>
              {['Framework', 'Reference', 'Requirement', 'Status', 'Evidence', 'Owner', canEdit ? 'Access Control' : null].filter(Boolean).map(h => (
                <th key={h as string} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', borderBottom: '1px solid #EDF2F7', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</td></tr>
            ) : requirements.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>{showAll ? 'No requirements found.' : 'No requirements tagged as access control yet — switch to "Browse all" to tag some.'}</td></tr>
            ) : requirements.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '10px 12px', color: '#3F3F3F', minWidth: '120px' }}>{r.framework_name}</td>
                <td style={{ padding: '10px 12px', color: '#64748B' }}>{r.reference_code || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#3F3F3F', minWidth: '260px' }}>{r.requirement_text}</td>
                <td style={{ padding: '10px 12px', minWidth: '110px' }}>
                  <EditableCell display={<span style={{ background: REQ_STATUS_COLOR[r.status]?.bg, color: REQ_STATUS_COLOR[r.status]?.color, padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{REQ_STATUS_LABEL[r.status] || r.status}</span>}
                    editing={isEditing(r.id, 'status')} canEdit={canEdit} onStartEdit={() => setEditing({ id: r.id, field: 'status' })}>
                    <select autoFocus style={inp} defaultValue={r.status} onChange={e => patchRequirement(r, { status: e.target.value })} onBlur={() => setEditing(null)}>
                      {Object.entries(REQ_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </EditableCell>
                </td>
                <td style={{ padding: '10px 12px', minWidth: '180px', color: '#64748B' }}>
                  <EditableCell display={r.evidence} editing={isEditing(r.id, 'evidence')} canEdit={canEdit} onStartEdit={() => setEditing({ id: r.id, field: 'evidence' })}>
                    <input autoFocus style={inp} defaultValue={r.evidence} onBlur={e => patchRequirement(r, { evidence: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                  </EditableCell>
                </td>
                <td style={{ padding: '10px 12px', minWidth: '150px', color: '#3F3F3F' }}>
                  <EditableCell display={r.owner_email} editing={isEditing(r.id, 'owner')} canEdit={canEdit} onStartEdit={() => setEditing({ id: r.id, field: 'owner' })}>
                    <input autoFocus style={inp} defaultValue={r.owner_email} onBlur={e => patchRequirement(r, { owner_email: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                  </EditableCell>
                </td>
                {canEdit && (
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => tagAccessControl(r, r.category !== 'access_control')}
                      style={{ padding: '5px 10px', background: r.category === 'access_control' ? '#F1F5F9' : '#EFF6FF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: r.category === 'access_control' ? '#64748B' : '#156082', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }}>
                      {r.category === 'access_control' ? 'Untag' : 'Tag as Access Control'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AccessReviewRequirementsPage() {
  return <GRCLayout><AccessReviewRequirementsContent /></GRCLayout>
}
