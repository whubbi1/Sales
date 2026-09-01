import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class InfluenceSource(Base):
    __tablename__ = "influence_sources"
    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name              = Column(String(255), nullable=False)
    description       = Column(Text)
    language          = Column(String(50))                   # free text, e.g. 'English' — same convention as marketing_email_templates.language
    source_type       = Column(String(20), nullable=False)   # 'url' | 'file'
    subtype           = Column(String(20))                   # 'website' | 'blog' | 'linkedin' | 'other' (url sources only)
    url               = Column(String(1000))
    file_url          = Column(String(500))                  # s3 ref
    file_name         = Column(String(255))
    check_frequency   = Column(String(20), default='manual')  # 'manual' | 'daily' | 'weekly'
    active            = Column(Boolean, default=True)
    last_checked_at   = Column(DateTime)
    last_summary      = Column(Text)
    last_error        = Column(String(500))
    created_by_email  = Column(String(255))
    created_at        = Column(DateTime, default=datetime.utcnow)
    updated_at        = Column(DateTime, default=datetime.utcnow)


class InfluenceSourceUpdate(Base):
    __tablename__ = "influence_source_updates"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id   = Column(UUID(as_uuid=True), nullable=False)
    checked_at  = Column(DateTime, default=datetime.utcnow)
    summary     = Column(Text)


class SocialPost(Base):
    __tablename__ = "social_posts"
    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    platform          = Column(String(20), nullable=False)   # 'linkedin' | 'twitter'
    topic             = Column(Text)
    content           = Column(Text, nullable=False)
    status            = Column(String(20), default='draft')  # 'draft' | 'approved' | 'posted' (posted = marked by a person, not auto-published — see social_influence.py header)
    source_ids        = Column(JSONB, default=list)
    created_by_email  = Column(String(255))
    created_at        = Column(DateTime, default=datetime.utcnow)
    updated_at        = Column(DateTime, default=datetime.utcnow)
