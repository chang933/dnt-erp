from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime

class Customer(Base):
    __tablename__ = "erp_customers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    phone = Column(String(20), index=True)
    memo = Column(Text, nullable=True)  # 메모
    is_vip = Column(Boolean, default=False, nullable=False)  # VIP 여부
    is_blacklist = Column(Boolean, default=False, nullable=False, index=True)  # 블랙리스트 여부
    blacklist_reason = Column(Text, nullable=True)  # 블랙리스트 사유
    blacklist_date = Column(DateTime, nullable=True)  # 블랙리스트 등록일
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    visits = relationship("Visit", back_populates="customer", cascade="all, delete-orphan")

