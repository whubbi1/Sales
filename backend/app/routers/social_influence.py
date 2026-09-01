# backend/app/routers/social_influence.py
# Social Media Influence — external information sources (files, websites, blogs, LinkedIn
# pages) monitored over time, used as grounding for Claude-generated social posts. Mirrors
# existing patterns rather than inventing new ones:
#   - claude_web_search() (app/routers/companies.py) does the actual "fetch a URL and read it"
#     work via Claude's web_search tool — reused as-is for source checking.
#   - S3 upload mirrors app/routers/hr.py's upload_to_s3/s3_ref_to_presigned, same as
#     marketing.py already does for event logos/files.
#
# STAGE 1 (this file): source monitoring + draft generation. A generated post's "posted"
# status is set manually by a person after they copy it to LinkedIn/X themselves.
# STAGE 2 (not yet built): LinkedIn/X OAuth connections and one-click auto-publish.
import os
import uuid
import json
import base64
import asyncio
import hashlib
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import get_db
from app.routers.hr import upload_to_s3, s3_ref_to_presigned
from app.routers.companies import claude_web_search

router = APIRouter()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
GENERATION_MODEL = "claude-sonnet-5"

URL_SUBTYPES = {"website", "blog", "linkedin", "other"}
CHECK_FREQUENCIES = {"manual", "daily", "weekly"}
FREQUENCY_INTERVALS = {"daily": timedelta(days=1), "weekly": timedelta(days=7)}
PLATFORMS = {"linkedin", "twitter"}
POST_STATUSES = {"draft", "approved", "posted"}


def _row(d: dict) -> dict:
    for k, v in d.items():
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
    return d


async def _presign_source(d: dict) -> dict:
    if (d.get("file_url") or "").startswith("s3://"):
        d["file_url"] = await s3_ref_to_presigned(d["file_url"])
    return d


async def _get_source(db: AsyncSession, source_id: str) -> dict | None:
    r = await db.execute(text("SELECT * FROM influence_sources WHERE id = CAST(:id AS UUID)"), {"id": source_id})
    row = r.fetchone()
    return await _presign_source(_row(dict(row._mapping))) if row else None


# ─── Sources ─────────────────────────────────────────────────────────────────────
@router.get("/influence-sources")
async def list_influence_sources(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM influence_sources ORDER BY created_at DESC"))
    return {"sources": [await _presign_source(_row(dict(row._mapping))) for row in r.fetchall()]}


@router.post("/influence-sources")
async def create_influence_source(data: dict, db: AsyncSession = Depends(get_db)):
    if not data.get("name") or not data.get("url"):
        raise HTTPException(status_code=400, detail="name and url are required")
    subtype = data.get("subtype") or "other"
    if subtype not in URL_SUBTYPES:
        raise HTTPException(status_code=400, detail=f"subtype must be one of {sorted(URL_SUBTYPES)}")
    frequency = data.get("check_frequency") or "manual"
    if frequency not in CHECK_FREQUENCIES:
        raise HTTPException(status_code=400, detail=f"check_frequency must be one of {sorted(CHECK_FREQUENCIES)}")
    source_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO influence_sources (id, name, description, language, source_type, subtype, url, check_frequency, active, created_by_email, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :name, :description, :language, 'url', :subtype, :url, :frequency, TRUE, :created_by_email, NOW(), NOW())
    """), {
        "id": source_id, "name": data["name"], "description": data.get("description") or None,
        "language": data.get("language") or None, "subtype": subtype, "url": data["url"],
        "frequency": frequency, "created_by_email": data.get("created_by_email", ""),
    })
    await db.commit()
    return await _get_source(db, source_id)


@router.post("/influence-sources/upload")
async def upload_influence_source(
    name: str = Form(...), check_frequency: str = Form("manual"),
    description: str = Form(""), language: str = Form(""),
    file: UploadFile = File(...), created_by_email: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    if check_frequency not in CHECK_FREQUENCIES:
        raise HTTPException(status_code=400, detail=f"check_frequency must be one of {sorted(CHECK_FREQUENCIES)}")
    content = await file.read()
    source_id = str(uuid.uuid4())
    key = f"marketing/social-influence/{source_id}/{file.filename.replace(' ', '_')}"
    file_ref = await upload_to_s3(key, content, file.content_type or "application/octet-stream")
    await db.execute(text("""
        INSERT INTO influence_sources (id, name, description, language, source_type, file_url, file_name, check_frequency, active, created_by_email, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :name, :description, :language, 'file', :file_url, :file_name, :frequency, TRUE, :created_by_email, NOW(), NOW())
    """), {
        "id": source_id, "name": name, "description": description or None, "language": language or None,
        "file_url": file_ref, "file_name": file.filename,
        "frequency": check_frequency, "created_by_email": created_by_email,
    })
    await db.commit()
    return await _get_source(db, source_id)


@router.get("/influence-sources/{source_id}")
async def get_influence_source(source_id: str, db: AsyncSession = Depends(get_db)):
    source = await _get_source(db, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return source


@router.put("/influence-sources/{source_id}")
async def update_influence_source(source_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    existing = await _get_source(db, source_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Source not found")
    frequency = data.get("check_frequency", "")
    if frequency and frequency not in CHECK_FREQUENCIES:
        raise HTTPException(status_code=400, detail=f"check_frequency must be one of {sorted(CHECK_FREQUENCIES)}")
    subtype = data.get("subtype", "")
    if subtype and subtype not in URL_SUBTYPES:
        raise HTTPException(status_code=400, detail=f"subtype must be one of {sorted(URL_SUBTYPES)}")
    await db.execute(text("""
        UPDATE influence_sources SET
            name = COALESCE(NULLIF(:name,''), name),
            description = COALESCE(:description, description),
            language = COALESCE(NULLIF(:language,''), language),
            url = COALESCE(NULLIF(:url,''), url),
            subtype = COALESCE(NULLIF(:subtype,''), subtype),
            check_frequency = COALESCE(NULLIF(:frequency,''), check_frequency),
            active = COALESCE(:active, active),
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {
        "id": source_id, "name": data.get("name", ""), "description": data.get("description"),
        "language": data.get("language", ""), "url": data.get("url", ""), "subtype": subtype,
        "frequency": frequency, "active": data.get("active"),
    })
    await db.commit()
    return await _get_source(db, source_id)


