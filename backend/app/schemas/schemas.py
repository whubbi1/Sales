# backend/app/schemas/schemas.py
from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

# ─── Contact (summary only — full ContactBase/Response defined further down,
# but Company needs this early for its main_contact embed) ─────────────────────
class ContactSummary(BaseModel):
    id: UUID
    internal_id: Optional[str] = None
    first_name: str
    last_name: str
    job_type: Optional[str] = None
    email: Optional[str] = None
    lead_status: Optional[str] = None
    class Config:
        from_attributes = True

# ─── Company ──────────────────────────────────────────────────────────────────
class CompanyBase(BaseModel):
    name: str
    contact_name: Optional[str] = None
    main_contact_id: Optional[UUID] = None
    parent_id: Optional[UUID] = None
    level: Optional[int] = 1
    domain_names: Optional[List[str]] = []
    phone: Optional[str] = None
    sector: Optional[str] = None
    country: Optional[str] = None
    status: Optional[str] = "lead"
    main_erp: Optional[List[str]] = []
    cybersecurity_solutions: Optional[List[str]] = []
    grc_solutions: Optional[List[str]] = []
    sap_hosting_partner: Optional[List[str]] = []
    services_provided: Optional[Dict[str, List[str]]] = {}
    logo_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    employee_count: Optional[int] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_email: Optional[str] = None

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(CompanyBase):
    name: Optional[str] = None

class CompanySummary(BaseModel):
    id: UUID
    internal_id: Optional[str] = None
    name: str
    status: str
    level: int
    class Config:
        from_attributes = True

class CompanyResponse(CompanyBase):
    id: UUID
    internal_id: Optional[str] = None
    parent: Optional[CompanySummary] = None
    children: Optional[List[CompanySummary]] = []
    main_contact: Optional[ContactSummary] = None
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
    link_date: Optional[datetime] = None
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

# ─── Partner (summary only — Partner itself is a raw-SQL entity, see routers/partners.py) ──
class PartnerSummary(BaseModel):
    id: UUID
    internal_id: Optional[str] = None
    name: str
    status: Optional[str] = None
    class Config:
        from_attributes = True

# Legal module's Operational Teams / Sales Entities (legal_org_entities, category
# discriminator) — attached to Lead/Opportunity responses the same way PartnerSummary is.
class OrgEntitySummary(BaseModel):
    id: UUID
    code: str
    title: str
    class Config:
        from_attributes = True

# ─── Marketing Event (summary only — Event itself is a raw-SQL entity, see routers/marketing.py) ──
class EventSummary(BaseModel):
    id: UUID
    title: str
    event_date: Optional[datetime] = None
    status: Optional[str] = None
    class Config:
        from_attributes = True

# ─── Lead (summary only — full LeadResponse defined further down) ─────────────
class LeadSummary(BaseModel):
    id: UUID
    lead_number: Optional[str] = None
    title: str
    origin: Optional[str] = None
    class Config:
        from_attributes = True

# ─── Contact ──────────────────────────────────────────────────────────────────
class ContactBase(BaseModel):
    first_name: str
    last_name: str
    company_id: Optional[UUID] = None
    partner_id: Optional[UUID] = None
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
    assigned_to_email: Optional[str] = None
    notes: Optional[str] = None
    data_source: Optional[str] = "LinkedIn"
    data_source_ref_type: Optional[str] = None
    data_source_ref_id: Optional[UUID] = None

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

class ContactResponse(ContactBase):
    id: UUID
    internal_id: Optional[str] = None
    company: Optional[CompanySummary] = None
    partner: Optional[PartnerSummary] = None
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# ─── Opportunity ──────────────────────────────────────────────────────────────
class ConsultantEntry(BaseModel):
    email: str
    name: Optional[str] = None

