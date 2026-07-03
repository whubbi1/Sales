import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base

class UserProfile(Base):
    __tablename__ = "user_profiles"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email           = Column(String(255), unique=True, nullable=False, index=True)
    first_name      = Column(String(100))
    last_name       = Column(String(100))
    display_name    = Column(String(255))
    job_title       = Column(String(255))
    department      = Column(String(255))
    mobile_phone    = Column(String(50))
    office_phone    = Column(String(50))
    manager_email   = Column(String(255))
    manager_name    = Column(String(255))
    photo_url       = Column(Text)  # base64 or URL
    ms_user_id      = Column(String(255))
    ms_licenses     = Column(JSON, default=list)
    ms_groups       = Column(JSON, default=list)
    ms_roles        = Column(JSON, default=list)
    main_location_id   = Column(UUID(as_uuid=True))
    main_location_name = Column(String(255), default="All")
    is_excluded         = Column(Boolean, default=False)
    last_sync       = Column(DateTime)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class WhubbPermission(Base):
    __tablename__ = "whubbi_permissions"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_email  = Column(String(255), nullable=False, index=True)
    module      = Column(String(50), nullable=False)   # sales, finance, hr, grc, it, helpdesk, admin
    submodule   = Column(String(100))                  # companies, contacts, opportunities, cv, etc.
    data_scope     = Column(String(20), default='own')    # own, team, company
    access_mode    = Column(String(20), default='view')   # none, view, edit
    legal_entities = Column(JSONB, default=lambda: ["all"])  # ["all"] or ["france","portugal",...]
    granted_by     = Column(String(255))
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
