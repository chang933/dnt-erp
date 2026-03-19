"""KDS 주문/주문아이템 스키마"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime


class OrderItemBase(BaseModel):
    menu_id: str
    menu_name: str
    quantity: int = 1
    unit_price: int
    total_price: int
    parts: List[str]
    options: Optional[str] = None
    note: Optional[str] = None


class OrderItemCreate(OrderItemBase):
    status: str = "pending"
    part_status: Dict[str, str] = Field(default_factory=dict)


class OrderItemUpdate(BaseModel):
    status: Optional[str] = None
    part_status: Optional[Dict[str, str]] = None


class OrderItem(OrderItemBase):
    id: int
    order_id: int
    status: str
    part_status: Dict[str, str]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OrderBase(BaseModel):
    table_number: Optional[int] = None
    order_type: str = "dine_in"
    status: str = "active"
    total_amount: int = 0
    note: Optional[str] = None
    customer_phone: Optional[str] = None


class OrderCreate(OrderBase):
    items: List[OrderItemCreate]


class OrderUpdate(BaseModel):
    table_number: Optional[int] = None
    order_type: Optional[str] = None
    status: Optional[str] = None
    total_amount: Optional[int] = None
    note: Optional[str] = None
    customer_phone: Optional[str] = None


class Order(OrderBase):
    id: int
    order_number: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    items: List[OrderItem] = []

    class Config:
        from_attributes = True
