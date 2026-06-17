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
    company_id      = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)

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
    notes           = Column(Text)

    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company      = relationship("Company", back_populates="contacts")
    opportunities = relationship("Opportunity", secondary=contact_opportunity, back_populates="contacts")
