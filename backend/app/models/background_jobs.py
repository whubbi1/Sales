import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class BackgroundJob(Base):
    __tablename__ = "background_jobs"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id          = Column(String(50), unique=True, nullable=False)  # e.g. JOB-001
    name            = Column(String(255), nullable=False)
    description     = Column(Text)
    job_type        = Column(String(20), default='lambda')  # lambda, ecs_scheduled
    script_url      = Column(String(500))  # link to script
    script_content  = Column(Text)  # script code
    status          = Column(String(20), default='active')  # active, stopped, error
    schedule        = Column(String(100))  # cron expression
    last_run_at     = Column(DateTime)
    last_run_status = Column(String(20))  # success, failed, running
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow)

class JobExecution(Base):
    __tablename__ = "job_executions"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id      = Column(String(50), nullable=False)
    status      = Column(String(20), nullable=False)  # success, failed, running
    started_at  = Column(DateTime, default=datetime.utcnow)
    ended_at    = Column(DateTime)
    duration_ms = Column(Integer)
    output      = Column(Text)
    error       = Column(Text)
    triggered_by = Column(String(100), default='schedule')

class BackupRecord(Base):
    __tablename__ = "backup_records"
    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application  = Column(String(100), nullable=False)
    backup_type  = Column(String(50))  # database, files, full
    status       = Column(String(20), default='unknown')  # success, failed, running, unknown
    backup_date  = Column(DateTime)
    size_mb      = Column(Integer)
    location     = Column(String(500))  # S3 path or description
    notes        = Column(Text)
    created_by   = Column(String(255))
    created_at   = Column(DateTime, default=datetime.utcnow)
