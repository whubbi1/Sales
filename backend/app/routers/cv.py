from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
import uuid, json

router = APIRouter()

async def _table_exists(db: AsyncSession, name: str) -> bool:
    r = await db.execute(text("SELECT to_regclass(:n)"), {"n": name})
    return r.scalar() is not None

@router.get("/{email}")
async def get_cv(email: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT * FROM employee_cv WHERE email = :email"), {"email": email})
    row = r.fetchone()
    if row:
        cv = dict(row._mapping)
        cv["id"] = str(cv["id"])
    else:
        # Pre-fill from user_profiles if this employee hasn't set up a CV yet
        pr = await db.execute(text("SELECT first_name, last_name, job_title FROM user_profiles WHERE email = :email"), {"email": email})
        p = pr.fetchone()
        cv = {
            "id": None,
            "email": email,
            "first_name": p.first_name if p else "",
            "last_name": p.last_name if p else "",
            "title": p.job_title if p else "",
            "short_description": "",
            "skills": [],
            "languages": [],
        }

    er = await db.execute(text("""
        SELECT * FROM employee_cv_experience
        WHERE user_email = :email
        ORDER BY sort_order ASC, start_date DESC
    """), {"email": email})
    experiences = []
    for exp in er.fetchall():
        d = dict(exp._mapping)
        d["id"] = str(d["id"])
        experiences.append(d)
    cv["experiences"] = experiences

    # Read-only reflections from Training / Certifications (Phase 3). Tables may not exist yet.
    trainings, certifications = [], []
    if await _table_exists(db, "trainings"):
        tr = await db.execute(text("SELECT * FROM trainings WHERE user_email = :email ORDER BY training_date DESC"), {"email": email})
        trainings = [dict(t._mapping) for t in tr.fetchall()]
    if await _table_exists(db, "certifications"):
        cr = await db.execute(text("SELECT * FROM certifications WHERE user_email = :email ORDER BY cert_date DESC"), {"email": email})
        certifications = [dict(c._mapping) for c in cr.fetchall()]
    cv["trainings"] = trainings
    cv["certifications"] = certifications

    return {"cv": cv}

@router.put("/{email}")
async def update_cv(email: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        INSERT INTO employee_cv (id, email, first_name, last_name, title, short_description, skills, languages, created_at, updated_at)
        VALUES (gen_random_uuid(), :email, :first_name, :last_name, :title, :short_description, CAST(:skills AS JSON), CAST(:languages AS JSON), NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            title = EXCLUDED.title,
            short_description = EXCLUDED.short_description,
            skills = EXCLUDED.skills,
            languages = EXCLUDED.languages,
            updated_at = NOW()
    """), {
        "email": email,
        "first_name": data.get("first_name", ""),
        "last_name": data.get("last_name", ""),
        "title": data.get("title", ""),
        "short_description": data.get("short_description", ""),
        "skills": json.dumps(data.get("skills") or []),
        "languages": json.dumps(data.get("languages") or []),
    })
    await db.commit()
    return {"status": "ok"}

@router.post("/{email}/experience")
async def create_experience(email: str, data: dict, db: AsyncSession = Depends(get_db)):
    exp_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO employee_cv_experience
            (id, user_email, job_title, company, start_date, end_date, location, description, sort_order, created_at, updated_at)
        VALUES
            (CAST(:id AS UUID), :email, :job_title, :company, :start_date, :end_date, :location, :description, :sort_order, NOW(), NOW())
    """), {
        "id": exp_id,
        "email": email,
        "job_title": data.get("job_title", ""),
        "company": data.get("company", ""),
        "start_date": data.get("start_date", ""),
        "end_date": data.get("end_date", ""),
        "location": data.get("location", ""),
        "description": data.get("description", ""),
        "sort_order": data.get("sort_order", 0),
    })
    await db.commit()
    return {"status": "ok", "id": exp_id}

@router.put("/{email}/experience/{eid}")
async def update_experience(email: str, eid: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE employee_cv_experience SET
            job_title = :job_title,
            company = :company,
            start_date = :start_date,
            end_date = :end_date,
            location = :location,
            description = :description,
            updated_at = NOW()
        WHERE id = CAST(:id AS UUID) AND user_email = :email
    """), {
        "id": eid,
        "email": email,
        "job_title": data.get("job_title", ""),
        "company": data.get("company", ""),
        "start_date": data.get("start_date", ""),
        "end_date": data.get("end_date", ""),
        "location": data.get("location", ""),
        "description": data.get("description", ""),
    })
    await db.commit()
    return {"status": "ok"}

@router.delete("/{email}/experience/{eid}")
async def delete_experience(email: str, eid: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM employee_cv_experience WHERE id = CAST(:id AS UUID) AND user_email = :email"), {"id": eid, "email": email})
    await db.commit()
    return {"status": "ok"}
