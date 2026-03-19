from pydantic import BaseModel, Field
from datetime import datetime
from decimal import Decimal
from typing import Optional


# 식자재 생성 요청 스키마
class IngredientCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="품목명")
    unit: str = Field(..., max_length=20, description="단위 (kg, L, 개 등)")
    unit_price: Decimal = Field(..., ge=0, description="단가")
    stock: Decimal = Field(0, ge=0, description="재고 (기본값: 0)")


# 식자재 수정 요청 스키마
class IngredientUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="품목명")
    unit: Optional[str] = Field(None, max_length=20, description="단위")
    unit_price: Optional[Decimal] = Field(None, ge=0, description="단가")
    stock: Optional[Decimal] = Field(None, ge=0, description="재고")


# 식자재 응답 스키마
class Ingredient(BaseModel):
    id: int
    name: str
    unit: str
    unit_price: Decimal
    stock: Decimal
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

