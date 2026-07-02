# backend/app/schemas/schemas.py
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# ─── Company ──────────────────────────────────────────────────────────────────
class CompanyBase(BaseModel):
    name: str
    contact_name: Optional[str] = None
    parent_id: Optional[UUID] = None
    level: Optional[int] = 1
    domain_names: Optional[List[str]] = []
    phone: Optional[str] = None
    sector: Optional[str] = None
    country: Optional[str] = None
    status: Optional[str] = "lead"
    main_erp: Optional[List[str]] = []
    cybersecurity_solutions: Optional[List[str]] = []
    sap_hosting_partner: Optional[List[str]] = []
    linkedin_url: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(CompanyBase):
    name: Optional[str] = None

class CompanySummary(BaseModel):
    id: UUID
    name: str
    status: str
    level: int
    class Config:
        from_attributes = True

class CompanyResponse(CompanyBase):
    id: UUID
    parent: Optional[CompanySummary] = None
    children: Optional[List[CompanySummary]] = []
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# ─── Company Sub-resources ────────────────────────────────────────────────────
class NoteCreate(BaseModel):
    content: str
    created_by: Optional[str] = None

class NoteResponse(NoteCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class ArticleCreate(BaseModel):
    title: str
    url: str
    description: Optional[str] = None
    created_by: Optional[str] = None

class ArticleResponse(ArticleCreate):
    id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[str] = "medium"
    status: Optional[str] = "todo"
    assigned_to: Optional[str] = None

class TaskUpdate(TaskCreate):
    title: Optional[str] = None

class TaskResponse(TaskCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# ─── Contact ──────────────────────────────────────────────────────────────────
class ContactBase(BaseModel):
    first_name: str
    last_name: str
    company_id: Optional[UUID] = None
    email: Optional[str] = None
    mobile_phone: Optional[str] = None
    office_phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    job_name: Optional[str] = None
    job_type: Optional[str] = None
    lead_status: Optional[str] = "New"
    preferred_language: Optional[str] = None
    subscriptions: Optional[List[str]] = []
    assigned_to: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("job_type", "lead_status", mode="before")
    @classmethod
    def _blank_enum_to_none(cls, v):
        # job_type/lead_status map to Postgres enum columns that reject '' —
        # the frontend sends '' for "no selection" instead of omitting the field.
        return v or None

class ContactCreate(ContactBase):
    pass

class ContactUpdate(ContactBase):
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class ContactSummary(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    job_type: Optional[str] = None
    email: Optional[str] = None
    lead_status: Optional[str] = None
    class Config:
        from_attributes = True

class ContactResponse(ContactBase):
    id: UUID
    company: Optional[CompanySummary] = None
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# ─── Opportunity ──────────────────────────────────────────────────────────────
class OpportunityBase(BaseModel):
    deal_name: str
    company_id: Optional[UUID] = None
    deal_id: Optional[str] = None
    project_name: Optional[str] = None
    deal_amount: Optional[float] = None
    closing_date: Optional[datetime] = None
    deal_status: Optional[str] = "Presentation To Be Scheduled"
    assigned_consultants: Optional[List[str]] = []
    contract_start_date: Optional[datetime] = None
    contract_end_date: Optional[datetime] = None
    project_status: Optional[str] = None
    contracting_party: Optional[str] = None
    deal_type: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None

class OpportunityCreate(OpportunityBase):
    contact_ids: Optional[List[UUID]] = []

class OpportunityUpdate(OpportunityBase):
    deal_name: Optional[str] = None
    contact_ids: Optional[List[UUID]] = []

class OpportunitySummary(BaseModel):
    id: UUID
    deal_name: str
    deal_status: Optional[str] = None
    deal_amount: Optional[float] = None
    closing_date: Optional[datetime] = None
    class Config:
        from_attributes = True

class OpportunityResponse(OpportunityBase):
    id: UUID
    company: Optional[CompanySummary] = None
    contacts: Optional[List[ContactSummary]] = []
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True
