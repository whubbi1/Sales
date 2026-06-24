import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class ErrorLog(Base):
    __tablename__ = "error_logs"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_email = Column(String(255), default="unknown")
    page       = Column(String(500))
    level      = Column(SAEnum('ERROR', 'WARNING', 'INFO', name='log_level'), default='ERROR')
    message    = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
