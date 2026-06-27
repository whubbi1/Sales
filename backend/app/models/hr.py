from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import uuid

class HRProfile(Base):
    """Base profile for all HR candidates (freelancer or internal recruit)"""
    __tablename__ = "hr_profiles"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_type = Column(String(20), nullable=False)  # freelancer, internal
    # Personal info
    first_name = Column(String(100))
    last_name = Column(String(100))
    email = Column(String(255))
    phone = Column(String(50))
    linkedin_url = Column(String(500))
    country = Column(String(50))
    language = Column(String(10))  # fr, pt, cs, ro, es
    # Professional
    current_title = Column(String(255))
    skills = Column(JSON)           # ["Python", "FastAPI", ...]
    years_experience = Column(Integer)
    # CV
    cv_sharepoint_url = Column(String(1000))
    cv_filename = Column(String(255))
    cv_extracted = Column(Boolean, default=False)
    # Status (for internal recruits)
    recruitment_status = Column(String(30), default="new")
    # FR/freelancer specific
    daily_rate = Column(Integer)        # TJM for freelancers
    availability_date = Column(DateTime)
    # Metadata
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    created_by = Column(String(255))
    projects = relationship("HRProject", back_populates="profile", cascade="all, delete-orphan")
    comments = relationship("HRComment", back_populates="profile", cascade="all, delete-orphan")

class HRProject(Base):
    """Projects from CV"""
    __tablename__ = "hr_projects"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("hr_profiles.id"))
    title = Column(String(255))
    company = Column(String(255))
    start_date = Column(String(20))
    end_date = Column(String(20))
    description = Column(Text)
    technologies = Column(JSON)
    profile = relationship("HRProfile", back_populates="projects")

class HRComment(Base):
    """Recruiter comments / exchanges"""
    __tablename__ = "hr_comments"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("hr_profiles.id"))
    author_email = Column(String(255))
    author_name = Column(String(255))
    content = Column(Text)
    comment_type = Column(String(20), default="note")  # note, call, email, interview
    created_at = Column(DateTime)
    profile = relationship("HRProfile", back_populates="comments")

class HRJobDescription(Base):
    """Job descriptions at WCOMPLY"""
    __tablename__ = "hr_job_descriptions"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    department = Column(String(100))
    location = Column(String(100))
    contract_type = Column(String(50))  # CDI, CDD, Freelance, Stage
    status = Column(String(20), default="open")  # open, closed, draft
    description = Column(Text)
    responsibilities = Column(JSON)
    requirements = Column(JSON)
    salary_min = Column(Integer)
    salary_max = Column(Integer)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

class HRProposal(Base):
    """Proposal letters sent to candidates"""
    __tablename__ = "hr_proposals"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("hr_profiles.id"))
    # Proposal details
    role = Column(String(255))
    responsibilities = Column(JSON)
    salary = Column(Integer)
    advantages = Column(JSON)   # benefits
    start_date = Column(String(50))
    country = Column(String(50))
    language = Column(String(10))
    # Status
    status = Column(String(20), default="draft")  # draft, sent, signed, rejected
    # DocuSign
    docusign_envelope_id = Column(String(255))
    docusign_status = Column(String(50))
    signed_at = Column(DateTime)
    # Onboarding
    onboarding_token = Column(String(100), unique=True)
    onboarding_sent_at = Column(DateTime)
    onboarding_completed_at = Column(DateTime)
    # Dates
    created_at = Column(DateTime)
    sent_at = Column(DateTime)

class HROnboardingDocument(Base):
    """Documents uploaded during onboarding"""
    __tablename__ = "hr_onboarding_documents"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proposal_id = Column(UUID(as_uuid=True), ForeignKey("hr_proposals.id"))
    document_type = Column(String(100))  # id_card, social_security, bank_details, etc.
    filename = Column(String(255))
    sharepoint_url = Column(String(1000))
    uploaded_at = Column(DateTime)
    # Personal info collected during onboarding
    personal_data = Column(JSON)  # {social_security, bank_account, personal_phone, ...}
