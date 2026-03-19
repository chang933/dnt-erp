from pydantic import BaseModel, Field
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from app.models.inventory_log import InventoryLogType


# 입출고 로그 생성 요청 스키마
class InventoryLogCreate(BaseModel):
    ingredient_id: int = Field(..., description="식자재 ID")
    log_type: InventoryLogType = Field(..., description="입고/출고")
    quantity: Decimal = Field(..., gt=0, description="수량")
    log_date: date = Field(default_factory=date.today, description="날짜", alias="date")
    memo: Optional[str] = Field(None, max_length=500, description="메모")
    
    class Config:
        populate_by_name = True


# 입출고 로그 응답 스키마
class InventoryLog(BaseModel):
    id: int
    ingredient_id: int
    log_type: InventoryLogType
    quantity: Decimal
    log_date: date = Field(..., alias="date")
    memo: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True


# 입출고 로그 응답 (식자재 정보 포함)
class InventoryLogWithIngredient(InventoryLog):
    ingredient_name: str
    ingredient_unit: str

    class Config:
        from_attributes = True