class OpportunityBase(BaseModel):
    # deal_name is server-generated (see compute_deal_name in app/services/ids.py) — always
    # recomputed from company/partner/project/closing_date on create and update, so it's not
    # meaningfully settable by the client. Optional here purely so callers don't need to send it.
    deal_name: Optional[str] = None
    company_id: Optional[UUID] = None
    partner_id: Optional[UUID] = None
    contracting_party_id: Optional[UUID] = None
    contracting_party_partner_id: Optional[UUID] = None
    main_operational_team_id: Optional[UUID] = None
    sales_team_id: Optional[UUID] = None
    # Set automatically when converted from a Lead (see close_lead_with_opportunity), or left
    # unset for an Opportunity created directly.
    lead_id: Optional[UUID] = None
    # Carried over from the source Lead's referral_contact_id when converting, or set directly
    # here when there's no source Lead.
    referral_contact_id: Optional[UUID] = None
    # deal_id is server-generated on create (see next_internal_id) and never changes after —
    # kept here as Optional/ignored-on-write so responses can still round-trip it.
    deal_id: Optional[str] = None
    project_name: Optional[str] = None
    deal_amount: Optional[float] = None
    closing_date: Optional[datetime] = None
    deal_status: Optional[str] = "Presentation To Be Scheduled"
    assigned_consultants: Optional[List[ConsultantEntry]] = []
    contract_start_date: Optional[datetime] = None
    contract_end_date: Optional[datetime] = None
    project_status: Optional[str] = None
    contracting_party: Optional[str] = None
    deal_type: Optional[str] = None
    invoice_days: Optional[float] = None
    daily_rate: Optional[float] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_email: Optional[str] = None
    sharepoint_site_url: Optional[str] = None

class OpportunityCreate(OpportunityBase):
    contact_ids: Optional[List[UUID]] = []

class OpportunityUpdate(OpportunityBase):
    contact_ids: Optional[List[UUID]] = []

class OpportunitySummary(BaseModel):
    id: UUID
    deal_id: Optional[str] = None
    deal_name: str
    deal_status: Optional[str] = None
    deal_amount: Optional[float] = None
    closing_date: Optional[datetime] = None
    contract_start_date: Optional[datetime] = None
    contract_end_date: Optional[datetime] = None
    # Lets a linked Project tell a Software Licenses deal apart from a regular delivery
    # engagement, to decide which set of Project-only fields to show.
    project_status: Optional[str] = None
    # Surfaced so RFP's linked-opportunities list can be filtered by team on the RFP page —
    # an RFP has no team fields of its own (it links to Opportunities many-to-many).
    main_operational_team: Optional[OrgEntitySummary] = None
    sales_team: Optional[OrgEntitySummary] = None
    class Config:
        from_attributes = True

class OpportunityResponse(OpportunityBase):
    id: UUID
    company: Optional[CompanySummary] = None
    partner: Optional[PartnerSummary] = None
    contracting_party_company: Optional[CompanySummary] = None
    contracting_party_partner: Optional[PartnerSummary] = None
    main_operational_team: Optional[OrgEntitySummary] = None
    sales_team: Optional[OrgEntitySummary] = None
    lead: Optional[LeadSummary] = None
    referral_contact: Optional[ContactSummary] = None
    contacts: Optional[List[ContactSummary]] = []
    created_at: datetime
    updated_at: datetime
    # Only set (transiently, not a real column) on the single create/update response where this
    # request just auto-created a new RFP for this opportunity — tells the frontend to redirect.
    rfp_id: Optional[UUID] = None
    class Config:
        from_attributes = True

# ─── Opportunity Staffing ───────────────────────────────────────────────────────
class StaffingCreate(BaseModel):
    user_email: str
    user_name: Optional[str] = None
    role: Optional[str] = None

class StaffingMonth(BaseModel):
    month: datetime
    days: float

class StaffingResponse(StaffingCreate):
    id: UUID
    opportunity_id: UUID
    created_at: datetime
    months: Optional[List[StaffingMonth]] = []
    class Config:
        from_attributes = True

class StaffingMonthsUpdate(BaseModel):
    months: List[StaffingMonth]

# ─── Opportunity Checklist ──────────────────────────────────────────────────────
class ChecklistItemCreate(BaseModel):
    text: str
    position: Optional[int] = 0

class ChecklistItemUpdate(BaseModel):
    text: Optional[str] = None
    is_checked: Optional[bool] = None
    position: Optional[int] = None

class ChecklistItemResponse(BaseModel):
    id: UUID
    opportunity_id: UUID
    text: str
    is_checked: bool
    position: int
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# ─── Opportunity Comments ───────────────────────────────────────────────────────
class CommentCreate(BaseModel):
    author_email: str
    author_name: Optional[str] = None
    comment: str

class CommentResponse(CommentCreate):
    id: UUID
    opportunity_id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

# ─── Sales Tasks (generic — company / contact / opportunity) ──────────────────
class SalesTaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    owner_email: Optional[str] = None
    owner_name: Optional[str] = None
    status: Optional[str] = "todo"
    entity_type: str
    entity_id: UUID
    sync_to_outlook: Optional[bool] = False

    @field_validator("status", mode="before")
    @classmethod
    def _blank_to_none(cls, v):
        return v or "todo"

