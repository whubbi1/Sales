from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from datetime import datetime
import uuid, os, base64, json, httpx, secrets

router = APIRouter()

API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MS_TENANT = os.getenv("MS_TENANT_ID", "")
MS_CLIENT = os.getenv("MS_CLIENT_ID", "")
MS_SECRET = os.getenv("MS_CLIENT_SECRET", "")
SHAREPOINT_SITE = os.getenv("SHAREPOINT_SITE_ID", "")
DOCUSIGN_ACCOUNT = os.getenv("DOCUSIGN_ACCOUNT_ID", "")
DOCUSIGN_KEY = os.getenv("DOCUSIGN_INTEGRATION_KEY", "")
WHUBBI_API_URL = os.getenv("WHUBBI_API_URL", "https://api.whubbi.wcomply.com")

# SharePoint folder sharing URLs for CV/document storage
SHAREPOINT_RECRUITMENT_URL = "https://wcomply.sharepoint.com/:f:/s/wcomply-HR/IgDsWu6K4lhqSIBLpu5eKpX4AThfbi029iqbHgDb_IQhoVY?e=sCToFw"
SHAREPOINT_FREELANCER_URL  = "https://wcomply.sharepoint.com/:f:/s/wcomply-HR/IgDuttxAz2gOQJWIokbuzzmVAVdr92slh5OLUsqO_IkQGiA?e=ox55oP"

# ─── Country config ────────────────────────────────────────────────────────────
COUNTRY_CONFIG = {
    "france": {
        "language": "fr", "currency": "EUR",
        "required_docs": ["carte_identite", "securite_sociale", "rib", "justificatif_domicile", "declaration_honorabilite"],
        "doc_labels": {"carte_identite": "Carte d'identité ou passeport", "securite_sociale": "Numéro de sécurité sociale", "rib": "RIB (Relevé d'Identité Bancaire)", "justificatif_domicile": "Justificatif de domicile (-3 mois)", "declaration_honorabilite": "Déclaration sur l'honneur"},
    },
    "portugal": {
        "language": "pt", "currency": "EUR",
        "required_docs": ["cartao_cidadao", "niss", "iban", "comprovativo_morada", "nif"],
        "doc_labels": {"cartao_cidadao": "Cartão de Cidadão ou Passaporte", "niss": "Número de Identificação de Segurança Social", "iban": "IBAN bancário", "comprovativo_morada": "Comprovativo de morada (-3 meses)", "nif": "Número de Identificação Fiscal"},
    },
    "czech_republic": {
        "language": "cs", "currency": "CZK",
        "required_docs": ["obcansky_prukaz", "rodne_cislo", "bankovni_ucet", "potvrzeni_adresy"],
        "doc_labels": {"obcansky_prukaz": "Občanský průkaz nebo pas", "rodne_cislo": "Rodné číslo", "bankovni_ucet": "Číslo bankovního účtu (IBAN)", "potvrzeni_adresy": "Potvrzení adresy (-3 měsíce)"},
    },
    "romania": {
        "language": "ro", "currency": "RON",
        "required_docs": ["carte_identitate", "cnp", "cont_bancar", "adeverinta_domiciliu"],
        "doc_labels": {"carte_identitate": "Carte de identitate sau pașaport", "cnp": "Cod Numeric Personal (CNP)", "cont_bancar": "Cont bancar (IBAN)", "adeverinta_domiciliu": "Adeverință de domiciliu (-3 luni)"},
    },
    "spain": {
        "language": "es", "currency": "EUR",
        "required_docs": ["dni_pasaporte", "nss", "cuenta_bancaria", "certificado_empadronamiento", "nie"],
        "doc_labels": {"dni_pasaporte": "DNI, NIE o Pasaporte", "nss": "Número de Seguridad Social", "cuenta_bancaria": "Cuenta bancaria (IBAN)", "certificado_empadronamiento": "Certificado de empadronamiento (-3 meses)", "nie": "NIE (si aplica)"},
    },
}

