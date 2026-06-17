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
    parent_id       = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    level           = Column(Integer, default=1)

    name            = Column(String(255), nullable=False)  # company name
    contact_name    = Column(String(255))                   # main contact
    domain_names    = Column(JSONB, default=list)
    phone           = Column(String(50))
    sector          = Column(String(255))
    country         = Column(String(100))
    status          = Column(SAEnum(CompanyStatus), default=CompanyStatus.lead, nullable=False)
    main_erp        = Column(JSONB, default=list)
    cybersecurity_solutions = Column(JSONB, default=list)
    sap_hosting_partner     = Column(JSONB, default=list)
    linkedin_url    = Column(String(500))
    notes           = Column(Text)
    assigned_to     = Column(String(255))

    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    parent   = relationship("Company", remote_side=[id], foreign_keys=[parent_id], backref="children")
    contacts = relationship("Contact", back_populates="company", cascade="all, delete-orphan")

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
    company_id  = Column(UUID(as_uuid=True), nullable=False)
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
