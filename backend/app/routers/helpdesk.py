from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from datetime import datetime, timedelta
import uuid

router = APIRouter()

DEFAULT_CATEGORIES = [
    {"name": "IT Infrastructure", "description": "Network, servers, hardware", "color": "#156082", "icon": "🖥️"},
    {"name": "SAP / ERP",         "description": "SAP incidents and requests", "color": "#e97132", "icon": "⚙️"},
    {"name": "Access & Security",  "description": "Access rights, passwords",   "color": "#DC2626", "icon": "🔐"},
    {"name": "Software",           "description": "Software installation",       "color": "#45B6E4", "icon": "💿"},
    {"name": "Hardware",           "description": "PC, laptop, peripherals",     "color": "#059669", "icon": "🖱️"},
    {"name": "General Request",    "description": "Other requests",              "color": "#848EA5", "icon": "🎫"},
]
DEFAULT_SLA = [
    {"name": "Critical SLA", "priority": "critical", "response_time_hours": 1,  "resolution_time_hours": 4},
    {"name": "High SLA",     "priority": "high",     "response_time_hours": 4,  "resolution_time_hours": 8},
    {"name": "Medium SLA",   "priority": "medium",   "response_time_hours": 8,  "resolution_time_hours": 24},
    {"name": "Low SLA",      "priority": "low",      "response_time_hours": 24, "resolution_time_hours": 72},
]

async def seed(db: AsyncSession):
    c = await db.execute(text("SELECT COUNT(*) FROM ticket_categories"))
    if c.scalar() == 0:
        for cat in DEFAULT_CATEGORIES:
            await db.execute(text("INSERT INTO ticket_categories (id,name,description,color,icon,active,created_at) VALUES (gen_random_uuid(),:name,:description,:color,:icon,true,NOW())"), cat)
    s = await db.execute(text("SELECT COUNT(*) FROM sla_policies"))
    if s.scalar() == 0:
        for sla in DEFAULT_SLA:
            await db.execute(text("INSERT INTO sla_policies (id,name,priority,response_time_hours,resolution_time_hours,active,created_at) VALUES (gen_random_uuid(),:name,:priority,:response_time_hours,:resolution_time_hours,true,NOW())"), sla)
    await db.commit()

def ticket_number():
    n = datetime.utcnow()
    return f"TKT-{n.year}{n.month:02d}-{str(uuid.uuid4())[:4].upper()}"


@router.get("/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db)):
    await seed(db)
    status_r = await db.execute(text("SELECT status, COUNT(*) as c FROM tickets GROUP BY status"))
    by_status = {r.status: r.c for r in status_r.fetchall()}
    breached  = await db.execute(text("SELECT COUNT(*) FROM tickets WHERE sla_deadline < NOW() AND status NOT IN ('resolved','closed')"))
    prio_r    = await db.execute(text("SELECT priority, COUNT(*) as c FROM tickets GROUP BY priority"))
    avg_r     = await db.execute(text("SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) FROM tickets WHERE resolved_at IS NOT NULL"))
    recent    = await db.execute(text("""
        SELECT t.id,t.ticket_number,t.title,t.status,t.priority,t.requester_name,
               t.assignee_name,t.created_at,t.sla_deadline,
               c.name as category_name,c.color as category_color,c.icon as category_icon
        FROM tickets t LEFT JOIN ticket_categories c ON t.category_id=c.id
        ORDER BY t.created_at DESC LIMIT 10
    """))
    total = sum(by_status.values())
    return {
        "total": total,
        "open": by_status.get("new",0)+by_status.get("open",0)+by_status.get("in_progress",0),
        "resolved": by_status.get("resolved",0)+by_status.get("closed",0),
        "sla_breached": breached.scalar(),
        "avg_resolution_hours": round(avg_r.scalar() or 0, 1),
        "by_status": by_status,
        "by_priority": {r.priority: r.c for r in prio_r.fetchall()},
        "recent_tickets": [dict(r._mapping) for r in recent.fetchall()],
    }


@router.get("/tickets")
async def list_tickets(status: str = None, priority: str = None, search: str = None,
                       limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_db)):
    where, params = ["1=1"], {"limit": limit, "offset": offset}
    if status:   where.append("t.status=:status");    params["status"] = status
    if priority: where.append("t.priority=:priority"); params["priority"] = priority
    if search:
        where.append("(t.title ILIKE :s OR t.ticket_number ILIKE :s OR t.requester_email ILIKE :s)")
        params["s"] = f"%{search}%"
    w = " AND ".join(where)
    r = await db.execute(text(f"""
        SELECT t.id,t.ticket_number,t.title,t.status,t.priority,t.requester_email,
               t.requester_name,t.requester_type,t.assignee_name,t.created_at,t.sla_deadline,
               c.name as category_name,c.color as category_color,c.icon as category_icon
        FROM tickets t LEFT JOIN ticket_categories c ON t.category_id=c.id
        WHERE {w} ORDER BY t.created_at DESC LIMIT :limit OFFSET :offset
    """), params)
    cnt = await db.execute(text(f"SELECT COUNT(*) FROM tickets t WHERE {w}"),
                            {k: v for k,v in params.items() if k not in ("limit","offset")})
    return {"tickets": [dict(r._mapping) for r in r.fetchall()], "total": cnt.scalar()}


