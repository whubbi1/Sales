# backend/app/models/company.py
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base
import enum

class CompanyStatus(str, enum.Enum):
    lead = "lead"
    prospect = "prospect"
    client = "client"
    partner = "partner"

class Company(Base):
    __tablename__ = "companies"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    internal_id     = Column(String(20), unique=True)
    parent_id       = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    level           = Column(Integer, default=1)

    name            = Column(String(255), nullable=False)  # company name
    contact_name    = Column(String(255))                   # legacy free-text main contact, superseded by main_contact_id
    # Main contact is a real Contact record — plain FK, no relationship() (Contact already has its
    # own company_id FK the other way; avoids a backref-naming collision on the same pair of tables).
    main_contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    domain_names    = Column(JSONB, default=list)
    phone           = Column(String(50))
    sector          = Column(String(255))
    country         = Column(String(100))
    status          = Column(SAEnum(CompanyStatus), default=CompanyStatus.lead, nullable=False)
    main_erp        = Column(JSONB, default=list)
    cybersecurity_solutions = Column(JSONB, default=list)
    grc_solutions           = Column(JSONB, default=list)
    sap_hosting_partner     = Column(JSONB, default=list)
    # Services tab — which project types we've provided, keyed by Opportunity Type,
    # e.g. {"SAP": ["Project", "Daily Invoicing"]}. Manually toggled, independent of
    # the actual Opportunity records (those only drive the "Contract Finalised" list
    # shown underneath each toggle).
    services_provided       = Column(JSONB, default=dict)
    logo_url        = Column(Text)  # s3://bucket/key ref, resolved to a presigned URL on read
    linkedin_url    = Column(String(500))
    notes           = Column(Text)
    assigned_to     = Column(String(255))                   # display name of the assigned wcomply employee
    assigned_to_email = Column(String(255))

    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    parent   = relationship("Company", remote_side=[id], foreign_keys=[parent_id], backref="children")
    contacts = relationship("Contact", back_populates="company", foreign_keys="Contact.company_id", cascade="all, delete-orphan")

class CompanyNote(Base):
    __tablename__ = "company_notes"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False)
    content    = Column(Text, nullable=False)
    created_by = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CompanyArticle(Base):
    __tablename__ = "company_articles"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # An article is anchored to whichever of these it was created under — nullable so a
    # Contact-created article doesn't need a Company (loosened from company_id NOT NULL via
    # migration in main.py; existing rows are unaffected).
    company_id  = Column(UUID(as_uuid=True), nullable=True)
    contact_id  = Column(UUID(as_uuid=True), nullable=True)
    title       = Column(String(500), nullable=False)
    url         = Column(String(1000), nullable=False)
    description = Column(Text)
    created_by  = Column(String(255))
    created_at  = Column(DateTime, default=datetime.utcnow)

class CompanyTask(Base):
    __tablename__ = "company_tasks"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id  = Column(UUID(as_uuid=True), nullable=False)
    title       = Column(String(500), nullable=False)
    description = Column(Text)
    due_date    = Column(DateTime)
    priority    = Column(SAEnum('low', 'medium', 'high', name='company_task_priority'), default='medium')
    status      = Column(SAEnum('todo', 'in_progress', 'done', name='company_task_status'), default='todo')
    assigned_to = Column(String(255))
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
