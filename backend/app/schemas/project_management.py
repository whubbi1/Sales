# backend/app/schemas/project_management.py — request/response shapes for
# app/routers/project_management.py (Operations > Project Management).
from datetime import datetime
from typing import Optional, List, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class _ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Person(BaseModel):
    name: str
    email: Optional[str] = None


class LevelDef(BaseModel):
    level: str
    description: Optional[str] = ""


# ─── Basic information ───────────────────────────────────────────────────────
class SettingsUpdate(BaseModel):
    sharepoint_url: Optional[str] = None
    extra_action_statuses: Optional[List[str]] = None
    impact_levels: Optional[List[LevelDef]] = None
    probability_levels: Optional[List[LevelDef]] = None
    meeting_types: Optional[List[str]] = None


class SettingsResponse(BaseModel):
    project_id: UUID
    sharepoint_url: Optional[str] = None
    customer_logo_url: Optional[str] = None
    has_custom_logo: bool = False        # False when customer_logo_url is inherited from the linked company
    action_statuses: List[str]           # defaults + extras, in display order
    extra_action_statuses: List[str]
    impact_levels: List[LevelDef]
    probability_levels: List[LevelDef]
    meeting_types: List[str]


class TemplateResponse(_ORM):
    id: UUID
    template_type: str
    name: str
    filename: Optional[str] = None
    uploaded_by: Optional[str] = None
    created_at: datetime


# ─── Members ─────────────────────────────────────────────────────────────────
Access = Literal["none", "view", "edit"]


