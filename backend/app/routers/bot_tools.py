"""
WHUBBI Bot — tool catalog & permission enforcement
────────────────────────────────────────────────────
Every tool the bot can call is defined once here as {module, submodule, level, schema, handler}.
`level` is "view" for reads, "edit" for writes, or None for tools that don't map to a single
module/submodule (composite HR tools that span two submodules, and the self-inspection tool).

Permission check mirrors settings.py's own default exactly: no row in whubbi_permissions ->
access_mode "none". Unlike the platform's frontend hooks (which fail OPEN to "edit" on a fetch
error), fetch_perms() here fails CLOSED — a permissions-lookup error means every gated tool denies.
"""

import json
from dataclasses import dataclass
import httpx


# ─── Permission core ────────────────────────────────────────────────────────────
async def fetch_perms(http: httpx.AsyncClient, api: str, user_email: str) -> dict:
    if not user_email:
        return {}
    try:
        r = await http.get(f"{api}/settings/permissions/{user_email}")
        if r.status_code == 200:
            return r.json().get("permissions", {}) or {}
    except Exception:
        pass
    return {}


# Modules/submodules whose frontend page has no permission gate at all, or gates via a hook that
# defaults an absent whubbi_permissions row to full "edit" access (id === null -> edit) — confirmed
# by reading each layout: HRLayout (freelancers/recrutement/positions/jobs pages have no gate at
# all), GRCLayout (risks/audits/compliance pages ungated), ITLayout/DevelopmentLayout/TasksLayout
# (id-null -> edit), Sales and Helpdesk (no layout-level gate at all). An explicit row with
# access_mode="none" is still honored as a deliberate admin restriction — this only changes the
# *default* when no row exists, matching what a real user already experiences on the website.
# Legal (bot enforces its own strict gate independent of the frontend) and Training (TrainingLayout
# is the one module that genuinely defaults to deny) are deliberately excluded from this set.
FAIL_OPEN_DEFAULT = {
    ("sales", "companies"), ("sales", "contacts"), ("sales", "opportunities"),
    ("helpdesk", "tickets"), ("helpdesk", "knowledge"),
    ("hr", "freelancers"), ("hr", "recrutement"), ("hr", "positions"), ("hr", "jobs"),
    ("grc", "compliance"), ("grc", "risks"), ("grc", "audits"), ("grc", "access_review"),
    ("it", "assets"),
    ("development", "general"),
    ("tasks", "manager"),
}


def access(perms: dict, module: str, submodule: str) -> str:
    rec = (perms.get(module) or {}).get(submodule) or {}
    if rec.get("id") is None and (module, submodule) in FAIL_OPEN_DEFAULT:
        return "edit"
    return rec.get("access_mode", "none")


def allowed(perms: dict, module: str, submodule: str, level: str) -> bool:
    a = access(perms, module, submodule)
    return a == "edit" if level == "edit" else a in ("view", "edit")


def deny(label: str) -> str:
    return json.dumps({"error": f"permission_denied: You don't have permission to access {label}. "
                                 f"Ask your administrator to grant access via WHUBBI Permissions."})


@dataclass
class ToolCtx:
    email: str
    name: str
    perms: dict
    api: str
    http: httpx.AsyncClient


# ─── HR ──────────────────────────────────────────────────────────────────────────
async def _hr_dashboard(inp, ctx: ToolCtx) -> str:
    can_free = allowed(ctx.perms, "hr", "freelancers", "view")
    can_rec = allowed(ctx.perms, "hr", "recrutement", "view")
    can_jobs = allowed(ctx.perms, "hr", "jobs", "view")
    if not can_free and not can_rec:
        return deny("HR")
    r = await ctx.http.get(f"{ctx.api}/hr/dashboard")
    d = r.json()
    stats_in = d.get("stats", {})
    stats = {}
    if can_free:
        stats["freelancers"] = stats_in.get("freelancers")
    if can_rec:
        stats["internal_candidates"] = stats_in.get("internal_candidates")
        stats["pending_proposals"] = stats_in.get("pending_proposals")
    if can_jobs:
        stats["open_jobs"] = stats_in.get("open_jobs")
    out = {"stats": stats}
    if can_rec:
        out["by_status"] = d.get("by_status")
    if can_free and can_rec:
        out["by_country"] = d.get("by_country")
    out["recent"] = [row for row in d.get("recent", [])
                      if (row.get("profile_type") == "freelancer" and can_free)
                      or (row.get("profile_type") == "internal" and can_rec)]
    return json.dumps(out)


async def _get_freelancers(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "hr", "freelancers", "view"):
        return deny("HR Freelancers")
    r = await ctx.http.get(f"{ctx.api}/hr/freelancers")
    rows = r.json().get("freelancers", [])
    if inp.get("country"):
        rows = [f for f in rows if (f.get("country") or "").lower() == inp["country"].lower()]
    if inp.get("search"):
        q = inp["search"].lower()
        rows = [f for f in rows if
                q in f"{f.get('first_name','')} {f.get('last_name','')}".lower() or
                any(q in s.lower() for s in (f.get("skills") or []))]
    return json.dumps([{
        "id": f["id"],
        "name": f"{f.get('first_name','')} {f.get('last_name','')}".strip(),
        "title": f.get("current_title", ""),
        "country": f.get("country", ""),
        "daily_rate": f.get("daily_rate"),
        "availability_date": str(f.get("availability_date", ""))[:10] or None,
        "skills": (f.get("skills") or [])[:6],
        "years_experience": f.get("years_experience"),
    } for f in rows[:20]])


async def _get_freelancer(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "hr", "freelancers", "view"):
        return deny("HR Freelancers")
    r = await ctx.http.get(f"{ctx.api}/hr/freelancers/{inp['profile_id']}")
    d = r.json()
    return json.dumps({
        "name": f"{d.get('first_name','')} {d.get('last_name','')}".strip(),
        "title": d.get("current_title"), "email": d.get("email"),
        "phone": d.get("phone"), "linkedin": d.get("linkedin_url"),
        "country": d.get("country"), "daily_rate": d.get("daily_rate"),
        "availability": str(d.get("availability_date", ""))[:10] or None,
        "skills": d.get("skills", []),
        "years_experience": d.get("years_experience"),
        "projects": [
            {"title": p.get("title"), "company": p.get("company"),
             "from": p.get("start_date"), "to": p.get("end_date"),
             "tech": (p.get("technologies") or [])[:5]}
            for p in (d.get("projects") or [])[:6]
        ],
        "recent_comments": [
            {"by": cc.get("author_name"), "type": cc.get("comment_type"),
             "text": (cc.get("content") or "")[:300],
             "date": str(cc.get("created_at", ""))[:10]}
            for cc in (d.get("comments") or [])[:4]
        ],
        "documents": len(d.get("documents") or []),
        "has_cv": bool(d.get("cv_sharepoint_url")),
    })


