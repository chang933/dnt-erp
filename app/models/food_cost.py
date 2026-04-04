from sqlalchemy import Column, Integer, String, Date, DateTime, Numeric, Text, ForeignKey
from app.db.base import Base
from datetime import datetime


class FoodCost(Base):
    __tablename__ = "erp_food_costs"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("erp_stores.id"), nullable=False, index=True, server_default="1")
    date = Column(Date, nullable=False, index=True)
    supplier = Column(String(50), nullable=False)          # G월드, CJ, 참다운, 쿠팡 등
    record_type = Column(String(20), nullable=False)       # 'usage' | 'payment'
    amount = Column(Numeric(12, 0), nullable=False)
    memo = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
