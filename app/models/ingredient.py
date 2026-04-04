from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime

class Ingredient(Base):
    __tablename__ = "erp_ingredients"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("erp_stores.id"), nullable=False, index=True, server_default="1")
    name = Column(String(100), nullable=False, index=True)  # 품목명
    unit = Column(String(20), nullable=False)  # 단위 (kg, L, 개 등)
    unit_price = Column(Numeric(10, 2), nullable=False)  # 단가
    stock = Column(Numeric(10, 2), nullable=False, default=0)  # 재고
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    inventory_logs = relationship("InventoryLog", back_populates="ingredient", cascade="all, delete-orphan")

