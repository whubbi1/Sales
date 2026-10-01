# backend/app/models/project_management.py
# Operations > Project Management — the delivery-management extension of Projects Follow-Up.
# Every table hangs off an existing Project (same list as Projects Follow-Up), so nothing
# here duplicates Project's own fields; it only adds the governance layer on top: members
# and their per-section access, planning, meetings (AI-generated minutes + validation),
# and the action / risk / decision registers those meetings feed.
#
# Table names are prefixed pm_ — project_deliverables already exists for the Invoicing
# tab's billing milestones, which are unrelated to the documentary deliverables here.
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


# Sections a member can be granted access to — keys of PMMember.permissions, and the
# section names used by the router's access checks.
PM_SECTIONS = ["basic_info", "members", "planning", "meetings", "deliverables", "tasks", "actions", "risks", "decisions"]

DEFAULT_ACTION_STATUSES = ["Open", "In Progress", "Solved", "On Hold"]
DEFAULT_LEVELS = [
    {"level": "Low", "description": ""},
    {"level": "Medium", "description": ""},
    {"level": "High", "description": ""},
]
TEMPLATE_TYPES = ["project_status_report", "meeting_minutes", "action_list", "risk_register", "decision_list", "member_list", "deliverable_list", "presentation", "other"]

# The 5 register types that get a bulk-Excel import (upload/preview/apply) and a
# downloadable template — project-specific (PMTemplate, above) or, absent one, generated
# on demand (see PMDefaultTemplate / write_template_xlsx in services/excel_import.py).
IMPORT_REGISTERS = ["actions", "risks", "decisions", "members", "deliverables"]
PHASE_MAX_DEPTH = 10  # top-level phase = depth 1, so up to 9 nested sub-phase levels below it


class PMSettings(Base):
    __tablename__ = "pm_settings"

    project_id        = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    sharepoint_url    = Column(String(1000))
    customer_logo_ref = Column(String(1000))  # s3://… reference, presigned on read
    # Added on top of DEFAULT_ACTION_STATUSES, never replacing them — the four defaults are
    # what the spec guarantees every action list has.
    extra_action_statuses = Column(JSONB, nullable=False, default=list)
    impact_levels      = Column(JSONB, nullable=False, default=lambda: [dict(l) for l in DEFAULT_LEVELS])
    probability_levels = Column(JSONB, nullable=False, default=lambda: [dict(l) for l in DEFAULT_LEVELS])
    meeting_types      = Column(JSONB, nullable=False, default=lambda: ["Kick-off", "Steering Committee", "Weekly Status", "Workshop"])
    # Last number issued per register prefix ({"A": 12, "R": 3, …}) — incremented under a
    # row lock, so numbers stay unique and are never reused after a deletion.
    counters          = Column(JSONB, nullable=False, default=dict)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PMTemplate(Base):
    __tablename__ = "pm_templates"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id    = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    template_type = Column(String(40), nullable=False)  # one of TEMPLATE_TYPES
    name          = Column(String(255), nullable=False)
    file_ref      = Column(String(1000), nullable=False)
    filename      = Column(String(255))
    content_type  = Column(String(255))
    uploaded_by   = Column(String(255))
    created_at    = Column(DateTime, default=datetime.utcnow)


class PMDefaultTemplate(Base):
    """Global (not per-project) admin-uploaded override of a standard register template —
    Operations > Project Defaults. Absent a row here, the standard template is generated
    on the fly by write_template_xlsx() instead."""
    __tablename__ = "pm_default_templates"

    template_type = Column(String(40), primary_key=True)  # one of TEMPLATE_TYPES (the 5 register ones)
    name          = Column(String(255), nullable=False)
    file_ref      = Column(String(1000), nullable=False)
    filename      = Column(String(255))
    content_type  = Column(String(255))
    uploaded_by   = Column(String(255))
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PMMember(Base):
    __tablename__ = "pm_members"
    __table_args__ = (UniqueConstraint("project_id", "email", name="uq_pm_member_email"),)

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id   = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    # Optional link to the CRM contact this member was picked/created from — name/email/phone
    # above are still the source of truth for this project (copied in, not derived live).
    contact_id   = Column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    name         = Column(String(255), nullable=False)
    email        = Column(String(255), nullable=False)  # stored lower-cased; matched against X-User-Email
    phone        = Column(String(50))
    project_role = Column(String(255))
    company_role = Column(String(255))
    # {section: 'none' | 'view' | 'edit'} for each of PM_SECTIONS; a missing key means 'none'.
    permissions  = Column(JSONB, nullable=False, default=dict)
    created_at   = Column(DateTime, default=datetime.utcnow)


