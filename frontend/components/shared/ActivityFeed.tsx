'use client'
import { useRouter } from 'next/navigation'

const ICON: Record<string, string> = { opportunity: '💼', note: '📝', task: '✅' }
const COLOR: Record<string, string> = { opportunity: '#219BD6', note: '#e97132', task: '#059669' }

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Merges Opportunity-created / Note-added / Task-assigned events into one reverse-chronological
// feed for a record's Overview tab. Each caller passes whatever of the three it already has —
// an entity with no task source (e.g. Contacts today) just omits `tasks`.
export function ActivityFeed({ opportunities = [], notes = [], tasks = [], opportunityHref }: {
  opportunities?: any[]
  notes?: any[]
  tasks?: any[]
  opportunityHref: (o: any) => string
}) {
  const router = useRouter()
  type Event = { key: string; type: string; title: string; date: string; href?: string; subtitle?: string }
  const events: Event[] = [
    ...opportunities.map((o: any): Event => ({ key: `opp-${o.id}`, type: 'opportunity', title: `Opportunity created: ${o.deal_name}`, date: o.created_at, href: opportunityHref(o) })),
    ...notes.map((n: any): Event => ({ key: `note-${n.id}`, type: 'note', title: 'Note added', subtitle: n.content, date: n.created_at })),
    ...tasks.map((t: any): Event => ({ key: `task-${t.id}`, type: 'task', title: `Task assigned: ${t.title}`, date: t.created_at })),
  ].filter(e => e.date).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (events.length === 0) return <p style={{ color: '#9B9B9B', fontSize: '12px' }}>No activity yet.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {events.map(e => (
        <div key={e.key} onClick={() => e.href && router.push(e.href)}
          style={{ display: 'flex', gap: '10px', padding: '10px 12px', border: '1px solid #EDF2F7', borderRadius: '8px', cursor: e.href ? 'pointer' : 'default' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: COLOR[e.type] + '22', color: COLOR[e.type], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0 }}>{ICON[e.type]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#144766' }}>{e.title}</div>
            {e.subtitle && <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.subtitle}</div>}
            <div style={{ fontSize: '10px', color: '#9B9B9B', marginTop: '3px' }}>{fmt(e.date)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
