import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class CompanyMarketingSetup(Base):
    """Singleton — one shared record describing the company for marketing purposes. Used both
    as a reference page for the team and as grounding context fed into the competitor-suggestion
    prompts in competitor_analysis.py."""
    __tablename__ = "company_marketing_setup"
    id                    = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    description           = Column(Text)
    services              = Column(Text)
    target_countries      = Column(JSONB, default=list)
    target_audience       = Column(Text)
    marketing_objectives  = Column(Text)
    updated_by_email      = Column(String(255))
    updated_at            = Column(DateTime, default=datetime.utcnow)
    created_at            = Column(DateTime, default=datetime.utcnow)


class Competitor(Base):
    __tablename__ = "competitors"
    id                      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name                    = Column(String(255), nullable=False)
    countries               = Column(JSONB, default=list)
    website                 = Column(String(500))
    linkedin_url            = Column(String(500))
    active                  = Column(Boolean, default=True)
    source                  = Column(String(20), default='manual')   # 'manual' | 'ai_suggested'
    linkedin_followers      = Column(Integer)
    employee_count_estimate = Column(String(50))
    services_summary        = Column(Text)
    customer_stories        = Column(Text)
    customers               = Column(JSONB, default=list)
    analysis_notes          = Column(Text)
    last_analyzed_at        = Column(DateTime)
    last_analysis_error     = Column(String(500))
    created_by_email        = Column(String(255))
    created_at              = Column(DateTime, default=datetime.utcnow)
    updated_at              = Column(DateTime, default=datetime.utcnow)