async def _get_recruitment_pipeline(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "hr", "recrutement", "view"):
        return deny("HR Recruitment")
    params = {}
    if inp.get("status"):
        params["status"] = inp["status"]
    r = await ctx.http.get(f"{ctx.api}/hr/recruitment", params=params)
    rows = r.json().get("candidates", [])
    if inp.get("country"):
        rows = [cc for cc in rows if (cc.get("country") or "").lower() == inp["country"].lower()]
    return json.dumps([{
        "id": cc["id"],
        "name": f"{cc.get('first_name','')} {cc.get('last_name','')}".strip(),
        "status": cc.get("recruitment_status"),
        "country": cc.get("country"),
        "title": cc.get("current_title"),
        "position": cc.get("job_position_title", ""),
    } for cc in rows[:25]])


async def _get_job_positions(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "hr", "positions", "view"):
        return deny("HR Job Positions")
    r = await ctx.http.get(f"{ctx.api}/hr/positions")
    return json.dumps(r.json().get("positions", []))


async def _search_profiles(inp, ctx: ToolCtx) -> str:
    can_free = allowed(ctx.perms, "hr", "freelancers", "view")
    can_rec = allowed(ctx.perms, "hr", "recrutement", "view")
    if not can_free and not can_rec:
        return deny("HR")
    q = inp["name"].lower()
    results = []
    if can_free:
        fr = await ctx.http.get(f"{ctx.api}/hr/freelancers")
        for f in fr.json().get("freelancers", []):
            full = f"{f.get('first_name','')} {f.get('last_name','')}".lower()
            if q in full:
                results.append({"id": f["id"], "name": full.title(), "type": "freelancer",
                                 "country": f.get("country"), "title": f.get("current_title")})
    if can_rec:
        rc = await ctx.http.get(f"{ctx.api}/hr/recruitment")
        for cc in rc.json().get("candidates", []):
            full = f"{cc.get('first_name','')} {cc.get('last_name','')}".lower()
            if q in full:
                results.append({"id": cc["id"], "name": full.title(), "type": "internal",
                                 "status": cc.get("recruitment_status"), "country": cc.get("country")})
    return json.dumps(results)


async def _add_comment(inp, ctx: ToolCtx) -> str:
    module_sub = "freelancers" if inp["profile_type"] == "freelancer" else "recrutement"
    if not allowed(ctx.perms, "hr", module_sub, "edit"):
        return deny("HR — edit access")
    endpoint = "freelancers" if inp["profile_type"] == "freelancer" else "recruitment"
    r = await ctx.http.post(
        f"{ctx.api}/hr/{endpoint}/{inp['profile_id']}/comments",
        json={
            "content": inp["content"],
            "comment_type": inp.get("comment_type", "note"),
            "author_email": ctx.email,
            "author_name": ctx.name,
        },
    )
    return json.dumps(r.json())


async def _update_recruitment_status(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "hr", "recrutement", "edit"):
        return deny("HR Recruitment — edit access")
    r = await ctx.http.put(
        f"{ctx.api}/hr/recruitment/{inp['profile_id']}/status",
        json={"status": inp["status"]},
    )
    return json.dumps(r.json())


# ─── Legal ───────────────────────────────────────────────────────────────────────
async def _check_legal_access(inp, ctx: ToolCtx) -> str:
    return json.dumps({
        "entities": access(ctx.perms, "legal", "entities"),
        "templates": access(ctx.perms, "legal", "templates"),
        "admin": access(ctx.perms, "legal", "admin"),
    })


async def _get_legal_entities(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "legal", "entities", "view"):
        return deny("Legal Entities")
    r = await ctx.http.get(f"{ctx.api}/legal/entities")
    entities = r.json().get("entities", [])
    if inp.get("country"):
        entities = [e for e in entities if (e.get("country") or "").lower() == inp["country"].lower()]
    return json.dumps([{
        "id": e["id"], "name": e["legal_name"], "address": e.get("legal_address"),
        "country": e.get("country"),
        "registration": f"{e.get('registration_description','')} {e.get('registration_value','')}".strip(),
        "document_count": len(e.get("documents") or []),
    } for e in entities])


async def _get_legal_templates(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "legal", "templates", "view"):
        return deny("Legal Templates")
    params = {}
    if inp.get("country"):
        params["country"] = inp["country"]
    r = await ctx.http.get(f"{ctx.api}/legal/templates", params=params)
    templates = r.json().get("templates", [])
    return json.dumps([{
        "id": t["id"], "title": t["title"], "description": t.get("description"),
        "doc_type": t.get("doc_type"), "country": t.get("country"),
        "has_link": bool(t.get("sharepoint_url")),
    } for t in templates])


# ─── Sales ───────────────────────────────────────────────────────────────────────
async def _sales_list_companies(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "sales", "companies", "view"):
        return deny("Sales Companies")
    r = await ctx.http.get(f"{ctx.api}/companies/")
    rows = r.json()
    if inp.get("search"):
        q = inp["search"].lower()
        rows = [c for c in rows if q in (c.get("name") or "").lower()]
    return json.dumps([{
        "id": c["id"], "name": c.get("name"), "sector": c.get("sector"),
        "country": c.get("country"), "status": c.get("status"),
        "assigned_to": c.get("assigned_to"),
    } for c in rows[:25]])


async def _sales_get_company(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "sales", "companies", "view"):
        return deny("Sales Companies")
    r = await ctx.http.get(f"{ctx.api}/companies/{inp['company_id']}/")
    return json.dumps(r.json())


async def _sales_create_company(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "sales", "companies", "edit"):
        return deny("Sales Companies — edit access")
    body = {"name": inp["name"]}
    for k in ("sector", "country", "status", "notes", "contact_name"):
        if inp.get(k):
            body[k] = inp[k]
    r = await ctx.http.post(f"{ctx.api}/companies/", json=body)
    return json.dumps(r.json())


async def _sales_update_company(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "sales", "companies", "edit"):
        return deny("Sales Companies — edit access")
    body = {k: v for k, v in inp.items() if k != "company_id" and v is not None}
    r = await ctx.http.put(f"{ctx.api}/companies/{inp['company_id']}/", json=body)
    return json.dumps(r.json())


async def _sales_list_contacts(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "sales", "contacts", "view"):
        return deny("Sales Contacts")
    r = await ctx.http.get(f"{ctx.api}/contacts/")
    rows = r.json()
    if inp.get("search"):
        q = inp["search"].lower()
        rows = [c for c in rows if q in f"{c.get('first_name','')} {c.get('last_name','')}".lower()]
    return json.dumps([{
        "id": c["id"], "name": f"{c.get('first_name','')} {c.get('last_name','')}".strip(),
        "email": c.get("email"), "job_name": c.get("job_name"),
        "company": (c.get("company") or {}).get("name"),
    } for c in rows[:25]])


async def _sales_create_contact(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "sales", "contacts", "edit"):
        return deny("Sales Contacts — edit access")
    body = {"first_name": inp["first_name"], "last_name": inp["last_name"]}
    for k in ("company_id", "email", "job_name", "mobile_phone"):
        if inp.get(k):
            body[k] = inp[k]
    r = await ctx.http.post(f"{ctx.api}/contacts/", json=body)
    return json.dumps(r.json())