PROPOSAL_TEMPLATES = {
    "fr": {
        "subject": "Offre de mission / Proposition d'emploi — {role}",
        "greeting": "Madame, Monsieur {first_name} {last_name},",
        "intro": "Nous avons le plaisir de vous adresser cette offre pour le poste de {role} au sein de WCOMPLY.",
        "responsibilities_title": "Responsabilités",
        "salary_label": "Rémunération",
        "advantages_title": "Avantages",
        "closing": "Dans l'attente de votre retour, nous restons à votre disposition.",
        "signature": "L'équipe RH WCOMPLY",
    },
    "pt": {
        "subject": "Proposta de colaboração — {role}",
        "greeting": "Exmo(a). Sr(a). {first_name} {last_name},",
        "intro": "É com prazer que lhe apresentamos esta proposta para a posição de {role} na WCOMPLY.",
        "responsibilities_title": "Responsabilidades",
        "salary_label": "Remuneração",
        "advantages_title": "Benefícios",
        "closing": "Aguardamos o seu retorno e ficamos à sua inteira disposição.",
        "signature": "Equipa de RH WCOMPLY",
    },
    "cs": {
        "subject": "Nabídka spolupráce — {role}",
        "greeting": "Vážená/ý {first_name} {last_name},",
        "intro": "S potěšením Vám předkládáme tuto nabídku na pozici {role} ve společnosti WCOMPLY.",
        "responsibilities_title": "Odpovědnosti",
        "salary_label": "Odměna",
        "advantages_title": "Výhody",
        "closing": "Těšíme se na Vaši odpověď a jsme Vám plně k dispozici.",
        "signature": "HR tým WCOMPLY",
    },
    "ro": {
        "subject": "Ofertă de colaborare — {role}",
        "greeting": "Stimată/Stimate {first_name} {last_name},",
        "intro": "Cu plăcere vă prezentăm această ofertă pentru poziția de {role} în cadrul WCOMPLY.",
        "responsibilities_title": "Responsabilități",
        "salary_label": "Remunerație",
        "advantages_title": "Beneficii",
        "closing": "Așteptăm răspunsul dumneavoastră și rămânem la dispoziție.",
        "signature": "Echipa HR WCOMPLY",
    },
    "es": {
        "subject": "Oferta de colaboración — {role}",
        "greeting": "Estimada/o {first_name} {last_name},",
        "intro": "Nos complace presentarle esta oferta para el puesto de {role} en WCOMPLY.",
        "responsibilities_title": "Responsabilidades",
        "salary_label": "Remuneración",
        "advantages_title": "Ventajas",
        "closing": "Quedamos a su entera disposición y esperamos su respuesta.",
        "signature": "Equipo de RRHH WCOMPLY",
    },
}

# ─── MS Graph token ─────────────────────────────────────────────────────────────
async def get_ms_token():
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"https://login.microsoftonline.com/{MS_TENANT}/oauth2/v2.0/token",
            data={"grant_type":"client_credentials","client_id":MS_CLIENT,"client_secret":MS_SECRET,"scope":"https://graph.microsoft.com/.default"}
        )
        return r.json().get("access_token")

def _encode_share_url(url: str) -> str:
    encoded = base64.b64encode(url.encode()).decode().rstrip("=").replace("+", "-").replace("/", "_")
    return f"u!{encoded}"

