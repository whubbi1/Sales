# backend/app/models/project.py
# Operations module — a Project is either auto-created from an Opportunity once it reaches
# Contract Won (is_internal=False, opportunity_id set — covering Daily Invoicing/Project
# engagements as well as Software Licenses deals, which use the license_* fields below
# instead of the staffing/expense-tracking fields), or created directly as an Internal
# Project (is_internal=True, no opportunity, its own name/description/dates/partner).
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Float, Boolean, Integer, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_number = Column(String(20), unique=True)
    is_internal    = Column(Boolean, default=False, nullable=False)
    opportunity_id = Column(UUID(as_uuid=True), ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True)
    # Partner isn't an ORM model (raw-SQL table, see partners.py) — plain column, same trick
    # used throughout this codebase (Opportunity.partner_id, RFP.partner_id, etc).
    partner_id     = Column(UUID(as_uuid=True), nullable=True)
    # legal_org_entities isn't an ORM model either — same plain-column trick. Carried over
    # from Opportunity.main_operational_team_id when the project is auto-created from one.
    main_operational_team_id = Column(UUID(as_uuid=True), nullable=True)

    # Editable independently of the linked Opportunity's deal_name.
    project_name   = Column(String(500), nullable=False)
    description    = Column(Text)  # mainly used by internal projects

    # Delivery status — 'Finished' auto-stamps the relevant actual end date (see
    # update_project in projects.py) if it isn't already set.
    status         = Column(String(20), default='New')  # 'New' | 'Planned' | 'In Progress' | 'Finished'
    # Manually-set visual health indicator + completion percentage, shown on the detail
    # page and addable as report columns — independent of `status` above.
    status_color   = Column(String(10))  # 'red' | 'orange' | 'green'
    progress       = Column(Integer)  # 0-100

    # Internal projects only — an Opportunity-linked project's baseline dates are read live
    # from Opportunity.contract_start_date/contract_end_date instead of duplicated here.
    start_date     = Column(DateTime)
    end_date       = Column(DateTime)

    # Revised/actual dates track the plan drifting from (and then landing versus) the
    # original Opportunity contract dates / internal start_date/end_date above.
    revised_start_date = Column(DateTime)
    revised_end_date   = Column(DateTime)
    actual_start_date  = Column(DateTime)
    actual_end_date    = Column(DateTime)

    project_manager_email = Column(String(255))
    project_manager_name  = Column(String(255))
    karanext_reference    = Column(String(255))

    # Drives which sub-form the Invoicing tab shows — defaults from the linked Opportunity's
    # project_status at creation (and via a one-time backfill for pre-existing projects), but
    # is independently editable here since the Opportunity itself is frozen after Contract Won
    # and a project's actual invoicing setup can need correcting afterward. Plain string, not a
    # native enum, per this codebase's convention for fields added post-launch.
    invoicing_type        = Column(String(20))  # 'Daily Invoicing' | 'Project' | 'License'

    # Software Licenses projects only — mirrors the revised/actual start_date/end_date
    # pattern above but for the license term itself, plus how the license is invoiced.
    revised_license_start_date = Column(DateTime)
    revised_license_end_date   = Column(DateTime)
    actual_license_start_date  = Column(DateTime)
    actual_license_end_date    = Column(DateTime)
    # Plain strings, not Postgres enums — these are new fields added post-launch via
    # migration, and native enum types are painful to extend later (see deal_status_enum).
    invoicing_frequency        = Column(String(20))  # 'Monthly' | 'Yearly'
    total_contract_value       = Column(Float)
    invoicing_start            = Column(String(20))  # 'Upfront' | 'Other'
    invoicing_amount_per_unit  = Column(Float)

    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ProjectExpense(Base):
    __tablename__ = "project_expenses"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id   = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    expense_date = Column(DateTime, nullable=False)
    amount       = Column(Float, nullable=False)
    description  = Column(Text)
    created_by   = Column(String(255))
    created_at   = Column(DateTime, default=datetime.utcnow)