@router.get("/tickets/{tid}")
async def get_ticket(tid: str, db: AsyncSession = Depends(get_db)):
    t = await db.execute(text("""
        SELECT t.*,c.name as category_name,c.color as category_color,c.icon as category_icon
        FROM tickets t LEFT JOIN ticket_categories c ON t.category_id=c.id WHERE t.id=:id::uuid
    """), {"id": tid})
    ticket = t.fetchone()
    if not ticket: return {"error": "Not found"}
    coms = await db.execute(text("SELECT * FROM ticket_comments WHERE ticket_id=:id::uuid ORDER BY created_at"), {"id": tid})
    return {"ticket": dict(ticket._mapping), "comments": [dict(c._mapping) for c in coms.fetchall()]}


@router.post("/tickets")
async def create_ticket(data: dict, db: AsyncSession = Depends(get_db)):
    tid = str(uuid.uuid4())
    sla_r = await db.execute(text("SELECT resolution_time_hours FROM sla_policies WHERE priority=:p AND active=true LIMIT 1"), {"p": data.get("priority","medium")})
    sla_row = sla_r.fetchone()
    sla_h = sla_row.resolution_time_hours if sla_row else 24
    await db.execute(text("""
        INSERT INTO tickets (id,ticket_number,title,description,category_id,priority,status,
            requester_email,requester_name,requester_type,assignee_email,assignee_name,sla_deadline,created_at,updated_at)
        VALUES (:id::uuid,:tn,:title,:desc,:cat_id::uuid,:prio,'new',:req_email,:req_name,:req_type,:ass_email,:ass_name,:sla,NOW(),NOW())
    """), {"id": tid, "tn": ticket_number(), "title": data.get("title"), "desc": data.get("description"),
           "cat_id": data.get("category_id") or "00000000-0000-0000-0000-000000000000",
           "prio": data.get("priority","medium"), "req_email": data.get("requester_email"),
           "req_name": data.get("requester_name"), "req_type": data.get("requester_type","internal"),
           "ass_email": data.get("assignee_email"), "ass_name": data.get("assignee_name"),
           "sla": datetime.utcnow() + timedelta(hours=sla_h)})
    await db.commit()
    return {"status": "ok", "id": tid}


@router.put("/tickets/{tid}")
async def update_ticket(tid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE tickets SET
            status=COALESCE(:status,status), priority=COALESCE(:priority,priority),
            assignee_email=COALESCE(:assignee_email,assignee_email),
            assignee_name=COALESCE(:assignee_name,assignee_name),
            resolution=COALESCE(:resolution,resolution),
            resolved_at=CASE WHEN :status IN ('resolved','closed') AND resolved_at IS NULL THEN NOW() ELSE resolved_at END,
            updated_at=NOW()
        WHERE id=:id::uuid
    """), {**data, "id": tid})
    await db.commit()
    return {"status": "ok"}


@router.post("/tickets/{tid}/comments")
async def add_comment(tid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        INSERT INTO ticket_comments (id,ticket_id,author_email,author_name,content,is_internal,created_at)
        VALUES (gen_random_uuid(),:tid::uuid,:email,:name,:content,:internal,NOW())
    """), {"tid": tid, "email": data.get("author_email"), "name": data.get("author_name"),
           "content": data.get("content"), "internal": data.get("is_internal", False)})
    await db.execute(text("UPDATE tickets SET updated_at=NOW() WHERE id=:id::uuid"), {"id": tid})
    await db.commit()
    return {"status": "ok"}


@router.get("/categories")
async def get_categories(db: AsyncSession = Depends(get_db)):
    await seed(db)
    r = await db.execute(text("SELECT * FROM ticket_categories WHERE active=true ORDER BY name"))
    return {"categories": [dict(x._mapping) for x in r.fetchall()]}


@router.post("/categories")
async def create_category(data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("INSERT INTO ticket_categories (id,name,description,color,icon,active,created_at) VALUES (gen_random_uuid(),:name,:desc,:color,:icon,true,NOW())"),
                     {"name": data.get("name"), "desc": data.get("description",""), "color": data.get("color","#45B6E4"), "icon": data.get("icon","🎫")})
    await db.commit()
    return {"status": "ok"}