async def _sales_list_opportunities(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "sales", "opportunities", "view"):
        return deny("Sales Opportunities")
    r = await ctx.http.get(f"{ctx.api}/opportunities/")
    rows = r.json()
    if inp.get("status"):
        rows = [o for o in rows if (o.get("deal_status") or "").lower() == inp["status"].lower()]
    return json.dumps([{
        "id": o["id"], "deal_name": o.get("deal_name"),
        "company": (o.get("company") or {}).get("name"),
        "deal_amount": o.get("deal_amount"), "deal_status": o.get("deal_status"),
        "closing_date": str(o.get("closing_date", ""))[:10] or None,
    } for o in rows[:25]])


async def _sales_get_opportunity(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "sales", "opportunities", "view"):
        return deny("Sales Opportunities")
    r = await ctx.http.get(f"{ctx.api}/opportunities/{inp['opportunity_id']}/")
    return json.dumps(r.json())


async def _sales_create_opportunity(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "sales", "opportunities", "edit"):
        return deny("Sales Opportunities — edit access")
    body = {"deal_name": inp["deal_name"]}
    for k in ("company_id", "deal_amount", "closing_date", "deal_status", "notes"):
        if inp.get(k) is not None:
            body[k] = inp[k]
    r = await ctx.http.post(f"{ctx.api}/opportunities/", json=body)
    return json.dumps(r.json())


async def _sales_update_opportunity(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "sales", "opportunities", "edit"):
        return deny("Sales Opportunities — edit access")
    body = {k: v for k, v in inp.items() if k != "opportunity_id" and v is not None}
    r = await ctx.http.put(f"{ctx.api}/opportunities/{inp['opportunity_id']}/", json=body)
    return json.dumps(r.json())


# ─── GRC ─────────────────────────────────────────────────────────────────────────
async def _grc_dashboard(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "grc", "compliance", "view"):
        return deny("GRC")
    r = await ctx.http.get(f"{ctx.api}/grc/dashboard")
    return json.dumps(r.json())


async def _grc_list_risks(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "grc", "risks", "view"):
        return deny("GRC Risks")
    r = await ctx.http.get(f"{ctx.api}/grc/risks")
    rows = r.json().get("risks", [])
    if inp.get("status"):
        rows = [x for x in rows if (x.get("status") or "").lower() == inp["status"].lower()]
    return json.dumps([{
        "id": x["id"], "title": x.get("title"), "category": x.get("category"),
        "status": x.get("status"), "score": x.get("score"), "owner_name": x.get("owner_name"),
    } for x in rows[:25]])


async def _grc_create_risk(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "grc", "risks", "edit"):
        return deny("GRC Risks — edit access")
    body = {"title": inp["title"]}
    for k in ("description", "category", "probability", "impact", "status", "mitigation", "owner_email", "owner_name"):
        if inp.get(k) is not None:
            body[k] = inp[k]
    r = await ctx.http.post(f"{ctx.api}/grc/risks", json=body)
    return json.dumps(r.json())


async def _grc_update_risk(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "grc", "risks", "edit"):
        return deny("GRC Risks — edit access")
    body = {k: v for k, v in inp.items() if k != "risk_id" and v is not None}
    r = await ctx.http.put(f"{ctx.api}/grc/risks/{inp['risk_id']}", json=body)
    return json.dumps(r.json())


async def _grc_list_audits(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "grc", "audits", "view"):
        return deny("GRC Audits")
    r = await ctx.http.get(f"{ctx.api}/grc/audits")
    rows = r.json().get("audits", [])
    return json.dumps([{
        "id": x["id"], "title": x.get("title"), "audit_type": x.get("audit_type"),
        "status": x.get("status"), "start_date": str(x.get("start_date", ""))[:10] or None,
        "findings_count": x.get("findings_count"),
    } for x in rows[:25]])


async def _grc_get_audit(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "grc", "audits", "view"):
        return deny("GRC Audits")
    r = await ctx.http.get(f"{ctx.api}/grc/audits/{inp['audit_id']}")
    return json.dumps(r.json())


async def _grc_add_audit_finding(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "grc", "audits", "edit"):
        return deny("GRC Audits — edit access")
    body = {"title": inp["title"]}
    for k in ("description", "severity", "corrective_action", "owner_email"):
        if inp.get(k):
            body[k] = inp[k]
    r = await ctx.http.post(f"{ctx.api}/grc/audits/{inp['audit_id']}/findings", json=body)
    return json.dumps(r.json())


async def _grc_list_access_reviews(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "grc", "access_review", "view"):
        return deny("GRC Access Review")
    r = await ctx.http.get(f"{ctx.api}/grc/access-review")
    rows = r.json().get("cycles", [])
    return json.dumps([{
        "id": x["id"], "cycle_name": x.get("cycle_name"), "review_type": x.get("review_type"),
        "status": x.get("status"), "due_date": str(x.get("due_date", ""))[:10] or None,
        "tasks_total": x.get("tasks_total"), "tasks_open": x.get("tasks_open"),
    } for x in rows[:25]])


async def _grc_update_access_review_status(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "grc", "access_review", "edit"):
        return deny("GRC Access Review — edit access")
    r = await ctx.http.put(f"{ctx.api}/grc/access-review/{inp['cycle_id']}/status",
                            json={"status": inp["status"]})
    return json.dumps(r.json())


# ─── IT ──────────────────────────────────────────────────────────────────────────
async def _it_list_equipments(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "it", "assets", "view"):
        return deny("IT Equipments")
    r = await ctx.http.get(f"{ctx.api}/it/equipments")
    rows = r.json().get("equipments", [])
    if inp.get("search"):
        q = inp["search"].lower()
        rows = [x for x in rows if q in f"{x.get('name','')} {x.get('assigned_name','')} {x.get('serial_number','')}".lower()]
    return json.dumps([{
        "id": x["id"], "name": x.get("name"), "equipment_type": x.get("equipment_type"),
        "assigned_name": x.get("assigned_name"), "location_name": x.get("location_name"),
        "serial_number": x.get("serial_number"),
    } for x in rows[:25]])


async def _it_create_equipment(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "it", "assets", "edit"):
        return deny("IT Equipments — edit access")
    body = {"name": inp["name"]}
    for k in ("equipment_type", "serial_number", "assigned_email", "assigned_name", "location_name", "comment"):
        if inp.get(k):
            body[k] = inp[k]
    r = await ctx.http.post(f"{ctx.api}/it/equipments", json=body)
    return json.dumps(r.json())


async def _it_update_equipment(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "it", "assets", "edit"):
        return deny("IT Equipments — edit access")
    body = {k: v for k, v in inp.items() if k != "equipment_id" and v is not None}
    r = await ctx.http.put(f"{ctx.api}/it/equipments/{inp['equipment_id']}", json=body)
    return json.dumps(r.json())


