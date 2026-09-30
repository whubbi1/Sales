# backend/app/models/helpdesk.py
# Simplified model without FK constraints to avoid SQLAlchemy conflicts
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean, Float, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base

# Seeded into a project's priority_matrix the first time its SLA settings are read, if
# empty — same P1-P4 example the business gave when asking for this feature.
DEFAULT_PRIORITY_MATRIX = [
    {"priority": "P1 - Critical", "criteria": "Production down, active security breach, many users affected",
     "response_hours": 1, "qualification_hours": 1, "workaround_hours": 4, "resolution_hours": 24, "update_frequency_hours": 2},
    {"priority": "P2 - Major", "criteria": "Important function degraded, no simple alternative",
     "response_hours": 4, "qualification_hours": 4, "workaround_hours": 8, "resolution_hours": 48, "update_frequency_hours": 8},
    {"priority": "P3 - Minor", "criteria": "Limited impact, a workaround exists",
     "response_hours": 8, "qualification_hours": 8, "workaround_hours": 24, "resolution_hours": 120, "update_frequency_hours": 24},
    {"priority": "P4 - Request / enhancement", "criteria": "Role creation, information request, improvement",
     "response_hours": 24, "qualification_hours": 24, "workaround_hours": None, "resolution_hours": 240, "update_frequency_hours": 72},
]

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
    # Optional link to Projects Follow-Up — drives portal visibility scoping and, when the
    # project has SLA settings, its priority-matrix targets instead of the global default.
    project_id      = Column(UUID(as_uuid=True), nullable=True)
    # The Graph message id a ticket was created from by the email-to-ticket poll loop, for
    # idempotency (never set for tickets created through the UI/API).
    source_message_id = Column(String(500), nullable=True)
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

class ProjectSLA(Base):
    """Per-project SLA configuration, set up from Projects Follow-Up's own SLA tab. One
    row per project; a ticket on this project uses its priority_matrix targets instead of
    the global sla_policies default. Everything here is configuration/targets — the
    business-hours-aware clock, auto-escalation, auto-closure, CSAT sending and the
    compliance/FCR/reopen-rate/backlog dashboards are follow-up work, not built yet."""
    __tablename__ = "project_slas"
    project_id  = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)

    # 1 & 2. Timing indicators + priority matrix, combined: one row per priority level with
    # all five "core of the contract" timings for that severity.
    priority_matrix = Column(JSONB, nullable=False, default=lambda: [dict(p) for p in DEFAULT_PRIORITY_MATRIX])

    # 3. Quality indicators — contractual targets, not computed metrics (computing them
    # from actual ticket history is follow-up work).
    sla_compliance_target_pct = Column(Float, nullable=True)
    fcr_target_pct            = Column(Float, nullable=True)
    reopen_rate_target_pct    = Column(Float, nullable=True)
    csat_enabled              = Column(Boolean, nullable=False, default=False)

    # 4. Service availability.
    coverage_hours = Column(String(255), nullable=True)
    channels       = Column(JSONB, nullable=False, default=list)

    # 5. Measurement rules.
    business_hours_only  = Column(Boolean, nullable=False, default=True)
    pause_on_client_wait  = Column(Boolean, nullable=False, default=True)
    auto_closure_days     = Column(Integer, nullable=True, default=5)
    escalation_rules      = Column(JSONB, nullable=False, default=list)
    exclusions            = Column(Text, nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
