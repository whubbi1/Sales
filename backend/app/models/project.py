# backend/app/models/project.py
# Operations module — a Project is either auto-created from an Opportunity once it reaches
# Contract Ongoing/Finalised with project type Daily Invoicing/Project (is_internal=False,
# opportunity_id set), or created directly as an Internal Project (is_internal=True, no
# opportunity, its own name/description/dates/partner).
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

    # Editable independently of the linked Opportunity's deal_name.
    project_name   = Column(String(500), nullable=False)
    description    = Column(Text)  # mainly used by internal projects

    # Internal projects only — an Opportunity-linked project's dates are read live from
    # Opportunity.contract_start_date/contract_end_date instead of duplicated here.
    start_date     = Column(DateTime)
    end_date       = Column(DateTime)

    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


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
