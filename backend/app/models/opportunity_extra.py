# backend/app/models/opportunity_extra.py
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class OpportunityStaffing(Base):
    __tablename__ = "opportunity_staffing"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    opportunity_id = Column(UUID(as_uuid=True), ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False)
    user_email     = Column(String(255), nullable=False)
    user_name      = Column(String(255))
    role           = Column(String(255))
    created_at     = Column(DateTime, default=datetime.utcnow)

class OpportunityChecklistItem(Base):
    __tablename__ = "opportunity_checklist_items"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    opportunity_id = Column(UUID(as_uuid=True), ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False)
    text           = Column(Text, nullable=False)
    is_checked     = Column(Boolean, default=False)
    position       = Column(Integer, default=0)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class OpportunityComment(Base):
    __tablename__ = "opportunity_comments"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    opportunity_id = Column(UUID(as_uuid=True), ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False)
    author_email   = Column(String(255), nullable=False)
    author_name    = Column(String(255))
    comment        = Column(Text, nullable=False)
    created_at     = Column(DateTime, default=datetime.utcnow)

class SalesTask(Base):
    __tablename__ = "sales_tasks"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title            = Column(String(255), nullable=False)
    description      = Column(Text)
    due_date         = Column(DateTime)
    owner_email      = Column(String(255))
    owner_name       = Column(String(255))
    status           = Column(SAEnum('todo', 'in_progress', 'done', name='sales_task_status'), default='todo')
    entity_type      = Column(SAEnum('company', 'contact', 'opportunity', name='sales_task_entity_type'), nullable=False)
    entity_id        = Column(UUID(as_uuid=True), nullable=False)
    sync_to_outlook  = Column(Boolean, default=False)
    outlook_task_id  = Column(String(255))
    created_by_email = Column(String(255))
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
