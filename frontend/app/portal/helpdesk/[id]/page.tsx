'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getStoredPortalUser, portalApiJson } from '@/lib/portalAuth'
import { recordPortalPageVisit } from '@/lib/portalRecentPages'
import PortalModuleLayout from '@/components/portal/PortalModuleLayout'

const HELPDESK_NAV = [
  { href: '/portal/helpdesk', label: 'Tickets', icon: '🎫' },
  { href: '/portal/helpdesk/knowledge', label: 'Knowledge Base', icon: '📚' },
]

const PRIORITY_LABEL: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }
const STATUS_LABEL: Record<string, string> = { new: 'New', open: 'Open', in_progress: 'In Progress', pending: 'Pending', resolved: 'Resolved', closed: 'Closed' }

function fmtDateTime(d?: string) { return d ? new Date(d).toLocaleString() : '—' }

export default function PortalTicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [ticket, setTicket] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const load = () => portalApiJson<{ ticket: any; comments: any[]; error?: string }>(`/helpdesk/tickets/${id}`).then(d => {
    if (!d.ticket) { setNotFound(true); return }
    setTicket(d.ticket)
    setComments(d.comments || [])
    recordPortalPageVisit(getStoredPortalUser()?.email || '', `/portal/helpdesk/${id}`, `Ticket: ${d.ticket.title}`)
  }).catch(() => setNotFound(true))

  useEffect(() => {
    if (!getStoredPortalUser()) {
      router.replace('/portal/login')
      return
    }
    load()
  }, [id, router])

  const reply = async () => {
    if (!comment.trim()) return
    setSending(true)
    try {
      await portalApiJson(`/helpdesk/tickets/${id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: comment }),
      })
      setComment('')
      await load()
    } catch {}
    setSending(false)
  }

  if (notFound) {
    return <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontFamily: 'Montserrat, sans-serif', fontSize: '13px' }}>Ticket not found.</div>
  }
  if (!ticket) {
    return <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontFamily: 'Montserrat, sans-serif', fontSize: '13px' }}>Loading…</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ background: '#156082', padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: 'white', fontSize: '15px', fontWeight: 800 }}>Helpdesk</div>
        <img src="/wcomply-logo.png" alt="WCOMPLY" style={{ height: '40px', objectFit: 'contain' }} />
      </div>

      <div style={{ padding: '32px 40px', maxWidth: '760px', margin: '0 auto' }}>
        <button onClick={() => router.push('/portal/helpdesk')}
          style={{ background: 'none', border: 'none', color: '#156082', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: '16px' }}>
          ← All tickets
        </button>

        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '22px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h1 style={{ fontSize: '17px', fontWeight: 800, color: '#156082', margin: 0 }}>{ticket.title}</h1>
            <span style={{ fontSize: '11px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{ticket.ticket_number}</span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <span>Status: <b>{STATUS_LABEL[ticket.status] || ticket.status}</b></span>
            <span>Priority: <b>{PRIORITY_LABEL[ticket.priority] || ticket.priority}</b></span>
            <span>Opened: {fmtDateTime(ticket.created_at)}</span>
          </div>
          {ticket.description && <p style={{ fontSize: '13px', color: '#3F3F3F', marginTop: '14px', whiteSpace: 'pre-wrap' }}>{ticket.description}</p>}
        </div>

        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '22px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#156082', marginBottom: '14px' }}>Conversation</div>
          {comments.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>No messages yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
              {comments.map(c => (
                <div key={c.id} style={{ background: '#F8FAFC', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>
                    <b style={{ color: '#156082' }}>{c.author_name || c.author_email}</b>
                    <span>{fmtDateTime(c.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#3F3F3F', whiteSpace: 'pre-wrap' }}>{c.content}</div>
                </div>
              ))}
            </div>
          )}
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Write a reply…"
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' as const }} />
          <div style={{ textAlign: 'right', marginTop: '10px' }}>
            <button onClick={reply} disabled={sending || !comment.trim()}
              style={{ padding: '9px 18px', background: sending ? '#F5F7FA' : '#156082', color: sending ? '#848EA5' : 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer' }}>
              {sending ? 'Sending…' : 'Send reply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
