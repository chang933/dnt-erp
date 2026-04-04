from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, time


class ReservationCreate(BaseModel):
    reservation_date: date = Field(..., description="예약일")
    reservation_time: Optional[time] = Field(None, description="예약 시간")
    guest_name: str = Field(..., min_length=1, max_length=100, description="예약자 성함")
    head_count: int = Field(1, ge=1, le=999, description="인원")
    memo: Optional[str] = Field(None, description="기타내용")


class ReservationUpdate(BaseModel):
    reservation_date: Optional[date] = None
    reservation_time: Optional[time] = None
    guest_name: Optional[str] = Field(None, min_length=1, max_length=100)
    head_count: Optional[int] = Field(None, ge=1, le=999)
    memo: Optional[str] = None


class Reservation(BaseModel):
    id: int
    store_id: int = 1
    reservation_date: date
    reservation_time: Optional[time] = None
    guest_name: str
    head_count: int
    memo: Optional[str] = None

    class Config:
        from_attributes = True