# Invoicing tab, Project-type invoicing_type only — each deliverable bills either a fixed
# amount or a percentage of the linked Opportunity's deal_amount, not both.
class ProjectDeliverable(Base):
    __tablename__ = "project_deliverables"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id   = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title        = Column(String(500), nullable=False)
    due_date     = Column(DateTime)
    amount_type  = Column(String(20), nullable=False)  # 'fixed' | 'percentage'
    fixed_amount = Column(Float, nullable=True)
    percentage   = Column(Float, nullable=True)  # 0-100, of the linked Opportunity's deal_amount
    created_by   = Column(String(255))
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ProjectComment(Base):
    __tablename__ = "project_comments"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id   = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    author_email = Column(String(255), nullable=False)
    author_name  = Column(String(255))
    comment      = Column(Text, nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow)


class ProjectDocument(Base):
    __tablename__ = "project_documents"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id  = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    # 'sales' = pre-contract docs (proposals, contracts, RFP answers); 'project' = delivery
    # artifacts produced during execution.
    category    = Column(SAEnum('sales', 'project', name='project_document_category_enum'), nullable=False)
    title       = Column(String(500), nullable=False)
    url         = Column(String(1000), nullable=False)
    description = Column(Text)
    created_by  = Column(String(255))
    created_at  = Column(DateTime, default=datetime.utcnow)


class ProjectActivityLog(Base):
    __tablename__ = "project_activity_log"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id       = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    field_name       = Column(String(255), nullable=False)
    old_value        = Column(Text)
    new_value        = Column(Text)
    changed_by_email = Column(String(255))
    changed_by_name  = Column(String(255))
    changed_at       = Column(DateTime, default=datetime.utcnow)


# A named role on this project's staffing plan (e.g. "Project Manager"), with one assigned
# resource. Scoped per plan_type — Initial and Current keep independent role sets, same as
# they keep independent task sets, so the frozen Initial baseline never shifts underneath
# Current's edits. A resource can hold more than one role via more than one row here.
class ProjectStaffingRole(Base):
    __tablename__ = "project_staffing_roles"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id     = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    plan_type      = Column(SAEnum('initial', 'current', name='project_staffing_plan_type_enum'), nullable=False)
    name           = Column(String(255), nullable=False)
    resource_email = Column(String(255))
    resource_name  = Column(String(255))
    # Daily Invoicing only — set from the Invoicing tab, multiplied by this role's total
    # allocated days (summed across its tasks) to compute expected revenue.
    daily_rate     = Column(Float, nullable=True)

    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─── Staffing plan — Initial (frozen baseline, copied once from the RFP Staffing/Costing
# Sheet or created blank) + Current (freely editable from here on) ─────────────────────
class ProjectStaffingTask(Base):
    __tablename__ = "project_staffing_tasks"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id     = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    plan_type      = Column(SAEnum('initial', 'current', name='project_staffing_plan_type_enum'), nullable=False)
    title          = Column(String(500), nullable=False)
    role_id        = Column(UUID(as_uuid=True), ForeignKey("project_staffing_roles.id", ondelete="SET NULL"), nullable=True)
    # Superseded by role_id (kept only so pre-existing rows aren't silently blanked out).
    resource_email = Column(String(255))
    resource_name  = Column(String(255))
    position       = Column(Integer, default=0)

    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    role        = relationship("ProjectStaffingRole")
    allocations = relationship("ProjectStaffingAllocation", cascade="all, delete-orphan", order_by="ProjectStaffingAllocation.period_start")


class ProjectStaffingAllocation(Base):
    __tablename__ = "project_staffing_allocations"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id      = Column(UUID(as_uuid=True), ForeignKey("project_staffing_tasks.id", ondelete="CASCADE"), nullable=False)
    period_start = Column(DateTime, nullable=False)
    period_type  = Column(SAEnum('week', 'month', name='project_staffing_period_type_enum'), nullable=False)
    days         = Column(Float, nullable=False, default=0)