class SalesTaskCreate(SalesTaskBase):
    created_by_email: Optional[str] = None

class SalesTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    owner_email: Optional[str] = None
    owner_name: Optional[str] = None
    status: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    sync_to_outlook: Optional[bool] = None
    outlook_task_id: Optional[str] = None

class SalesTaskResponse(SalesTaskBase):
    id: UUID
    created_by_email: Optional[str] = None
    outlook_task_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# ─── RFP ────────────────────────────────────────────────────────────────────────
class RFPBase(BaseModel):
    name: str
    company_id: Optional[UUID] = None
    partner_id: Optional[UUID] = None
    owner_email: Optional[str] = None
    owner: Optional[str] = None
    approvers: Optional[List[ConsultantEntry]] = []  # reuses Opportunity's {email, name} shape
    documents_folder_url: Optional[str] = None
    status: Optional[str] = "Open"

class RFPCreate(RFPBase):
    opportunity_ids: Optional[List[UUID]] = []

class RFPUpdate(BaseModel):
    name: Optional[str] = None
    company_id: Optional[UUID] = None
    partner_id: Optional[UUID] = None
    owner_email: Optional[str] = None
    owner: Optional[str] = None
    approvers: Optional[List[ConsultantEntry]] = None
    documents_folder_url: Optional[str] = None
    status: Optional[str] = None

class RFPResponse(RFPBase):
    id: UUID
    reference: Optional[str] = None
    ai_summary: Optional[str] = None
    key_dates: Optional[List[dict]] = []
    analysis_status: Optional[str] = "pending"
    analysis_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    company: Optional[CompanySummary] = None
    partner: Optional[PartnerSummary] = None
    opportunities: Optional[List[OpportunitySummary]] = []
    class Config:
        from_attributes = True

class RFPSummary(BaseModel):
    id: UUID
    name: str
    status: Optional[str] = None
    class Config:
        from_attributes = True

class RFPCommentCreate(BaseModel):
    author_email: str
    author_name: Optional[str] = None
    comment: str

class RFPCommentResponse(RFPCommentCreate):
    id: UUID
    rfp_id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class RFPActionItemCreate(BaseModel):
    description: str
    due_date: Optional[datetime] = None
    owner_type: Optional[str] = None
    owner_email: Optional[str] = None
    owner_name: Optional[str] = None
    owner_contact_id: Optional[UUID] = None
    position: Optional[int] = 0

class RFPActionItemUpdate(BaseModel):
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    owner_type: Optional[str] = None
    owner_email: Optional[str] = None
    owner_name: Optional[str] = None
    owner_contact_id: Optional[UUID] = None
    status: Optional[str] = None
    position: Optional[int] = None

class RFPActionItemResponse(BaseModel):
    id: UUID
    rfp_id: UUID
    description: str
    due_date: Optional[datetime] = None
    owner_type: Optional[str] = None
    owner_email: Optional[str] = None
    owner_name: Optional[str] = None
    owner_contact_id: Optional[UUID] = None
    task_id: Optional[UUID] = None
    status: str
    position: int
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class RFPDocumentChecklistCreate(BaseModel):
    name: str
    template_url: Optional[str] = None
    answer_url: Optional[str] = None
    position: Optional[int] = 0

class RFPDocumentChecklistUpdate(BaseModel):
    name: Optional[str] = None
    template_url: Optional[str] = None
    answer_url: Optional[str] = None
    status: Optional[str] = None
    position: Optional[int] = None

class RFPDocumentChecklistResponse(BaseModel):
    id: UUID
    rfp_id: UUID
    name: str
    template_url: Optional[str] = None
    answer_url: Optional[str] = None
    status: str
    position: int
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# ─── RFP Staffing/Costing Sheet ─────────────────────────────────────────────────
class RFPStaffingAllocationIn(BaseModel):
    period_start: datetime
    period_type: str
    days: float

class RFPStaffingAllocationResponse(RFPStaffingAllocationIn):
    id: UUID
    class Config:
        from_attributes = True

class RFPStaffingRoleCreate(BaseModel):
    name: str
    resource_email: Optional[str] = None
    resource_name: Optional[str] = None

class RFPStaffingRoleUpdate(BaseModel):
    name: Optional[str] = None
    resource_email: Optional[str] = None
    resource_name: Optional[str] = None

