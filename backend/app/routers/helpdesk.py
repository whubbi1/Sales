from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from datetime import datetime, timedelta
import uuid, httpx, os

router = APIRouter()

MS_TENANT_ID     = os.getenv("MS_TENANT_ID","")
MS_CLIENT_ID     = os.getenv("MS_CLIENT_ID","")
MS_CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET","")

DEFAULT_CATEGORIES = [
    {"name":"Access & Security",  "color":"#DC2626","icon":"🔐"},
    {"name":"General Request",    "color":"#848EA5","icon":"🎫"},
    {"name":"Hardware",           "color":"#059669","icon":"🖱️"},
    {"name":"Software",           "color":"#45B6E4","icon":"💿"},
    {"name":"IT Infrastructure",  "color":"#156082","icon":"🖥️"},
    {"name":"Applications",       "color":"#e97132","icon":"⚙️"},
    {"name":"Projects",           "color":"#7C3AED","icon":"📋"},
]
APP_SUBCATEGORIES = ["Payfit","Karanext","May","SWILE","TravelPerk"]
DEFAULT_SLA = [
    {"name":"Critical SLA","priority":"critical","response_time_hours":1, "resolution_time_hours":4},
    {"name":"High SLA",    "priority":"high",    "response_time_hours":4, "resolution_time_hours":8},
    {"name":"Medium SLA",  "priority":"medium",  "response_time_hours":8, "resolution_time_hours":24},
    {"name":"Low SLA",     "priority":"low",     "response_time_hours":24,"resolution_time_hours":72},
]

async def seed(db: AsyncSession):
    c = await db.execute(text("SELECT COUNT(*) FROM ticket_categories WHERE parent_id IS NULL"))
    if c.scalar() == 0:
        for cat in DEFAULT_CATEGORIES:
            cat_id = str(uuid.uuid4())
            await db.execute(text("INSERT INTO ticket_categories (id,name,description,color,icon,active,created_at) VALUES (:id::uuid,:name,'',:color,:icon,true,NOW())"), {**cat,"id":cat_id})
            if cat["name"] == "Applications":
                for sub in APP_SUBCATEGORIES:
                    await db.execute(text("INSERT INTO ticket_categories (id,name,description,color,icon,parent_id,active,created_at) VALUES (gen_random_uuid(),:name,'',:color,'📱',:pid::uuid,true,NOW())"), {"name":sub,"color":cat["color"],"pid":cat_id})
        await db.commit()
    g = await db.execute(text("SELECT COUNT(*) FROM helpdesk_groups"))
    if g.scalar() == 0:
        await db.execute(text("INSERT INTO helpdesk_groups (id,name,description,active,created_at) VALUES (gen_random_uuid(),'Helpdesk Admin','Default administrator group',true,NOW())"))
        await db.commit()
    s = await db.execute(text("SELECT COUNT(*) FROM sla_policies"))
    if s.scalar() == 0:
        for sla in DEFAULT_SLA:
            await db.execute(text("INSERT INTO sla_policies (id,name,priority,response_time_hours,resolution_time_hours,active,created_at) VALUES (gen_random_uuid(),:name,:priority,:response_time_hours,:resolution_time_hours,true,NOW())"), sla)
        await db.commit()

def gen_ticket_number():
    n = datetime.utcnow()
    return f"TKT-{n.year}{n.month:02d}-{str(uuid.uuid4())[:4].upper()}"

