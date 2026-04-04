from sqlalchemy import Column, Integer, String, Boolean, DateTime
from app.db.base import Base
from datetime import datetime


class User(Base):
    __tablename__ = "erp_users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_admin = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
