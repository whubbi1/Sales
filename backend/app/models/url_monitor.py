import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Float
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class MonitoredURL(Base):
    __tablename__ = "monitored_urls"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name       = Column(String(255), nullable=False)
    url        = Column(String(1000), nullable=False)
    active     = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class HealthCheck(Base):
    __tablename__ = "health_checks"
    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    url_id        = Column(UUID(as_uuid=True), nullable=True)
    url           = Column(String(1000))
    name          = Column(String(255))
    status        = Column(String(20))
    status_code   = Column(Integer, nullable=True)
    response_time = Column(Float, nullable=True)
    error         = Column(String(500), nullable=True)
    checked_at    = Column(DateTime, default=datetime.utcnow)
