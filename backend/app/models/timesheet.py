# backend/app/models/timesheet.py
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Float, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class TimesheetEntry(Base):
    __tablename__ = "timesheet_entries"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_email  = Column(String(255), nullable=False)
    user_name   = Column(String(255))
    project_id  = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    entry_date  = Column(DateTime, nullable=False)
    # Whichever unit the user entered in — amount is stored as-is, converted to days (1 day
    # = 8 hours) only when rolling up into staffing/utilization numbers.
    unit        = Column(SAEnum('days', 'hours', name='timesheet_unit_enum'), nullable=False, default='days')
    amount      = Column(Float, nullable=False)
    description = Column(Text)

    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