async def _it_list_software(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "it", "assets", "view"):
        return deny("IT Software")
    r = await ctx.http.get(f"{ctx.api}/it/software")
    rows = r.json().get("software", [])
    if inp.get("search"):
        q = inp["search"].lower()
        rows = [x for x in rows if q in (x.get("name") or "").lower()]
    return json.dumps([{
        "id": x["id"], "name": x.get("name"), "editor": x.get("editor"),
        "version": x.get("version"), "owner_name": x.get("owner_name"),
    } for x in rows[:25]])


async def _it_list_applications(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "it", "assets", "view"):
        return deny("IT Applications")
    r = await ctx.http.get(f"{ctx.api}/it/applications")
    rows = r.json().get("applications", [])
    if inp.get("search"):
        q = inp["search"].lower()
        rows = [x for x in rows if q in (x.get("name") or "").lower()]
    return json.dumps([{
        "id": x["id"], "name": x.get("name"), "editor": x.get("editor"),
        "version": x.get("version"), "owner_name": x.get("owner_name"),
    } for x in rows[:25]])


# ─── Helpdesk ────────────────────────────────────────────────────────────────────
async def _helpdesk_dashboard(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "helpdesk", "tickets", "view"):
        return deny("Helpdesk")
    r = await ctx.http.get(f"{ctx.api}/helpdesk/dashboard")
    return json.dumps(r.json())


async def _helpdesk_list_tickets(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "helpdesk", "tickets", "view"):
        return deny("Helpdesk Tickets")
    r = await ctx.http.get(f"{ctx.api}/helpdesk/tickets")
    rows = r.json().get("tickets", [])
    if inp.get("status"):
        rows = [x for x in rows if (x.get("status") or "").lower() == inp["status"].lower()]
    return json.dumps([{
        "id": x["id"], "ticket_number": x.get("ticket_number"), "title": x.get("title"),
        "status": x.get("status"), "priority": x.get("priority"),
        "assignee_name": x.get("assignee_name"), "requester_name": x.get("requester_name"),
    } for x in rows[:25]])


async def _helpdesk_get_ticket(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "helpdesk", "tickets", "view"):
        return deny("Helpdesk Tickets")
    r = await ctx.http.get(f"{ctx.api}/helpdesk/tickets/{inp['ticket_id']}")
    return json.dumps(r.json())


async def _helpdesk_create_ticket(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "helpdesk", "tickets", "edit"):
        return deny("Helpdesk Tickets — edit access")
    body = {"title": inp["title"], "requester_email": ctx.email, "requester_name": ctx.name}
    for k in ("description", "priority", "ticket_type", "assignee_email", "assignee_name", "application"):
        if inp.get(k):
            body[k] = inp[k]
    r = await ctx.http.post(f"{ctx.api}/helpdesk/tickets", json=body)
    return json.dumps(r.json())


async def _helpdesk_update_ticket(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "helpdesk", "tickets", "edit"):
        return deny("Helpdesk Tickets — edit access")
    body = {k: v for k, v in inp.items() if k != "ticket_id" and v is not None}
    r = await ctx.http.put(f"{ctx.api}/helpdesk/tickets/{inp['ticket_id']}", json=body)
    return json.dumps(r.json())


async def _helpdesk_add_ticket_comment(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "helpdesk", "tickets", "edit"):
        return deny("Helpdesk Tickets — edit access")
    r = await ctx.http.post(f"{ctx.api}/helpdesk/tickets/{inp['ticket_id']}/comments", json={
        "content": inp["content"], "author_email": ctx.email, "author_name": ctx.name,
        "is_internal": bool(inp.get("is_internal", False)),
    })
    return json.dumps(r.json())


async def _helpdesk_search_knowledge(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "helpdesk", "knowledge", "view"):
        return deny("Helpdesk Knowledge Base")
    r = await ctx.http.get(f"{ctx.api}/helpdesk/knowledge")
    rows = r.json().get("articles", [])
    if inp.get("search"):
        q = inp["search"].lower()
        rows = [x for x in rows if q in (x.get("title") or "").lower() or q in (x.get("excerpt") or "").lower()]
    return json.dumps([{
        "id": x["id"], "title": x.get("title"), "category": x.get("category"),
        "excerpt": x.get("excerpt"),
    } for x in rows[:20]])


# ─── Admin (read-only) ────────────────────────────────────────────────────────────
async def _admin_list_users(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "admin", "users", "view"):
        return deny("Admin Users")
    r = await ctx.http.get(f"{ctx.api}/settings/users")
    rows = r.json().get("users", [])
    if inp.get("search"):
        q = inp["search"].lower()
        rows = [x for x in rows if q in (x.get("display_name") or "").lower() or q in (x.get("email") or "").lower()]
    return json.dumps([{
        "email": x.get("email"), "display_name": x.get("display_name"),
        "job_title": x.get("job_title"), "department": x.get("department"),
    } for x in rows[:30]])


async def _admin_costs_summary(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "admin", "costs", "view"):
        return deny("Admin Costs")
    r = await ctx.http.get(f"{ctx.api}/admin/costs")
    return json.dumps(r.json())


async def _admin_system_health(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "admin", "monitoring", "view"):
        return deny("Admin Monitoring")
    r = await ctx.http.get(f"{ctx.api}/admin/health")
    return json.dumps(r.json())


# ─── Development ─────────────────────────────────────────────────────────────────
async def _dev_list_requests(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "development", "general", "view"):
        return deny("Development")
    r = await ctx.http.get(f"{ctx.api}/development/requests")
    rows = r.json().get("requests", [])
    if inp.get("status"):
        rows = [x for x in rows if (x.get("status") or "").lower() == inp["status"].lower()]
    return json.dumps([{
        "id": x["id"], "request_number": x.get("request_number"), "title": x.get("title"),
        "status": x.get("status"), "priority": x.get("priority"),
        "assignee_name": x.get("assignee_name"), "pipeline_name": x.get("pipeline_name"),
    } for x in rows[:25]])


async def _dev_get_request(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "development", "general", "view"):
        return deny("Development")
    r = await ctx.http.get(f"{ctx.api}/development/requests/{inp['request_id']}")
    return json.dumps(r.json())


async def _dev_update_request(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "development", "general", "edit"):
        return deny("Development — edit access")
    body = {k: v for k, v in inp.items() if k != "request_id" and v is not None}
    r = await ctx.http.put(f"{ctx.api}/development/requests/{inp['request_id']}", json=body)
    return json.dumps(r.json())


# ─── Training ────────────────────────────────────────────────────────────────────
async def _training_catalog(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "training", "manager", "view"):
        return deny("Training")
    r = await ctx.http.get(f"{ctx.api}/training/catalog")
    rows = r.json().get("catalog", [])
    if inp.get("search"):
        q = inp["search"].lower()
        rows = [x for x in rows if q in (x.get("title") or "").lower()]
    return json.dumps([{
        "id": x["id"], "title": x.get("title"), "training_type": x.get("training_type"),
        "duration": x.get("duration"), "expertise_level": x.get("expertise_level"),
    } for x in rows[:25]])


