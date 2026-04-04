from sqlalchemy import Column, Integer, String, Date, DateTime, Text, Time, ForeignKey
from app.db.base import Base
from datetime import datetime


class Reservation(Base):
    __tablename__ = "erp_reservations"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("erp_stores.id"), nullable=False, index=True, server_default="1")
    reservation_date = Column(Date, nullable=False, index=True)
    reservation_time = Column(Time, nullable=True)
    guest_name = Column(String(100), nullable=False)
    head_count = Column(Integer, nullable=False, default=1)
    memo = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