async def upload_to_sharepoint(token: str, filename: str, content: bytes, folder: str = "HR/CVs"):
    """Legacy path-based upload (used by onboarding)."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/octet-stream"}
    url = f"https://graph.microsoft.com/v1.0/sites/{SHAREPOINT_SITE}/drive/root:/{folder}/{filename}:/content"
    async with httpx.AsyncClient() as client:
        r = await client.put(url, headers=headers, content=content)
        if r.status_code in [200, 201]:
            return r.json().get("webUrl", "")
    return ""

async def upload_to_sharepoint_folder(token: str, share_url: str, subfolder: str, filename: str, content: bytes) -> str:
    """Upload a file into a named subfolder under a SharePoint sharing URL."""
    encoded = _encode_share_url(share_url)
    auth = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=30) as client:
        # Get the parent folder's drive item
        pr = await client.get(f"https://graph.microsoft.com/v1.0/shares/{encoded}/driveItem", headers=auth)
        if pr.status_code != 200:
            return ""
        p = pr.json()
        drive_id = p["parentReference"]["driveId"]
        parent_id = p["id"]
        # Upload — Graph API navigates path segments via :/path/to/file: notation
        upload_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/items/{parent_id}:/{subfolder}/{filename}:/content"
        r = await client.put(upload_url, headers={**auth, "Content-Type": "application/octet-stream"}, content=content)
        if r.status_code in [200, 201]:
            return r.json().get("webUrl", "")
    return ""

# ─── CV Extraction via Claude API ───────────────────────────────────────────────
COUNTRY_MAP = {
    "france": "france", "french": "france", "fr": "france",
    "portugal": "portugal", "portuguese": "portugal", "pt": "portugal",
    "czech republic": "czech_republic", "czech": "czech_republic", "czechia": "czech_republic", "cs": "czech_republic",
    "romania": "romania", "romanian": "romania", "ro": "romania",
    "spain": "spain", "spanish": "spain", "es": "spain",
}

async def extract_cv_with_claude(pdf_bytes: bytes, filename: str) -> dict:
    if not API_KEY:
        raise ValueError("ANTHROPIC_API_KEY not configured")

    b64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")
    prompt = """Extract ALL information from this CV and return ONLY a valid JSON object with this exact structure:
{
  "first_name": "",
  "last_name": "",
  "email": "",
  "phone": "",
  "linkedin_url": "",
  "current_title": "",
  "years_experience": 0,
  "country": "france",
  "skills": ["skill1", "skill2"],
  "daily_rate": null,
  "projects": [
    {
      "title": "Job title",
      "company": "Company name",
      "start_date": "MM/YYYY",
      "end_date": "MM/YYYY or Present",
      "description": "What they did",
      "technologies": ["tech1", "tech2"]
    }
  ]
}
For country, use one of: france, portugal, czech_republic, romania, spain. Default to france if unknown.
Return ONLY the JSON, no markdown, no explanation."""

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": API_KEY,
                "anthropic-version": "2023-06-01",
                "anthropic-beta": "pdfs-2024-09-25",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 4000,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}},
                        {"type": "text", "text": prompt}
                    ]
                }]
            }
        )
        if r.status_code != 200:
            raise ValueError(f"Claude API error {r.status_code}: {r.text[:200]}")
        text_content = r.json()["content"][0]["text"].strip()
        text_content = text_content.replace("```json", "").replace("```", "").strip()
        data = json.loads(text_content)
        # Normalize country to dropdown values
        raw_country = str(data.get("country", "")).lower().strip()
        data["country"] = COUNTRY_MAP.get(raw_country, "france")
        return data

# ─── Dashboard ─────────────────────────────────────────────────────────────────
@router.get("/dashboard")
async def hr_dashboard(db: AsyncSession = Depends(get_db)):
    freelancers = await db.execute(text("SELECT COUNT(*) FROM hr_profiles WHERE profile_type='freelancer'"))
    internals = await db.execute(text("SELECT COUNT(*) FROM hr_profiles WHERE profile_type='internal'"))
    jobs = await db.execute(text("SELECT COUNT(*) FROM hr_job_descriptions WHERE status='open'"))
    proposals = await db.execute(text("SELECT COUNT(*) FROM hr_proposals WHERE status='sent'"))
    by_status = await db.execute(text("""
        SELECT recruitment_status, COUNT(*) as count FROM hr_profiles
        WHERE profile_type='internal' GROUP BY recruitment_status
    """))
    by_country = await db.execute(text("""
        SELECT country, COUNT(*) as count FROM hr_profiles GROUP BY country ORDER BY count DESC
    """))
    recent = await db.execute(text("""
        SELECT id, first_name, last_name, profile_type, recruitment_status, country, created_at
        FROM hr_profiles ORDER BY created_at DESC LIMIT 5
    """))
    return {
        "stats": {"freelancers": freelancers.scalar(), "internal_candidates": internals.scalar(),
                  "open_jobs": jobs.scalar(), "pending_proposals": proposals.scalar()},
        "by_status": {r.recruitment_status: r.count for r in by_status.fetchall()},
        "by_country": [{"country": r.country, "count": r.count} for r in by_country.fetchall()],
        "recent": [dict(r._mapping) for r in recent.fetchall()],
    }

# ─── Upload & Extract CV ────────────────────────────────────────────────────────
@router.post("/cv/extract")
async def extract_cv(file: UploadFile = File(...)):
    content = await file.read()
    try:
        extracted = await extract_cv_with_claude(content, file.filename)
        return {"extracted": extracted, "filename": file.filename, "size": len(content)}
    except Exception as e:
        print(f"CV extraction error: {e}")
        return {"extracted": {}, "error": str(e), "filename": file.filename}

@router.post("/cv/upload/{profile_id}")
async def upload_cv(profile_id: str, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    content = await file.read()
    token = await get_ms_token()

    # Get profile info to determine folder routing
    row = await db.execute(
        text("SELECT profile_type, first_name, last_name, country FROM hr_profiles WHERE id=CAST(:id AS UUID)"),
        {"id": profile_id}
    )
    profile = row.fetchone()

    url = ""
    if profile:
        name_folder = f"{profile.first_name} {profile.last_name}".strip() or profile_id
        if profile.profile_type == "freelancer":
            url = await upload_to_sharepoint_folder(token, SHAREPOINT_FREELANCER_URL, name_folder, file.filename, content)
        else:
            country = (profile.country or "unknown").replace(" ", "_")
            subfolder = f"{country}/{name_folder}"
            url = await upload_to_sharepoint_folder(token, SHAREPOINT_RECRUITMENT_URL, subfolder, file.filename, content)

    # Fallback to legacy path if share URL upload failed
    if not url:
        url = await upload_to_sharepoint(token, f"{profile_id}_{file.filename}", content, "HR/CVs")

    await db.execute(text("""
        UPDATE hr_profiles SET cv_sharepoint_url=:url, cv_filename=:fn, updated_at=NOW()
        WHERE id=CAST(:id AS UUID)
    """), {"url": url, "fn": file.filename, "id": profile_id})
    await db.commit()
    return {"status": "ok", "sharepoint_url": url}

# ─── Freelancers ────────────────────────────────────────────────────────────────
@router.get("/freelancers")
async def list_freelancers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT p.*, COUNT(pr.id) as project_count
        FROM hr_profiles p
        LEFT JOIN hr_projects pr ON pr.profile_id = p.id
        WHERE p.profile_type = 'freelancer'
        GROUP BY p.id ORDER BY p.created_at DESC
    """))
    profiles = [dict(r._mapping) for r in result.fetchall()]
    for p in profiles:
        p["id"] = str(p["id"])
        if isinstance(p.get("skills"), str):
            try: p["skills"] = json.loads(p["skills"])
            except: p["skills"] = []
    return {"freelancers": profiles}