async def _training_list_assignments(inp, ctx: ToolCtx) -> str:
    email = inp.get("user_email") or ctx.email
    # Viewing your own assignments is always allowed (MyWhubbi self-service, no permission gate
    # on /settings/training) — only looking up someone else's requires the Training module permission.
    if email.lower() != ctx.email.lower() and not allowed(ctx.perms, "training", "manager", "view"):
        return deny("Training")
    r = await ctx.http.get(f"{ctx.api}/training/assignments/{email}")
    rows = r.json().get("assignments", [])
    return json.dumps([{
        "id": x["id"], "training_name": x.get("training_name"), "status": x.get("status"),
        "due_date": str(x.get("due_date", ""))[:10] or None,
    } for x in rows[:25]])


async def _training_assign(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "training", "manager", "edit"):
        return deny("Training — edit access")
    body = {
        "user_emails": inp["user_emails"],
        "assigned_by_email": ctx.email, "assigned_by_name": ctx.name,
    }
    for k in ("catalog_id", "plan_id", "due_date", "recurrence"):
        if inp.get(k):
            body[k] = inp[k]
    r = await ctx.http.post(f"{ctx.api}/training/assignments", json=body)
    return json.dumps(r.json())


# ─── Task Manager ────────────────────────────────────────────────────────────────
async def _tm_list_tasks(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "tasks", "manager", "view"):
        return deny("Task Manager")
    scope = inp.get("scope", "own")
    params = {"scope": scope}
    if scope in ("own", "team"):
        params["email"] = ctx.email
    r = await ctx.http.get(f"{ctx.api}/task-manager/tasks", params=params)
    rows = r.json().get("tasks", [])
    if inp.get("status"):
        rows = [x for x in rows if (x.get("status") or "").lower() == inp["status"].lower()]
    if inp.get("assignee_email"):
        rows = [x for x in rows if (x.get("assignee_email") or "").lower() == inp["assignee_email"].lower()]
    return json.dumps([{
        "id": x["id"], "task_number": x.get("task_number"), "title": x.get("title"),
        "status": x.get("status"), "owner_name": x.get("owner_name"),
        "assignee_name": x.get("assignee_name"), "due_date": str(x.get("due_date", ""))[:10] or None,
    } for x in rows[:25]])


async def _tm_get_task(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "tasks", "manager", "view"):
        return deny("Task Manager")
    r = await ctx.http.get(f"{ctx.api}/task-manager/tasks/{inp['task_id']}")
    return json.dumps(r.json())


async def _tm_create_task(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "tasks", "manager", "edit"):
        return deny("Task Manager — edit access")
    body = {
        "title": inp["title"], "owner_email": ctx.email, "owner_name": ctx.name,
        "created_by_email": ctx.email,
    }
    for k in ("description", "assignee_email", "assignee_name", "due_date"):
        if inp.get(k):
            body[k] = inp[k]
    r = await ctx.http.post(f"{ctx.api}/task-manager/tasks", json=body)
    return json.dumps(r.json())


async def _tm_update_task_status(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "tasks", "manager", "edit"):
        return deny("Task Manager — edit access")
    r = await ctx.http.put(f"{ctx.api}/task-manager/tasks/{inp['task_id']}/status",
                            json={"acting_email": ctx.email, "status": inp["status"]})
    return json.dumps(r.json())


async def _tm_reassign_task(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "tasks", "manager", "edit"):
        return deny("Task Manager — edit access")
    r = await ctx.http.post(f"{ctx.api}/task-manager/tasks/{inp['task_id']}/reassign", json={
        "acting_email": ctx.email, "new_assignee_email": inp["new_assignee_email"],
        "new_assignee_name": inp.get("new_assignee_name", ""),
    })
    return json.dumps(r.json())


async def _tm_add_task_comment(inp, ctx: ToolCtx) -> str:
    if not allowed(ctx.perms, "tasks", "manager", "edit"):
        return deny("Task Manager — edit access")
    r = await ctx.http.post(f"{ctx.api}/task-manager/tasks/{inp['task_id']}/comments", json={
        "content": inp["content"], "author_email": ctx.email, "author_name": ctx.name,
    })
    return json.dumps(r.json())


# ─── MyWhubbi (personal, self-scoped — no module permission gate, matches ProfileLayout
# having no permission check at all: it's your own identity-scoped data, always yours to see) ───
async def _my_profile(inp, ctx: ToolCtx) -> str:
    r = await ctx.http.get(f"{ctx.api}/settings/profile/{ctx.email}")
    d = r.json()
    return json.dumps({
        "display_name": d.get("display_name"), "job_title": d.get("job_title"),
        "department": d.get("department"), "manager_name": d.get("manager_name"),
        "mobile_phone": d.get("mobile_phone"), "office_phone": d.get("office_phone"),
        "main_location_name": d.get("main_location_name"),
        "licenses": d.get("ms_licenses") or [], "groups": d.get("ms_groups") or [],
    })


async def _my_equipments(inp, ctx: ToolCtx) -> str:
    r = await ctx.http.get(f"{ctx.api}/it/equipments")
    rows = [x for x in r.json().get("equipments", [])
            if (x.get("assigned_email") or "").lower() == ctx.email.lower()]
    return json.dumps([{
        "id": x["id"], "name": x.get("name"), "equipment_type": x.get("equipment_type"),
        "serial_number": x.get("serial_number"), "location_name": x.get("location_name"),
    } for x in rows])


async def _my_cv(inp, ctx: ToolCtx) -> str:
    r = await ctx.http.get(f"{ctx.api}/cv/{ctx.email}")
    cv = r.json().get("cv", {})
    return json.dumps({
        "name": f"{cv.get('first_name','')} {cv.get('last_name','')}".strip(),
        "title": cv.get("title"), "summary": cv.get("short_description"),
        "skills": cv.get("skills", []), "languages": cv.get("languages", []),
        "experience_count": len(cv.get("experiences") or []),
    })


async def _my_certifications(inp, ctx: ToolCtx) -> str:
    r = await ctx.http.get(f"{ctx.api}/training/certifications/{ctx.email}")
    body = r.json()
    rows = body.get("certifications", []) if isinstance(body, dict) else body
    return json.dumps([{
        "name": x.get("name"), "cert_date": str(x.get("cert_date", ""))[:10] or None,
        "description": x.get("description"),
    } for x in (rows or [])[:20]])


async def _request_access_change(inp, ctx: ToolCtx) -> str:
    item_name = inp["item_name"]
    action = inp.get("action", "add")
    owner_email, owner_name = "", ""
    try:
        sr = await ctx.http.get(f"{ctx.api}/it/software")
        for s in sr.json().get("software", []):
            if item_name.lower() in (s.get("name") or "").lower():
                owner_email = s.get("owner_email") or ""
                owner_name = s.get("owner_name") or ""
                break
    except Exception:
        pass
    body = {
        "title": f"{'Add' if action == 'add' else 'Remove'} access: {item_name}",
        "description": inp.get("notes") or f"Requested via WHUBBI bot by {ctx.name}.",
        "source": "mywhubbi",
        "owner_email": owner_email or ctx.email, "owner_name": owner_name or ctx.name,
        "assignee_email": owner_email or ctx.email, "assignee_name": owner_name or ctx.name,
        "created_by_email": ctx.email,
    }
    r = await ctx.http.post(f"{ctx.api}/task-manager/tasks", json=body)
    result = r.json()
    task_id = result.get("id")
    if task_id and owner_email and owner_email.lower() != ctx.email.lower():
        try:
            await ctx.http.post(f"{ctx.api}/task-manager/tasks/{task_id}/watchers", json={
                "acting_email": owner_email, "user_email": ctx.email, "user_name": ctx.name,
            })
        except Exception:
            pass
    return json.dumps(result)


