import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class MarketingSetup(Base):
    """A marketing setup: description, services, target markets/audience/objectives, scoped to
    one or more real legal entities (legal_entities table, owned by legal.py) — one company can
    have several (e.g. one per region). Same all_entities/entity_ids/entity_names JSONB idiom
    legal.py's legal_templates already uses for this exact kind of assignment, rather than a
    junction table. Also used as grounding context fed into the competitor-suggestion prompts in
    this file."""
    __tablename__ = "marketing_setups"
    id                    = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name                  = Column(String(255), nullable=False)
    description           = Column(Text)
    services              = Column(Text)
    target_countries      = Column(JSONB, default=list)
    target_audience       = Column(Text)
    target_customers      = Column(Text)
    marketing_objectives  = Column(Text)
    all_entities          = Column(Boolean, default=False)
    entity_ids            = Column(JSONB, default=list)   # legal_entities.id values
    entity_names          = Column(JSONB, default=list)   # denormalized display copy
    created_by_email      = Column(String(255))
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
