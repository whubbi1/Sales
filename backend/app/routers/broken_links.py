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
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}

# linkedin.com blocks any unauthenticated request with a 999 regardless of whether the profile/page
# is real (logging in to check would violate its ToS — see the LinkedIn-check feature's design), and
# sharepoint.com requires a signed-in Microsoft session — a 401/403 there means "can't verify", not
# "broken". Report these separately so real dead links aren't buried under expected auth-wall noise.
AUTH_WALLED_DOMAINS = ("linkedin.com", "sharepoint.com")


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


def _is_auth_walled(url: str) -> bool:
    return any(d in url for d in AUTH_WALLED_DOMAINS)


async def _check_one(client: httpx.AsyncClient, sem: asyncio.Semaphore, link: dict) -> dict | None:
    async with sem:
        url = link["url"]
        if not url.startswith(("http://", "https://")):
            return {**link, "error": "malformed_url", "bucket": "broken"}
        try:
            r = await client.head(url, timeout=TIMEOUT, follow_redirects=True, headers=HEADERS)
            if r.status_code >= 400:
                r = await client.get(url, timeout=TIMEOUT, follow_redirects=True, headers=HEADERS)
        except Exception as e:
            return {**link, "error": str(e)[:150], "bucket": "broken"}
        if r.status_code >= 400 or r.status_code == 999:
            bucket = "unverifiable" if _is_auth_walled(url) and r.status_code in (401, 403, 999) else "broken"
            return {**link, "status_code": r.status_code, "bucket": bucket}
        return None


@router.post("/broken-links")
async def check_broken_links(db: AsyncSession = Depends(get_db)):
    all_links = await _gather_links(db)
    truncated = len(all_links) > MAX_LINKS
    checked_links = all_links[:MAX_LINKS]

    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(*[_check_one(client, sem, l) for l in checked_links])
    flagged = [r for r in results if r]
    broken = [{k: v for k, v in r.items() if k != "bucket"} for r in flagged if r["bucket"] == "broken"]
    unverifiable = [{k: v for k, v in r.items() if k != "bucket"} for r in flagged if r["bucket"] == "unverifiable"]

    return {
        "total_checked": len(checked_links),
        "total_found": len(all_links),
        "truncated": truncated,
        "broken": broken,
        "unverifiable": unverifiable,
    }
