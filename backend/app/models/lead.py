# backend/app/models/lead.py
# Sales module — a Lead precedes an Opportunity. When its status becomes "Create an
# Opportunity" it auto-creates one (mirroring the Opportunity -> RFP/Project auto-create
# pattern elsewhere in this codebase), carrying over the company/contacts.
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Table
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

# A Lead can involve more than one Partner — plain UUID column (no FK object), same trick
# used throughout this codebase since Partner is a raw-SQL table, not an ORM model.
lead_partner = Table(
    'lead_partners',
    Base.metadata,
    Column('lead_id', UUID(as_uuid=True), ForeignKey('leads.id', ondelete='CASCADE')),
    Column('partner_id', UUID(as_uuid=True)),
)

# Partner-side contacts — a flat list, not mapped to a specific partner (a Lead already
# only usually involves a small number of partners).
lead_partner_contact = Table(
    'lead_partner_contacts',
    Base.metadata,
    Column('lead_id', UUID(as_uuid=True), ForeignKey('leads.id', ondelete='CASCADE')),
    Column('contact_id', UUID(as_uuid=True), ForeignKey('contacts.id', ondelete='CASCADE')),
)


class Lead(Base):
    __tablename__ = "leads"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_number    = Column(String(20), unique=True)
    title          = Column(String(500), nullable=False)
    company_id     = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    # The Company Contact — a Lead's own single main contact, distinct from the
    # partner-side contacts list above.
    contact_id     = Column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)

    start_date     = Column(DateTime)
    end_date       = Column(DateTime)
    origin         = Column(String(255))
    # marketing_events isn't an ORM model (raw-SQL table, see marketing.py) — plain column, no
    # FK object, same trick used for main_operational_team_id below. Relevant when origin='Event'.
    event_id       = Column(UUID(as_uuid=True), nullable=True)
    # The person who made the introduction — relevant when origin='Referral'. Distinct from the
    # Company Contact above and from the partner-side contacts list, since a referral can come
    # from anyone, not just this lead's own company or partner contacts.
    referral_contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    status         = Column(SAEnum(
        'Open', 'In Progress', 'Closed', 'Create an Opportunity',
        name='lead_status_enum'
    ), default='Open')

    # Set once an Opportunity has actually been created from this lead (see
    # POST /leads/{id}/close-with-opportunity) — a lead reaching the "Create an
    # Opportunity" status is only a stage, not itself a trigger.
    opportunity_id = Column(UUID(as_uuid=True), ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True)
    # Stamped the moment status becomes 'Closed'; a closed lead can never be reopened,
    # so this is set exactly once.
    closed_at      = Column(DateTime, nullable=True)

    assigned_to       = Column(String(255))
    assigned_to_email = Column(String(255))

    # legal_org_entities isn't an ORM model (raw-SQL table, see legal.py) — plain columns,
    # no FK object, same trick used for Opportunity.partner_id. FK enforced at the DB level
    # by the ALTER TABLE migration in main.py.
    main_operational_team_id = Column(UUID(as_uuid=True), nullable=True)
    sales_team_id            = Column(UUID(as_uuid=True), nullable=True)

    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company = relationship("Company", foreign_keys=[company_id])
    contact = relationship("Contact", foreign_keys=[contact_id])
    referral_contact = relationship("Contact", foreign_keys=[referral_contact_id])


class LeadActivityLog(Base):
    __tablename__ = "lead_activity_log"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id          = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    field_name       = Column(String(255), nullable=False)
    old_value        = Column(Text)
    new_value        = Column(Text)
    changed_by_email = Column(String(255))
    changed_by_name  = Column(String(255))
    changed_at       = Column(DateTime, default=datetime.utcnow)


class LeadNote(Base):
    __tablename__ = "lead_notes"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id    = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    content    = Column(Text, nullable=False)
    created_by = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LeadFile(Base):
    __tablename__ = "lead_files"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id     = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    title       = Column(String(500), nullable=False)
    url         = Column(String(1000), nullable=False)
    description = Column(Text)
    created_by  = Column(String(255))
    created_at  = Column(DateTime, default=datetime.utcnow)