class RFPStaffingRoleResponse(RFPStaffingRoleCreate):
    id: UUID
    rfp_id: UUID
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class RFPStaffingTaskCreate(BaseModel):
    title: str
    role_id: Optional[UUID] = None
    position: Optional[int] = 0

class RFPStaffingTaskUpdate(BaseModel):
    title: Optional[str] = None
    role_id: Optional[UUID] = None
    position: Optional[int] = None

class RFPStaffingTaskResponse(RFPStaffingTaskCreate):
    id: UUID
    rfp_id: UUID
    created_at: datetime
    updated_at: datetime
    role: Optional[RFPStaffingRoleResponse] = None
    allocations: Optional[List[RFPStaffingAllocationResponse]] = []
    class Config:
        from_attributes = True

class RFPStaffingAllocationsSet(BaseModel):
    allocations: List[RFPStaffingAllocationIn]

class RFPStaffingRateCreate(BaseModel):
    resource_email: str
    resource_name: Optional[str] = None
    day_rate: float

class RFPStaffingRateResponse(RFPStaffingRateCreate):
    id: UUID
    rfp_id: UUID
    class Config:
        from_attributes = True

# ─── Projects (Operations module) ───────────────────────────────────────────────
class ProjectCreate(BaseModel):
    project_name: str
    is_internal: Optional[bool] = False
    opportunity_id: Optional[UUID] = None
    partner_id: Optional[UUID] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class ProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    partner_id: Optional[UUID] = None
    main_operational_team_id: Optional[UUID] = None
    description: Optional[str] = None
    status: Optional[str] = None
    status_color: Optional[str] = None
    progress: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    revised_start_date: Optional[datetime] = None
    revised_end_date: Optional[datetime] = None
    actual_start_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    project_manager_email: Optional[str] = None
    project_manager_name: Optional[str] = None
    karanext_reference: Optional[str] = None
    revised_license_start_date: Optional[datetime] = None
    revised_license_end_date: Optional[datetime] = None
    actual_license_start_date: Optional[datetime] = None
    actual_license_end_date: Optional[datetime] = None
    invoicing_frequency: Optional[str] = None
    total_contract_value: Optional[float] = None
    invoicing_start: Optional[str] = None
    invoicing_amount_per_unit: Optional[float] = None
    invoicing_type: Optional[str] = None
    expected_revenue: Optional[float] = None
    # Attributed to the activity log entries this update produces, not persisted on the row.
    changed_by_email: Optional[str] = None
    changed_by_name: Optional[str] = None

    @field_validator("invoicing_frequency", "invoicing_start", "invoicing_type", "status", "status_color", mode="before")
    @classmethod
    def _blank_enum_to_none(cls, v):
        # These map to Postgres enum columns that reject '' — the frontend sends '' for
        # "no selection" instead of omitting the field.
        return v or None

class ProjectResponse(BaseModel):
    id: UUID
    project_number: Optional[str] = None
    is_internal: bool
    opportunity_id: Optional[UUID] = None
    partner_id: Optional[UUID] = None
    project_name: str
    description: Optional[str] = None
    main_operational_team_id: Optional[UUID] = None
    status: Optional[str] = None
    status_color: Optional[str] = None
    progress: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    revised_start_date: Optional[datetime] = None
    revised_end_date: Optional[datetime] = None
    actual_start_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    project_manager_email: Optional[str] = None
    project_manager_name: Optional[str] = None
    karanext_reference: Optional[str] = None
    revised_license_start_date: Optional[datetime] = None
    revised_license_end_date: Optional[datetime] = None
    actual_license_start_date: Optional[datetime] = None
    actual_license_end_date: Optional[datetime] = None
    invoicing_frequency: Optional[str] = None
    total_contract_value: Optional[float] = None
    invoicing_start: Optional[str] = None
    invoicing_amount_per_unit: Optional[float] = None
    invoicing_type: Optional[str] = None
    expected_revenue: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    opportunity: Optional[OpportunitySummary] = None
    company: Optional[CompanySummary] = None
    partner: Optional[PartnerSummary] = None
    main_operational_team: Optional[OrgEntitySummary] = None
    # Computed, not a stored column — 'extended' if the linked Opportunity has an RFP or this
    # project already has manually-entered Extended (roles/tasks) data, 'basic' otherwise.
    # Drives which Staffing sub-UI the frontend shows (see _attach_related in projects.py).
    staffing_mode: Optional[str] = None
    class Config:
        from_attributes = True

class ProjectCommentCreate(BaseModel):
    author_email: str
    author_name: Optional[str] = None
    comment: str

