from sqlalchemy import Column, Integer, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime

class Visit(Base):
    __tablename__ = "erp_visits"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("erp_stores.id"), nullable=False, index=True, server_default="1")
    customer_id = Column(Integer, ForeignKey("erp_customers.id"), nullable=False, index=True)
    date = Column(DateTime, nullable=False, index=True, default=datetime.utcnow)
    memo = Column(Text, nullable=True)  # 방문 메모
    
    # Relationships
    customer = relationship("Customer", back_populates="visits")

