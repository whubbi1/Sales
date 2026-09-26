'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { OperationsLayout } from '@/components/OperationsLayout'
import { TabNav } from '@/components/shared/RecordLayout'
import { pmAPI } from '@/lib/api'
import { PMSettings, fmtDate, ErrorBanner, useAction } from '@/components/project-management/shared'
import { BasicInfoTab } from '@/components/project-management/BasicInfoTab'
import { MembersTab, SECTIONS } from '@/components/project-management/MembersTab'
import { PlanningTab } from '@/components/project-management/PlanningTab'
import { MeetingsTab } from '@/components/project-management/MeetingsTab'
import { DeliverablesTab } from '@/components/project-management/DeliverablesTab'
import { TasksTab, ActionsTab, RisksTab, DecisionsTab } from '@/components/project-management/RegisterTab'

type Access = { is_manager: boolean; sections: Record<string, 'none' | 'view' | 'edit'> }

function ProjectManagementContent() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<any>(null)
  const [access, setAccess] = useState<Access | null>(null)
  const [settings, setSettings] = useState<PMSettings | null>(null)
  const [pending, setPending] = useState<{ meetings: any[]; deliverables: any[] }>({ meetings: [], deliverables: [] })
  const [tab, setTab] = useState('')
  const [openMeetingId, setOpenMeetingId] = useState<string | undefined>()
  const [loadError, setLoadError] = useState('')
  const { busy, error, run } = useAction()

  const loadSettings = () => pmAPI.getSettings(id).then(setSettings).catch(() => {})
  const loadPending = () => pmAPI.myValidations().then((p: any) => setPending({
    meetings: p.meetings.filter((m: any) => m.project_id === id),
    deliverables: p.deliverables.filter((d: any) => d.project_id === id),
  })).catch(() => {})

  useEffect(() => {
    Promise.all([pmAPI.getProject(id), pmAPI.getAccess(id)])
      .then(([p, a]) => {
        setProject(p); setAccess(a)
        const first = SECTIONS.find(s => a.sections[s.key] !== 'none')
        if (first) setTab(first.label)
      })
      .catch(e => setLoadError(e.message))
    loadSettings(); loadPending()
  }, [id])

  if (loadError) return <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>{loadError}</div>
  if (!project || !access) return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>

  const visible = SECTIONS.filter(s => access.sections[s.key] !== 'none')
  const current = SECTIONS.find(s => s.label === tab)
  const canEdit = current ? access.sections[current.key] === 'edit' : false
  const tabProps = settings && { projectId: id, canEdit, settings, reloadSettings: loadSettings }

  // Validators/approvers can act even without access to the section itself.
  const openValidation = (meetingId: string) => { setOpenMeetingId(meetingId); setTab('Meetings') }
  const decideDeliverable = (d: any, approve: boolean) => {
    const comment = approve ? '' : prompt('Why are you rejecting this version?') || ''
    if (!approve && !comment.trim()) return
    run(async () => { await pmAPI.decideVersion(id, d.deliverable_id, d.version_id, approve, comment); loadPending() })
  }
  // A requested validator without Meetings access still gets that one meeting, read-only.
  const validatorOnly = !!openMeetingId && access.sections.meetings === 'none'

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '11px', color: '#9B9B9B' }}>
        <button onClick={() => router.push('/operations/project-management')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontWeight: 600, fontSize: '11px', padding: 0 }}>Project Management</button>
        <span>/</span><span style={{ color: '#3F3F3F', fontWeight: 600 }}>{project.project_name}</span>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', gap: '16px', alignItems: 'center' }}>
        {settings?.customer_logo_url
          ? <img src={settings.customer_logo_url} alt="Customer logo" style={{ height: '44px', maxWidth: '120px', objectFit: 'contain' }} />
          : <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#144766', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🗂️</div>}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#144766', margin: 0 }}>{project.project_name}</h1>
            <span style={{ background: '#F1F5F9', color: '#64748B', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: 700 }}>{project.project_number}</span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            {project.company?.name || project.partner?.name || '—'} · {fmtDate(project.opportunity?.contract_start_date || project.start_date)} → {fmtDate(project.opportunity?.contract_end_date || project.end_date)}
            {project.project_manager_name && <> · PM: {project.project_manager_name}</>}
          </div>
        </div>
        {settings?.sharepoint_url && <a className="btn-secondary" href={settings.sharepoint_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>📂 SharePoint folder</a>}
      </div>

      <ErrorBanner error={error} />
      {(pending.meetings.length > 0 || pending.deliverables.length > 0) && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '12px' }}>
          <b style={{ color: '#9A3412' }}>Waiting for your validation</b>
          {pending.meetings.map(m => (
            <div key={m.meeting_id} style={{ marginTop: '6px' }}>
              Meeting minutes {m.number} — {m.title} ({fmtDate(m.meeting_date)}){' '}
              <button className="btn-secondary" style={{ marginLeft: '8px', padding: '3px 10px' }} onClick={() => openValidation(m.meeting_id)}>Review</button>
            </div>
          ))}
          {pending.deliverables.map(d => (
            <div key={d.version_id} style={{ marginTop: '6px' }}>
              Deliverable {d.number} — {d.name}, version {d.version_label}
              <button className="btn-primary" style={{ marginLeft: '8px', padding: '3px 10px' }} disabled={busy} onClick={() => decideDeliverable(d, true)}>Approve</button>
              <button className="btn-secondary" style={{ marginLeft: '6px', padding: '3px 10px' }} disabled={busy} onClick={() => decideDeliverable(d, false)}>Reject</button>
            </div>
          ))}
        </div>
      )}

      {validatorOnly && tabProps ? (
        <MeetingsTab key={openMeetingId} {...tabProps} canEdit={false} openMeetingId={openMeetingId} onChange={loadPending} onExit={() => setOpenMeetingId(undefined)} />
      ) : visible.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#3F3F3F', marginBottom: '4px' }}>You are not a member of this project</div>
          <div style={{ fontSize: '12px', color: '#94A3B8' }}>Ask the project manager to add you in Project Members.</div>
        </div>
      ) : (
        <>
          <TabNav tabs={visible.map(s => s.label)} active={tab} onChange={t => { setTab(t); setOpenMeetingId(undefined) }} />
          {tabProps && (
            <>
              {tab === 'Basic Information' && <BasicInfoTab {...tabProps} />}
              {tab === 'Members' && <MembersTab projectId={id} isManager={access.is_manager} />}
              {tab === 'Planning' && <PlanningTab {...tabProps} />}
              {tab === 'Tasks' && <TasksTab {...tabProps} />}
              {tab === 'Meetings' && <MeetingsTab key={openMeetingId || 'list'} {...tabProps} canEdit={access.sections.meetings === 'edit'} openMeetingId={openMeetingId} onChange={loadPending} />}
              {tab === 'Action List' && <ActionsTab {...tabProps} />}
              {tab === 'Decision Register' && <DecisionsTab {...tabProps} />}
              {tab === 'Risk Management' && <RisksTab {...tabProps} />}
              {tab === 'Deliverables' && <DeliverablesTab {...tabProps} />}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default function ProjectManagementDetailPage() {
  return <OperationsLayout><ProjectManagementContent /></OperationsLayout>
}