class ProjectCommentResponse(ProjectCommentCreate):
    id: UUID
    project_id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class ProjectDocumentCreate(BaseModel):
    category: str
    title: str
    url: str
    description: Optional[str] = None
    created_by: Optional[str] = None

class ProjectDocumentResponse(ProjectDocumentCreate):
    id: UUID
    project_id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class ProjectExpenseCreate(BaseModel):
    expense_date: datetime
    amount: float
    description: Optional[str] = None
    created_by: Optional[str] = None

class ProjectExpenseResponse(ProjectExpenseCreate):
    id: UUID
    project_id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class ProjectDeliverableCreate(BaseModel):
    title: str
    due_date: Optional[datetime] = None
    amount_type: str  # 'fixed' | 'percentage'
    fixed_amount: Optional[float] = None
    percentage: Optional[float] = None
    created_by: Optional[str] = None

class ProjectDeliverableUpdate(BaseModel):
    title: Optional[str] = None
    due_date: Optional[datetime] = None
    amount_type: Optional[str] = None
    fixed_amount: Optional[float] = None
    percentage: Optional[float] = None

class ProjectDeliverableResponse(ProjectDeliverableCreate):
    id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class ProjectActivityLogResponse(BaseModel):
    id: UUID
    project_id: UUID
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by_email: Optional[str] = None
    changed_by_name: Optional[str] = None
    changed_at: datetime
    class Config:
        from_attributes = True

class ProjectStaffingRoleCreate(BaseModel):
    plan_type: str
    name: str
    resource_email: Optional[str] = None
    resource_name: Optional[str] = None
    daily_rate: Optional[float] = None

class ProjectStaffingRoleUpdate(BaseModel):
    name: Optional[str] = None
    resource_email: Optional[str] = None
    resource_name: Optional[str] = None
    daily_rate: Optional[float] = None

class ProjectStaffingRoleResponse(ProjectStaffingRoleCreate):
    id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class ProjectStaffingTaskCreate(BaseModel):
    plan_type: str
    title: str
    role_id: Optional[UUID] = None
    position: Optional[int] = 0

class ProjectStaffingTaskUpdate(BaseModel):
    title: Optional[str] = None
    role_id: Optional[UUID] = None
    position: Optional[int] = None

class ProjectStaffingAllocationIn(BaseModel):
    period_start: datetime
    period_type: str
    days: float

class ProjectStaffingAllocationResponse(ProjectStaffingAllocationIn):
    id: UUID
    class Config:
        from_attributes = True

class ProjectStaffingTaskResponse(ProjectStaffingTaskCreate):
    id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime
    role: Optional[ProjectStaffingRoleResponse] = None
    allocations: Optional[List[ProjectStaffingAllocationResponse]] = []
    class Config:
        from_attributes = True

class ProjectStaffingAllocationsSet(BaseModel):
    allocations: List[ProjectStaffingAllocationIn]

# ─── Basic staffing (mirrors StaffingCreate/StaffingResponse/StaffingMonthsUpdate above,
# but scoped to Project instead of Opportunity) ─────────────────────────────────
class ProjectStaffingBasicCreate(BaseModel):
    user_email: str
    user_name: Optional[str] = None
    role: Optional[str] = None

class ProjectStaffingBasicResponse(ProjectStaffingBasicCreate):
    id: UUID
    project_id: UUID
    created_at: datetime
    months: Optional[List[StaffingMonth]] = []
    class Config:
        from_attributes = True

class ProjectStaffingBasicMonthsUpdate(BaseModel):
    months: List[StaffingMonth]

# ─── Timesheets ─────────────────────────────────────────────────────────────────
class TimesheetEntryCreate(BaseModel):
    user_email: str
    user_name: Optional[str] = None
    project_id: UUID
    entry_date: datetime
    unit: str = 'days'
    amount: float
    description: Optional[str] = None

class TimesheetEntryUpdate(BaseModel):
    entry_date: Optional[datetime] = None
    unit: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None

