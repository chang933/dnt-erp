from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date


class FoodCostCreate(BaseModel):
    date: date
    supplier: str = Field(..., min_length=1, max_length=50)
    record_type: str = Field(..., pattern="^(usage|payment)$")
    amount: int = Field(..., ge=1)
    memo: Optional[str] = None


class FoodCostUpdate(BaseModel):
    amount: Optional[int] = Field(None, ge=1)
    memo: Optional[str] = None


class FoodCost(BaseModel):
    id: int
    store_id: int = 1
    date: date
    supplier: str
    record_type: str
    amount: int
    memo: Optional[str] = None

    class Config:
        from_attributes = True
