# backend/app/models/contact.py
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Table
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base

# Many-to-many: contacts <-> opportunities
contact_opportunity = Table(
    'contact_opportunity',
    Base.metadata,
    Column('contact_id', UUID(as_uuid=True), ForeignKey('contacts.id', ondelete='CASCADE')),
    Column('opportunity_id', UUID(as_uuid=True), ForeignKey('opportunities.id', ondelete='CASCADE'))
)

class Contact(Base):
    __tablename__ = "contacts"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    internal_id     = Column(String(20), unique=True)
    company_id      = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    # Partner isn't an ORM model (raw-SQL table, see partners.py) — plain column, FK enforced at the DB
    # level by the ALTER TABLE migration in main.py, not declared here to avoid mapper-resolution issues.
    partner_id      = Column(UUID(as_uuid=True), nullable=True)

    # Where this contact/lead originated. When not 'LinkedIn', ref_type/ref_id point at the
    # specific record (marketing_events / projects / partners) — plain column, no FK object,
    # since it's polymorphic across three different tables (same reasoning as partner_id above).
    data_source          = Column(String(20), default='LinkedIn')
    data_source_ref_type = Column(String(20), nullable=True)
    data_source_ref_id   = Column(UUID(as_uuid=True), nullable=True)

    first_name      = Column(String(255), nullable=False)
    last_name       = Column(String(255), nullable=False)
    email           = Column(String(255))
    mobile_phone    = Column(String(50))
    office_phone    = Column(String(50))
    linkedin_url    = Column(String(500))
    job_name        = Column(String(255))
    job_type        = Column(SAEnum(
        'CIO', 'CTO', 'CISO', 'SAP Manager', 'SAP Architect', 'SAP GRC',
        'SAP Security Manager', 'SAP Technical Manager', 'Cybersecurity Architect',
        'SOC Manager', 'Internal Audit', 'CFO', 'Partner', 'Buyer', 'Other',
        name='contact_job_type'
    ))
    lead_status     = Column(SAEnum('New', 'Open', 'Connected', name='contact_lead_status'), default='New')
    preferred_language = Column(String(100))
    subscriptions   = Column(JSONB, default=list)  # ["Marketing Information", "Customer Service Communication", "One to One"]

    assigned_to     = Column(String(255))
    assigned_to_email = Column(String(255))
    notes           = Column(Text)

    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company      = relationship("Company", back_populates="contacts", foreign_keys=[company_id])
    opportunities = relationship("Opportunity", secondary=contact_opportunity, back_populates="contacts")

class ContactNote(Base):
    __tablename__ = "contact_notes"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contact_id = Column(UUID(as_uuid=True), nullable=False)
    content    = Column(Text, nullable=False)
    created_by = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ContactTask(Base):
    __tablename__ = "contact_tasks"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contact_id  = Column(UUID(as_uuid=True), nullable=False)
    title       = Column(String(500), nullable=False)
    description = Column(Text)
    due_date    = Column(DateTime)
    priority    = Column(SAEnum('low', 'medium', 'high', name='contact_task_priority'), default='medium')
    status      = Column(SAEnum('todo', 'in_progress', 'done', name='contact_task_status'), default='todo')
    assigned_to = Column(String(255))
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
