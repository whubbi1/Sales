# backend/app/models/rfp.py
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, Float, ForeignKey, Table
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base

# Many-to-many: an RFP can cover more than one opportunity (e.g. several lots of the same
# tender), and an opportunity could in principle be referenced from more than one RFP record.
rfp_opportunity = Table(
    'rfp_opportunities',
    Base.metadata,
    Column('rfp_id', UUID(as_uuid=True), ForeignKey('rfps.id', ondelete='CASCADE')),
    Column('opportunity_id', UUID(as_uuid=True), ForeignKey('opportunities.id', ondelete='CASCADE'))
)


class RFP(Base):
    __tablename__ = "rfps"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference   = Column(String(20), unique=True)
    name        = Column(String(500), nullable=False)
    company_id  = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    # Partner isn't an ORM model (raw-SQL table, see partners.py) — plain column, FK enforced at
    # the DB level by an ALTER TABLE migration, same trick used for Contact/Opportunity.partner_id.
    partner_id  = Column(UUID(as_uuid=True), nullable=True)

    owner_email = Column(String(255))
    owner       = Column(String(255))
    approvers   = Column(JSONB, default=list)  # [{email, name}] — mirrors Opportunity.assigned_consultants

    documents_folder_url = Column(Text)

    status      = Column(SAEnum('Open', 'Submitted', 'Won', 'Lost', name='rfp_status_enum'), default='Open')

    ai_summary  = Column(Text)
    key_dates   = Column(JSONB, default=list)  # [{label, date}]

    analysis_status = Column(SAEnum('pending', 'analyzing', 'done', 'failed', name='rfp_analysis_status_enum'), default='pending')
    analysis_error  = Column(Text)

    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company      = relationship("Company", foreign_keys=[company_id])
    opportunities = relationship("Opportunity", secondary=rfp_opportunity)
    action_items  = relationship("RFPActionItem", back_populates="rfp", cascade="all, delete-orphan")
    document_checklist = relationship("RFPDocumentChecklist", back_populates="rfp", cascade="all, delete-orphan")


class RFPActionItem(Base):
    __tablename__ = "rfp_action_items"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfp_id      = Column(UUID(as_uuid=True), ForeignKey("rfps.id", ondelete="CASCADE"), nullable=False)
    description = Column(Text, nullable=False)
    due_date    = Column(DateTime)

    owner_type  = Column(SAEnum('internal', 'external', name='rfp_action_owner_type_enum'))
    owner_email = Column(String(255))
    owner_name  = Column(String(255))
    # Set when owner_type='external' — the RFP's linked contact chosen as owner. Plain column
    # (no FK object) for the same reason partner_id above is plain — keeps this file free of
    # any cross-model mapper-resolution surprises.
    owner_contact_id = Column(UUID(as_uuid=True), nullable=True)
    # The task_manager `tasks.id` created for this item when owner_type='internal', so it can
    # be kept in sync (due date/owner changes) without re-creating it on every edit.
    task_id     = Column(UUID(as_uuid=True), nullable=True)

    status      = Column(SAEnum('pending', 'done', name='rfp_action_status_enum'), default='pending')
    position    = Column(Integer, default=0)

    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    rfp = relationship("RFP", back_populates="action_items")


class RFPDocumentChecklist(Base):
    __tablename__ = "rfp_document_checklist"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfp_id       = Column(UUID(as_uuid=True), ForeignKey("rfps.id", ondelete="CASCADE"), nullable=False)
    name         = Column(String(500), nullable=False)
    template_url = Column(Text)
    answer_url   = Column(Text)
    status       = Column(SAEnum('pending', 'done', name='rfp_document_status_enum'), default='pending')
    position     = Column(Integer, default=0)

    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    rfp = relationship("RFP", back_populates="document_checklist")


# A named role on this RFP (e.g. "Project Manager"), with one assigned wcomply resource.
# A resource can hold more than one role by being assigned to more than one row here.
class RFPStaffingRole(Base):
    __tablename__ = "rfp_staffing_roles"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfp_id         = Column(UUID(as_uuid=True), ForeignKey("rfps.id", ondelete="CASCADE"), nullable=False)
    name           = Column(String(255), nullable=False)
    resource_email = Column(String(255))
    resource_name  = Column(String(255))

    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─── Staffing/Costing Sheet ─────────────────────────────────────────────────────
# A task row, assigned to one Role (which in turn resolves to one wcomply resource). Its
# time allocation lives in RFPStaffingAllocation so the sheet can be viewed/edited by week
# or by month without losing whichever granularity the numbers were actually entered at.
class RFPStaffingTask(Base):
    __tablename__ = "rfp_staffing_tasks"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfp_id         = Column(UUID(as_uuid=True), ForeignKey("rfps.id", ondelete="CASCADE"), nullable=False)
    title          = Column(String(500), nullable=False)
    role_id        = Column(UUID(as_uuid=True), ForeignKey("rfp_staffing_roles.id", ondelete="SET NULL"), nullable=True)
    # Superseded by role_id (kept only so pre-existing rows aren't silently blanked out).
    resource_email = Column(String(255))
    resource_name  = Column(String(255))
    position       = Column(Integer, default=0)

    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    role        = relationship("RFPStaffingRole")
    allocations = relationship("RFPStaffingAllocation", cascade="all, delete-orphan", order_by="RFPStaffingAllocation.period_start")


class RFPStaffingAllocation(Base):
    __tablename__ = "rfp_staffing_allocations"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id      = Column(UUID(as_uuid=True), ForeignKey("rfp_staffing_tasks.id", ondelete="CASCADE"), nullable=False)
    # 'week' periods start on a Monday, 'month' periods start on the 1st — the sheet's
    # week/month toggle only changes which of these it displays/edits, nothing is lost
    # switching back and forth.
    period_start = Column(DateTime, nullable=False)
    period_type  = Column(SAEnum('week', 'month', name='rfp_staffing_period_type_enum'), nullable=False)
    days         = Column(Float, nullable=False, default=0)


# One sales day-rate per resource, scoped to this RFP only (a resource can be priced
# differently on a different RFP).
class RFPStaffingRate(Base):
    __tablename__ = "rfp_staffing_rates"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfp_id         = Column(UUID(as_uuid=True), ForeignKey("rfps.id", ondelete="CASCADE"), nullable=False)
    resource_email = Column(String(255), nullable=False)
    resource_name  = Column(String(255))
    day_rate       = Column(Float, nullable=False, default=0)

    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