@router.delete("/influence-sources/{source_id}")
async def delete_influence_source(source_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM influence_source_updates WHERE source_id = CAST(:id AS UUID)"), {"id": source_id})
    await db.execute(text("DELETE FROM influence_sources WHERE id = CAST(:id AS UUID)"), {"id": source_id})
    await db.commit()
    return {"status": "ok"}


@router.get("/influence-sources/{source_id}/updates")
async def list_source_updates(source_id: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT * FROM influence_source_updates WHERE source_id = CAST(:id AS UUID) ORDER BY checked_at DESC
    """), {"id": source_id})
    return {"updates": [_row(dict(row._mapping)) for row in r.fetchall()]}


# ─── Checking a source for new information ───────────────────────────────────────
def _summaries_differ(old: str | None, new: str) -> bool:
    if not old:
        return False  # first-ever check establishes a baseline, it isn't "new" yet
    norm = lambda s: hashlib.sha256(" ".join(s.split()).lower().encode()).hexdigest()
    return norm(old) != norm(new)


async def _check_source(db: AsyncSession, source: dict) -> dict:
    if source["source_type"] != "url":
        return source  # file sources are static — nothing to re-check
    prompt = (
        f"Fetch the current content at this URL: {source['url']}\n"
        "Summarize what's currently there in under 150 words, focused on recent posts, "
        "news, announcements or updates a marketing team would want to know about. "
        "Plain prose, no markdown, no preamble."
    )
    try:
        summary = await claude_web_search(prompt)
        changed = _summaries_differ(source.get("last_summary"), summary)
        await db.execute(text("""
            UPDATE influence_sources SET last_summary = :summary, last_checked_at = NOW(), last_error = NULL, updated_at = NOW()
            WHERE id = CAST(:id AS UUID)
        """), {"id": source["id"], "summary": summary})
        if changed:
            await db.execute(text("""
                INSERT INTO influence_source_updates (id, source_id, checked_at, summary)
                VALUES (CAST(:id AS UUID), CAST(:sid AS UUID), NOW(), :summary)
            """), {"id": str(uuid.uuid4()), "sid": source["id"], "summary": summary})
        await db.commit()
    except Exception as e:
        await db.execute(text("""
            UPDATE influence_sources SET last_error = :err, last_checked_at = NOW(), updated_at = NOW() WHERE id = CAST(:id AS UUID)
        """), {"id": source["id"], "err": str(e)[:500]})
        await db.commit()
    return await _get_source(db, source["id"])


@router.post("/influence-sources/{source_id}/check")
async def check_influence_source(source_id: str, db: AsyncSession = Depends(get_db)):
    source = await _get_source(db, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return await _check_source(db, source)


# ─── Periodic monitor — in-process background loop, started once at app startup ──
# (same idiom as _hold_mcp_session_manager in main.py: a long-lived asyncio task inside this
# already-always-on ECS Fargate container, rather than new scheduling infrastructure).
CHECK_LOOP_INTERVAL = 60 * 60       # wake hourly...
MAX_SOURCES_PER_CYCLE = 10          # ...but only recheck a bounded batch per wake, to cap cost
CHECK_CONCURRENCY = 3


async def periodic_check_loop():
    from app.database import AsyncSessionLocal
    while True:
        try:
            async with AsyncSessionLocal() as db:
                r = await db.execute(text("""
                    SELECT * FROM influence_sources
                    WHERE active = TRUE AND source_type = 'url' AND check_frequency != 'manual'
                    ORDER BY last_checked_at ASC NULLS FIRST
                """))
                due = []
                for row in r.fetchall():
                    s = _row(dict(row._mapping))
                    interval = FREQUENCY_INTERVALS.get(s["check_frequency"])
                    if not s["last_checked_at"] or datetime.utcnow() - s["last_checked_at"] >= interval:
                        due.append(s)
                    if len(due) >= MAX_SOURCES_PER_CYCLE:
                        break
                sem = asyncio.Semaphore(CHECK_CONCURRENCY)

                async def _bounded(s):
                    async with sem:
                        await _check_source(db, s)

                if due:
                    await asyncio.gather(*[_bounded(s) for s in due])
        except Exception as e:
            print(f"[SocialInfluence] periodic_check_loop error: {e}")
        await asyncio.sleep(CHECK_LOOP_INTERVAL)


# ─── Content generation ───────────────────────────────────────────────────────────
PLATFORM_GUIDANCE = {
    "linkedin": "LinkedIn: professional, informative tone; up to ~3000 characters; can use short paragraphs and up to 3-5 relevant hashtags at the end.",
    "twitter": "X/Twitter: punchy and concise; hard limit of 280 characters including any hashtags; at most 1-2 hashtags.",
}

# Files whose bytes Claude can read natively as a document/image content block. Anything else
# (docx/pptx/xlsx, ...) is referenced by name only — no bespoke text-extraction is built for
# those, matching the sources the user actually described (files, websites, blogs, LinkedIn).
DOCUMENT_MEDIA_TYPES = {"application/pdf"}
IMAGE_MEDIA_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
TEXT_MEDIA_TYPES = {"text/plain", "text/markdown", "text/csv"}


def _source_meta_line(source: dict) -> str:
    """Description/language the person added for this source, if any — passed to Claude so it
    knows how to read the material (e.g. a presentation's language) without re-detecting it."""
    parts = []
    if source.get("description"):
        parts.append(f"Description: {source['description']}")
    if source.get("language"):
        parts.append(f"Language: {source['language']}")
    return ("\n" + "\n".join(parts)) if parts else ""


async def _source_content_blocks(source: dict) -> list[dict]:
    """Build the Claude content block(s) representing one source's material."""
    meta = _source_meta_line(source)
    if source["source_type"] == "url":
        text_part = f"Source \"{source['name']}\" ({source['url']}):{meta}\n{source.get('last_summary') or '(not yet checked — no summary available)'}"
        return [{"type": "text", "text": text_part}]

    # file source — fetch bytes via the existing presign helper rather than adding a new
    # boto3 get_object path just for this.
    presigned = await s3_ref_to_presigned(source["file_url"])
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(presigned)
        resp.raise_for_status()
        content = resp.content
    media_type = resp.headers.get("content-type", "application/octet-stream").split(";")[0]
    b64 = base64.b64encode(content).decode()

    header = f"File \"{source['file_name']}\" (source \"{source['name']}\"):{meta}"
    if media_type in DOCUMENT_MEDIA_TYPES:
        return [{"type": "text", "text": header}, {"type": "document", "source": {"type": "base64", "media_type": media_type, "data": b64}}]
    if media_type in IMAGE_MEDIA_TYPES:
        return [{"type": "text", "text": header}, {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}}]
    if media_type in TEXT_MEDIA_TYPES:
        try:
            return [{"type": "text", "text": f"{header}\n{content.decode('utf-8')}"}]
        except UnicodeDecodeError:
            pass
    return [{"type": "text", "text": f"(Additional file provided: \"{source['file_name']}\" — content type not directly readable, referenced by name only){meta}"}]


@router.post("/social-posts/generate")
async def generate_social_post(data: dict, db: AsyncSession = Depends(get_db)):
    platform = data.get("platform")
    if platform not in PLATFORMS:
        raise HTTPException(status_code=400, detail=f"platform must be one of {sorted(PLATFORMS)}")
    topic = data.get("topic") or ""
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    source_ids = data.get("source_ids")
    if source_ids:
        placeholders = ", ".join(f"CAST(:id{i} AS UUID)" for i in range(len(source_ids)))
        params = {f"id{i}": sid for i, sid in enumerate(source_ids)}
        r = await db.execute(text(f"SELECT * FROM influence_sources WHERE id IN ({placeholders})"), params)
    else:
        r = await db.execute(text("SELECT * FROM influence_sources WHERE active = TRUE"))
    sources = [await _presign_source(_row(dict(row._mapping))) for row in r.fetchall()]

    content_blocks: list[dict] = []
    for s in sources:
        content_blocks.extend(await _source_content_blocks(s))

    instruction = (
        f"Write one social media post for {platform.upper()} about: {topic or 'the material provided below'}.\n"
        f"Style guidance — {PLATFORM_GUIDANCE[platform]}\n"
        "Ground the post in the source material given above when it's relevant; don't invent facts "
        "that aren't supported by it. Return ONLY the post text, nothing else — no preamble, no quotes, no markdown fences."
    )
    content_blocks.append({"type": "text", "text": instruction})

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={
                "model": GENERATION_MODEL, "max_tokens": 1024,
                "system": "You are the social media copywriter for WHUBBI/WCOMPLY, a B2B business management platform. Write clear, on-brand, factual copy.",
                "messages": [{"role": "user", "content": content_blocks}],
            },
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Claude API error {resp.status_code}: {resp.text[:300]}")
        d = resp.json()
        content = "\n".join(b["text"] for b in d.get("content", []) if b.get("type") == "text").strip()

    post_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO social_posts (id, platform, topic, content, status, source_ids, created_by_email, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :platform, :topic, :content, 'draft', CAST(:source_ids AS JSONB), :created_by_email, NOW(), NOW())
    """), {
        "id": post_id, "platform": platform, "topic": topic, "content": content,
        "source_ids": json.dumps([s["id"] for s in sources]), "created_by_email": data.get("created_by_email", ""),
    })
    await db.commit()
    r2 = await db.execute(text("SELECT * FROM social_posts WHERE id = CAST(:id AS UUID)"), {"id": post_id})
    return _row(dict(r2.fetchone()._mapping))


@router.get("/social-posts")
async def list_social_posts(db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM social_posts ORDER BY created_at DESC"))
    return {"posts": [_row(dict(row._mapping)) for row in r.fetchall()]}


@router.put("/social-posts/{post_id}")
async def update_social_post(post_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT id FROM social_posts WHERE id = CAST(:id AS UUID)"), {"id": post_id})
    if not r.first():
        raise HTTPException(status_code=404, detail="Post not found")
    status = data.get("status", "")
    if status and status not in POST_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(POST_STATUSES)}")
    await db.execute(text("""
        UPDATE social_posts SET content = COALESCE(NULLIF(:content,''), content), status = COALESCE(NULLIF(:status,''), status), updated_at = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {"id": post_id, "content": data.get("content", ""), "status": data.get("status", "")})
    await db.commit()
    r2 = await db.execute(text("SELECT * FROM social_posts WHERE id = CAST(:id AS UUID)"), {"id": post_id})
    return _row(dict(r2.fetchone()._mapping))


@router.delete("/social-posts/{post_id}")
async def delete_social_post(post_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM social_posts WHERE id = CAST(:id AS UUID)"), {"id": post_id})
    await db.commit()
    return {"status": "ok"}

# Stage 2 (not built yet): LinkedIn/X OAuth connections + one-click auto-publish. For now,
# PUT /social-posts/{id} with {"status": "posted"} lets a person mark a post as posted after
# copying it to the platform themselves.