# ─── Tool catalog ────────────────────────────────────────────────────────────────
# (module, submodule, level, schema, handler) — level None = always offered, handler self-gates
TOOL_DEFS = [
    # HR
    ("hr", "freelancers", None, {
        "name": "hr_dashboard",
        "description": "Get HR overview: total freelancers, candidates by status and country, recent activity.",
        "input_schema": {"type": "object", "properties": {}},
    }, _hr_dashboard),
    ("hr", "freelancers", "view", {
        "name": "get_freelancers",
        "description": "List freelancers. Filter by country and/or search by name or skill keyword.",
        "input_schema": {"type": "object", "properties": {
            "country": {"type": "string"}, "search": {"type": "string"}}},
    }, _get_freelancers),
    ("hr", "freelancers", "view", {
        "name": "get_freelancer",
        "description": "Full profile for one freelancer: contact, skills, projects, recent comments, documents.",
        "input_schema": {"type": "object", "properties": {"profile_id": {"type": "string"}},
                          "required": ["profile_id"]},
    }, _get_freelancer),
    ("hr", "recrutement", "view", {
        "name": "get_recruitment_pipeline",
        "description": "List internal recruitment candidates. Filter by status and/or country.",
        "input_schema": {"type": "object", "properties": {
            "status": {"type": "string"}, "country": {"type": "string"}}},
    }, _get_recruitment_pipeline),
    ("hr", "positions", "view", {
        "name": "get_job_positions",
        "description": "List all job positions with open/closed status.",
        "input_schema": {"type": "object", "properties": {}},
    }, _get_job_positions),
    ("hr", "freelancers", None, {
        "name": "search_profiles",
        "description": "Search for a person by name across both freelancers and internal candidates.",
        "input_schema": {"type": "object", "properties": {"name": {"type": "string"}},
                          "required": ["name"]},
    }, _search_profiles),
    ("hr", "freelancers", "edit", {
        "name": "add_comment",
        "description": "Add a comment or note to a profile. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "profile_id": {"type": "string"},
            "profile_type": {"type": "string", "enum": ["freelancer", "internal"]},
            "content": {"type": "string"},
            "comment_type": {"type": "string", "enum": ["note", "call", "email", "interview"]},
        }, "required": ["profile_id", "profile_type", "content", "comment_type"]},
    }, _add_comment),
    ("hr", "recrutement", "edit", {
        "name": "update_recruitment_status",
        "description": "Move a candidate to a new recruitment stage. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "profile_id": {"type": "string"},
            "status": {"type": "string", "enum": ["new", "screening", "interview_1", "technical_test",
                                                   "offer", "hired", "rejected", "on_hold"]},
        }, "required": ["profile_id", "status"]},
    }, _update_recruitment_status),

    # Legal
    ("legal", "entities", None, {
        "name": "check_legal_access",
        "description": "Check what legal module permissions the current user has (entities, templates, admin). Call this before get_legal_entities or get_legal_templates.",
        "input_schema": {"type": "object", "properties": {}},
    }, _check_legal_access),
    ("legal", "entities", "view", {
        "name": "get_legal_entities",
        "description": "List WCOMPLY legal entities with registration info and document links. Requires legal.entities permission.",
        "input_schema": {"type": "object", "properties": {"country": {"type": "string"}}},
    }, _get_legal_entities),
    ("legal", "templates", "view", {
        "name": "get_legal_templates",
        "description": "List legal template documents available on SharePoint. Requires legal.templates permission.",
        "input_schema": {"type": "object", "properties": {"country": {"type": "string"}}},
    }, _get_legal_templates),

    # Sales
    ("sales", "companies", "view", {
        "name": "sales_list_companies",
        "description": "List CRM companies. Optional name search.",
        "input_schema": {"type": "object", "properties": {"search": {"type": "string"}}},
    }, _sales_list_companies),
    ("sales", "companies", "view", {
        "name": "sales_get_company",
        "description": "Full detail for one company: contacts, opportunities, notes, tasks.",
        "input_schema": {"type": "object", "properties": {"company_id": {"type": "string"}},
                          "required": ["company_id"]},
    }, _sales_get_company),
    ("sales", "companies", "edit", {
        "name": "sales_create_company",
        "description": "Create a new CRM company. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "name": {"type": "string"}, "sector": {"type": "string"}, "country": {"type": "string"},
            "status": {"type": "string"}, "notes": {"type": "string"}, "contact_name": {"type": "string"},
        }, "required": ["name"]},
    }, _sales_create_company),
    ("sales", "companies", "edit", {
        "name": "sales_update_company",
        "description": "Update a CRM company's fields. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "company_id": {"type": "string"}, "name": {"type": "string"}, "sector": {"type": "string"},
            "country": {"type": "string"}, "status": {"type": "string"}, "notes": {"type": "string"},
        }, "required": ["company_id"]},
    }, _sales_update_company),
    ("sales", "contacts", "view", {
        "name": "sales_list_contacts",
        "description": "List CRM contacts. Optional name search.",
        "input_schema": {"type": "object", "properties": {"search": {"type": "string"}}},
    }, _sales_list_contacts),
    ("sales", "contacts", "edit", {
        "name": "sales_create_contact",
        "description": "Create a new CRM contact. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "first_name": {"type": "string"}, "last_name": {"type": "string"},
            "company_id": {"type": "string"}, "email": {"type": "string"},
            "job_name": {"type": "string"}, "mobile_phone": {"type": "string"},
        }, "required": ["first_name", "last_name"]},
    }, _sales_create_contact),
    ("sales", "opportunities", "view", {
        "name": "sales_list_opportunities",
        "description": "List sales opportunities/deals. Optional status filter.",
        "input_schema": {"type": "object", "properties": {"status": {"type": "string"}}},
    }, _sales_list_opportunities),
    ("sales", "opportunities", "view", {
        "name": "sales_get_opportunity",
        "description": "Full detail for one opportunity.",
        "input_schema": {"type": "object", "properties": {"opportunity_id": {"type": "string"}},
                          "required": ["opportunity_id"]},
    }, _sales_get_opportunity),
    ("sales", "opportunities", "edit", {
        "name": "sales_create_opportunity",
        "description": "Create a new sales opportunity. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "deal_name": {"type": "string"}, "company_id": {"type": "string"},
            "deal_amount": {"type": "number"}, "closing_date": {"type": "string"},
            "deal_status": {"type": "string"}, "notes": {"type": "string"},
        }, "required": ["deal_name"]},
    }, _sales_create_opportunity),
    ("sales", "opportunities", "edit", {
        "name": "sales_update_opportunity",
        "description": "Update an opportunity (stage, amount, etc). Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "opportunity_id": {"type": "string"}, "deal_status": {"type": "string"},
            "deal_amount": {"type": "number"}, "project_status": {"type": "string"},
            "notes": {"type": "string"},
        }, "required": ["opportunity_id"]},
    }, _sales_update_opportunity),

    # GRC
    ("grc", "compliance", "view", {
        "name": "grc_dashboard",
        "description": "GRC overview: framework compliance, risk summary, upcoming audits.",
        "input_schema": {"type": "object", "properties": {}},
    }, _grc_dashboard),
    ("grc", "risks", "view", {
        "name": "grc_list_risks",
        "description": "List risk register entries. Optional status filter.",
        "input_schema": {"type": "object", "properties": {"status": {"type": "string"}}},
    }, _grc_list_risks),
    ("grc", "risks", "edit", {
        "name": "grc_create_risk",
        "description": "Add a new risk to the register. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "title": {"type": "string"}, "description": {"type": "string"}, "category": {"type": "string"},
            "probability": {"type": "integer"}, "impact": {"type": "integer"}, "status": {"type": "string"},
            "mitigation": {"type": "string"}, "owner_email": {"type": "string"}, "owner_name": {"type": "string"},
        }, "required": ["title"]},
    }, _grc_create_risk),
    ("grc", "risks", "edit", {
        "name": "grc_update_risk",
        "description": "Update a risk's fields. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "risk_id": {"type": "string"}, "status": {"type": "string"}, "mitigation": {"type": "string"},
            "probability": {"type": "integer"}, "impact": {"type": "integer"}, "owner_name": {"type": "string"},
        }, "required": ["risk_id"]},
    }, _grc_update_risk),
    ("grc", "audits", "view", {
        "name": "grc_list_audits",
        "description": "List audits.",
        "input_schema": {"type": "object", "properties": {}},
    }, _grc_list_audits),
    ("grc", "audits", "view", {
        "name": "grc_get_audit",
        "description": "Full detail for one audit, including its findings.",
        "input_schema": {"type": "object", "properties": {"audit_id": {"type": "string"}},
                          "required": ["audit_id"]},
    }, _grc_get_audit),
    ("grc", "audits", "edit", {
        "name": "grc_add_audit_finding",
        "description": "Add a finding to an audit. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "audit_id": {"type": "string"}, "title": {"type": "string"}, "description": {"type": "string"},
            "severity": {"type": "string"}, "corrective_action": {"type": "string"}, "owner_email": {"type": "string"},
        }, "required": ["audit_id", "title"]},
    }, _grc_add_audit_finding),
    ("grc", "access_review", "view", {
        "name": "grc_list_access_reviews",
        "description": "List access review cycles with task progress.",
        "input_schema": {"type": "object", "properties": {}},
    }, _grc_list_access_reviews),
    ("grc", "access_review", "edit", {
        "name": "grc_update_access_review_status",
        "description": "Change an access review cycle's status. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "cycle_id": {"type": "string"},
            "status": {"type": "string", "enum": ["open", "in_progress", "closed"]},
        }, "required": ["cycle_id", "status"]},
    }, _grc_update_access_review_status),

    # IT
    ("it", "assets", "view", {
        "name": "it_list_equipments",
        "description": "List IT equipment. Optional search by name, serial number, or assignee.",
        "input_schema": {"type": "object", "properties": {"search": {"type": "string"}}},
    }, _it_list_equipments),
    ("it", "assets", "edit", {
        "name": "it_create_equipment",
        "description": "Register a new piece of IT equipment. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "name": {"type": "string"}, "equipment_type": {"type": "string"}, "serial_number": {"type": "string"},
            "assigned_email": {"type": "string"}, "assigned_name": {"type": "string"}, "location_name": {"type": "string"},
        }, "required": ["name"]},
    }, _it_create_equipment),
    ("it", "assets", "edit", {
        "name": "it_update_equipment",
        "description": "Update an equipment record (e.g. reassign, retire). Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "equipment_id": {"type": "string"}, "assigned_email": {"type": "string"},
            "assigned_name": {"type": "string"}, "end_service_date": {"type": "string"}, "comment": {"type": "string"},
        }, "required": ["equipment_id"]},
    }, _it_update_equipment),
    ("it", "assets", "view", {
        "name": "it_list_software",
        "description": "List licensed software. Optional name search.",
        "input_schema": {"type": "object", "properties": {"search": {"type": "string"}}},
    }, _it_list_software),
    ("it", "assets", "view", {
        "name": "it_list_applications",
        "description": "List internal applications. Optional name search.",
        "input_schema": {"type": "object", "properties": {"search": {"type": "string"}}},
    }, _it_list_applications),

    # Helpdesk
    ("helpdesk", "tickets", "view", {
        "name": "helpdesk_dashboard",
        "description": "Helpdesk overview: ticket counts by status/priority, SLA breaches, recent tickets.",
        "input_schema": {"type": "object", "properties": {}},
    }, _helpdesk_dashboard),
    ("helpdesk", "tickets", "view", {
        "name": "helpdesk_list_tickets",
        "description": "List helpdesk tickets. Optional status filter.",
        "input_schema": {"type": "object", "properties": {"status": {"type": "string"}}},
    }, _helpdesk_list_tickets),
    ("helpdesk", "tickets", "view", {
        "name": "helpdesk_get_ticket",
        "description": "Full detail for one ticket, including comments.",
        "input_schema": {"type": "object", "properties": {"ticket_id": {"type": "string"}},
                          "required": ["ticket_id"]},
    }, _helpdesk_get_ticket),
    ("helpdesk", "tickets", "edit", {
        "name": "helpdesk_create_ticket",
        "description": "Create a new helpdesk ticket. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "title": {"type": "string"}, "description": {"type": "string"}, "priority": {"type": "string"},
            "ticket_type": {"type": "string"}, "assignee_email": {"type": "string"}, "assignee_name": {"type": "string"},
            "application": {"type": "string"},
        }, "required": ["title"]},
    }, _helpdesk_create_ticket),
    ("helpdesk", "tickets", "edit", {
        "name": "helpdesk_update_ticket",
        "description": "Update a ticket's status/priority/assignee/resolution. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "ticket_id": {"type": "string"}, "status": {"type": "string"}, "priority": {"type": "string"},
            "assignee_email": {"type": "string"}, "assignee_name": {"type": "string"}, "resolution": {"type": "string"},
        }, "required": ["ticket_id"]},
    }, _helpdesk_update_ticket),
    ("helpdesk", "tickets", "edit", {
        "name": "helpdesk_add_ticket_comment",
        "description": "Add a comment to a ticket.",
        "input_schema": {"type": "object", "properties": {
            "ticket_id": {"type": "string"}, "content": {"type": "string"},
            "is_internal": {"type": "boolean"},
        }, "required": ["ticket_id", "content"]},
    }, _helpdesk_add_ticket_comment),
    ("helpdesk", "knowledge", "view", {
        "name": "helpdesk_search_knowledge",
        "description": "Search the helpdesk knowledge base.",
        "input_schema": {"type": "object", "properties": {"search": {"type": "string"}}},
    }, _helpdesk_search_knowledge),

    # Admin (read-only)
    ("admin", "users", "view", {
        "name": "admin_list_users",
        "description": "List/search WHUBBI users (name, email, department).",
        "input_schema": {"type": "object", "properties": {"search": {"type": "string"}}},
    }, _admin_list_users),
    ("admin", "costs", "view", {
        "name": "admin_costs_summary",
        "description": "AWS cost summary for the current month.",
        "input_schema": {"type": "object", "properties": {}},
    }, _admin_costs_summary),
    ("admin", "monitoring", "view", {
        "name": "admin_system_health",
        "description": "Infrastructure health status (ECS services, RDS, etc).",
        "input_schema": {"type": "object", "properties": {}},
    }, _admin_system_health),

    # Development
    ("development", "general", "view", {
        "name": "dev_list_requests",
        "description": "List development requests (features/bugs). Optional status filter.",
        "input_schema": {"type": "object", "properties": {"status": {"type": "string"}}},
    }, _dev_list_requests),
    ("development", "general", "view", {
        "name": "dev_get_request",
        "description": "Full detail for one development request, including activity log.",
        "input_schema": {"type": "object", "properties": {"request_id": {"type": "string"}},
                          "required": ["request_id"]},
    }, _dev_get_request),
    ("development", "general", "edit", {
        "name": "dev_update_request",
        "description": "Update a development request's status/priority/assignee. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "request_id": {"type": "string"}, "status": {"type": "string"}, "priority": {"type": "string"},
            "assignee_email": {"type": "string"}, "assignee_name": {"type": "string"},
        }, "required": ["request_id"]},
    }, _dev_update_request),

    # Training
    ("training", "manager", "view", {
        "name": "training_catalog",
        "description": "List available training courses in the catalog.",
        "input_schema": {"type": "object", "properties": {"search": {"type": "string"}}},
    }, _training_catalog),
    (None, None, None, {
        "name": "training_list_assignments",
        "description": "List training assignments for a user. Defaults to the current user's own (always allowed); looking up someone else requires Training module permission.",
        "input_schema": {"type": "object", "properties": {"user_email": {"type": "string"}}},
    }, _training_list_assignments),
    ("training", "manager", "edit", {
        "name": "training_assign",
        "description": "Assign a training course to one or more users. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "user_emails": {"type": "array", "items": {"type": "string"}},
            "catalog_id": {"type": "string"}, "plan_id": {"type": "string"},
            "due_date": {"type": "string"},
        }, "required": ["user_emails"]},
    }, _training_assign),

    # Task Manager
    ("tasks", "manager", "view", {
        "name": "tm_list_tasks",
        "description": "List WHUBBI tasks. Defaults to the current user's own tasks (owner, assignee, or watcher) — pass scope='company' to see all tasks platform-wide.",
        "input_schema": {"type": "object", "properties": {
            "scope": {"type": "string", "enum": ["own", "team", "company"], "description": "Defaults to 'own'"},
            "status": {"type": "string"}, "assignee_email": {"type": "string"}}},
    }, _tm_list_tasks),
    ("tasks", "manager", "view", {
        "name": "tm_get_task",
        "description": "Full detail for one task, including subtasks, comments, watchers.",
        "input_schema": {"type": "object", "properties": {"task_id": {"type": "string"}},
                          "required": ["task_id"]},
    }, _tm_get_task),
    ("tasks", "manager", "edit", {
        "name": "tm_create_task",
        "description": "Create a new task. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "title": {"type": "string"}, "description": {"type": "string"},
            "assignee_email": {"type": "string"}, "assignee_name": {"type": "string"}, "due_date": {"type": "string"},
        }, "required": ["title"]},
    }, _tm_create_task),
    ("tasks", "manager", "edit", {
        "name": "tm_update_task_status",
        "description": "Change a task's status. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "task_id": {"type": "string"},
            "status": {"type": "string", "enum": ["new", "open", "in_progress", "resolved", "closed"]},
        }, "required": ["task_id", "status"]},
    }, _tm_update_task_status),
    ("tasks", "manager", "edit", {
        "name": "tm_reassign_task",
        "description": "Reassign a task to someone else. Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "task_id": {"type": "string"}, "new_assignee_email": {"type": "string"},
            "new_assignee_name": {"type": "string"},
        }, "required": ["task_id", "new_assignee_email"]},
    }, _tm_reassign_task),
    ("tasks", "manager", "edit", {
        "name": "tm_add_task_comment",
        "description": "Add a comment to a task.",
        "input_schema": {"type": "object", "properties": {
            "task_id": {"type": "string"}, "content": {"type": "string"},
        }, "required": ["task_id", "content"]},
    }, _tm_add_task_comment),

    # MyWhubbi — always available, self-scoped to the requesting user, no module permission gate
    (None, None, None, {
        "name": "my_profile",
        "description": "Get the current user's own WHUBBI profile: job title, department, manager, phone, licenses, groups.",
        "input_schema": {"type": "object", "properties": {}},
    }, _my_profile),
    (None, None, None, {
        "name": "my_equipments",
        "description": "List IT equipment assigned to the current user.",
        "input_schema": {"type": "object", "properties": {}},
    }, _my_equipments),
    (None, None, None, {
        "name": "my_cv",
        "description": "Get the current user's own CV/bio: title, summary, skills, languages, experience count.",
        "input_schema": {"type": "object", "properties": {}},
    }, _my_cv),
    (None, None, None, {
        "name": "my_certifications",
        "description": "List the current user's own certifications.",
        "input_schema": {"type": "object", "properties": {}},
    }, _my_certifications),
    (None, None, None, {
        "name": "request_access_change",
        "description": "Request a license/group/role be added or removed for the current user (creates a task for the item's owner, e.g. IT). Always confirm with the user before calling this.",
        "input_schema": {"type": "object", "properties": {
            "item_name": {"type": "string", "description": "e.g. 'Microsoft 365 E5', 'Sales Team' group"},
            "action": {"type": "string", "enum": ["add", "remove"]},
            "notes": {"type": "string"},
        }, "required": ["item_name"]},
    }, _request_access_change),
]

TOOLS = [d[3] for d in TOOL_DEFS]
TOOL_META = {d[3]["name"]: (d[0], d[1], d[2]) for d in TOOL_DEFS}
TOOL_FN = {d[3]["name"]: d[4] for d in TOOL_DEFS}


def available_tools(perms: dict) -> list:
    return [t for t in TOOLS if TOOL_META[t["name"]][2] is None or allowed(perms, *TOOL_META[t["name"]])]


async def run_tool(name: str, inp: dict, ctx: ToolCtx) -> str:
    fn = TOOL_FN.get(name)
    if not fn:
        return json.dumps({"error": f"Unknown tool: {name}"})
    return await fn(inp, ctx)
