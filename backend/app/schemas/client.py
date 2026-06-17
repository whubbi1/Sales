# backend/app/schemas/client.py
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from enum import Enum

class ClientStatus(str, Enum):
    lead = "lead"
    prospect = "prospect"
    client = "client"
    partner = "partner"

ERP_OPTIONS      = ["SAP", "Dynamics", "IFS", "Infor", "Odoo", "Oracle", "JDE", "SAGE", "Unknown", "Other"]
CYBER_OPTIONS    = ["SAP ETD", "SAP GRC", "SAP Focused Run", "Cloud ALM", "SecurityBridge", "Onapsis", "Layer Seven Security", "Other"]
HOSTING_OPTIONS  = ["RISE", "AWS", "Azure", "GXP", "BLUE", "SENS", "Scaleway", "Private Datacenter", "Other"]

# ─── Client ───────────────────────────────────────────────────────────────────
class ClientBase(BaseModel):
    name: str
    company: str
    parent_id: Optional[UUID] = None
    level: Optional[int] = 1
    domain_names: Optional[List[str]] = []
    phone: Optional[str] = None
    sector: Optional[str] = None
    status: ClientStatus = ClientStatus.lead
    main_erp: Optional[List[str]] = []
    cybersecurity_solutions: Optional[List[str]] = []
    sap_hosting_partner: Optional[List[str]] = []
    linkedin_url: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(ClientBase):
    name: Optional[str] = None
    company: Optional[str] = None

class ClientSummary(BaseModel):
    id: UUID
    company: str
    name: str
    status: ClientStatus
    level: int
    class Config:
        from_attributes = True

class ClientResponse(ClientBase):
    id: UUID
    parent: Optional[ClientSummary] = None
    children: Optional[List[ClientSummary]] = []
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# ─── Note ─────────────────────────────────────────────────────────────────────
class NoteCreate(BaseModel):
    content: str
    created_by: Optional[str] = None

class NoteResponse(NoteCreate):
    id: UUID
    client_id: UUID
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# ─── Article ──────────────────────────────────────────────────────────────────
class ArticleCreate(BaseModel):
    title: str
    url: str
    description: Optional[str] = None
    created_by: Optional[str] = None

class ArticleResponse(ArticleCreate):
    id: UUID
    client_id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

# ─── Task ─────────────────────────────────────────────────────────────────────
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
    client_id: UUID
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True