class PMPhase(Base):
    __tablename__ = "pm_phases"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id  = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    parent_id   = Column(UUID(as_uuid=True), ForeignKey("pm_phases.id", ondelete="CASCADE"), nullable=True)
    name        = Column(String(500), nullable=False)
    description = Column(Text)
    owner       = Column(String(255))
    start_date  = Column(DateTime)
    end_date    = Column(DateTime)
    progress    = Column(Integer, default=0)  # 0-100
    position    = Column(Integer, default=0)
    created_at  = Column(DateTime, default=datetime.utcnow)


class PMTask(Base):
    __tablename__ = "pm_tasks"
    __table_args__ = (UniqueConstraint("project_id", "number", name="uq_pm_task_number"),)

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id  = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    number      = Column(String(20), nullable=False)
    title       = Column(String(500), nullable=False)
    description = Column(Text)
    phase_id    = Column(UUID(as_uuid=True), ForeignKey("pm_phases.id", ondelete="SET NULL"), nullable=True)
    assignee    = Column(String(255))
    start_date  = Column(DateTime)
    due_date    = Column(DateTime)
    status      = Column(String(40), default="To Do")  # 'To Do' | 'In Progress' | 'Done' | 'Blocked'
    progress    = Column(Integer, default=0)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PMMeeting(Base):
    __tablename__ = "pm_meetings"
    __table_args__ = (UniqueConstraint("project_id", "number", name="uq_pm_meeting_number"),)

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id   = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    number       = Column(String(20), nullable=False)
    meeting_type = Column(String(255))
    title        = Column(String(500), nullable=False)
    meeting_date = Column(DateTime)
    duration_minutes = Column(Integer, nullable=False, default=60)  # no separate end-time field
    location     = Column(String(500))
    attendees    = Column(JSONB, nullable=False, default=list)  # [{name, email}]

    # Set once "Create Teams meeting" has run — organizer_email is whichever internal user's
    # connected Outlook account (outlook_connections) created it, used by transcript_sync_loop
    # to know whose token to refresh when polling for this meeting's transcript.
    organizer_email  = Column(String(255))
    outlook_event_id = Column(String(255))
    teams_join_url   = Column(String(1000))
    online_meeting_id = Column(String(255))
    transcript_synced_at = Column(DateTime)

    transcript_ref      = Column(String(1000))
    transcript_filename = Column(String(255))
    transcript_text     = Column(Text)

    minutes  = Column(Text)
    # Reviewable draft of what this meeting changes in the registers, produced by the AI and
    # then edited by the uploader: {actions: [...], decisions: [...], risks: [...]}. Each item
    # carries existing_id (update that register entry) or null (create one). Only applied to
    # the registers on validation — see _finalize_meeting in the router.
    proposal = Column(JSONB, nullable=False, default=lambda: {"actions": [], "decisions": [], "risks": []})
    # 'draft' → 'generated' (AI ran) → 'in_review' (validation requested) → 'validated'
    status       = Column(String(20), nullable=False, default="draft")
    created_by   = Column(String(255))
    validated_at = Column(DateTime)
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    validations = relationship("PMMeetingValidation", cascade="all, delete-orphan", order_by="PMMeetingValidation.requested_at", lazy="selectin")


class PMMeetingValidation(Base):
    __tablename__ = "pm_meeting_validations"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id      = Column(UUID(as_uuid=True), ForeignKey("pm_meetings.id", ondelete="CASCADE"), nullable=False)
    validator_email = Column(String(255), nullable=False)
    validator_name  = Column(String(255))
    status          = Column(String(20), nullable=False, default="pending")  # 'pending' | 'approved' | 'rejected'
    comment         = Column(Text)
    requested_at    = Column(DateTime, default=datetime.utcnow)
    decided_at      = Column(DateTime)