@router.get("/freelancers/{profile_id}")
async def get_freelancer(profile_id: str, db: AsyncSession = Depends(get_db)):
    p = await db.execute(text("SELECT * FROM hr_profiles WHERE id=CAST(:id AS UUID) AND profile_type='freelancer'"), {"id": profile_id})
    row = p.fetchone()
    if not row: raise HTTPException(404, "Not found")
    profile = dict(row._mapping)
    profile["id"] = str(profile["id"])
    projs = await db.execute(text("SELECT * FROM hr_projects WHERE profile_id=CAST(:id AS UUID) ORDER BY start_date DESC"), {"id": profile_id})
    profile["projects"] = [dict(r._mapping) for r in projs.fetchall()]
    for pr in profile["projects"]:
        pr["id"] = str(pr["id"]); pr["profile_id"] = str(pr["profile_id"])
    return profile

@router.post("/freelancers")
async def create_freelancer(data: dict, db: AsyncSession = Depends(get_db)):
    pid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO hr_profiles (id, profile_type, first_name, last_name, email, phone, linkedin_url,
            country, language, current_title, skills, years_experience, daily_rate, availability_date,
            cv_filename, cv_sharepoint_url, cv_extracted, created_at, updated_at, created_by)
        VALUES (CAST(:id AS UUID), 'freelancer', :first_name, :last_name, :email, :phone, :linkedin_url,
            :country, :language, :current_title, CAST(:skills AS JSON), :years_experience, :daily_rate, :availability_date,
            :cv_filename, :cv_sharepoint_url, :cv_extracted, NOW(), NOW(), :created_by)
    """), {
        "id": pid, "first_name": data.get("first_name",""), "last_name": data.get("last_name",""),
        "email": data.get("email",""), "phone": data.get("phone",""), "linkedin_url": data.get("linkedin_url",""),
        "country": data.get("country",""), "language": data.get("language",""),
        "current_title": data.get("current_title",""),
        "skills": json.dumps(data.get("skills",[])),
        "years_experience": data.get("years_experience",0),
        "daily_rate": data.get("daily_rate"), "availability_date": data.get("availability_date"),
        "cv_filename": data.get("cv_filename",""), "cv_sharepoint_url": data.get("cv_sharepoint_url",""),
        "cv_extracted": data.get("cv_extracted", False), "created_by": data.get("created_by",""),
    })
    # Insert projects
    for proj in data.get("projects", []):
        await db.execute(text("""
            INSERT INTO hr_projects (id, profile_id, title, company, start_date, end_date, description, technologies)
            VALUES (gen_random_uuid(), CAST(:pid AS UUID), :title, :company, :start_date, :end_date, :description, CAST(:tech AS JSON))
        """), {"pid": pid, "title": proj.get("title",""), "company": proj.get("company",""),
               "start_date": proj.get("start_date",""), "end_date": proj.get("end_date",""),
               "description": proj.get("description",""), "tech": json.dumps(proj.get("technologies",[]))})
    await db.commit()
    return {"status": "ok", "id": pid}

@router.put("/freelancers/{profile_id}")
async def update_freelancer(profile_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE hr_profiles SET
            first_name=COALESCE(:first_name,first_name), last_name=COALESCE(:last_name,last_name),
            email=COALESCE(:email,email), phone=COALESCE(:phone,phone),
            linkedin_url=COALESCE(:linkedin_url,linkedin_url), country=COALESCE(:country,country),
            current_title=COALESCE(:current_title,current_title),
            skills=COALESCE(CAST(:skills AS JSON),skills), years_experience=COALESCE(:years_experience,years_experience),
            daily_rate=COALESCE(:daily_rate,daily_rate), updated_at=NOW()
        WHERE id=CAST(:id AS UUID)
    """), {**data, "id": profile_id, "skills": json.dumps(data.get("skills")) if data.get("skills") else None})
    await db.commit()
    return {"status": "ok"}