@router.delete("/categories/{cid}")
async def delete_category(cid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("UPDATE ticket_categories SET active=false WHERE id=:id::uuid"), {"id": cid})
    await db.commit()
    return {"status": "ok"}


@router.get("/sla")
async def get_sla(db: AsyncSession = Depends(get_db)):
    await seed(db)
    r = await db.execute(text("SELECT * FROM sla_policies ORDER BY response_time_hours"))
    return {"policies": [dict(x._mapping) for x in r.fetchall()]}


@router.get("/knowledge")
async def list_articles(search: str = None, category: str = None, db: AsyncSession = Depends(get_db)):
    where, params = ["published=true"], {}
    if search:
        where.append("(title ILIKE :s OR content ILIKE :s OR tags ILIKE :s)")
        params["s"] = f"%{search}%"
    if category:
        where.append("category=:cat"); params["cat"] = category
    r = await db.execute(text(f"""
        SELECT id,title,category,tags,author_name,views,helpful,created_at,updated_at,LEFT(content,200) as excerpt
        FROM knowledge_articles WHERE {' AND '.join(where)} ORDER BY views DESC,created_at DESC
    """), params)
    return {"articles": [dict(x._mapping) for x in r.fetchall()]}


@router.get("/knowledge/{aid}")
async def get_article(aid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("UPDATE knowledge_articles SET views=views+1 WHERE id=:id::uuid"), {"id": aid})
    await db.commit()
    r = await db.execute(text("SELECT * FROM knowledge_articles WHERE id=:id::uuid"), {"id": aid})
    row = r.fetchone()
    return dict(row._mapping) if row else {"error": "Not found"}


@router.post("/knowledge")
async def create_article(data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        INSERT INTO knowledge_articles (id,title,content,category,tags,author_email,author_name,published,created_at,updated_at)
        VALUES (gen_random_uuid(),:title,:content,:cat,:tags,:email,:name,:pub,NOW(),NOW())
    """), {"title": data.get("title"), "content": data.get("content"), "cat": data.get("category"),
           "tags": data.get("tags",""), "email": data.get("author_email"), "name": data.get("author_name"),
           "pub": data.get("published", True)})
    await db.commit()
    return {"status": "ok"}


@router.put("/knowledge/{aid}")
async def update_article(aid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE knowledge_articles SET title=COALESCE(:title,title),content=COALESCE(:content,content),
        category=COALESCE(:category,category),tags=COALESCE(:tags,tags),
        published=COALESCE(:published,published),updated_at=NOW() WHERE id=:id::uuid
    """), {**data, "id": aid})
    await db.commit()
    return {"status": "ok"}


@router.delete("/knowledge/{aid}")
async def delete_article(aid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM knowledge_articles WHERE id=:id::uuid"), {"id": aid})
    await db.commit()
    return {"status": "ok"}


@router.get("/reporting")
async def reporting(days: int = 30, db: AsyncSession = Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=days)
    vol   = await db.execute(text("SELECT DATE(created_at) as d,COUNT(*) as c FROM tickets WHERE created_at>:s GROUP BY DATE(created_at) ORDER BY d"), {"s": since})
    cat   = await db.execute(text("""
        SELECT c.name,c.color,c.icon,COUNT(t.id) as c
        FROM tickets t LEFT JOIN ticket_categories c ON t.category_id=c.id
        WHERE t.created_at>:s GROUP BY c.name,c.color,c.icon ORDER BY c DESC
    """), {"s": since})
    sla   = await db.execute(text("""
        SELECT COUNT(*) as total,
               SUM(CASE WHEN sla_deadline>=COALESCE(resolved_at,NOW()) THEN 1 ELSE 0 END) as ok,
               SUM(CASE WHEN sla_deadline<COALESCE(resolved_at,NOW()) THEN 1 ELSE 0 END) as breached
        FROM tickets WHERE created_at>:s
    """), {"s": since})
    prio  = await db.execute(text("""
        SELECT priority,AVG(EXTRACT(EPOCH FROM (resolved_at-created_at))/3600) as avg_h,COUNT(*) as c
        FROM tickets WHERE resolved_at IS NOT NULL AND created_at>:s GROUP BY priority
    """), {"s": since})
    sla_r = sla.fetchone()
    return {
        "period_days": days,
        "volume_by_day": [{"date": str(r.d), "count": r.c} for r in vol.fetchall()],
        "by_category": [dict(r._mapping) for r in cat.fetchall()],
        "sla": {"total": sla_r.total, "compliant": sla_r.ok, "breached": sla_r.breached,
                "rate": round((sla_r.ok/sla_r.total*100) if sla_r.total else 100, 1)},
        "by_priority": [{"priority": r.priority, "avg_hours": round(r.avg_h or 0,1), "count": r.c} for r in prio.fetchall()],
    }
