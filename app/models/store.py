from sqlalchemy import Column, Integer, String, Boolean, DateTime
from app.db.base import Base
from datetime import datetime


class Store(Base):
    __tablename__ = "erp_stores"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=True, index=True)  # 선택: 내부 코드
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