@router.delete("/freelancers/{profile_id}")
async def delete_freelancer(profile_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM hr_profiles WHERE id=CAST(:id AS UUID)"), {"id": profile_id})
    await db.commit()
    return {"status": "ok"}

# ─── Internal Recruitment ───────────────────────────────────────────────────────
RECRUITMENT_STATUSES = ["new","screening","interview_1","interview_2","technical_test","offer","hired","rejected","on_hold"]

@router.get("/recruitment")
async def list_internal(status: str = None, db: AsyncSession = Depends(get_db)):
    where = "WHERE profile_type='internal'"
    if status: where += f" AND recruitment_status='{status}'"
    result = await db.execute(text(f"""
        SELECT p.*, COUNT(pr.id) as project_count, COUNT(c.id) as comment_count
        FROM hr_profiles p
        LEFT JOIN hr_projects pr ON pr.profile_id = p.id
        LEFT JOIN hr_comments c ON c.profile_id = p.id
        {where} GROUP BY p.id ORDER BY p.created_at DESC
    """))
    profiles = [dict(r._mapping) for r in result.fetchall()]
    for p in profiles:
        p["id"] = str(p["id"])
        if isinstance(p.get("skills"), str):
            try: p["skills"] = json.loads(p["skills"])
            except: p["skills"] = []
    return {"candidates": profiles, "statuses": RECRUITMENT_STATUSES}

@router.get("/recruitment/{profile_id}")
async def get_candidate(profile_id: str, db: AsyncSession = Depends(get_db)):
    p = await db.execute(text("SELECT * FROM hr_profiles WHERE id=CAST(:id AS UUID) AND profile_type='internal'"), {"id": profile_id})
    row = p.fetchone()
    if not row: raise HTTPException(404, "Not found")
    profile = dict(row._mapping)
    profile["id"] = str(profile["id"])
    projs = await db.execute(text("SELECT * FROM hr_projects WHERE profile_id=CAST(:id AS UUID) ORDER BY start_date DESC"), {"id": profile_id})
    profile["projects"] = [dict(r._mapping) for r in projs.fetchall()]
    comments = await db.execute(text("SELECT * FROM hr_comments WHERE profile_id=CAST(:id AS UUID) ORDER BY created_at DESC"), {"id": profile_id})
    profile["comments"] = [dict(r._mapping) for r in comments.fetchall()]
    proposals = await db.execute(text("SELECT * FROM hr_proposals WHERE profile_id=CAST(:id AS UUID) ORDER BY created_at DESC"), {"id": profile_id})
    profile["proposals"] = [dict(r._mapping) for r in proposals.fetchall()]
    for pr in profile.get("projects",[]): pr["id"] = str(pr["id"]); pr["profile_id"] = str(pr["profile_id"])
    for c in profile.get("comments",[]): c["id"] = str(c["id"]); c["profile_id"] = str(c["profile_id"])
    for pr in profile.get("proposals",[]): pr["id"] = str(pr["id"]); pr["profile_id"] = str(pr["profile_id"])
    return profile

@router.post("/recruitment")
async def create_candidate(data: dict, db: AsyncSession = Depends(get_db)):
    pid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO hr_profiles (id, profile_type, first_name, last_name, email, phone, linkedin_url,
            country, language, current_title, skills, years_experience, recruitment_status,
            cv_filename, cv_sharepoint_url, cv_extracted, created_at, updated_at, created_by)
        VALUES (CAST(:id AS UUID), 'internal', :first_name, :last_name, :email, :phone, :linkedin_url,
            :country, :language, :current_title, CAST(:skills AS JSON), :years_experience, :recruitment_status,
            :cv_filename, :cv_sharepoint_url, :cv_extracted, NOW(), NOW(), :created_by)
    """), {
        "id": pid, "first_name": data.get("first_name",""), "last_name": data.get("last_name",""),
        "email": data.get("email",""), "phone": data.get("phone",""), "linkedin_url": data.get("linkedin_url",""),
        "country": data.get("country","france"), "language": data.get("language","fr"),
        "current_title": data.get("current_title",""), "skills": json.dumps(data.get("skills",[])),
        "years_experience": data.get("years_experience",0),
        "recruitment_status": data.get("recruitment_status","new"),
        "cv_filename": data.get("cv_filename",""), "cv_sharepoint_url": data.get("cv_sharepoint_url",""),
        "cv_extracted": data.get("cv_extracted", False), "created_by": data.get("created_by",""),
    })
    for proj in data.get("projects",[]):
        await db.execute(text("""
            INSERT INTO hr_projects (id, profile_id, title, company, start_date, end_date, description, technologies)
            VALUES (gen_random_uuid(), CAST(:pid AS UUID), :title, :company, :start_date, :end_date, :description, CAST(:tech AS JSON))
        """), {"pid": pid, "title": proj.get("title",""), "company": proj.get("company",""),
               "start_date": proj.get("start_date",""), "end_date": proj.get("end_date",""),
               "description": proj.get("description",""), "tech": json.dumps(proj.get("technologies",[]))})
    await db.commit()
    return {"status": "ok", "id": pid}

@router.put("/recruitment/{profile_id}/status")
async def update_status(profile_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("UPDATE hr_profiles SET recruitment_status=:status, updated_at=NOW() WHERE id=CAST(:id AS UUID)"),
                     {"status": data["status"], "id": profile_id})
    await db.commit()
    return {"status": "ok"}

@router.put("/recruitment/{profile_id}")
async def update_candidate(profile_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE hr_profiles SET
            first_name=COALESCE(:first_name, first_name),
            last_name=COALESCE(:last_name, last_name),
            email=COALESCE(:email, email),
            phone=COALESCE(:phone, phone),
            linkedin_url=COALESCE(:linkedin_url, linkedin_url),
            country=COALESCE(:country, country),
            language=COALESCE(:language, language),
            current_title=COALESCE(:current_title, current_title),
            skills=COALESCE(CAST(:skills AS JSON), skills),
            years_experience=COALESCE(:years_experience, years_experience),
            updated_at=NOW()
        WHERE id=CAST(:id AS UUID) AND profile_type='internal'
    """), {
        "id": profile_id,
        "first_name": data.get("first_name"),
        "last_name": data.get("last_name"),
        "email": data.get("email"),
        "phone": data.get("phone"),
        "linkedin_url": data.get("linkedin_url"),
        "country": data.get("country"),
        "language": data.get("language"),
        "current_title": data.get("current_title"),
        "skills": json.dumps(data["skills"]) if data.get("skills") is not None else None,
        "years_experience": data.get("years_experience"),
    })
    await db.commit()
    return {"status": "ok"}