async def get_ms_user(email: str) -> dict:
    try:
        url = f"https://login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/token"
        async with httpx.AsyncClient() as client:
            r = await client.post(url, data={"grant_type":"client_credentials","client_id":MS_CLIENT_ID,"client_secret":MS_CLIENT_SECRET,"scope":"https://graph.microsoft.com/.default"})
            token = r.json().get("access_token","")
            if token:
                ur = await client.get(f"https://graph.microsoft.com/v1.0/users/{email}?$select=displayName,givenName,surname", headers={"Authorization":f"Bearer {token}"},timeout=5)
                if ur.status_code == 200:
                    d = ur.json()
                    return {"name":d.get("displayName",""),"first":d.get("givenName",""),"last":d.get("surname","")}
    except Exception: pass
    return {}


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
               c.name as category_name,c.color as category_color,c.icon as category_icon,
               g.name as group_name
        FROM tickets t LEFT JOIN ticket_categories c ON t.category_id=c.id
        LEFT JOIN helpdesk_groups g ON t.group_id=g.id
        ORDER BY t.created_at DESC LIMIT 10
    """))
    total = sum(by_status.values())
    return {"total":total,"open":by_status.get("new",0)+by_status.get("open",0)+by_status.get("in_progress",0),
            "resolved":by_status.get("resolved",0)+by_status.get("closed",0),
            "sla_breached":breached.scalar(),"avg_resolution_hours":round(avg_r.scalar() or 0,1),
            "by_status":by_status,"by_priority":{r.priority:r.c for r in prio_r.fetchall()},
            "recent_tickets":[dict(r._mapping) for r in recent.fetchall()]}


@router.get("/tickets")
async def list_tickets(status:str=None,priority:str=None,group_id:str=None,
                       assignee_email:str=None,search:str=None,
                       limit:int=50,offset:int=0,db:AsyncSession=Depends(get_db)):
    where,params=["1=1"],{"limit":limit,"offset":offset}
    if status:   where.append("t.status=:status");    params["status"]=status
    if priority: where.append("t.priority=:priority"); params["priority"]=priority
    if group_id: where.append("t.group_id=:group_id::uuid"); params["group_id"]=group_id
    if assignee_email: where.append("t.assignee_email=:assignee_email"); params["assignee_email"]=assignee_email
    if search:
        where.append("(t.title ILIKE :s OR t.ticket_number ILIKE :s OR t.requester_email ILIKE :s)")
        params["s"]=f"%{search}%"
    w=" AND ".join(where)
    r=await db.execute(text(f"""
        SELECT t.id,t.ticket_number,t.title,t.status,t.priority,
               t.requester_email,t.requester_name,t.requester_type,
               t.assignee_email,t.assignee_name,t.created_at,t.sla_deadline,
               c.name as category_name,c.color as category_color,c.icon as category_icon,
               sc.name as subcategory_name,g.name as group_name
        FROM tickets t
        LEFT JOIN ticket_categories c ON t.category_id=c.id
        LEFT JOIN ticket_categories sc ON t.subcategory_id=sc.id
        LEFT JOIN helpdesk_groups g ON t.group_id=g.id
        WHERE {w} ORDER BY t.created_at DESC LIMIT :limit OFFSET :offset
    """),params)
    cnt=await db.execute(text(f"SELECT COUNT(*) FROM tickets t WHERE {w}"),{k:v for k,v in params.items() if k not in ("limit","offset")})
    return {"tickets":[dict(r._mapping) for r in r.fetchall()],"total":cnt.scalar()}


@router.get("/tickets/{tid}")
async def get_ticket(tid:str,db:AsyncSession=Depends(get_db)):
    t=await db.execute(text("""
        SELECT t.*,c.name as category_name,c.color as category_color,c.icon as category_icon,
               sc.name as subcategory_name,g.name as group_name,
               g.responsible_email,g.responsible_name
        FROM tickets t LEFT JOIN ticket_categories c ON t.category_id=c.id
        LEFT JOIN ticket_categories sc ON t.subcategory_id=sc.id
        LEFT JOIN helpdesk_groups g ON t.group_id=g.id WHERE t.id=:id::uuid
    """),{"id":tid})
    ticket=t.fetchone()
    if not ticket: return {"error":"Not found"}
    coms=await db.execute(text("SELECT * FROM ticket_comments WHERE ticket_id=:id::uuid ORDER BY created_at"),{"id":tid})
    return {"ticket":dict(ticket._mapping),"comments":[dict(c._mapping) for c in coms.fetchall()]}


@router.post("/tickets")
async def create_ticket(data:dict,db:AsyncSession=Depends(get_db)):
    tid=str(uuid.uuid4())
    req_email=data.get("requester_email","")
    req_name=data.get("requester_name","")
    if not req_name and req_email.lower().endswith("@wcomply.com"):
        ms=await get_ms_user(req_email)
        req_name=ms.get("name",req_email.split("@")[0])
    sla_r=await db.execute(text("SELECT resolution_time_hours FROM sla_policies WHERE priority=:p AND active=true LIMIT 1"),{"p":data.get("priority","medium")})
    sla_row=sla_r.fetchone()
    sla_h=sla_row.resolution_time_hours if sla_row else 24
    group_id=data.get("group_id")
    if not group_id:
        cat_id=data.get("category_id") or data.get("subcategory_id")
        if cat_id:
            g_r=await db.execute(text("SELECT group_id FROM ticket_categories WHERE id=:id::uuid"),{"id":cat_id})
            g_row=g_r.fetchone()
            if g_row and g_row.group_id: group_id=str(g_row.group_id)
        if not group_id:
            ag=await db.execute(text("SELECT id FROM helpdesk_groups WHERE name='Helpdesk Admin' LIMIT 1"))
            ag_row=ag.fetchone()
            if ag_row: group_id=str(ag_row.id)
    assignee_email=data.get("assignee_email","")
    assignee_name=data.get("assignee_name","")
    if group_id and not assignee_email:
        members_r=await db.execute(text("SELECT user_email,user_name FROM helpdesk_group_members WHERE group_id=:gid::uuid"),{"gid":group_id})
        members=members_r.fetchall()
        if len(members)==1: assignee_email=members[0].user_email; assignee_name=members[0].user_name
    ticket_num=gen_ticket_number()
    await db.execute(text("""
        INSERT INTO tickets (id,ticket_number,title,description,category_id,subcategory_id,group_id,
            priority,status,requester_email,requester_name,requester_type,
            assignee_email,assignee_name,sla_deadline,created_at,updated_at)
        VALUES (:id::uuid,:tn,:title,:desc,
            NULLIF(:cat_id,'')::uuid,NULLIF(:sub_id,'')::uuid,NULLIF(:group_id,'')::uuid,
            :prio,'new',:req_email,:req_name,:req_type,
            NULLIF(:ass_email,''),NULLIF(:ass_name,''),
            :sla,NOW(),NOW())
    """),{"id":tid,"tn":ticket_num,"title":data.get("title"),"desc":data.get("description",""),
          "cat_id":data.get("category_id",""),"sub_id":data.get("subcategory_id",""),
          "group_id":group_id or "","prio":data.get("priority","medium"),
          "req_email":req_email,"req_name":req_name,"req_type":data.get("requester_type","internal"),
          "ass_email":assignee_email,"ass_name":assignee_name,
          "sla":datetime.utcnow()+timedelta(hours=sla_h)})
    await db.commit()

    # Notify group responsible if not auto-assigned
    if not assignee_email and group_id:
        resp_r=await db.execute(text("SELECT responsible_email,responsible_name,name FROM helpdesk_groups WHERE id=:id::uuid"),{"id":group_id})
        resp=resp_r.fetchone()
        if resp and resp.responsible_email:
            try:
                from app.routers.helpdesk_teams import notify_group_responsible
                await notify_group_responsible({"ticket_number":ticket_num,"title":data.get("title"),"priority":data.get("priority","medium"),"requester_name":req_name,"requester_email":req_email},resp.name,resp.responsible_email,db)
            except Exception as e: print(f"Notify error: {e}")

    return {"status":"ok","id":tid,"ticket_number":ticket_num}


@router.put("/tickets/{tid}")
async def update_ticket(tid:str,data:dict,db:AsyncSession=Depends(get_db)):
    # Get current state before update
    current=await db.execute(text("""
        SELECT t.requester_email,t.assignee_email,t.ticket_number,t.title,
               t.description,t.teams_chat_id,c.name as category_name
        FROM tickets t LEFT JOIN ticket_categories c ON t.category_id=c.id
        WHERE t.id=:id::uuid
    """),{"id":tid})
    ticket=current.fetchone()
    if not ticket: return {"status":"error","message":"Not found"}
    old_assignee=ticket.assignee_email or ""
    new_assignee=data.get("assignee_email","")

    await db.execute(text("""
        UPDATE tickets SET
            status=COALESCE(NULLIF(:status,''),status),
            priority=COALESCE(NULLIF(:priority,''),priority),
            assignee_email=COALESCE(NULLIF(:assignee_email,''),assignee_email),
            assignee_name=COALESCE(NULLIF(:assignee_name,''),assignee_name),
            group_id=CASE WHEN :group_id='' THEN group_id ELSE :group_id::uuid END,
            resolution=COALESCE(NULLIF(:resolution,''),resolution),
            resolved_at=CASE WHEN :status IN ('resolved','closed') AND resolved_at IS NULL THEN NOW() ELSE resolved_at END,
            updated_at=NOW()
        WHERE id=:id::uuid
    """),{**{k:v or '' for k,v in data.items()},"id":tid,"group_id":data.get("group_id","")})
    await db.commit()

    # Create Teams chat when assignee is set/changed
    teams_result=None
    if new_assignee and new_assignee!=old_assignee and ticket.requester_email:
        try:
            from app.routers.helpdesk_teams import create_teams_chat
            teams_result=await create_teams_chat(
                ticket_id=tid,ticket_number=ticket.ticket_number,
                ticket_title=ticket.title,ticket_description=ticket.description or "",
                category_name=ticket.category_name or "",
                requester_email=ticket.requester_email,assignee_email=new_assignee,db=db)
        except Exception as e:
            teams_result={"status":"error","message":str(e)}

    return {"status":"ok","teams":teams_result}


@router.post("/tickets/{tid}/comments")
async def add_comment(tid:str,data:dict,db:AsyncSession=Depends(get_db)):
    await db.execute(text("INSERT INTO ticket_comments (id,ticket_id,author_email,author_name,content,is_internal,created_at) VALUES (gen_random_uuid(),:tid::uuid,:email,:name,:content,:internal,NOW())"),
                     {"tid":tid,"email":data.get("author_email"),"name":data.get("author_name"),"content":data.get("content"),"internal":data.get("is_internal",False)})
    await db.execute(text("UPDATE tickets SET updated_at=NOW() WHERE id=:id::uuid"),{"id":tid})
    await db.commit()
    return {"status":"ok"}


@router.get("/categories")
async def get_categories(db:AsyncSession=Depends(get_db)):
    await seed(db)
    r=await db.execute(text("""
        SELECT c.*,g.name as group_name,
               (SELECT COUNT(*) FROM ticket_categories sub WHERE sub.parent_id=c.id AND sub.active=true) as sub_count
        FROM ticket_categories c LEFT JOIN helpdesk_groups g ON c.group_id=g.id
        WHERE c.parent_id IS NULL AND c.active=true ORDER BY c.name
    """))
    categories=[]
    for cat in r.fetchall():
        cd=dict(cat._mapping)
        subs=await db.execute(text("SELECT c.*,g.name as group_name FROM ticket_categories c LEFT JOIN helpdesk_groups g ON c.group_id=g.id WHERE c.parent_id=:pid::uuid AND c.active=true ORDER BY c.name"),{"pid":str(cd["id"])})
        cd["subcategories"]=[dict(s._mapping) for s in subs.fetchall()]
        categories.append(cd)
    return {"categories":categories}


@router.post("/categories")
async def create_category(data:dict,db:AsyncSession=Depends(get_db)):
    await db.execute(text("INSERT INTO ticket_categories (id,name,description,color,icon,parent_id,group_id,active,created_at) VALUES (gen_random_uuid(),:name,:desc,:color,:icon,NULLIF(:parent_id,'')::uuid,NULLIF(:group_id,'')::uuid,true,NOW())"),
                     {"name":data.get("name"),"desc":data.get("description",""),"color":data.get("color","#45B6E4"),"icon":data.get("icon","🎫"),"parent_id":data.get("parent_id",""),"group_id":data.get("group_id","")})
    await db.commit()
    return {"status":"ok"}


@router.put("/categories/{cid}")
async def update_category(cid:str,data:dict,db:AsyncSession=Depends(get_db)):
    await db.execute(text("UPDATE ticket_categories SET group_id=NULLIF(:group_id,'')::uuid,name=COALESCE(NULLIF(:name,''),name) WHERE id=:id::uuid"),
                     {"id":cid,"group_id":data.get("group_id",""),"name":data.get("name","")})
    await db.commit()
    return {"status":"ok"}


@router.delete("/categories/{cid}")
async def delete_category(cid:str,db:AsyncSession=Depends(get_db)):
    await db.execute(text("UPDATE ticket_categories SET active=false WHERE id=:id::uuid OR parent_id=:id::uuid"),{"id":cid})
    await db.commit()
    return {"status":"ok"}


@router.get("/groups")
async def get_groups(db:AsyncSession=Depends(get_db)):
    r=await db.execute(text("SELECT * FROM helpdesk_groups WHERE active=true ORDER BY name"))
    groups=[]
    for g in r.fetchall():
        gd=dict(g._mapping)
        m=await db.execute(text("SELECT * FROM helpdesk_group_members WHERE group_id=:gid::uuid ORDER BY user_name"),{"gid":str(gd["id"])})
        gd["members"]=[dict(mm._mapping) for mm in m.fetchall()]
        groups.append(gd)
    return {"groups":groups}


@router.post("/groups")
async def create_group(data:dict,db:AsyncSession=Depends(get_db)):
    gid=str(uuid.uuid4())
    await db.execute(text("INSERT INTO helpdesk_groups (id,name,description,responsible_email,responsible_name,active,created_at) VALUES (:id::uuid,:name,:desc,:resp_email,:resp_name,true,NOW())"),
                     {"id":gid,"name":data.get("name"),"desc":data.get("description",""),"resp_email":data.get("responsible_email",""),"resp_name":data.get("responsible_name","")})
    await db.commit()
    return {"status":"ok","id":gid}


@router.post("/groups/{gid}/members")
async def add_group_member(gid:str,data:dict,db:AsyncSession=Depends(get_db)):
    await db.execute(text("INSERT INTO helpdesk_group_members (id,group_id,user_email,user_name,is_responsible,created_at) VALUES (gen_random_uuid(),:gid::uuid,:email,:name,:resp,NOW()) ON CONFLICT DO NOTHING"),
                     {"gid":gid,"email":data.get("user_email"),"name":data.get("user_name",""),"resp":data.get("is_responsible",False)})
    if data.get("is_responsible"):
        await db.execute(text("UPDATE helpdesk_groups SET responsible_email=:email,responsible_name=:name WHERE id=:id::uuid"),
                         {"email":data.get("user_email"),"name":data.get("user_name",""),"id":gid})
    await db.commit()
    return {"status":"ok"}


@router.delete("/groups/{gid}/members/{email}")
async def remove_group_member(gid:str,email:str,db:AsyncSession=Depends(get_db)):
    await db.execute(text("DELETE FROM helpdesk_group_members WHERE group_id=:gid::uuid AND user_email=:email"),{"gid":gid,"email":email})
    await db.commit()
    return {"status":"ok"}


@router.get("/users")
async def get_users(db:AsyncSession=Depends(get_db)):
    r=await db.execute(text("SELECT * FROM helpdesk_users ORDER BY user_name"))
    return {"users":[dict(u._mapping) for u in r.fetchall()]}


@router.post("/users")
async def upsert_user(data:dict,db:AsyncSession=Depends(get_db)):
    await db.execute(text("INSERT INTO helpdesk_users (id,user_email,user_name,role,created_at) VALUES (gen_random_uuid(),:email,:name,:role,NOW()) ON CONFLICT (user_email) DO UPDATE SET role=EXCLUDED.role,user_name=EXCLUDED.user_name"),
                     {"email":data.get("user_email"),"name":data.get("user_name",""),"role":data.get("role","end_user")})
    await db.commit()
    return {"status":"ok"}


@router.get("/users/{email}/role")
async def get_user_role(email:str,db:AsyncSession=Depends(get_db)):
    r=await db.execute(text("SELECT role FROM helpdesk_users WHERE user_email=:email"),{"email":email})
    row=r.fetchone()
    return {"role":row.role if row else "end_user"}


@router.get("/lookup/user")
async def lookup_user(email:str):
    if email.lower().endswith("@wcomply.com"):
        ms=await get_ms_user(email)
        if ms.get("name"): return {"found":True,"name":ms["name"],"type":"internal"}
    return {"found":False,"name":"","type":"external" if "@" in email else ""}


@router.get("/sla")
async def get_sla(db:AsyncSession=Depends(get_db)):
    await seed(db)
    r=await db.execute(text("SELECT * FROM sla_policies ORDER BY response_time_hours"))
    return {"policies":[dict(x._mapping) for x in r.fetchall()]}


@router.get("/knowledge")
async def list_articles(search:str=None,category:str=None,db:AsyncSession=Depends(get_db)):
    where,params=["published=true"],{}
    if search: where.append("(title ILIKE :s OR content ILIKE :s OR tags ILIKE :s)"); params["s"]=f"%{search}%"
    if category: where.append("category=:cat"); params["cat"]=category
    r=await db.execute(text(f"SELECT id,title,category,tags,author_name,views,helpful,created_at,updated_at,LEFT(content,200) as excerpt FROM knowledge_articles WHERE {' AND '.join(where)} ORDER BY views DESC,created_at DESC"),params)
    return {"articles":[dict(x._mapping) for x in r.fetchall()]}


@router.get("/knowledge/{aid}")
async def get_article(aid:str,db:AsyncSession=Depends(get_db)):
    await db.execute(text("UPDATE knowledge_articles SET views=views+1 WHERE id=:id::uuid"),{"id":aid})
    await db.commit()
    r=await db.execute(text("SELECT * FROM knowledge_articles WHERE id=:id::uuid"),{"id":aid})
    row=r.fetchone()
    return dict(row._mapping) if row else {"error":"Not found"}


@router.post("/knowledge")
async def create_article(data:dict,db:AsyncSession=Depends(get_db)):
    await db.execute(text("INSERT INTO knowledge_articles (id,title,content,category,tags,author_email,author_name,published,created_at,updated_at) VALUES (gen_random_uuid(),:title,:content,:cat,:tags,:email,:name,:pub,NOW(),NOW())"),
                     {"title":data.get("title"),"content":data.get("content"),"cat":data.get("category"),"tags":data.get("tags",""),"email":data.get("author_email"),"name":data.get("author_name"),"pub":data.get("published",True)})
    await db.commit()
    return {"status":"ok"}


@router.delete("/knowledge/{aid}")
async def delete_article(aid:str,db:AsyncSession=Depends(get_db)):
    await db.execute(text("DELETE FROM knowledge_articles WHERE id=:id::uuid"),{"id":aid})
    await db.commit()
    return {"status":"ok"}


@router.get("/reporting")
async def reporting(days:int=30,db:AsyncSession=Depends(get_db)):
    since=datetime.utcnow()-timedelta(days=days)
    vol=await db.execute(text("SELECT DATE(created_at) as d,COUNT(*) as c FROM tickets WHERE created_at>:s GROUP BY DATE(created_at) ORDER BY d"),{"s":since})
    cat=await db.execute(text("SELECT c.name,c.color,c.icon,COUNT(t.id) as c FROM tickets t LEFT JOIN ticket_categories c ON t.category_id=c.id WHERE t.created_at>:s GROUP BY c.name,c.color,c.icon ORDER BY c DESC"),{"s":since})
    sla=await db.execute(text("SELECT COUNT(*) as total,SUM(CASE WHEN sla_deadline>=COALESCE(resolved_at,NOW()) THEN 1 ELSE 0 END) as ok,SUM(CASE WHEN sla_deadline<COALESCE(resolved_at,NOW()) THEN 1 ELSE 0 END) as breached FROM tickets WHERE created_at>:s"),{"s":since})
    prio=await db.execute(text("SELECT priority,AVG(EXTRACT(EPOCH FROM (resolved_at-created_at))/3600) as avg_h,COUNT(*) as c FROM tickets WHERE resolved_at IS NOT NULL AND created_at>:s GROUP BY priority"),{"s":since})
    sla_r=sla.fetchone()
    return {"period_days":days,
            "volume_by_day":[{"date":str(r.d),"count":r.c} for r in vol.fetchall()],
            "by_category":[dict(r._mapping) for r in cat.fetchall()],
            "sla":{"total":sla_r.total,"compliant":sla_r.ok,"breached":sla_r.breached,"rate":round((sla_r.ok/sla_r.total*100) if sla_r.total else 100,1)},
            "by_priority":[{"priority":r.priority,"avg_hours":round(r.avg_h or 0,1),"count":r.c} for r in prio.fetchall()]}