class PMAction(Base):
    __tablename__ = "pm_actions"
    __table_args__ = (UniqueConstraint("project_id", "number", name="uq_pm_action_number"),)

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id   = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    number       = Column(String(20), nullable=False)
    title        = Column(String(500), nullable=False)
    description  = Column(Text)
    comment      = Column(Text)
    owner        = Column(String(255))
    status       = Column(String(40), nullable=False, default="Open")
    opening_date = Column(DateTime, default=datetime.utcnow)
    due_date     = Column(DateTime)
    closing_date = Column(DateTime)
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PMRisk(Base):
    __tablename__ = "pm_risks"
    __table_args__ = (UniqueConstraint("project_id", "number", name="uq_pm_risk_number"),)

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id  = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    number      = Column(String(20), nullable=False)
    title       = Column(String(500), nullable=False)
    description = Column(Text)
    mitigation  = Column(Text)
    owner       = Column(String(255))
    impact      = Column(String(40), default="Medium")       # a level from PMSettings.impact_levels
    probability = Column(String(40), default="Medium")       # a level from PMSettings.probability_levels
    status      = Column(String(20), nullable=False, default="Open")  # 'Open' | 'Closed'
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PMDecision(Base):
    __tablename__ = "pm_decisions"
    __table_args__ = (UniqueConstraint("project_id", "number", name="uq_pm_decision_number"),)

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id      = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    number          = Column(String(20), nullable=False)
    decision_date   = Column(DateTime)
    title           = Column(String(500), nullable=False)
    description     = Column(Text)
    decision_makers = Column(JSONB, nullable=False, default=list)  # [name, ...]
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Many-to-many between meetings and register items. item_id is polymorphic over
# pm_actions / pm_risks / pm_decisions (per item_type), so the router removes an item's
# links when it deletes the item; meeting deletion cascades here through the FK.
class PMMeetingLink(Base):
    __tablename__ = "pm_meeting_links"
    __table_args__ = (UniqueConstraint("meeting_id", "item_type", "item_id", name="uq_pm_meeting_link"),)

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("pm_meetings.id", ondelete="CASCADE"), nullable=False)
    item_type  = Column(String(20), nullable=False)  # 'action' | 'risk' | 'decision'
    item_id    = Column(UUID(as_uuid=True), nullable=False)


class PMDeliverable(Base):
    __tablename__ = "pm_deliverables"
    __table_args__ = (UniqueConstraint("project_id", "number", name="uq_pm_deliverable_number"),)

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id   = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    number       = Column(String(20), nullable=False)
    name         = Column(String(500), nullable=False)
    description  = Column(Text)
    owner        = Column(JSONB)                           # {name, email}
    approvers    = Column(JSONB, nullable=False, default=list)  # [{name, email}]
    contributors = Column(JSONB, nullable=False, default=list)  # [{name, email}]
    # Link to the latest version of the document — set by hand, and also moved forward
    # automatically whenever a version is approved.
    document_url = Column(String(1000))
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    versions = relationship("PMDeliverableVersion", cascade="all, delete-orphan", order_by="PMDeliverableVersion.created_at", lazy="selectin")


class PMDeliverableVersion(Base):
    __tablename__ = "pm_deliverable_versions"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deliverable_id = Column(UUID(as_uuid=True), ForeignKey("pm_deliverables.id", ondelete="CASCADE"), nullable=False)
    version_label  = Column(String(50), nullable=False)
    due_date       = Column(DateTime)
    document_url   = Column(String(1000))
    notes          = Column(Text)
    status         = Column(String(20), nullable=False, default="draft")  # 'draft' | 'in_approval' | 'approved' | 'rejected'
    submitted_at   = Column(DateTime)
    approved_at    = Column(DateTime)
    created_at     = Column(DateTime, default=datetime.utcnow)

    approvals = relationship("PMDeliverableApproval", cascade="all, delete-orphan", order_by="PMDeliverableApproval.requested_at", lazy="selectin")


class PMDeliverableApproval(Base):
    __tablename__ = "pm_deliverable_approvals"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version_id     = Column(UUID(as_uuid=True), ForeignKey("pm_deliverable_versions.id", ondelete="CASCADE"), nullable=False)
    approver_email = Column(String(255), nullable=False)
    approver_name  = Column(String(255))
    decision       = Column(String(20), nullable=False, default="pending")  # 'pending' | 'approved' | 'rejected'
    comment        = Column(Text)
    requested_at   = Column(DateTime, default=datetime.utcnow)
    decided_at     = Column(DateTime)