@router.post("/recruitment/{profile_id}/comments")
async def add_comment(profile_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        INSERT INTO hr_comments (id, profile_id, author_email, author_name, content, comment_type, created_at)
        VALUES (gen_random_uuid(), CAST(:pid AS UUID), :author_email, :author_name, :content, :comment_type, NOW())
    """), {"pid": profile_id, "author_email": data.get("author_email",""),
           "author_name": data.get("author_name",""), "content": data.get("content",""),
           "comment_type": data.get("comment_type","note")})
    await db.commit()
    return {"status": "ok"}

# ─── Proposals ──────────────────────────────────────────────────────────────────
@router.post("/recruitment/{profile_id}/proposals")
async def create_proposal(profile_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    proposal_id = str(uuid.uuid4())
    onboarding_token = secrets.token_urlsafe(32)
    # Get country config
    country = data.get("country","france").lower().replace(" ","_")
    lang = COUNTRY_CONFIG.get(country, {}).get("language", "fr")

    await db.execute(text("""
        INSERT INTO hr_proposals (id, profile_id, role, responsibilities, salary, advantages,
            start_date, country, language, status, onboarding_token, created_at)
        VALUES (CAST(:id AS UUID), CAST(:pid AS UUID), :role, CAST(:resp AS JSON), :salary, CAST(:adv AS JSON),
            :start_date, :country, :lang, 'draft', :token, NOW())
    """), {"id": proposal_id, "pid": profile_id, "role": data.get("role",""),
           "resp": json.dumps(data.get("responsibilities",[])),
           "salary": data.get("salary",0), "adv": json.dumps(data.get("advantages",[])),
           "start_date": data.get("start_date",""), "country": country, "lang": lang,
           "token": onboarding_token})
    await db.commit()
    return {"status": "ok", "id": proposal_id, "onboarding_token": onboarding_token}

@router.get("/proposals/{proposal_id}/preview")
async def preview_proposal(proposal_id: str, db: AsyncSession = Depends(get_db)):
    p = await db.execute(text("""
        SELECT pr.*, prof.first_name, prof.last_name, prof.email
        FROM hr_proposals pr JOIN hr_profiles prof ON prof.id = pr.profile_id
        WHERE pr.id=CAST(:id AS UUID)
    """), {"id": proposal_id})
    row = p.fetchone()
    if not row: raise HTTPException(404)
    d = dict(row._mapping)
    lang = d.get("language","fr")
    tpl = PROPOSAL_TEMPLATES.get(lang, PROPOSAL_TEMPLATES["fr"])
    country = d.get("country","france")
    cfg = COUNTRY_CONFIG.get(country, COUNTRY_CONFIG["france"])
    if isinstance(d.get("responsibilities"), str):
        try: d["responsibilities"] = json.loads(d["responsibilities"])
        except: d["responsibilities"] = []
    if isinstance(d.get("advantages"), str):
        try: d["advantages"] = json.loads(d["advantages"])
        except: d["advantages"] = []
    return {
        "proposal": d, "template": tpl, "country_config": cfg,
        "onboarding_url": f"{WHUBBI_API_URL}/hr/onboarding/{d['onboarding_token']}"
    }

@router.post("/proposals/{proposal_id}/send")
async def send_proposal(proposal_id: str, db: AsyncSession = Depends(get_db)):
    """Send proposal via DocuSign"""
    preview = await preview_proposal(proposal_id, db)
    d = preview["proposal"]
    tpl = preview["template"]
    # Generate HTML content for DocuSign
    responsibilities_html = "".join(f"<li>{r}</li>" for r in (d.get("responsibilities") or []))
    advantages_html = "".join(f"<li>{a}</li>" for a in (d.get("advantages") or []))
    currency = COUNTRY_CONFIG.get(d.get("country","france"), {}).get("currency","EUR")
    html_content = f"""
    <html><body style="font-family:Arial;max-width:700px;margin:40px auto;color:#333">
    <img src="https://wcomply.com/logo.png" alt="WCOMPLY" style="height:50px;margin-bottom:30px"/>
    <p>{tpl['greeting'].format(first_name=d['first_name'],last_name=d['last_name'])}</p>
    <p>{tpl['intro'].format(role=d['role'])}</p>
    <h3>{tpl['responsibilities_title']}</h3><ul>{responsibilities_html}</ul>
    <h3>{tpl['salary_label']}</h3><p>{d.get('salary',0):,} {currency}</p>
    <h3>{tpl['advantages_title']}</h3><ul>{advantages_html}</ul>
    <p>{tpl['closing']}</p>
    <p><strong>{tpl['signature']}</strong></p>
    </body></html>"""

    # DocuSign envelope
    if DOCUSIGN_KEY and DOCUSIGN_ACCOUNT:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    f"https://demo.docusign.net/restapi/v2.1/accounts/{DOCUSIGN_ACCOUNT}/envelopes",
                    headers={"Authorization": f"Bearer {DOCUSIGN_KEY}", "Content-Type":"application/json"},
                    json={
                        "emailSubject": tpl["subject"].format(role=d["role"]),
                        "documents": [{"documentBase64": base64.b64encode(html_content.encode()).decode(),
                                       "name": f"Proposal_{d['role']}.html","fileExtension":"html","documentId":"1"}],
                        "recipients": {"signers": [{"email":d["email"],"name":f"{d['first_name']} {d['last_name']}",
                                                    "recipientId":"1","routingOrder":"1",
                                                    "tabs":{"signHereTabs":[{"anchorString":"WCOMPLY","anchorYOffset":"100","anchorXOffset":"0"}]}}]},
                        "status": "sent"
                    }
                )
                if r.status_code == 201:
                    env_id = r.json().get("envelopeId","")
                    await db.execute(text("""
                        UPDATE hr_proposals SET status='sent', docusign_envelope_id=:env_id, sent_at=NOW()
                        WHERE id=CAST(:id AS UUID)
                    """), {"env_id": env_id, "id": proposal_id})
                    await db.commit()
                    return {"status": "sent", "envelope_id": env_id}
        except Exception as e:
            print(f"DocuSign error: {e}")

    # Fallback: mark as sent without DocuSign
    await db.execute(text("UPDATE hr_proposals SET status='sent', sent_at=NOW() WHERE id=CAST(:id AS UUID)"), {"id": proposal_id})
    await db.commit()
    return {"status": "sent", "note": "DocuSign not configured — marked as sent manually"}

# ─── Onboarding (public page) ───────────────────────────────────────────────────
@router.get("/onboarding/{token}")
async def get_onboarding(token: str, db: AsyncSession = Depends(get_db)):
    p = await db.execute(text("""
        SELECT pr.*, prof.first_name, prof.last_name, prof.email
        FROM hr_proposals pr JOIN hr_profiles prof ON prof.id = pr.profile_id
        WHERE pr.onboarding_token=:token AND pr.status IN ('signed','sent')
    """), {"token": token})
    row = p.fetchone()
    if not row: raise HTTPException(404, "Onboarding link invalid or expired")
    d = dict(row._mapping)
    country = d.get("country","france")
    cfg = COUNTRY_CONFIG.get(country, COUNTRY_CONFIG["france"])
    return {"proposal": d, "required_docs": cfg["required_docs"], "doc_labels": cfg["doc_labels"],
            "language": cfg["language"], "country": country}

@router.post("/onboarding/{token}/submit")
async def submit_onboarding(token: str, data: dict, db: AsyncSession = Depends(get_db)):
    p = await db.execute(text("SELECT id, profile_id, country FROM hr_proposals WHERE onboarding_token=:token"), {"token": token})
    row = p.fetchone()
    if not row: raise HTTPException(404)
    proposal_id = str(row.id)
    profile_id = str(row.profile_id)
    # Save personal data
    await db.execute(text("""
        INSERT INTO hr_onboarding_documents (id, proposal_id, document_type, personal_data, uploaded_at)
        VALUES (gen_random_uuid(), CAST(:pid AS UUID), 'personal_info', CAST(:data AS JSON), NOW())
    """), {"pid": proposal_id, "data": json.dumps(data.get("personal_info",{}))})
    await db.execute(text("UPDATE hr_proposals SET onboarding_completed_at=NOW() WHERE id=CAST(:id AS UUID)"), {"id": proposal_id})
    await db.commit()
    return {"status": "ok", "message": "Information received — HR team will contact you shortly"}

@router.post("/onboarding/{token}/upload-document")
async def upload_onboarding_doc(token: str, doc_type: str, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    p = await db.execute(text("SELECT id, profile_id FROM hr_proposals WHERE onboarding_token=:token"), {"token": token})
    row = p.fetchone()
    if not row: raise HTTPException(404)
    content = await file.read()
    ms_token = await get_ms_token()
    folder = f"HR/Onboarding/{str(row.profile_id)}"
    url = await upload_to_sharepoint(ms_token, f"{doc_type}_{file.filename}", content, folder)
    await db.execute(text("""
        INSERT INTO hr_onboarding_documents (id, proposal_id, document_type, filename, sharepoint_url, uploaded_at)
        VALUES (gen_random_uuid(), CAST(:pid AS UUID), :doc_type, :filename, :url, NOW())
    """), {"pid": str(row.id), "doc_type": doc_type, "filename": file.filename, "url": url})
    await db.commit()
    return {"status": "ok", "sharepoint_url": url}

# ─── Job Descriptions ───────────────────────────────────────────────────────────
@router.get("/jobs")
async def list_jobs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM hr_job_descriptions ORDER BY created_at DESC"))
    jobs = [dict(r._mapping) for r in result.fetchall()]
    for j in jobs:
        j["id"] = str(j["id"])
        for f in ["responsibilities","requirements"]:
            if isinstance(j.get(f), str):
                try: j[f] = json.loads(j[f])
                except: j[f] = []
    return {"jobs": jobs}

@router.post("/jobs")
async def create_job(data: dict, db: AsyncSession = Depends(get_db)):
    job_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO hr_job_descriptions (id, title, department, location, contract_type, status,
            description, responsibilities, requirements, salary_min, salary_max, created_at, updated_at)
        VALUES (CAST(:id AS UUID), :title, :department, :location, :contract_type, :status,
            :description, CAST(:resp AS JSON), CAST(:req AS JSON), :salary_min, :salary_max, NOW(), NOW())
    """), {"id": job_id, "title": data.get("title",""), "department": data.get("department",""),
           "location": data.get("location",""), "contract_type": data.get("contract_type","CDI"),
           "status": data.get("status","open"), "description": data.get("description",""),
           "resp": json.dumps(data.get("responsibilities",[])), "req": json.dumps(data.get("requirements",[])),
           "salary_min": data.get("salary_min"), "salary_max": data.get("salary_max")})
    await db.commit()
    return {"status": "ok", "id": job_id}

@router.put("/jobs/{job_id}")
async def update_job(job_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE hr_job_descriptions SET
            title=COALESCE(:title, title),
            description=COALESCE(:description, description),
            responsibilities=COALESCE(CAST(:resp AS JSON), responsibilities),
            requirements=COALESCE(CAST(:req AS JSON), requirements),
            updated_at=NOW()
        WHERE id=CAST(:id AS UUID)
    """), {
        "id": job_id,
        "title": data.get("title"),
        "description": data.get("description"),
        "resp": json.dumps(data.get("responsibilities")) if data.get("responsibilities") is not None else None,
        "req": json.dumps(data.get("requirements")) if data.get("requirements") is not None else None,
    })
    await db.commit()
    return {"status": "ok"}

@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM hr_job_descriptions WHERE id=CAST(:id AS UUID)"), {"id": job_id})
    await db.commit()
    return {"status": "ok"}

# ─── Country config endpoint ─────────────────────────────────────────────────────
@router.get("/country-config/{country}")
async def get_country_config(country: str):
    cfg = COUNTRY_CONFIG.get(country.lower().replace(" ","_"))
    if not cfg: raise HTTPException(404, "Country not configured")
    return cfg
