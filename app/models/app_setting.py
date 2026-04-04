from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from app.db.base import Base
from datetime import datetime


class AppSetting(Base):
    __tablename__ = "erp_app_settings"
    __table_args__ = (
        UniqueConstraint("store_id", "key", name="uq_erp_app_settings_store_key"),
    )

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("erp_stores.id"), nullable=False, index=True, server_default="1")
    key = Column(String(100), nullable=False, index=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