class MemberIn(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    project_role: Optional[str] = None
    company_role: Optional[str] = None
    contact_id: Optional[UUID] = None
    permissions: dict[str, Access] = Field(default_factory=dict)


class MemberResponse(_ORM):
    id: UUID
    name: str
    email: str
    phone: Optional[str] = None
    project_role: Optional[str] = None
    company_role: Optional[str] = None
    contact_id: Optional[UUID] = None
    permissions: dict


# ─── Planning ────────────────────────────────────────────────────────────────
class PhaseIn(BaseModel):
    parent_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    owner: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    progress: Optional[int] = Field(default=0, ge=0, le=100)
    position: Optional[int] = 0


class PhaseResponse(_ORM):
    id: UUID
    parent_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    owner: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    progress: Optional[int] = None
    position: Optional[int] = None


# ─── Tasks ───────────────────────────────────────────────────────────────────
class TaskIn(BaseModel):
    title: str
    description: Optional[str] = None
    phase_id: Optional[UUID] = None
    assignee: Optional[str] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = "To Do"
    progress: Optional[int] = Field(default=0, ge=0, le=100)


class TaskResponse(_ORM):
    id: UUID
    number: str
    title: str
    description: Optional[str] = None
    phase_id: Optional[UUID] = None
    assignee: Optional[str] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None
    progress: Optional[int] = None


# ─── Registers (actions / risks / decisions) ─────────────────────────────────
class ActionIn(BaseModel):
    title: str
    description: Optional[str] = None
    comment: Optional[str] = None
    owner: Optional[str] = None
    status: str = "Open"
    opening_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    closing_date: Optional[datetime] = None
    meeting_ids: List[UUID] = Field(default_factory=list)


class ActionResponse(_ORM):
    id: UUID
    number: str
    title: str
    description: Optional[str] = None
    comment: Optional[str] = None
    owner: Optional[str] = None
    status: str
    opening_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    closing_date: Optional[datetime] = None
    meeting_ids: List[UUID] = []


class RiskIn(BaseModel):
    title: str
    description: Optional[str] = None
    mitigation: Optional[str] = None
    owner: Optional[str] = None
    impact: str = "Medium"
    probability: str = "Medium"
    status: Literal["Open", "Closed"] = "Open"
    meeting_ids: List[UUID] = Field(default_factory=list)


class RiskResponse(_ORM):
    id: UUID
    number: str
    title: str
    description: Optional[str] = None
    mitigation: Optional[str] = None
    owner: Optional[str] = None
    impact: Optional[str] = None
    probability: Optional[str] = None
    status: str
    meeting_ids: List[UUID] = []


class DecisionIn(BaseModel):
    title: str
    description: Optional[str] = None
    decision_date: Optional[datetime] = None
    decision_makers: List[str] = Field(default_factory=list)
    meeting_ids: List[UUID] = Field(default_factory=list)


class DecisionResponse(_ORM):
    id: UUID
    number: str
    title: str
    description: Optional[str] = None
    decision_date: Optional[datetime] = None
    decision_makers: List[str] = []
    meeting_ids: List[UUID] = []


# ─── Meetings ────────────────────────────────────────────────────────────────
class MeetingIn(BaseModel):
    meeting_type: Optional[str] = None
    title: str
    meeting_date: Optional[datetime] = None
    duration_minutes: int = 60
    location: Optional[str] = None
    attendees: List[Person] = Field(default_factory=list)


# Proposed register changes, as generated by the AI and edited by the reviewer.
# existing_id set → update that register entry; null → create a new one.
class ProposedAction(BaseModel):
    existing_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    owner: Optional[str] = None
    due_date: Optional[str] = None  # YYYY-MM-DD
    status: Optional[str] = None
    comment: Optional[str] = None
    applied_id: Optional[UUID] = None


class ProposedDecision(BaseModel):
    existing_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    decision_makers: List[str] = Field(default_factory=list)
    applied_id: Optional[UUID] = None


class ProposedRisk(BaseModel):
    existing_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    mitigation: Optional[str] = None
    impact: Optional[str] = None
    probability: Optional[str] = None
    status: Optional[str] = None
    applied_id: Optional[UUID] = None


class Proposal(BaseModel):
    actions: List[ProposedAction] = Field(default_factory=list)
    decisions: List[ProposedDecision] = Field(default_factory=list)
    risks: List[ProposedRisk] = Field(default_factory=list)


class MeetingReview(BaseModel):
    minutes: str
    proposal: Proposal


class ValidationRequest(BaseModel):
    validators: List[Person]


class ValidationDecision(BaseModel):
    approve: bool
    comment: Optional[str] = None


class ValidationResponse(_ORM):
    id: UUID
    validator_email: str
    validator_name: Optional[str] = None
    status: str
    comment: Optional[str] = None
    requested_at: Optional[datetime] = None
    decided_at: Optional[datetime] = None


class MeetingSummary(_ORM):
    id: UUID
    number: str
    meeting_type: Optional[str] = None
    title: str
    meeting_date: Optional[datetime] = None
    status: str


class MeetingResponse(MeetingSummary):
    location: Optional[str] = None
    duration_minutes: int = 60
    attendees: List[Person] = []
    organizer_email: Optional[str] = None
    teams_join_url: Optional[str] = None
    transcript_filename: Optional[str] = None
    has_transcript: bool = False
    minutes: Optional[str] = None
    proposal: Proposal
    created_by: Optional[str] = None
    validated_at: Optional[datetime] = None
    validations: List[ValidationResponse] = []


# ─── Deliverables ────────────────────────────────────────────────────────────
class DeliverableIn(BaseModel):
    name: str
    description: Optional[str] = None
    owner: Optional[Person] = None
    approvers: List[Person] = Field(default_factory=list)
    contributors: List[Person] = Field(default_factory=list)
    document_url: Optional[str] = None


class VersionIn(BaseModel):
    version_label: str
    due_date: Optional[datetime] = None
    document_url: Optional[str] = None
    notes: Optional[str] = None


class ApprovalResponse(_ORM):
    id: UUID
    approver_email: str
    approver_name: Optional[str] = None
    decision: str
    comment: Optional[str] = None
    requested_at: Optional[datetime] = None
    decided_at: Optional[datetime] = None


class VersionResponse(_ORM):
    id: UUID
    version_label: str
    due_date: Optional[datetime] = None
    document_url: Optional[str] = None
    notes: Optional[str] = None
    status: str
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    approvals: List[ApprovalResponse] = []


class DeliverableResponse(_ORM):
    id: UUID
    number: str
    name: str
    description: Optional[str] = None
    owner: Optional[Person] = None
    approvers: List[Person] = []
    contributors: List[Person] = []
    document_url: Optional[str] = None
    versions: List[VersionResponse] = []


class AccessResponse(BaseModel):
    is_manager: bool
    sections: dict[str, Access]
