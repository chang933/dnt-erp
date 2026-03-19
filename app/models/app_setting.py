from sqlalchemy import Column, Integer, String, Text, DateTime
from app.db.base import Base
from datetime import datetime


class AppSetting(Base):
    __tablename__ = "erp_app_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
