from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


# 고객 생성 요청 스키마
class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="고객 이름")
    phone: Optional[str] = Field(None, max_length=20, description="연락처")
    memo: Optional[str] = Field(None, description="메모")
    is_vip: bool = Field(False, description="VIP 여부")


# 고객 수정 요청 스키마
class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="고객 이름")
    phone: Optional[str] = Field(None, max_length=20, description="연락처")
    memo: Optional[str] = Field(None, description="메모")
    is_vip: Optional[bool] = Field(None, description="VIP 여부")
    is_blacklist: Optional[bool] = Field(None, description="블랙리스트 여부")
    blacklist_reason: Optional[str] = Field(None, description="블랙리스트 사유")


# 고객 응답 스키마
class Customer(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    memo: Optional[str]
    is_vip: bool
    is_blacklist: bool
    blacklist_reason: Optional[str]
    blacklist_date: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

