from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class StoreBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: Optional[str] = Field(None, max_length=50)
    is_active: bool = True


class StoreCreate(StoreBase):
    pass


class StoreUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    code: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


class StoreOut(StoreBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
