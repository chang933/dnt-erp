"""
KDS 주문/주문아이템 모델 (도원반점 KDS)
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from app.db.base import Base
from datetime import datetime


class Order(Base):
    __tablename__ = "kds_orders"
    __table_args__ = (
        UniqueConstraint("store_id", "order_number", name="uq_kds_orders_store_order_number"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("erp_stores.id"), nullable=False, index=True, server_default="1")
    order_number = Column(Integer, index=True, nullable=False)  # 지점 내 주문번호 (#023 등)
    table_number = Column(Integer, nullable=True)  # 홀 테이블 번호
    order_type = Column(String(20), nullable=False, default="dine_in")  # dine_in | takeout | delivery
    status = Column(String(20), nullable=False, default="active")  # active | completed | cancelled
    total_amount = Column(Integer, nullable=False, default=0)  # 총 금액 (원)
    note = Column(Text, nullable=True)
    customer_phone = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "kds_order_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("kds_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    menu_id = Column(String(50), nullable=False, index=True)
    menu_name = Column(String(100), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Integer, nullable=False)
    total_price = Column(Integer, nullable=False)
    parts = Column(ARRAY(Text), nullable=False)  # ['면파트', '웍파트'] 등
    options = Column(Text, nullable=True)
    note = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # pending | cooking | ready | served
    part_status = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))  # {"면파트": "ready", "웍파트": "cooking"}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = relationship("Order", back_populates="items")
