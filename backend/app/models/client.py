# backend/app/models/client.py
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base
import enum

class ClientStatus(str, enum.Enum):
    lead = "lead"
    prospect = "prospect"
    client = "client"
    partner = "partner"

class Client(Base):
    __tablename__ = "clients"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_id       = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    level           = Column(Integer, default=1)  # 1=Grand-Parent, 2=Parent, 3=Child, 4=Sub-Child

    name            = Column(String(255), nullable=False)
    company         = Column(String(255), nullable=False)
    domain_names    = Column(JSONB, default=list)
    phone           = Column(String(50))
    sector          = Column(String(255))
    status          = Column(SAEnum(ClientStatus), default=ClientStatus.lead, nullable=False)
    main_erp        = Column(JSONB, default=list)
    cybersecurity_solutions = Column(JSONB, default=list)
    sap_hosting_partner     = Column(JSONB, default=list)
    linkedin_url    = Column(String(500))
    notes           = Column(Text)
    assigned_to     = Column(String(255))

    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    parent   = relationship("Client", remote_side=[id], foreign_keys=[parent_id], backref="children")

class ClientNote(Base):
    __tablename__ = "client_notes"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id  = Column(UUID(as_uuid=True), nullable=False)
    content    = Column(Text, nullable=False)
    created_by = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ClientArticle(Base):
    __tablename__ = "client_articles"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id   = Column(UUID(as_uuid=True), nullable=False)
    title       = Column(String(500), nullable=False)
    url         = Column(String(1000), nullable=False)
    description = Column(Text)
    created_by  = Column(String(255))
    created_at  = Column(DateTime, default=datetime.utcnow)

class ClientTask(Base):
    __tablename__ = "client_tasks"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id   = Column(UUID(as_uuid=True), nullable=False)
    title       = Column(String(500), nullable=False)
    description = Column(Text)
    due_date    = Column(DateTime)
    priority    = Column(SAEnum('low', 'medium', 'high', name='task_priority'), default='medium')
    status      = Column(SAEnum('todo', 'in_progress', 'done', name='task_status'), default='todo')
    assigned_to = Column(String(255))
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
