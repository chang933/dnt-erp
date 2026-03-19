from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


# 방문 기록 생성 요청 스키마
class VisitCreate(BaseModel):
    customer_id: int = Field(..., description="고객 ID")
    visit_date: datetime = Field(default_factory=datetime.now, description="방문일시", alias="date")
    memo: Optional[str] = Field(None, description="방문 메모")
    
    class Config:
        populate_by_name = True


# 방문 기록 응답 스키마
class Visit(BaseModel):
    id: int
    customer_id: int
    visit_date: datetime = Field(..., alias="date")
    memo: Optional[str]

    class Config:
        from_attributes = True
        populate_by_name = True


# 방문 기록 응답 (고객 정보 포함)
class VisitWithCustomer(Visit):
    customer_name: str
    customer_phone: Optional[str]

    class Config:
        from_attributes = True

