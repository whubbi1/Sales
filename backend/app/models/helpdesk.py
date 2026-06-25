# backend/app/models/helpdesk.py
# Simplified model without FK constraints to avoid SQLAlchemy conflicts
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class TicketCategory(Base):
    __tablename__ = "ticket_categories"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String(100), nullable=False)
    description = Column(Text)
    color       = Column(String(7), default='#45B6E4')
    icon        = Column(String(10), default='🎫')
    parent_id   = Column(UUID(as_uuid=True), nullable=True)
    group_id    = Column(UUID(as_uuid=True), nullable=True)
    active      = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

class HelpdeskGroup(Base):
    __tablename__ = "helpdesk_groups"
    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name              = Column(String(100), nullable=False)
    description       = Column(Text)
    responsible_email = Column(String(255))
    responsible_name  = Column(String(255))
    active            = Column(Boolean, default=True)
    created_at        = Column(DateTime, default=datetime.utcnow)

class HelpdeskGroupMember(Base):
    __tablename__ = "helpdesk_group_members"
    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id       = Column(UUID(as_uuid=True), nullable=False)
    user_email     = Column(String(255), nullable=False)
    user_name      = Column(String(255))
    is_responsible = Column(Boolean, default=False)
    created_at     = Column(DateTime, default=datetime.utcnow)

class HelpdeskUser(Base):
    __tablename__ = "helpdesk_users"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_email = Column(String(255), unique=True, nullable=False)
    user_name  = Column(String(255))
    role       = Column(String(20), default='end_user')
    created_at = Column(DateTime, default=datetime.utcnow)

class SLAPolicy(Base):
    __tablename__ = "sla_policies"
    id                    = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name                  = Column(String(100), nullable=False)
    priority              = Column(String(20), nullable=False)
    response_time_hours   = Column(Integer, default=4)
    resolution_time_hours = Column(Integer, default=24)
    active                = Column(Boolean, default=True)
    created_at            = Column(DateTime, default=datetime.utcnow)

class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = {'extend_existing': True}
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_number   = Column(String(20), unique=True)
    title           = Column(String(500), nullable=False)
    description     = Column(Text)
    category_id     = Column(UUID(as_uuid=True), nullable=True)
    subcategory_id  = Column(UUID(as_uuid=True), nullable=True)
    group_id        = Column(UUID(as_uuid=True), nullable=True)
    priority        = Column(SAEnum('critical','high','medium','low', name='ticket_priority', create_type=False), default='medium')
    status          = Column(SAEnum('new','open','in_progress','pending','resolved','closed', name='ticket_status', create_type=False), default='new')
    requester_email = Column(String(255), nullable=False)
    requester_name  = Column(String(255))
    requester_type  = Column(SAEnum('internal','external', name='requester_type', create_type=False), default='internal')
    assignee_email  = Column(String(255))
    assignee_name   = Column(String(255))
    sla_deadline    = Column(DateTime)
    resolution      = Column(Text)
    resolved_at     = Column(DateTime)
    closed_at       = Column(DateTime)
    teams_chat_id   = Column(Text)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TicketComment(Base):
    __tablename__ = "ticket_comments"
    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id    = Column(UUID(as_uuid=True), nullable=False)
    author_email = Column(String(255))
    author_name  = Column(String(255))
    content      = Column(Text, nullable=False)
    is_internal  = Column(Boolean, default=False)
    created_at   = Column(DateTime, default=datetime.utcnow)

class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"
    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title        = Column(String(500), nullable=False)
    content      = Column(Text, nullable=False)
    category     = Column(String(100))
    tags         = Column(String(500))
    author_email = Column(String(255))
    author_name  = Column(String(255))
    views        = Column(Integer, default=0)
    helpful      = Column(Integer, default=0)
    published    = Column(Boolean, default=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TeamsSubscription(Base):
    __tablename__ = "teams_subscriptions"
    __table_args__ = {'extend_existing': True}
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id       = Column(UUID(as_uuid=True))
    chat_id         = Column(Text, unique=True)
    subscription_id = Column(Text)
    expires_at      = Column(DateTime)
    created_at      = Column(DateTime, default=datetime.utcnow)
