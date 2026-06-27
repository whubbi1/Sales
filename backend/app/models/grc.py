from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import uuid

class GRCFramework(Base):
    __tablename__ = "grc_frameworks"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)          # ISO 27001, GDPR, SOC2, NIS2
    description = Column(Text)
    category = Column(String(50))                        # security, privacy, financial
    version = Column(String(20))
    active = Column(Boolean, default=True)
    created_at = Column(DateTime)
    controls = relationship("GRCControl", back_populates="framework", cascade="all, delete-orphan")

class GRCControl(Base):
    __tablename__ = "grc_controls"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    framework_id = Column(UUID(as_uuid=True), ForeignKey("grc_frameworks.id"))
    control_id = Column(String(50))                      # e.g. A.5.1, Art.5, CC6.1
    title = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    status = Column(String(20), default="not_started")   # not_started, in_progress, compliant, not_applicable
    evidence = Column(Text)
    owner_email = Column(String(255))
    owner_name = Column(String(255))
    due_date = Column(DateTime)
    updated_at = Column(DateTime)
    framework = relationship("GRCFramework", back_populates="controls")

class GRCRisk(Base):
    __tablename__ = "grc_risks"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))                       # operational, security, compliance, financial
    probability = Column(Integer)                        # 1-5
    impact = Column(Integer)                             # 1-5
    status = Column(String(20), default="open")          # open, mitigated, accepted, closed
    mitigation = Column(Text)
    owner_email = Column(String(255))
    owner_name = Column(String(255))
    due_date = Column(DateTime)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

class GRCAudit(Base):
    __tablename__ = "grc_audits"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    framework_id = Column(UUID(as_uuid=True), nullable=True)
    audit_type = Column(String(50))                      # internal, external, regulatory
    status = Column(String(20), default="planned")       # planned, in_progress, completed, cancelled
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    auditor_name = Column(String(255))
    scope = Column(Text)
    findings_count = Column(Integer, default=0)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    findings = relationship("GRCFinding", back_populates="audit", cascade="all, delete-orphan")

class GRCFinding(Base):
    __tablename__ = "grc_findings"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    audit_id = Column(UUID(as_uuid=True), ForeignKey("grc_audits.id"))
    title = Column(String(255), nullable=False)
    description = Column(Text)
    severity = Column(String(20))                        # critical, high, medium, low
    status = Column(String(20), default="open")          # open, in_progress, resolved
    corrective_action = Column(Text)
    owner_email = Column(String(255))
    due_date = Column(DateTime)
    created_at = Column(DateTime)
    audit = relationship("GRCAudit", back_populates="findings")
