from pydantic import BaseModel, Field
from typing import Optional
from datetime import date as date_type
from decimal import Decimal
from app.models.revenue_expense import RevenueExpenseType

class RevenueExpenseBase(BaseModel):
    date: date_type = Field(..., description="날짜")
    revenue_expense_type: RevenueExpenseType = Field(..., description="매출/지출 유형")
    amount: Decimal = Field(..., description="금액", ge=0)
    memo: Optional[str] = Field(None, description="메모")

class RevenueExpenseCreate(RevenueExpenseBase):
    pass

class RevenueExpenseUpdate(BaseModel):
    date: Optional[date_type] = Field(None, description="날짜")
    revenue_expense_type: Optional[RevenueExpenseType] = Field(None, description="매출/지출 유형")
    amount: Optional[Decimal] = Field(None, description="금액", ge=0)
    memo: Optional[str] = Field(None, description="메모")

class RevenueExpense(RevenueExpenseBase):
    id: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = False
