# backend/app/routers/broken_links.py
import asyncio
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.database import get_db
from app.models.company import Company, CompanyArticle
from app.models.contact import Contact
from app.models.opportunity import Opportunity

router = APIRouter()

MAX_LINKS = 200  # keeps one run's time/cost bounded — surfaced to the caller if hit, not silently dropped
CONCURRENCY = 10
TIMEOUT = 8.0


async def _gather_links(db: AsyncSession):
    links = []

    companies = (await db.execute(select(Company.id, Company.name, Company.linkedin_url, Company.domain_names))).all()
    for c in companies:
        if c.linkedin_url:
            links.append({"source_type": "company", "source_id": str(c.id), "source_name": c.name, "field": "linkedin_url", "url": c.linkedin_url})
        for d in (c.domain_names or []):
            links.append({"source_type": "company", "source_id": str(c.id), "source_name": c.name, "field": "domain", "url": f"https://{d}"})

    partners = (await db.execute(text("SELECT id, name, linkedin_url, domain_names FROM partners"))).fetchall()
    for p in partners:
        if p.linkedin_url:
            links.append({"source_type": "partner", "source_id": str(p.id), "source_name": p.name, "field": "linkedin_url", "url": p.linkedin_url})
        for d in (p.domain_names or []):
            links.append({"source_type": "partner", "source_id": str(p.id), "source_name": p.name, "field": "domain", "url": f"https://{d}"})

    contacts = (await db.execute(select(Contact.id, Contact.first_name, Contact.last_name, Contact.linkedin_url).where(Contact.linkedin_url.isnot(None)))).all()
    for c in contacts:
        links.append({"source_type": "contact", "source_id": str(c.id), "source_name": f"{c.first_name} {c.last_name}", "field": "linkedin_url", "url": c.linkedin_url})

    partner_links = (await db.execute(text("""
        SELECT pl.id, pl.url, p.name AS partner_name FROM partner_links pl JOIN partners p ON p.id = pl.partner_id
    """))).fetchall()
    for pl in partner_links:
        links.append({"source_type": "partner_link", "source_id": str(pl.id), "source_name": pl.partner_name, "field": "url", "url": pl.url})

    opps = (await db.execute(select(Opportunity.id, Opportunity.deal_name, Opportunity.sharepoint_site_url))).all()
    for o in opps:
        if o.sharepoint_site_url:
            links.append({"source_type": "opportunity", "source_id": str(o.id), "source_name": o.deal_name, "field": "sharepoint_site_url", "url": o.sharepoint_site_url})

    opp_links = (await db.execute(text("""
        SELECT ol.id, ol.url, o.deal_name FROM opportunity_links ol JOIN opportunities o ON o.id = ol.opportunity_id
    """))).fetchall()
    for ol in opp_links:
        links.append({"source_type": "opportunity_link", "source_id": str(ol.id), "source_name": ol.deal_name, "field": "url", "url": ol.url})

    articles = (await db.execute(select(CompanyArticle.id, CompanyArticle.title, CompanyArticle.url))).all()
    for a in articles:
        links.append({"source_type": "company_article", "source_id": str(a.id), "source_name": a.title, "field": "url", "url": a.url})

    return links


async def _check_one(client: httpx.AsyncClient, sem: asyncio.Semaphore, link: dict) -> dict | None:
    async with sem:
        try:
            r = await client.head(link["url"], timeout=TIMEOUT, follow_redirects=True)
            if r.status_code >= 400:
                r = await client.get(link["url"], timeout=TIMEOUT, follow_redirects=True)
        except Exception as e:
            return {**link, "error": str(e)[:150]}
        if r.status_code >= 400:
            return {**link, "status_code": r.status_code}
        return None


@router.post("/broken-links")
async def check_broken_links(db: AsyncSession = Depends(get_db)):
    all_links = await _gather_links(db)
    truncated = len(all_links) > MAX_LINKS
    checked_links = all_links[:MAX_LINKS]

    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(*[_check_one(client, sem, l) for l in checked_links])
    broken = [r for r in results if r]

    return {
        "total_checked": len(checked_links),
        "total_found": len(all_links),
        "truncated": truncated,
        "broken": broken,
    }
