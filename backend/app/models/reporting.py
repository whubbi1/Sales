# backend/app/models/reporting.py
# Reporting & Analytics module — a saved Report is a validated query spec (see
# app/services/reporting_registry.py + reporting_query.py) plus how to chart it; a saved
# Dashboard is an ordered set of Reports. Both can be shared with specific other users.
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class SavedReport(Base):
    __tablename__ = "saved_reports"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name         = Column(String(255), nullable=False)
    owner_email  = Column(String(255), nullable=False)
    spec         = Column(JSONB, nullable=False)
    chart_type   = Column(String(20), default='table')
    # List of user emails this report is shared with, or ["*"] for everyone.
    shared_with  = Column(JSONB, default=list)

    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SavedDashboard(Base):
    __tablename__ = "saved_dashboards"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name         = Column(String(255), nullable=False)
    owner_email  = Column(String(255), nullable=False)
    # Ordered list of SavedReport id strings.
    report_ids   = Column(JSONB, default=list)
    shared_with  = Column(JSONB, default=list)

    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
