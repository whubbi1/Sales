# backend/app/models/opportunity.py
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Float, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.contact import contact_opportunity

class Opportunity(Base):
    __tablename__ = "opportunities"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id          = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    # Partner isn't an ORM model (raw-SQL table, see partners.py) — plain column, FK enforced at the DB
    # level by the ALTER TABLE migration in main.py, not declared here to avoid mapper-resolution issues.
    partner_id          = Column(UUID(as_uuid=True), nullable=True)
    # Plain FK, no relationship() — Company already has its own `contacts`/`opportunities`
    # relationships to other tables; attached manually in the router (see _attach_contracting_party),
    # same trick used for `partner` above, to avoid a repeat of the AmbiguousForeignKeysError.
    contracting_party_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)

    deal_id             = Column(String(100))
    deal_name           = Column(String(500), nullable=False)
    project_name        = Column(String(500))
    deal_amount         = Column(Float)
    closing_date        = Column(DateTime)
    deal_status         = Column(SAEnum(
        'Presentation To Be Scheduled', 'Presentation Done', 'Proposition Ongoing',
        'Proposition Accepted', 'RFP Ongoing', 'Contract Ongoing', 'Contract Finalised',
        'PO Received', 'Contract Lost',
        name='deal_status_enum'
    ), default='Presentation To Be Scheduled')
    assigned_consultants = Column(JSONB, default=list)
    contract_start_date = Column(DateTime)
    contract_end_date   = Column(DateTime)
    project_status      = Column(SAEnum(
        'Daily Invoicing', 'Project', 'Software Licenses',
        name='project_status_enum'
    ))
    contracting_party   = Column(String(255))
    deal_type           = Column(SAEnum(
        'SAP', 'GRC', 'Smart Global Governance', 'SecurityBridge',
        'Onapsis', 'BowBridge', 'IBM OpenPages',
        name='deal_type_enum'
    ))
    notes               = Column(Text)
    assigned_to         = Column(String(255))
    assigned_to_email   = Column(String(255))
    sharepoint_site_url = Column(Text)

    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company  = relationship("Company", backref="opportunities", foreign_keys=[company_id])
    contacts = relationship("Contact", secondary=contact_opportunity, back_populates="opportunities")
