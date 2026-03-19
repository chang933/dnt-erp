from sqlalchemy import Column, Integer, Date, DateTime, ForeignKey, Enum as SQLEnum, Numeric, String
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime
import enum

class InventoryLogType(str, enum.Enum):
    IN = "입고"
    OUT = "출고"

class InventoryLog(Base):
    __tablename__ = "erp_inventory_log"
    
    id = Column(Integer, primary_key=True, index=True)
    ingredient_id = Column(Integer, ForeignKey("erp_ingredients.id"), nullable=False, index=True)
    log_type = Column(SQLEnum(InventoryLogType, native_enum=False), nullable=False, name="type")  # 입고/출고
    quantity = Column(Numeric(10, 2), nullable=False)  # 수량
    date = Column(Date, nullable=False, index=True, default=datetime.utcnow().date)
    memo = Column(String(500), nullable=True)  # 메모
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    ingredient = relationship("Ingredient", back_populates="inventory_logs")