class TimesheetEntryResponse(TimesheetEntryCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# ─── Leads (Sales module) ───────────────────────────────────────────────────────
class LeadCreate(BaseModel):
    title: str
    company_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None
    partner_ids: Optional[List[UUID]] = []
    partner_contact_ids: Optional[List[UUID]] = []
    main_operational_team_id: Optional[UUID] = None
    sales_team_id: Optional[UUID] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    origin: Optional[str] = None
    event_id: Optional[UUID] = None
    referral_contact_id: Optional[UUID] = None
    status: Optional[str] = 'Open'
    assigned_to: Optional[str] = None
    assigned_to_email: Optional[str] = None

class LeadUpdate(BaseModel):
    title: Optional[str] = None
    company_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None
    partner_ids: Optional[List[UUID]] = None
    partner_contact_ids: Optional[List[UUID]] = None
    main_operational_team_id: Optional[UUID] = None
    sales_team_id: Optional[UUID] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    origin: Optional[str] = None
    event_id: Optional[UUID] = None
    referral_contact_id: Optional[UUID] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_email: Optional[str] = None
    # Attributed to the activity log entries this update produces, not persisted on the row.
    changed_by_email: Optional[str] = None
    changed_by_name: Optional[str] = None

class LeadResponse(BaseModel):
    id: UUID
    lead_number: Optional[str] = None
    title: str
    company_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None
    main_operational_team_id: Optional[UUID] = None
    sales_team_id: Optional[UUID] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    origin: Optional[str] = None
    event_id: Optional[UUID] = None
    referral_contact_id: Optional[UUID] = None
    status: str
    opportunity_id: Optional[UUID] = None
    closed_at: Optional[datetime] = None
    assigned_to: Optional[str] = None
    assigned_to_email: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    company: Optional[CompanySummary] = None
    contact: Optional[ContactSummary] = None
    partners: Optional[List[PartnerSummary]] = []
    partner_contacts: Optional[List[ContactSummary]] = []
    main_operational_team: Optional[OrgEntitySummary] = None
    sales_team: Optional[OrgEntitySummary] = None
    event: Optional[EventSummary] = None
    referral_contact: Optional[ContactSummary] = None
    class Config:
        from_attributes = True

class LeadActivityLogResponse(BaseModel):
    id: UUID
    lead_id: UUID
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by_email: Optional[str] = None
    changed_by_name: Optional[str] = None
    changed_at: datetime
    class Config:
        from_attributes = True

class LeadNoteCreate(BaseModel):
    content: str
    created_by: Optional[str] = None

class LeadNoteResponse(LeadNoteCreate):
    id: UUID
    lead_id: UUID
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class LeadFileCreate(BaseModel):
    title: str
    url: str
    description: Optional[str] = None
    created_by: Optional[str] = None

class LeadFileResponse(LeadFileCreate):
    id: UUID
    lead_id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class LeadCloseWithOpportunity(BaseModel):
    opportunity_id: UUID
    changed_by_email: Optional[str] = None
    changed_by_name: Optional[str] = None

# ─── Reporting & Analytics ──────────────────────────────────────────────────────
class ReportSpecFilter(BaseModel):
    column: str
    operator: str
    value: Optional[Any] = None

class ReportSpecAggregate(BaseModel):
    column: str
    function: str

class ReportSpecSort(BaseModel):
    column: str
    dir: Optional[str] = 'asc'

class ReportSpec(BaseModel):
    entity: str
    columns: Optional[List[str]] = []
    filters: Optional[List[ReportSpecFilter]] = []
    group_by: Optional[List[str]] = []
    aggregates: Optional[List[ReportSpecAggregate]] = []
    sort: Optional[ReportSpecSort] = None
    chart_type: Optional[str] = 'table'
    limit: Optional[int] = 500

class SavedReportCreate(BaseModel):
    name: str
    owner_email: str
    spec: ReportSpec
    chart_type: Optional[str] = 'table'
    shared_with: Optional[List[str]] = []

class SavedReportUpdate(BaseModel):
    name: Optional[str] = None
    spec: Optional[ReportSpec] = None
    chart_type: Optional[str] = None
    shared_with: Optional[List[str]] = None

class SavedReportResponse(BaseModel):
    id: UUID
    name: str
    owner_email: str
    spec: dict
    chart_type: str
    shared_with: List[str] = []
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class SavedDashboardCreate(BaseModel):
    name: str
    owner_email: str
    report_ids: Optional[List[UUID]] = []
    shared_with: Optional[List[str]] = []

class SavedDashboardUpdate(BaseModel):
    name: Optional[str] = None
    report_ids: Optional[List[UUID]] = None
    shared_with: Optional[List[str]] = None

class SavedDashboardResponse(BaseModel):
    id: UUID
    name: str
    owner_email: str
    report_ids: List[str] = []
    shared_with: List[str] = []
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class AIReportDraftRequest(BaseModel):
    prompt: str
